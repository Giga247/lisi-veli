#!/usr/bin/env bash
# ჩატის ლოგის ჩამწერი — SessionEnd / PreCompact hook-ებიდან ეშვება.
#
# stdin-ზე იღებს hook-ის JSON-ს (session_id, transcript_path, cwd),
# ტრანსკრიპტიდან ამოიღებს დიალოგს, `claude -p`-ით ააგებს ქართულ შეჯამებას
# და ჩაწერს docs/chat-logs/<თარიღი>-<sessid>.md ფაილში, შემდეგ კი
# თავიდან ააგებს docs/chat-logs/INDEX.md-ს ყველა ლოგის frontmatter-იდან.
#
# რეკურსიის დაცვა: ჩვენივე გამოძახებული `claude -p` ისევ ამ hook-ს რომ არ
# გაუშვას, CHATLOG_RUNNING ცვლადს ვამოწმებთ.

set -uo pipefail

[[ -n "${CHATLOG_RUNNING:-}" ]] && exit 0

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT="$(cat)"

SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // empty')"
TRANSCRIPT="$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')"
PROJECT_DIR="$(printf '%s' "$INPUT" | jq -r '.cwd // empty')"
EVENT="$(printf '%s' "$INPUT" | jq -r '.hook_event_name // "manual"')"

# ხელით გაშვებისთვის: chatlog-write.sh <transcript.jsonl> <project_dir>
[[ -z "$TRANSCRIPT" && $# -ge 1 ]] && TRANSCRIPT="$1"
[[ -z "$PROJECT_DIR" && $# -ge 2 ]] && PROJECT_DIR="$2"
[[ -z "$SESSION_ID" ]] && SESSION_ID="$(basename "${TRANSCRIPT%.jsonl}")"

# --- 0. თვით-დეტაჩი --------------------------------------------------------
# SessionEnd-ზე Claude Code სესიას ხურავს; შემაჯამებელს ~40 წამი სჭირდება.
# ამიტომ სკრიპტი თავს ფონურ, მშობელს გადარჩენილ პროცესად იმეორებს.
if [[ -z "${CHATLOG_DETACHED:-}" ]]; then
  STASH="$(mktemp)"
  printf '%s' "$INPUT" > "$STASH"
  LOGFILE="${TMPDIR:-/tmp}/chatlog-hook.log"
  nohup env CHATLOG_DETACHED=1 CHATLOG_STASH="$STASH" \
    "${BASH_SOURCE[0]}" >> "$LOGFILE" 2>&1 < "$STASH" &
  disown 2>/dev/null || true
  exit 0
fi
[[ -n "${CHATLOG_STASH:-}" ]] && rm -f "$CHATLOG_STASH"

[[ -f "$TRANSCRIPT" ]] || { echo "chatlog: ტრანსკრიპტი ვერ მოიძებნა: $TRANSCRIPT" >&2; exit 0; }
[[ -d "$PROJECT_DIR" ]] || { echo "chatlog: პროექტის საქაღალდე ვერ მოიძებნა" >&2; exit 0; }

LOG_DIR="$PROJECT_DIR/docs/chat-logs"
mkdir -p "$LOG_DIR"

SHORT_ID="${SESSION_ID:0:8}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# --- 1. დიალოგის ამოღება ---------------------------------------------------
jq -r -f "$HOOK_DIR/chatlog-extract.jq" "$TRANSCRIPT" > "$WORK/dialog.md" 2>/dev/null

# ძალიან მოკლე სესია (მაგ. მხოლოდ მისალმება) ლოგს არ იმსახურებს
if [[ "$(wc -c < "$WORK/dialog.md")" -lt 400 ]]; then
  echo "chatlog: სესია ძალიან მოკლეა, ლოგი გამოტოვებულია" >&2
  exit 0
fi

# ძალიან გრძელი დიალოგი — ვჭრით, რომ შემაჯამებელს კონტექსტი არ გადაევსოს
MAX_BYTES=400000
if [[ "$(wc -c < "$WORK/dialog.md")" -gt "$MAX_BYTES" ]]; then
  { head -c 150000 "$WORK/dialog.md"
    printf '\n\n[... შუა ნაწილი შემოკლებულია ...]\n\n'
    tail -c 250000 "$WORK/dialog.md"
  } > "$WORK/dialog.trim.md"
  mv "$WORK/dialog.trim.md" "$WORK/dialog.md"
fi

AI_TITLE="$(jq -r 'select(.type=="ai-title") | .aiTitle' "$TRANSCRIPT" 2>/dev/null | tail -1)"
[[ -z "$AI_TITLE" || "$AI_TITLE" == "null" ]] && AI_TITLE="უსათაურო სესია"

# სესიის თარიღი — არსებული ლოგის სახელიდან, თუ უკვე გვაქვს (PreCompact-ის მერე
# SessionEnd იმავე ფაილს უნდა გადააწეროს, ახალი რომ არ გაჩნდეს)
EXISTING="$(find "$LOG_DIR" -maxdepth 1 -name "*-$SHORT_ID.md" -print -quit 2>/dev/null)"
if [[ -n "$EXISTING" ]]; then
  OUT="$EXISTING"
  DATE="$(basename "$OUT" | cut -d- -f1-3)"
else
  DATE="$(date +%Y-%m-%d)"
  OUT="$LOG_DIR/$DATE-$SHORT_ID.md"
fi

# --- 2. შეჯამების აგება `claude -p`-ით -------------------------------------
cat > "$WORK/prompt.md" <<PROMPTEOF
შენ ხარ პროექტის მდივანი. ქვემოთ მოცემულია Claude Code-ის ერთი სესიის სრული
დიალოგი. დაწერე ამ სესიის ლოგი **ქართულად**.

მკაცრი წესები:
- პასუხში დააბრუნე **მხოლოდ markdown ფაილის შიგთავსი**, სხვა არაფერი.
- არ დაიწყო "აი, ლოგი" ტიპის წინადადებით, არ დაურთო ბოლოში კომენტარი.
- ფაქტები აიღე მხოლოდ დიალოგიდან. არაფერი გამოიგონო. თუ რამე არ ვიცით, დაწერე "—".
- \`summary\` ველი ერთი წინადადებაა, მაქსიმუმ 25 სიტყვა, ინდექსში გამოსაჩენად.

ფორმატი ზუსტად ასეთი:

---
title: <სესიის თემა, 3-7 სიტყვა>
date: $DATE
session: $SHORT_ID
summary: <ერთი წინადადება — რა გაკეთდა და რა გადაწყდა>
---

# <title-ის იგივე ტექსტი>

**თარიღი:** $DATE · **სესია:** \`$SHORT_ID\`

## რა იყო მიზანი
<1-3 წინადადება: რა თხოვა მომხმარებელმა>

## მიღებული გადაწყვეტილებები
<markdown ცხრილი: | # | საკითხი | გადაწყვეტილება | — მხოლოდ ნამდვილად გადაწყვეტილი
საკითხები. თუ არცერთი არ არის, დაწერე "ამ სესიაზე გადაწყვეტილება არ მიღებულა.">

## ტექნიკური დეტალები
<რაც შემდეგ სესიას დასჭირდება: არქიტექტურა, ფაილების სტრუქტურა, ბრძანებები,
რიცხვები, სახელები. bullet-ებით. თუ არაფერია — გამოტოვე სექცია.>

## შეცვლილი ფაილები
<bullet-ები: \`გზა\` — რა შეიცვალა. თუ არაფერი შეცვლილა, დაწერე "ფაილები არ შეცვლილა.">

## ღია საკითხები და შემდეგი ნაბიჯები
<checkbox სია: - [ ] ... თუ არაფერია, დაწერე "ღია საკითხი არ დარჩა.">

აი დიალოგი:

---

PROMPTEOF
cat "$WORK/dialog.md" >> "$WORK/prompt.md"

# cwd = დროებითი საქაღალდე, რომ headless გაშვებამ პროექტის hook-ები არ ჩატვირთოს
if ! CHATLOG_RUNNING=1 "$(command -v claude)" -p \
      --model sonnet \
      --allowed-tools "" \
      < "$WORK/prompt.md" > "$WORK/summary.md" 2> "$WORK/err.txt"; then
  echo "chatlog: შემაჯამებელი ვერ გაეშვა: $(tail -3 "$WORK/err.txt")" >&2
  exit 0
fi

if [[ ! -s "$WORK/summary.md" ]] || ! head -1 "$WORK/summary.md" | grep -q '^---'; then
  echo "chatlog: შემაჯამებლის პასუხი მოულოდნელი ფორმატისაა, ლოგი არ ჩაწერილა" >&2
  exit 0
fi

mv "$WORK/summary.md" "$OUT"
echo "chatlog: ჩაიწერა $OUT ($EVENT)" >&2

# --- 3. INDEX.md-ის ხელახლა აგება ------------------------------------------
"$HOOK_DIR/chatlog-index.sh" "$PROJECT_DIR"
