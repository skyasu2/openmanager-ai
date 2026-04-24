#!/usr/bin/env bash
set -euo pipefail

# Keep MCP client config free of inline credentials. The vercel-mcp package
# currently reads VERCEL_API_KEY from a command argument, so this wrapper loads
# the local project env at process start and constructs that argument here.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

read_vercel_api_key() {
  local line value
  if [ ! -f "$ENV_FILE" ]; then
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      '' | '#'*)
        continue
        ;;
      export\ VERCEL_API_KEY=* | VERCEL_API_KEY=*)
        value="${line#export }"
        value="${value#VERCEL_API_KEY=}"
        if [[ "$value" == \"*\" && "$value" == *\" ]]; then
          value="${value:1:${#value}-2}"
        elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
          value="${value:1:${#value}-2}"
        fi
        VERCEL_API_KEY="$value"
        export VERCEL_API_KEY
        return 0
        ;;
    esac
  done < "$ENV_FILE"
}

if [ -f "$ENV_FILE" ]; then
  read_vercel_api_key
fi

if [ -z "${VERCEL_API_KEY:-}" ]; then
  echo "Error: VERCEL_API_KEY is required for vercel-mcp" >&2
  exit 1
fi

MCP_CACHE_ROOT="${OPENMANAGER_MCP_CACHE_ROOT:-${HOME:-}/.mcp-servers/openmanager-ai-mcp}"
LOCAL_BIN="$MCP_CACHE_ROOT/node_modules/vercel-mcp/build/index.js"

if [ -f "$LOCAL_BIN" ]; then
  exec node "$LOCAL_BIN" "VERCEL_API_KEY=${VERCEL_API_KEY}"
fi

exec npx -y vercel-mcp@0.0.7 "VERCEL_API_KEY=${VERCEL_API_KEY}"
