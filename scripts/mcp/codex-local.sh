#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_ENV_RESOLVER="$REPO_ROOT/scripts/mcp/resolve-runtime-env.sh"

if [ ! -f "$RUNTIME_ENV_RESOLVER" ]; then
  echo "ERROR: $RUNTIME_ENV_RESOLVER not found"
  exit 2
fi

# shellcheck source=/dev/null
source "$RUNTIME_ENV_RESOLVER"

if [ ! -f "$CODEX_HOME/config.toml" ]; then
  echo "ERROR: $CODEX_HOME/config.toml not found"
  echo "Hint: set OPENMANAGER_CODEX_HOME_MODE=project or create $HOME/.codex/config.toml"
  exit 2
fi

exec codex "$@"
