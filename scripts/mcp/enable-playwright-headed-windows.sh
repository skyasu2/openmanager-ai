#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/mcp/enable-playwright-headed-windows.sh [--port <number>] [--browser <msedge|chrome|chromium|firefox|webkit>] [--version <npm-version>]

What it does:
  1) Switches .codex/config.toml Playwright MCP to windows-http mode
  2) Starts Playwright MCP server on Windows in a visible PowerShell window
EOF
}

PORT=8931
BROWSER="msedge"
VERSION="0.0.55"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --browser)
      BROWSER="${2:-}"
      shift 2
      ;;
    --version)
      VERSION="${2:-}"
      shift 2
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

if [[ -z "$VERSION" ]]; then
  echo "Error: --version must not be empty" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

bash "$REPO_ROOT/scripts/mcp/set-playwright-mcp-mode.sh" --mode windows-http --port "$PORT"
bash "$REPO_ROOT/scripts/mcp/start-playwright-mcp-windows.sh" --port "$PORT" --browser "$BROWSER" --version "$VERSION"

echo "Done. Restart Codex session to reconnect Playwright MCP via HTTP."
