#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/config/renovate/docker-compose.yml"
ENV_FILE="$ROOT_DIR/config/renovate/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >&2 <<'EOF'
Missing config/renovate/.env

Setup:
  cp config/renovate/renovate.env.example config/renovate/.env
  # fill RENOVATE_TOKEN and optional GITHUB_COM_TOKEN
EOF
  exit 1
fi

REPO_SLUG="${RENOVATE_REPOSITORY:-skyasu2/openmanager-ai}"
DRY_RUN_MODE=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN_MODE="--dry-run=full"
      shift
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

CMD=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm renovate)
if [[ -n "$DRY_RUN_MODE" ]]; then
  CMD+=("$DRY_RUN_MODE")
fi
CMD+=("$REPO_SLUG")
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  CMD+=("${EXTRA_ARGS[@]}")
fi

echo "Running Renovate for $REPO_SLUG"
"${CMD[@]}"
