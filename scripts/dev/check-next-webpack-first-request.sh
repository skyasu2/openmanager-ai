#!/usr/bin/env bash
# scripts/dev/check-next-webpack-first-request.sh
#
# Minimal repro for webpack dev first-request compile latency.
# Measures:
# - time until the dev server prints a "Ready in ..." line
# - wall clock for the first request to a target path
# - whether webpack logged proxy + target compile steps

set -euo pipefail

PORT="${NEXT_WEBPACK_PROBE_PORT:-}"
PATH_TO_PROBE="${NEXT_WEBPACK_PROBE_PATH:-/api/version}"
READY_TIMEOUT_S="${NEXT_WEBPACK_READY_TIMEOUT_S:-120}"
REQUEST_TIMEOUT_S="${NEXT_WEBPACK_REQUEST_TIMEOUT_S:-120}"
LOG_TAIL_LINES="${NEXT_WEBPACK_LOG_TAIL_LINES:-80}"
NEXT_LOG_FILE="$(mktemp -t openmanager-next-webpack-probe-XXXX.log)"
SERVER_PID=""

for arg in "$@"; do
  case "$arg" in
    --port=*) PORT="${arg#--port=}" ;;
    --path=*) PATH_TO_PROBE="${arg#--path=}" ;;
    --ready-timeout=*) READY_TIMEOUT_S="${arg#--ready-timeout=}" ;;
    --request-timeout=*) REQUEST_TIMEOUT_S="${arg#--request-timeout=}" ;;
    --help|-h)
      echo "Usage: bash scripts/dev/check-next-webpack-first-request.sh [--path=/api/version] [--port=PORT] [--ready-timeout=120] [--request-timeout=120]"
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
NEXT_BIN="node_modules/.bin/next"

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
  rm -rf .next/dev/types 2>/dev/null || true
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

if [ ! -x "$NEXT_BIN" ]; then
  echo "[webpack:probe] ❌ $NEXT_BIN not found. Run npm install first."
  exit 1
fi

echo "[webpack:probe] port=${PORT}"
echo "[webpack:probe] path=${PATH_TO_PROBE}"
echo "[webpack:probe] ready-timeout=${READY_TIMEOUT_S}s request-timeout=${REQUEST_TIMEOUT_S}s"
echo "[webpack:probe] log=${NEXT_LOG_FILE}"

env NODE_OPTIONS='--max-old-space-size=4096' NEXT_DISABLE_DEVTOOLS=1 "$NEXT_BIN" dev --webpack --hostname 127.0.0.1 --port "$PORT" >"$NEXT_LOG_FILE" 2>&1 &
SERVER_PID=$!

READY_LINE=""
START_TS="$(date +%s)"
DEADLINE_TS="$((START_TS + READY_TIMEOUT_S))"

echo -n "[webpack:probe] waiting for Ready"
while [ "$(date +%s)" -lt "$DEADLINE_TS" ]; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "[webpack:probe] ❌ next dev exited before ready"
    tail -n "$LOG_TAIL_LINES" "$NEXT_LOG_FILE" 2>/dev/null || true
    exit 1
  fi

  READY_LINE="$(grep -m1 'Ready in ' "$NEXT_LOG_FILE" || true)"
  if [ -n "$READY_LINE" ]; then
    break
  fi

  echo -n "."
  sleep 1
done

echo ""

if [ -z "$READY_LINE" ]; then
  echo "[webpack:probe] ❌ ready line not found within ${READY_TIMEOUT_S}s"
  tail -n "$LOG_TAIL_LINES" "$NEXT_LOG_FILE" 2>/dev/null || true
  exit 1
fi

READY_WALL_S="$(( $(date +%s) - START_TS ))"
echo "[webpack:probe] ✅ server ready in ${READY_WALL_S}s"
echo "[webpack:probe] ready-line: ${READY_LINE}"

REQUEST_START_TS="$(date +%s)"
REQUEST_HTTP_CODE="$(probe_http_code "${BASE_URL}${PATH_TO_PROBE}" "$REQUEST_TIMEOUT_S")"
REQUEST_WALL_S="$(( $(date +%s) - REQUEST_START_TS ))"

echo "[webpack:probe] first-request http=${REQUEST_HTTP_CODE} wall=${REQUEST_WALL_S}s"

PROXY_LOG_LINE="$(grep -m1 'Compiling proxy' "$NEXT_LOG_FILE" || true)"
TARGET_LOG_PATTERN="Compiling ${PATH_TO_PROBE}"
TARGET_LOG_LINE="$(grep -m1 "$TARGET_LOG_PATTERN" "$NEXT_LOG_FILE" || true)"

if [ -n "$PROXY_LOG_LINE" ]; then
  echo "[webpack:probe] proxy-log: ${PROXY_LOG_LINE}"
else
  echo "[webpack:probe] proxy-log: <not observed>"
fi

if [ -n "$TARGET_LOG_LINE" ]; then
  echo "[webpack:probe] target-log: ${TARGET_LOG_LINE}"
else
  echo "[webpack:probe] target-log: <not observed>"
fi

echo "[webpack:probe] tail (${LOG_TAIL_LINES}):"
tail -n "$LOG_TAIL_LINES" "$NEXT_LOG_FILE" 2>/dev/null || true

if [ "$REQUEST_HTTP_CODE" = "404" ]; then
  echo "[webpack:probe] ❌ route missing"
  exit 1
fi

if [ "$REQUEST_HTTP_CODE" = "000" ]; then
  echo "[webpack:probe] ❌ first request timed out before a response"
  exit 1
fi

exit 0
