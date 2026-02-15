#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/mcp/start-playwright-mcp-windows.sh [--port <number>] [--browser <msedge|chrome|chromium|firefox|webkit>]

Example:
  bash scripts/mcp/start-playwright-mcp-windows.sh --port 8931 --browser msedge
EOF
}

PORT=8931
BROWSER="msedge"

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

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || ((PORT < 1 || PORT > 65535)); then
  echo "Error: --port must be a valid TCP port (1-65535)" >&2
  exit 2
fi

case "$BROWSER" in
  msedge|chrome|chromium|firefox|webkit) ;;
  *)
    echo "Error: unsupported --browser value: $BROWSER" >&2
    exit 2
    ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PS_SCRIPT="$REPO_ROOT/scripts/mcp/start-playwright-mcp-windows.ps1"

if [[ ! -f "$PS_SCRIPT" ]]; then
  echo "Error: missing PowerShell script: $PS_SCRIPT" >&2
  exit 2
fi

for cmd in cmd.exe wslpath; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command not found: $cmd" >&2
    exit 2
  fi
done

WIN_REPO_ROOT="$(wslpath -w "$REPO_ROOT")"
WIN_PS_SCRIPT="$(wslpath -w "$PS_SCRIPT")"

# WSL에서 cmd.exe start가 블로킹되는 케이스가 있어 비동기 실행으로 즉시 반환한다.
cmd.exe /c start '""' powershell -NoExit -ExecutionPolicy Bypass -File "$WIN_PS_SCRIPT" -RepoPath "$WIN_REPO_ROOT" -Port "$PORT" -Browser "$BROWSER" >/dev/null 2>&1 &

echo "Started Windows Playwright MCP server in a new PowerShell window."
echo "Port: $PORT"
echo "Browser: $BROWSER"
echo "Endpoint: http://127.0.0.1:${PORT}/mcp"
