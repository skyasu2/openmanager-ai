#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  bash scripts/mcp/start-node-mcp-package.sh <package> <version> <bin-path> [args...]

Description:
  Start an npm MCP server package through a local user-scope install when
  available, falling back to a pinned npx invocation. This preserves the
  vendor stdio command model while avoiding slow npx startup in MCP clients
  that use short connection checks.
EOF
}

if [ "$#" -lt 3 ]; then
  usage
  exit 2
fi

PACKAGE_NAME="$1"
PACKAGE_VERSION="$2"
PACKAGE_BIN="$3"
shift 3

if [ -z "$PACKAGE_NAME" ] || [ -z "$PACKAGE_VERSION" ] || [ -z "$PACKAGE_BIN" ]; then
  usage
  exit 2
fi

case "${PACKAGE_NAME}|${PACKAGE_VERSION}|${PACKAGE_BIN}" in
  "diagram-converter-mcp|0.2.11|dist/index.js" | \
  "@supabase/mcp-server-supabase|0.6.3|dist/transports/stdio.js" | \
  "@playwright/mcp|0.0.70|cli.js" | \
  "next-devtools-mcp|0.3.10|dist/index.js" | \
  "chrome-devtools-mcp|0.23.0|build/src/bin/chrome-devtools-mcp.js" | \
  "vercel-mcp|0.0.7|build/index.js")
    ;;
  *)
    echo "Error: unsupported MCP package tuple: ${PACKAGE_NAME}@${PACKAGE_VERSION} ${PACKAGE_BIN}" >&2
    exit 2
    ;;
esac

MCP_CACHE_ROOT="${OPENMANAGER_MCP_CACHE_ROOT:-${HOME:-}/.mcp-servers/openmanager-ai-mcp}"
LOCAL_BIN="$MCP_CACHE_ROOT/node_modules/$PACKAGE_NAME/$PACKAGE_BIN"

if [ -f "$LOCAL_BIN" ]; then
  exec node "$LOCAL_BIN" "$@"
fi

exec npx -y "${PACKAGE_NAME}@${PACKAGE_VERSION}" "$@"
