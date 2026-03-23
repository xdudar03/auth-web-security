#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"
PREBUILT_MODEL_FILE="./model/prebuilt/trained/arcface_yale_anony_v1_label_encoder.joblib"

if [ "$MODE" = "prod" ]; then
  export SERVER_ENV_FILE="./server/.env.prod"
  export APP_MODE="prod"
else
  export SERVER_ENV_FILE="./server/.env"
  export APP_MODE="dev"
fi

if [ "$MODE" = "prod" ]; then
  # Force refresh of prebuilt DB/model assets before app startup
  if [ -z "${MODEL_ARTIFACT_IMAGE:-}" ] && [ ! -f "$PREBUILT_MODEL_FILE" ]; then
    echo "Prod mode requires a prebuilt model."
    echo "Set MODEL_ARTIFACT_IMAGE to an artifact image, or provide $PREBUILT_MODEL_FILE locally."
    exit 1
  fi
  docker compose run --rm model-artifacts-init
  docker compose run --rm prod-assets-init
fi

# 1) Build and start containers
docker compose up --build -d

# 2) Seed database in dev mode only
if [ "$MODE" != "prod" ]; then
  docker compose exec -T server bash -lc "/app/seedDbGit.sh"
else
  echo "Prod mode: prebuilt model loaded by docker-compose bootstrap."
fi

# 3) Follow logs
docker compose logs -f
