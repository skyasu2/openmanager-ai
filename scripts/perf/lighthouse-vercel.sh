#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${LIGHTHOUSE_URL:-https://openmanager-ai.vercel.app}"
REPORT_DIR="${LIGHTHOUSE_REPORT_DIR:-reports/lighthouse}"
RUNS="${LIGHTHOUSE_RUNS:-3}"
MIN_PERFORMANCE="${LIGHTHOUSE_MIN_PERFORMANCE:-0.8}"
MIN_ACCESSIBILITY="${LIGHTHOUSE_MIN_ACCESSIBILITY:-0.9}"
MIN_BEST_PRACTICES="${LIGHTHOUSE_MIN_BEST_PRACTICES:-0.85}"
MIN_SEO="${LIGHTHOUSE_MIN_SEO:-0.8}"

mkdir -p "$REPORT_DIR"

node scripts/perf/run-lighthouse-score.js \
  --url "$TARGET_URL" \
  --preset mobile \
  --runs "$RUNS" \
  --output "$REPORT_DIR/vercel-mobile-summary.json" \
  --min-performance "$MIN_PERFORMANCE" \
  --min-accessibility "$MIN_ACCESSIBILITY" \
  --min-best-practices "$MIN_BEST_PRACTICES" \
  --min-seo "$MIN_SEO"

node scripts/perf/run-lighthouse-score.js \
  --url "$TARGET_URL" \
  --preset desktop \
  --runs "$RUNS" \
  --output "$REPORT_DIR/vercel-desktop-summary.json" \
  --min-performance "$MIN_PERFORMANCE" \
  --min-accessibility "$MIN_ACCESSIBILITY" \
  --min-best-practices "$MIN_BEST_PRACTICES" \
  --min-seo "$MIN_SEO"
