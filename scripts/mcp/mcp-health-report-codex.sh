#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HEALTH_CHECK_SCRIPT="$REPO_ROOT/scripts/mcp/mcp-health-check-codex.sh"
OUTPUT_PATH="$REPO_ROOT/logs/mcp-health/codex-health-latest.json"
HEALTH_ARGS=()

usage() {
  cat <<'EOF'
Usage: bash scripts/mcp/mcp-health-report-codex.sh [options]

Options:
  --output <path>      Save JSON report to a specific path
  --no-live-probe      Forward to mcp-health-check-codex.sh
  --probe <server>     Forward to mcp-health-check-codex.sh
  -h, --help           Show this help

This wrapper:
  1. runs mcp-health-check-codex.sh with --json
  2. saves the JSON payload to a stable file path
  3. prints a one-line summary for operators/CI
  4. exits with the original health-check exit code
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --output)
      OUTPUT_PATH="${2:-}"
      shift 2
      ;;
    --no-live-probe)
      HEALTH_ARGS+=("--no-live-probe")
      shift
      ;;
    --probe)
      if [ $# -lt 2 ]; then
        echo "--probe requires a server name" >&2
        exit 2
      fi
      HEALTH_ARGS+=("--probe" "$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ ! -x "$HEALTH_CHECK_SCRIPT" ]; then
  echo "Missing executable health check script: $HEALTH_CHECK_SCRIPT" >&2
  exit 2
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

TMP_JSON="$(mktemp "${TMPDIR:-/tmp}/codex-mcp-health-report.XXXXXX.json")"
trap 'rm -f "$TMP_JSON"' EXIT

set +e
bash "$HEALTH_CHECK_SCRIPT" --json "${HEALTH_ARGS[@]}" >"$TMP_JSON"
HEALTH_EXIT_CODE=$?
set -e

cp "$TMP_JSON" "$OUTPUT_PATH"

SUMMARY_OUTPUT="$(
  JSON_REPORT_PATH="$OUTPUT_PATH" node <<'NODE'
const fs = require('node:fs');

const reportPath = process.env.JSON_REPORT_PATH;
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const liveProbeSummary = report.options?.runLiveProbe
  ? `live-probe-failures=${report.summary?.liveProbeFailCount ?? 0}`
  : 'live-probe=skipped';

console.log(
  [
    `status=${report.exitCode === 0 ? 'ok' : report.exitCode === 1 ? 'warn' : 'fail'}`,
    `servers=${report.summary?.successCount ?? 0}/${report.summary?.totalServers ?? 0}`,
    liveProbeSummary,
    `report=${reportPath}`,
    `log=${report.logFile ?? '-'}`,
  ].join(' ')
);
NODE
)"

echo "$SUMMARY_OUTPUT"
exit "$HEALTH_EXIT_CODE"
