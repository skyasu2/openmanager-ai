#!/usr/bin/env bash
# scripts/dev/collect-next-dev-trace.sh
#
# Collect a Turbopack dev trace after the app reaches a target route.
# Intended for local performance investigation, not product QA.

set -euo pipefail

PORT="${NEXT_DEV_TRACE_PORT:-}"
READY_TIMEOUT_S="${NEXT_DEV_TRACE_TIMEOUT_S:-150}"
READY_PATH="${NEXT_DEV_TRACE_PATH:-/api/version}"
CURL_TIMEOUT_S="${NEXT_DEV_TRACE_CURL_TIMEOUT_S:-2}"
LOG_TAIL_LINES="${NEXT_DEV_TRACE_LOG_TAIL_LINES:-80}"
NEXT_LOG_FILE="$(mktemp -t openmanager-next-dev-trace-XXXX.log)"
SERVER_PID=""
TRACE_PATH=".next/dev/trace-turbopack"

for arg in "$@"; do
  case "$arg" in
    --port=*) PORT="${arg#--port=}" ;;
    --timeout=*) READY_TIMEOUT_S="${arg#--timeout=}" ;;
    --path=*) READY_PATH="${arg#--path=}" ;;
    --help|-h)
      echo "Usage: bash scripts/dev/collect-next-dev-trace.sh [--port=PORT] [--timeout=SECS] [--path=/api/version]"
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

BASE_URL="http://127.0.0.1:${PORT}"

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    for _ in $(seq 1 5); do
      if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      kill -9 "$SERVER_PID" 2>/dev/null || true
    fi
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$NEXT_LOG_FILE"
}
trap cleanup EXIT INT TERM

probe_http_code() {
  local url="$1"
  local max_time="$2"
  local code=""

  code="$(curl --max-time "$max_time" -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"

  case "$code" in
    [0-9][0-9][0-9]) printf '%s\n' "$code" ;;
    *) printf '000\n' ;;
  esac
}

NEXT_BIN="node_modules/.bin/next"

if [ ! -x "$NEXT_BIN" ]; then
  echo "[dev:trace] ❌ $NEXT_BIN not found. Run npm install first."
  exit 1
fi

rm -f "$TRACE_PATH"

echo "[dev:trace] port=${PORT}"
echo "[dev:trace] probe=${READY_PATH} timeout=${READY_TIMEOUT_S}s"
echo "[dev:trace] log=${NEXT_LOG_FILE}"

env \
  NODE_OPTIONS='--max-old-space-size=4096' \
  NEXT_DISABLE_DEVTOOLS=1 \
  NEXT_TURBOPACK_TRACING=1 \
  "$NEXT_BIN" dev --hostname 127.0.0.1 --port "$PORT" >"$NEXT_LOG_FILE" 2>&1 &
SERVER_PID=$!

START_TS="$(date +%s)"
DEADLINE_TS="$((START_TS + READY_TIMEOUT_S))"
READY_CODE="000"
READY_ELAPSED=""

echo -n "[dev:trace] waiting"
while [ "$(date +%s)" -lt "$DEADLINE_TS" ]; do
  NOW_TS="$(date +%s)"
  ELAPSED_TS="$((NOW_TS - START_TS))"

  if [ "$ELAPSED_TS" -gt 0 ] && [ $((ELAPSED_TS % 5)) -eq 0 ]; then
    echo -n "."
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "[dev:trace] ❌ next dev exited before readiness"
    tail -n "$LOG_TAIL_LINES" "$NEXT_LOG_FILE" 2>/dev/null || true
    exit 1
  fi

  READY_CODE="$(probe_http_code "${BASE_URL}${READY_PATH}" "$CURL_TIMEOUT_S")"
  if [ "$READY_CODE" != "000" ]; then
    READY_ELAPSED="$ELAPSED_TS"
    break
  fi

  sleep 1
done
echo ""

if [ -z "$READY_ELAPSED" ]; then
  echo "[dev:trace] ❌ readiness timeout after ${READY_TIMEOUT_S}s"
  echo "[dev:trace]    http=${READY_CODE}"
  echo "[dev:trace]    probe url: ${BASE_URL}${READY_PATH}"
  tail -n "$LOG_TAIL_LINES" "$NEXT_LOG_FILE" 2>/dev/null || true
  exit 1
fi

echo "[dev:trace] ✅ ready in ${READY_ELAPSED}s (http=${READY_CODE})"

if [ ! -f "$TRACE_PATH" ]; then
  echo "[dev:trace] ❌ trace file not found: $TRACE_PATH"
  tail -n "$LOG_TAIL_LINES" "$NEXT_LOG_FILE" 2>/dev/null || true
  exit 1
fi

TRACE_SIZE="$(wc -c < "$TRACE_PATH" | tr -d ' ')"
echo "[dev:trace] trace file: ${TRACE_PATH} (${TRACE_SIZE} bytes)"
echo "[dev:trace] next step:"
echo "  npx next internal trace ${TRACE_PATH}"
echo "  trace viewer: https://trace.nextjs.org/"
