#!/usr/bin/env bash
set -euo pipefail
# if SQLITE_DB_PATH is not set, use ./users.db
if [ -z "${SQLITE_DB_PATH:-}" ]; then
  SQLITE_DB_PATH="./data/users.db"
fi

is_docker_runtime() {
  [ -f "/.dockerenv" ] || grep -qaE "(docker|containerd|kubepods)" /proc/1/cgroup 2>/dev/null
}

MODE="${1:-auto}"
if [ "$MODE" = "auto" ]; then
  if is_docker_runtime; then
    MODE="docker"
  else
    MODE="local"
  fi
fi

# Keep explicit env override highest priority.
if [ -n "${MODEL_BASE_URL:-}" ]; then
  RESOLVED_MODEL_BASE_URL="${MODEL_BASE_URL%/}"
elif [ "$MODE" = "docker" ]; then
  RESOLVED_MODEL_BASE_URL="http://model:5000"
elif [ "$MODE" = "local" ] || [ "$MODE" = "localhost" ]; then
  RESOLVED_MODEL_BASE_URL="http://localhost:5000"
else
  echo "Invalid MODE: $MODE (use: auto|docker|local|localhost)"
  exit 1
fi
MODEL_BASE_URL="$RESOLVED_MODEL_BASE_URL"
MODEL_INIT_TRAINING_URL="${MODEL_BASE_URL%/}/initial_training"

echo "Seeding mode: $MODE"
echo "Using MODEL_BASE_URL: $MODEL_BASE_URL"

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