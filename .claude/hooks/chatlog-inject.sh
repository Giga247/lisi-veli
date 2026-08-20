#!/usr/bin/env bash
# SessionStart hook — ახალ სესიას აწვდის ჩატების ინდექსს (ზედა დონე).
# დეტალებში ჩასვლა Claude-მა საჭიროებისამებრ თვითონ უნდა გადაწყვიტოს.
set -uo pipefail

[[ -n "${CHATLOG_RUNNING:-}" ]] && exit 0

INPUT="$(cat)"
PROJECT_DIR="$(printf '%s' "$INPUT" | jq -r '.cwd // empty')"
[[ -z "$PROJECT_DIR" ]] && PROJECT_DIR="$PWD"

INDEX="$PROJECT_DIR/docs/chat-logs/INDEX.md"
[[ -f "$INDEX" ]] || exit 0

CTX="## წინა ჩატების ისტორია (ზედა დონე)

ამ პროექტში ყოველი სესია ლოგდება. ქვემოთ ინდექსია — თითო წინა ჩატი ერთი სტრიქონი.

$(cat "$INDEX")

**როგორ გამოიყენო:** ეს ინდექსი ზედა დონეა. თუ რომელიმე წინა სესიის დეტალი
დაგჭირდა (გადაწყვეტილების მიზეზი, ტექნიკური სპეციფიკა, ღია საკითხები),
წაიკითხე შესაბამისი ფაილი: \`docs/chat-logs/<ფაილის-სახელი>\`.
წინასწარ ყველა ფაილს ნუ წაიკითხავ — მხოლოდ ის, რაც ამოცანას ეხება."

jq -n --arg ctx "$CTX" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
