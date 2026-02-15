#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/mcp/set-playwright-mcp-mode.sh --mode <stdio|windows-http> [--port <number>] [--dry-run]

Examples:
  bash scripts/mcp/set-playwright-mcp-mode.sh --mode stdio
  bash scripts/mcp/set-playwright-mcp-mode.sh --mode windows-http --port 8931
EOF
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="$REPO_ROOT/.codex/config.toml"

MODE=""
PORT=8931
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "Error: --mode is required" >&2
  usage
  exit 2
fi

if [[ "$MODE" != "stdio" && "$MODE" != "windows-http" ]]; then
  echo "Error: --mode must be one of: stdio, windows-http" >&2
  exit 2
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || ((PORT < 1 || PORT > 65535)); then
  echo "Error: --port must be a valid TCP port (1-65535)" >&2
  exit 2
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: config file not found: $CONFIG_FILE" >&2
  exit 2
fi

tmp_file="$(mktemp)"
cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

set +e
awk -v mode="$MODE" -v port="$PORT" '
function print_playwright_section() {
  print "[mcp_servers.playwright]"
  if (mode == "stdio") {
    print "command = \"npx\""
    print "args = [\"-y\", \"@playwright/mcp\", \"--output-dir\", \".playwright-mcp/screenshots\"]"
    print "startup_timeout_sec = 60"
    print "tool_timeout_sec = 180"
    print "required = false"
  } else if (mode == "windows-http") {
    print "url = \"http://127.0.0.1:" port "/mcp\""
    print "startup_timeout_sec = 60"
    print "tool_timeout_sec = 180"
    print "required = false"
  }
  print ""
}

BEGIN {
  in_playwright = 0
  found = 0
}

{
  if ($0 ~ /^\[mcp_servers\.playwright\]$/) {
    found = 1
    in_playwright = 1
    print_playwright_section()
    next
  }

  if (in_playwright == 1) {
    if ($0 ~ /^\[mcp_servers\./) {
      in_playwright = 0
      print $0
    }
    next
  }

  print $0
}

END {
  if (found == 0) {
    exit 42
  }
}
' "$CONFIG_FILE" >"$tmp_file"
awk_exit=$?
set -e

if [[ $awk_exit -eq 42 ]]; then
  echo "Error: [mcp_servers.playwright] section not found in $CONFIG_FILE" >&2
  exit 2
fi

if [[ $awk_exit -ne 0 ]]; then
  echo "Error: failed to rewrite $CONFIG_FILE" >&2
  exit 2
fi

if cmp -s "$CONFIG_FILE" "$tmp_file"; then
  echo "No changes needed. Playwright MCP mode is already '$MODE'."
  exit 0
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[Dry Run] Proposed changes:"
  diff -u "$CONFIG_FILE" "$tmp_file" || true
  exit 0
fi

backup_file="${CONFIG_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$CONFIG_FILE" "$backup_file"
mv "$tmp_file" "$CONFIG_FILE"

echo "Updated Playwright MCP mode: $MODE"
echo "Config: $CONFIG_FILE"
echo "Backup: $backup_file"
if [[ "$MODE" == "windows-http" ]]; then
  echo "Target endpoint: http://127.0.0.1:${PORT}/mcp"
fi
echo "Restart Codex session to apply the MCP config change."
