#!/usr/bin/env bash
# scripts/dev/check-next-dev-readiness.sh
#
# Minimal readiness probe for `next dev`.
# Use this before investigating nested App Router route 404s.

set -euo pipefail

WEBPACK=false
PORT="${NEXT_DEV_READY_PORT:-}"
READY_TIMEOUT_S="${NEXT_DEV_READY_TIMEOUT_S:-15}"
READY_PATH="${NEXT_DEV_READY_PATH:-/api/version}"
CURL_TIMEOUT_S="${NEXT_DEV_READY_CURL_TIMEOUT_S:-1}"
LOG_TAIL_LINES="${NEXT_DEV_READY_LOG_TAIL_LINES:-60}"
NEXT_LOG_FILE="$(mktemp -t openmanager-next-dev-ready-XXXX.log)"
SERVER_PID=""

for arg in "$@"; do
  case "$arg" in
    --webpack) WEBPACK=true ;;
    --port=*) PORT="${arg#--port=}" ;;
    --timeout=*) READY_TIMEOUT_S="${arg#--timeout=}" ;;
    --path=*) READY_PATH="${arg#--path=}" ;;
    --curl-timeout=*) CURL_TIMEOUT_S="${arg#--curl-timeout=}" ;;
    --help|-h)
      echo "Usage: bash scripts/dev/check-next-dev-readiness.sh [--webpack] [--port=PORT] [--timeout=SECS] [--path=/api/version]"
      exit 0
      ;;
  esac
done

if [ -z "$PORT" ]; then
  PORT="$(node -e '
    const net = require("node:net");
    const s = net.createServer();
    s.unref();
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      process.stdout.write(String(a.port));
      s.close();
    });
  ')"
fi

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill -9 "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$NEXT_LOG_FILE"
}
trap cleanup EXIT INT TERM

MODE="turbopack"
CMD=(npm run dev -- --hostname 127.0.0.1 --port "$PORT")
if [ "$WEBPACK" = "true" ]; then
  MODE="webpack"
  CMD+=(--webpack)
fi

BASE_URL="http://127.0.0.1:${PORT}"

echo "[dev:readiness] mode=${MODE} port=${PORT}"
echo "[dev:readiness] probe=${READY_PATH} timeout=${READY_TIMEOUT_S}s"
echo "[dev:readiness] command=${CMD[*]}"

NEXT_DISABLE_DEVTOOLS=1 "${CMD[@]}" >"$NEXT_LOG_FILE" 2>&1 &
SERVER_PID=$!

READY_CODE="000"
READY_ELAPSED=""

for i in $(seq 1 "$READY_TIMEOUT_S"); do
  READY_CODE="$(curl --max-time "$CURL_TIMEOUT_S" -s -o /tmp/openmanager-next-dev-ready-body.txt -w '%{http_code}' "${BASE_URL}${READY_PATH}" || true)"
  if [ "$READY_CODE" != "000" ]; then
    READY_ELAPSED="$i"
    break
  fi
  sleep 1
done

if [ -z "$READY_ELAPSED" ]; then
  echo "[dev:readiness] ❌ readiness timeout"
  echo "[dev:readiness] http=${READY_CODE}"
  echo "[dev:readiness] startup log tail:"
  tail -n "$LOG_TAIL_LINES" "$NEXT_LOG_FILE" 2>/dev/null || true
  exit 1
fi

echo "[dev:readiness] ✅ ready in ${READY_ELAPSED}s (http=${READY_CODE})"

for path in \
  /api/version \
  /api/system \
  /api/ai/jobs \
  /api/ai/supervisor \
  /api/ai/supervisor/stream/v2; do
  http_code="$(curl --max-time 3 -s -o /tmp/openmanager-next-dev-route-body.txt -w '%{http_code}' "${BASE_URL}${path}" || true)"
  printf '[dev:readiness] %s %s\n' "$http_code" "$path"
done
