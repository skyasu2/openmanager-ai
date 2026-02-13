#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export CODEX_HOME="$REPO_ROOT/.codex"

if [ ! -f "$CODEX_HOME/config.toml" ]; then
  echo "ERROR: $CODEX_HOME/config.toml not found"
  echo "Hint: initialize project Codex config first."
  exit 2
fi

exec codex "$@"
