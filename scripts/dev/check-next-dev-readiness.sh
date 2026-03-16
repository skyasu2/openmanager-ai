#!/usr/bin/env bash
# scripts/dev/check-next-dev-readiness.sh
#
# Minimal readiness probe for `next dev`.
# Use this before investigating nested App Router route 404s.
#
# Fix: invokes next dev directly (node_modules/.bin/next) to avoid the
# hardcoded `-p 3000` in the npm `dev` script conflicting with the dynamic
# port we allocate here. The old `npm run dev -- --port $PORT` approach
# resulted in `next dev -p 3000 --port $PORT`, where Next.js may bind to
# 3000 while the probe polled a different port (HTTP 000 timeout).

set -euo pipefail

WEBPACK=false
PORT="${NEXT_DEV_READY_PORT:-}"
READY_TIMEOUT_S="${NEXT_DEV_READY_TIMEOUT_S:-90}"
READY_PATH="${NEXT_DEV_READY_PATH:-/api/version}"
CURL_TIMEOUT_S="${NEXT_DEV_READY_CURL_TIMEOUT_S:-2}"
LOG_TAIL_LINES="${NEXT_DEV_READY_LOG_TAIL_LINES:-60}"
NEXT_LOG_FILE="$(mktemp -t openmanager-next-dev-ready-XXXX.log)"
SERVER_PID=""
ROUTE_FAIL=0

for arg in "$@"; do
  case "$arg" in
    --webpack)        WEBPACK=true ;;
    --port=*)         PORT="${arg#--port=}" ;;
    --timeout=*)      READY_TIMEOUT_S="${arg#--timeout=}" ;;
    --path=*)         READY_PATH="${arg#--path=}" ;;
    --curl-timeout=*) CURL_TIMEOUT_S="${arg#--curl-timeout=}" ;;
    --help|-h)
      echo "Usage: bash scripts/dev/check-next-dev-readiness.sh [--webpack] [--port=PORT] [--timeout=SECS] [--path=/api/version]"
      exit 0
      ;;
  esac
done

# ─── Free port ───────────────────────────────────────────────────────────────
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

# ─── Cleanup ──────────────────────────────────────────────────────────────────
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
  # Avoid broken .next/dev route types from poisoning subsequent `npm run type-check`.
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

# ─── Build command ────────────────────────────────────────────────────────────
# Call next dev directly — NOT via `npm run dev` — to avoid the hardcoded
# `-p 3000` in the npm script. Set env vars inline instead of using cross-env.
NEXT_BIN="node_modules/.bin/next"

if [ ! -x "$NEXT_BIN" ]; then
  echo "[dev:readiness] ❌ $NEXT_BIN not found. Run npm install first."
  exit 1
fi

MODE="turbopack"
CMD=(env NODE_OPTIONS='--max-old-space-size=4096' NEXT_DISABLE_DEVTOOLS=1 "$NEXT_BIN" dev --hostname 127.0.0.1 --port "$PORT")
if [ "$WEBPACK" = "true" ]; then
  MODE="webpack"
  CMD+=(--webpack)
fi

echo "[dev:readiness] mode=${MODE} port=${PORT}"
echo "[dev:readiness] probe=${READY_PATH} timeout=${READY_TIMEOUT_S}s"
echo "[dev:readiness] log=${NEXT_LOG_FILE}"

"${CMD[@]}" >"$NEXT_LOG_FILE" 2>&1 &
SERVER_PID=$!

# ─── Wait for readiness ───────────────────────────────────────────────────────
READY_CODE="000"
READY_ELAPSED=""
LAST_LOG_LINE=""
START_TS="$(date +%s)"
DEADLINE_TS="$((START_TS + READY_TIMEOUT_S))"

echo -n "[dev:readiness] waiting"
while [ "$(date +%s)" -lt "$DEADLINE_TS" ]; do
  NOW_TS="$(date +%s)"
  ELAPSED_TS="$((NOW_TS - START_TS))"

  # Print a progress dot every 5s, and show latest log line every 10s
  if [ "$ELAPSED_TS" -gt 0 ] && [ $((ELAPSED_TS % 5)) -eq 0 ]; then
    echo -n "."
  fi
  if [ "$ELAPSED_TS" -gt 0 ] && [ $((ELAPSED_TS % 10)) -eq 0 ]; then
    LAST_LOG_LINE="$(tail -n1 "$NEXT_LOG_FILE" 2>/dev/null || true)"
    [ -n "$LAST_LOG_LINE" ] && echo -n " [${LAST_LOG_LINE:0:60}]"
  fi

  # Verify process is still alive
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "[dev:readiness] ❌ next dev process exited prematurely (PID=${SERVER_PID})"
    echo "[dev:readiness]    startup log:"
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
  echo "[dev:readiness] ❌ readiness timeout after ${READY_TIMEOUT_S}s"
  echo "[dev:readiness]    http=${READY_CODE}"
  echo "[dev:readiness]    probe url: ${BASE_URL}${READY_PATH}"
  echo "[dev:readiness]    startup log (last ${LOG_TAIL_LINES} lines):"
  tail -n "$LOG_TAIL_LINES" "$NEXT_LOG_FILE" 2>/dev/null || true
  exit 1
fi

echo "[dev:readiness] ✅ ready in ${READY_ELAPSED}s (http=${READY_CODE})"

# ─── Route spot-checks ────────────────────────────────────────────────────────
echo ""
echo "[dev:readiness] route spot-check:"
for path in \
  /api/version \
  /api/health \
  /api/system \
  /api/ai/jobs \
  /api/ai/supervisor \
  /api/ai/supervisor/stream/v2 \
  /api/ai/incident-report \
  /api/security/csp-report; do
  http_code="$(probe_http_code "${BASE_URL}${path}" 3)"
  # 404 = route missing, 000 = probe/network failure, anything else = route exists.
  if [ "$http_code" = "404" ]; then
    printf '[dev:readiness] ✗ %s  %s  ← route missing\n' "$http_code" "$path"
    ROUTE_FAIL=$((ROUTE_FAIL + 1))
  elif [ "$http_code" = "000" ]; then
    printf '[dev:readiness] ✗ %s  %s  ← probe failed\n' "$http_code" "$path"
    ROUTE_FAIL=$((ROUTE_FAIL + 1))
  else
    printf '[dev:readiness] ✓ %s  %s\n' "$http_code" "$path"
  fi
done

if [ "$ROUTE_FAIL" -gt 0 ]; then
  echo ""
  echo "[dev:readiness] ❌ route spot-check failed (${ROUTE_FAIL})"
  exit 1
fi
