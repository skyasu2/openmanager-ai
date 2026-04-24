#!/usr/bin/env bash
set -euo pipefail

# Prefer the existing dedicated Supabase MCP install when present, while
# keeping project config portable through a pinned npm fallback.

PACKAGE_NAME="@supabase/mcp-server-supabase"
PACKAGE_VERSION="0.6.3"
PACKAGE_BIN="dist/transports/stdio.js"

if [ -n "${OPENMANAGER_SUPABASE_MCP_BIN:-}" ] && [ -f "$OPENMANAGER_SUPABASE_MCP_BIN" ]; then
  exec node "$OPENMANAGER_SUPABASE_MCP_BIN" "$@"
fi

LEGACY_BIN="${HOME:-}/.mcp-servers/supabase/node_modules/$PACKAGE_NAME/$PACKAGE_BIN"
if [ -f "$LEGACY_BIN" ]; then
  exec node "$LEGACY_BIN" "$@"
fi

exec bash "$(dirname "${BASH_SOURCE[0]}")/start-node-mcp-package.sh" "$PACKAGE_NAME" "$PACKAGE_VERSION" "$PACKAGE_BIN" "$@"
