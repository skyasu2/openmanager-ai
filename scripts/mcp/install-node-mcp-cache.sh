#!/usr/bin/env bash
set -euo pipefail

MCP_CACHE_ROOT="${OPENMANAGER_MCP_CACHE_ROOT:-${HOME:-}/.mcp-servers/openmanager-ai-mcp}"

mkdir -p "$MCP_CACHE_ROOT"

npm install --prefix "$MCP_CACHE_ROOT" --no-audit --no-fund \
  diagram-converter-mcp@0.2.11 \
  @supabase/mcp-server-supabase@0.6.3 \
  @playwright/mcp@0.0.70 \
  next-devtools-mcp@0.3.10 \
  chrome-devtools-mcp@0.23.0 \
  vercel-mcp@0.0.7
