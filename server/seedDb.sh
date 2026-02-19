#!/usr/bin/env bash
set -euo pipefail
# if SQLITE_DB_PATH is not set, use ./users.db
if [ -z "${SQLITE_DB_PATH:-}" ]; then
  SQLITE_DB_PATH="./data/users.db"
fi
rm -f $SQLITE_DB_PATH

npx tsx src/seed/addRoles.ts
npx tsx src/seed/addUsers.ts
npx tsx src/seed/addShops.ts
npx tsx src/seed/addTestUsersWithPrivacy.ts
npx tsx src/seed/addItems.ts
npx tsx src/seed/addTransactions.ts
npx tsx src/seed/addEmbeddings.ts
npx tsx src/seed/addCustomers.ts

curl -X POST "http://127.0.0.1:5000/initial_training" -H "Content-Type: application/json"