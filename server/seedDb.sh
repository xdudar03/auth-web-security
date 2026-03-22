#!/usr/bin/env bash
set -euo pipefail
# if SQLITE_DB_PATH is not set, use ./users.db
if [ -z "${SQLITE_DB_PATH:-}" ]; then
  SQLITE_DB_PATH="./data/users.db"
fi
MODEL_BASE_URL="${MODEL_BASE_URL:-http://model:5000}"
MODEL_INIT_TRAINING_URL="${MODEL_INIT_TRAINING_URL:-${MODEL_BASE_URL%/}/initial_training}"

rm -f "$SQLITE_DB_PATH"

npx tsx src/seed/addRoles.ts
npx tsx src/seed/addUsers.ts
npx tsx src/seed/addShops.ts
npx tsx src/seed/addTestUsersWithPrivacy.ts
npx tsx src/seed/addItems.ts
npx tsx src/seed/addTransactions.ts
npx tsx src/seed/addEmbeddings.ts

training_response_file="$(mktemp)"
training_status_code="$(
  curl --silent --show-error \
    -o "$training_response_file" \
    -w "%{http_code}" \
    -X POST "$MODEL_INIT_TRAINING_URL" \
    -H "Content-Type: application/json"
)"
training_body="$(cat "$training_response_file")"
rm -f "$training_response_file"

if [ "$training_status_code" = "400" ]; then
  echo "Initial training skipped: $training_body"
elif [ "$training_status_code" -lt "200" ] || [ "$training_status_code" -ge "300" ]; then
  echo "Initial training failed (HTTP $training_status_code): $training_body"
  exit 1
else
  echo "Initial training started: $training_body"
fi