#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="$ROOT_DIR/renovate.json"
RENOVATE_IMAGE="${RENOVATE_IMAGE:-ghcr.io/renovatebot/renovate:latest}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing renovate config: $CONFIG_FILE" >&2
  exit 1
fi

node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')); console.log('renovate.json syntax ok')" "$CONFIG_FILE" >/dev/null

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker run --rm \
    -v "$ROOT_DIR:/work" \
    -w /work \
    "$RENOVATE_IMAGE" \
    renovate-config-validator --strict renovate.json
  exit 0
fi

if command -v renovate-config-validator >/dev/null 2>&1; then
  renovate-config-validator --strict "$CONFIG_FILE"
  exit 0
fi

echo "No Renovate validator runtime available. Install Docker or renovate-config-validator." >&2
exit 1
