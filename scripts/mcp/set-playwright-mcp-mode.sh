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
awk -v mode="$MODE" -v port="$PORT" -v repo_root="$REPO_ROOT" '
function print_playwright_section() {
  print "[mcp_servers.playwright]"
  if (mode == "stdio") {
    print "command = \"bash\""
    print "args = [\"" repo_root "/scripts/mcp/start-node-mcp-package.sh\", \"@playwright/mcp\", \"0.0.70\", \"cli.js\", \"--isolated\", \"--output-dir\", \"tmp/playwright/mcp/screenshots\"]"
    print "startup_timeout_sec = 60"
    print "tool_timeout_sec = 180"
    print "required = false"
    print ""
    print "[mcp_servers.playwright.env]"
    print "DISPLAY = \":0\""
  } else if (mode == "windows-http") {
    print "url = \"http://localhost:" port "/mcp\""
    print "startup_timeout_sec = 60"
    print "tool_timeout_sec = 180"
    print "required = false"
  }
  print ""
}

BEGIN {
  state = "normal"
  found = 0
}

{
  if (state == "normal") {
    if ($0 == "[mcp_servers.playwright]") {
      found = 1
      state = "playwright-main"
      print_playwright_section()
    } else {
      print $0
    }
    next
  }

  # Inside playwright main or env subsection: skip content, handle sub-sections
  if (state == "playwright-main" || state == "playwright-env") {
    if ($0 == "[mcp_servers.playwright.env]") {
      state = "playwright-env"
      next
    }
    # Tools sub-sections: exit skip state and print normally
    if ($0 ~ /^\[mcp_servers\.playwright\.tools\./) {
      state = "normal"
      print $0
      next
    }
    # Different server entirely: exit skip state and print
    if ($0 ~ /^\[mcp_servers\./ && $0 !~ /^\[mcp_servers\.playwright/) {
      state = "normal"
      print $0
      next
    }
    # Content lines inside main or env section: skip
    next
  }
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
  echo "Target endpoint: http://localhost:${PORT}/mcp"
fi
echo "Restart Codex session to apply the MCP config change."
