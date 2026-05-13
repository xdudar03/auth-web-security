#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"

die() {
  printf '\nDocker startup cannot continue:\n%s\n\n' "$1" >&2
  exit 1
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

strip_wrapping_quotes() {
  local value="$1"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

read_env_value() {
  local name="$1"
  local file="$2"
  local line key value

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="$(trim "$line")"

    if [ -z "$line" ] || [[ "$line" == \#* ]] || [[ "$line" != *=* ]]; then
      continue
    fi

    key="$(trim "${line%%=*}")"
    key="${key#export }"

    if [ "$key" = "$name" ]; then
      value="$(trim "${line#*=}")"
      strip_wrapping_quotes "$value"
      return 0
    fi
  done < "$file"

  return 1
}

is_placeholder_secret() {
  local value="$1"
  [ -z "$value" ] || [ "$value" = "change-me" ] || [[ "$value" == replace-with* ]]
}

validate_server_env() {
  [ -f "$SERVER_ENV_FILE" ] || die "Missing server env file: $SERVER_ENV_FILE

Create it from the template first:
  cp server/.env.example server/.env
  cp server/.env.prod.example server/.env.prod"

  local invalid_names=()
  local name value

  for name in SESSION_SECRET JWT_SECRET; do
    value="$(read_env_value "$name" "$SERVER_ENV_FILE" || true)"
    if is_placeholder_secret "$value"; then
      invalid_names+=("$name")
    fi
  done

  if [ "${#invalid_names[@]}" -gt 0 ]; then
    {
      printf 'The server Docker image runs with NODE_ENV=production, so placeholder secrets are rejected.\n'
      printf 'Update %s with strong random values for:\n' "$SERVER_ENV_FILE"
      printf '  - %s\n' "${invalid_names[@]}"
      printf '\nGenerate values with:\n'
      printf '  openssl rand -base64 32\n'
    } >&2
    exit 1
  fi
}

show_compose_diagnostics() {
  local status="$1"

  {
    printf '\nDocker Compose failed with exit code %s.\n' "$status"
    printf 'Current service status:\n'
  } >&2

  docker compose ps >&2 || true

  {
    printf '\nRecent service logs:\n'
  } >&2

  docker compose logs --no-color --tail=80 prod-assets-init model server client >&2 || true
}

run_compose_command() {
  local label="$1"
  shift

  set +e
  "$@"
  local status=$?
  set -e

  if [ "$status" -ne 0 ]; then
    printf '\n%s failed.\n' "$label" >&2
    show_compose_diagnostics "$status"
    exit "$status"
  fi
}

case "$MODE" in
  dev)
    export SERVER_ENV_FILE="./server/.env"
    export APP_MODE="dev"
    ;;
  prod)
    export SERVER_ENV_FILE="./server/.env.prod"
    export APP_MODE="prod"
    ;;
  *)
    die "Unknown mode: $MODE

Use:
  ./run-docker.sh
  ./run-docker.sh prod"
    ;;
esac

validate_server_env

if [ "$MODE" = "prod" ]; then
  # Force refresh of prebuilt DB/model assets before app startup
  run_compose_command "Production asset bootstrap" docker compose run --rm prod-assets-init
fi

# 1) Build and start containers
run_compose_command "Docker Compose startup" docker compose up --build -d

# 2) Seed database in dev mode only
if [ "$MODE" = "dev" ]; then
  run_compose_command "Database seeding" docker compose exec -T server bash -lc "/app/seedDbGit.sh"
fi

# 3) Follow logs
docker compose logs -f
