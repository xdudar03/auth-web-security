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
  docker compose run --rm prod-assets-init
fi

# 1) Build and start containers
docker compose up --build -d

# 2) Seed database in dev mode only
if [ "$MODE" != "prod" ]; then
  docker compose exec -T server bash -lc "/app/seedDbGit.sh"
else
  if [ -f "$PREBUILT_MODEL_FILE" ]; then
    echo "Prod mode: prebuilt DB/model assets loaded by docker-compose."
  else
    echo "Prod mode: no prebuilt model artifacts found; triggering initial model training from seeded DB."
    docker compose exec -T server bash -lc '
      set -e
      MODEL_INIT_TRAINING_URL="${MODEL_INIT_TRAINING_URL:-${MODEL_BASE_URL%/}/initial_training}"

      training_response_file="$(mktemp)"
      training_status_code="$(
        curl --silent --show-error \
          -o "$training_response_file" \
          -w "%{http_code}" \
          -X POST "$MODEL_INIT_TRAINING_URL" \
          -H "Content-Type: application/json"
      )"
      training_body="$(<"$training_response_file")"
      rm -f "$training_response_file"

      if [ "$training_status_code" = "400" ]; then
        echo "Initial training skipped: $training_body"
      elif [ "$training_status_code" -lt "200" ] || [ "$training_status_code" -ge "300" ]; then
        echo "Initial training failed (HTTP $training_status_code): $training_body"
        exit 1
      else
        echo "Initial training scheduled: $training_body"
      fi
    '
  fi
fi

# 3) Follow logs
docker compose logs -f
