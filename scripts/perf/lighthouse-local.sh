#!/usr/bin/env bash
set -euo pipefail

PORT="${LIGHTHOUSE_PORT:-3000}"
TARGET_URL="${LIGHTHOUSE_URL:-http://localhost:${PORT}}"
REPORT_DIR="${LIGHTHOUSE_REPORT_DIR:-reports/lighthouse}"
RUNS="${LIGHTHOUSE_RUNS:-3}"
MIN_PERFORMANCE="${LIGHTHOUSE_MIN_PERFORMANCE:-0.8}"
MIN_ACCESSIBILITY="${LIGHTHOUSE_MIN_ACCESSIBILITY:-0.9}"
MIN_BEST_PRACTICES="${LIGHTHOUSE_MIN_BEST_PRACTICES:-0.85}"
MIN_SEO="${LIGHTHOUSE_MIN_SEO:-0.8}"

mkdir -p "$REPORT_DIR"

npm run build

npm run start -- -p "$PORT" >/tmp/openmanager-lighthouse-start.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for attempt in $(seq 1 60); do
  if curl -fsS "$TARGET_URL" >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "Lighthouse target did not become ready: $TARGET_URL" >&2
    exit 1
  fi
  sleep 1
done

node scripts/perf/run-lighthouse-score.js \
  --url "$TARGET_URL" \
  --preset mobile \
  --runs "$RUNS" \
  --output "$REPORT_DIR/local-mobile-summary.json" \
  --min-performance "$MIN_PERFORMANCE" \
  --min-accessibility "$MIN_ACCESSIBILITY" \
  --min-best-practices "$MIN_BEST_PRACTICES" \
  --min-seo "$MIN_SEO"

node scripts/perf/run-lighthouse-score.js \
  --url "$TARGET_URL" \
  --preset desktop \
  --runs "$RUNS" \
  --output "$REPORT_DIR/local-desktop-summary.json" \
  --min-performance "$MIN_PERFORMANCE" \
  --min-accessibility "$MIN_ACCESSIBILITY" \
  --min-best-practices "$MIN_BEST_PRACTICES" \
  --min-seo "$MIN_SEO"
