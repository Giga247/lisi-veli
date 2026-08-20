#!/usr/bin/env bash
# ააგებს docs/chat-logs/INDEX.md-ს ყველა ლოგის frontmatter-იდან.
# ინდექსი = ზედა დონე. თითო სესია ერთი სტრიქონი.
set -uo pipefail

PROJECT_DIR="${1:?გამოყენება: chatlog-index.sh <project_dir>}"
LOG_DIR="$PROJECT_DIR/docs/chat-logs"
INDEX="$LOG_DIR/INDEX.md"
[[ -d "$LOG_DIR" ]] || exit 0

# frontmatter-იდან ერთი ველის ამოღება
fm() { sed -n "/^---$/,/^---$/p" "$1" | sed -n "s/^$2: *//p" | head -1; }

TMP="$(mktemp)"
{
  echo "# ჩატების ინდექსი"
  echo
  echo "თითო სესია — ერთი სტრიქონი. დეტალები შესაბამის ფაილშია."
  echo "**ბოლო განახლება:** $(date '+%Y-%m-%d %H:%M')"
  echo
  echo "| თარიღი | თემა | რა გაკეთდა | დეტალები |"
  echo "|---|---|---|---|"
} > "$TMP"

# ახლები ზემოთ
find "$LOG_DIR" -maxdepth 1 -name '2*.md' | sort -r | while read -r f; do
  base="$(basename "$f")"
  d="$(fm "$f" date)";     [[ -z "$d" ]] && d="${base:0:10}"
  t="$(fm "$f" title)";    [[ -z "$t" ]] && t="${base%.md}"
  s="$(fm "$f" summary)";  [[ -z "$s" ]] && s="—"
  # markdown ცხრილს | არ უყვარს
  t="${t//|//}"; s="${s//|//}"
  printf '| %s | %s | %s | [%s](%s) |\n' "$d" "$t" "$s" "$base" "$base" >> "$TMP"
done

if [[ "$(grep -c '^| 2' "$TMP")" -eq 0 ]]; then
  echo "| — | ლოგი ჯერ არ არის | — | — |" >> "$TMP"
fi

mv "$TMP" "$INDEX"
echo "chatlog: INDEX.md განახლდა" >&2
