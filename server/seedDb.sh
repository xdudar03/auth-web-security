#!/usr/bin/env bash
set -euo pipefail

rm -f users.db

npx tsx src/seed/addRoles.ts
npx tsx src/seed/addUsers.ts
npx tsx src/seed/addShops.ts
npx tsx src/seed/addTestUsersWithPrivacy.ts
npx tsx src/seed/addItems.ts
npx tsx src/seed/addTransactions.ts

npm run dev