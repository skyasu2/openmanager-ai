#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SPEC="tests/manual/ai-retention-parity.spec.ts"
CONFIG="playwright.config.vercel.manual.ts"
BASE_URL="${PLAYWRIGHT_BASE_URL:-https://openmanager-ai.vercel.app}"
CHANNEL="${PLAYWRIGHT_CHANNEL:-chromium}"
LOG_FILE="$(mktemp)"

run_once() {
  local channel="$1"
  set +e
  # Production is currently public; keep Vercel bypass disabled by default.
  # Callers can still opt in by exporting VERCEL_AUTOMATION_BYPASS_SECRET explicitly.
  PLAYWRIGHT_BASE_URL="$BASE_URL" \
  PLAYWRIGHT_SKIP_SERVER=1 \
  PLAYWRIGHT_CHANNEL="$channel" \
  VERCEL_AUTOMATION_BYPASS_SECRET="${VERCEL_AUTOMATION_BYPASS_SECRET:-}" \
  npx playwright test "$SPEC" --config "$CONFIG" 2>&1 | tee "$LOG_FILE"
  local status=${PIPESTATUS[0]}
  set -e
  return "$status"
}

is_retryable_browser_failure() {
  grep -Eq \
    'browserType\.launch|setsockopt: Operation not permitted|signal=SIGTRAP|Target page, context or browser has been closed|Network service crashed or was terminated|FD ownership violation' \
    "$LOG_FILE"
}

alternate_channel() {
  local channel="$1"
  if [[ "$channel" == "chromium" ]]; then
    printf '%s\n' 'chrome'
    return 0
  fi

  printf '%s\n' 'chromium'
}

echo "Running Vercel AI retention parity on channel: $CHANNEL"
if run_once "$CHANNEL"; then
  rm -f "$LOG_FILE"
  exit 0
fi

if is_retryable_browser_failure; then
  FALLBACK_CHANNEL="$(alternate_channel "$CHANNEL")"
  echo "Browser runtime failure detected. Retrying on fallback channel: $FALLBACK_CHANNEL"
  sleep 2
  if run_once "$FALLBACK_CHANNEL"; then
    rm -f "$LOG_FILE"
    exit 0
  fi
fi

rm -f "$LOG_FILE"
exit 1
