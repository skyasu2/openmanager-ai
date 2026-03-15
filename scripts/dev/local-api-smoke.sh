#!/usr/bin/env bash
# scripts/dev/local-api-smoke.sh
#
# Local API Smoke Test (production-like: next build + next start)
#
# Purpose:
#   Verify nested App Router API routes that may 404 under `next dev`.
#   Runs against a production build to replicate Vercel behaviour locally.
#
# Usage:
#   npm run local:smoke              # skip build if .next exists
#   npm run local:smoke -- --rebuild # force fresh build
#   npm run local:smoke -- --port=3099
#   npm run local:smoke -- --timeout=10

set -euo pipefail

# ─── Defaults ───────────────────────────────────────────────────────────────
REBUILD=false
PORT="${LOCAL_SMOKE_PORT:-}"
TIMEOUT_S="${LOCAL_SMOKE_TIMEOUT_S:-7}"
PASS=0
FAIL=0
SKIP=0

# ─── Args ───────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --rebuild)   REBUILD=true ;;
    --port=*)    PORT="${arg#--port=}" ;;
    --timeout=*) TIMEOUT_S="${arg#--timeout=}" ;;
    --help|-h)
      echo "Usage: npm run local:smoke [-- --rebuild] [-- --port=PORT] [-- --timeout=SECS]"
      exit 0
      ;;
  esac
done

# ─── Free port ──────────────────────────────────────────────────────────────
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
SERVER_PID=""

# ─── Cleanup ─────────────────────────────────────────────────────────────────
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ─── Build ──────────────────────────────────────────────────────────────────
if [ "$REBUILD" = "true" ] || [ ! -d ".next" ]; then
  echo "[local:smoke] Building production bundle (next build)..."
  npm run build:prod
else
  echo "[local:smoke] Skipping build (.next exists). Use --rebuild to force."
fi

# ─── Start server ────────────────────────────────────────────────────────────
echo "[local:smoke] Starting next start on port ${PORT}..."
npm run start -- -p "$PORT" &>/dev/null &
SERVER_PID=$!

# Wait until server is ready (max 30s)
echo -n "[local:smoke] Waiting for server"
for i in $(seq 1 30); do
  if curl -sf "${BASE_URL}/api/health" -o /dev/null 2>/dev/null; then
    echo " ready (${i}s)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo ""
    echo "[local:smoke] ❌ Server did not start within 30s."
    exit 1
  fi
  echo -n "."
  sleep 1
done

# ─── Check function ──────────────────────────────────────────────────────────
# check <label> <path> [<expected-status>]
# expected-status defaults to "!404" (any non-404 means route exists)
check() {
  local label="$1"
  local path="$2"
  local expected="${3:-!404}"

  local http_code
  http_code="$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time "$TIMEOUT_S" \
    -H 'Accept: application/json' \
    "${BASE_URL}${path}" 2>/dev/null || echo "000")"

  local status="PASS"

  if [ "$expected" = "!404" ]; then
    # Route must exist: anything except 404 is acceptable
    if [ "$http_code" = "404" ] || [ "$http_code" = "000" ]; then
      status="FAIL"
    fi
  elif [ "$expected" = "200" ]; then
    [ "$http_code" = "200" ] || status="FAIL"
  else
    [ "$http_code" = "$expected" ] || status="FAIL"
  fi

  if [ "$status" = "PASS" ]; then
    echo "  ✓ ${label} (${http_code})"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${label} — got ${http_code}, expected ${expected}"
    FAIL=$((FAIL + 1))
  fi
}

# ─── Tests ───────────────────────────────────────────────────────────────────
echo ""
echo "── Baseline (1-depth routes) ──"
check "GET /api/health"      /api/health      200
check "GET /api/system"      /api/system      "!404"
check "GET /api/csrf-token"  /api/csrf-token  "!404"
check "GET /api/database"    /api/database    "!404"

echo ""
echo "── Nested routes (previously 404 on next dev) ──"
check "GET /api/ai/supervisor"             /api/ai/supervisor             "!404"
check "GET /api/ai/supervisor/stream/v2"   /api/ai/supervisor/stream/v2   "!404"
check "GET /api/ai/jobs"                   /api/ai/jobs                   "!404"
check "GET /api/servers/next"              /api/servers/next              "!404"
check "GET /api/ai/incident-report"        /api/ai/incident-report        "!404"
check "GET /api/security/csp-report"       /api/security/csp-report       "!404"

# ─── Summary ─────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo "── Summary ──────────────────────────────────────────"
echo "  total:   ${TOTAL}"
echo "  passed:  ${PASS}"
echo "  failed:  ${FAIL}"
echo "  skipped: ${SKIP}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "❌ ${FAIL} check(s) failed — nested routes are missing from production build."
  echo "   → Run with --rebuild if .next is stale."
  exit 1
fi

echo "✅ All API routes exist in production build."
echo "   (4xx responses for auth/method are expected; only 404 = route missing)"
