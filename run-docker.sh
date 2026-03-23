#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"

if [ "$MODE" = "prod" ]; then
  export SERVER_ENV_FILE="./server/.env.prod"
  export APP_MODE="prod"
else
  export SERVER_ENV_FILE="./server/.env"
  export APP_MODE="dev"
fi

if [ "$MODE" = "prod" ]; then
  # Force refresh of prebuilt DB/model assets before app startup
  docker compose run --rm prod-assets-init
fi

# 1) Build and start containers
docker compose up --build -d

# 2) Seed database in dev mode only
if [ "$MODE" = "dev" ]; then
  docker compose exec -T server bash -lc "/app/seedDbGit.sh"
fi

# 3) Follow logs
docker compose logs -f
