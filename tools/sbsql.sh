#!/bin/sh
# SQL-ის გაშვება Supabase-ის Management API-ით.
#   tools/sbsql.sh ფაილი.sql        — ფაილის გაშვება
#   echo "select 1" | tools/sbsql.sh — stdin-იდან
# ტოკენი .env.local-იდან იკითხება და არასოდეს იბეჭდება.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
. "$root/.env.local"
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || { echo "SUPABASE_ACCESS_TOKEN ცარიელია" >&2; exit 1; }
[ -n "${SUPABASE_PROJECT_REF:-}" ]  || { echo "SUPABASE_PROJECT_REF ცარიელია"  >&2; exit 1; }

sql=$(cat "${1:--}")
body=$(SQL="$sql" python3 -c 'import json,os;print(json.dumps({"query":os.environ["SQL"]}))')

out=$(printf '%s' "$body" | curl -sS -X POST \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" --data-binary @-)

printf '%s' "$out" | python3 -c '
import json,sys
raw=sys.stdin.read()
try: d=json.loads(raw)
except Exception: print(raw); sys.exit(1)
if isinstance(d,dict) and ("message" in d or "error" in d):
    print("შეცდომა:", d.get("message") or d.get("error"), file=sys.stderr); sys.exit(1)
print(json.dumps(d, ensure_ascii=False, indent=2) if d else "OK")
'
