#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HEALTH_CHECK_SCRIPT="$REPO_ROOT/scripts/mcp/mcp-health-check-codex.sh"
OUTPUT_PATH="$REPO_ROOT/logs/mcp-health/codex-health-latest.json"
HEALTH_ARGS=()
ALLOW_MISSING_CODEX=0
SUMMARY_FILE=""

usage() {
  cat <<'EOF'
Usage: bash scripts/mcp/mcp-health-report-codex.sh [options]

Options:
  --output <path>      Save JSON report to a specific path
  --allow-missing-codex
                      Emit a skipped report instead of failing when codex CLI is unavailable
  --summary-file <path>
                      Append a Markdown summary to the given file (for CI summaries)
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
    --allow-missing-codex)
      ALLOW_MISSING_CODEX=1
      shift
      ;;
    --summary-file)
      SUMMARY_FILE="${2:-}"
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
if [ -n "$SUMMARY_FILE" ]; then
  mkdir -p "$(dirname "$SUMMARY_FILE")"
fi

TMP_JSON="$(mktemp "${TMPDIR:-/tmp}/codex-mcp-health-report.XXXXXX.json")"
trap 'rm -f "$TMP_JSON"' EXIT

if ! command -v codex >/dev/null 2>&1; then
  if [ "$ALLOW_MISSING_CODEX" -ne 1 ]; then
    echo "codex CLI is not available in PATH" >&2
    exit 2
  fi

  REPORT_TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')" \
  REPORT_CONFIG_FILE="$REPO_ROOT/.codex/config.toml" \
  REPORT_OUTPUT_PATH="$OUTPUT_PATH" \
  REPORT_LIVE_TIMEOUT="${MCP_LIVE_PROBE_TIMEOUT_SEC:-45}" \
  REPORT_SELECTED_PROBES="$(IFS=,; printf '%s' "${HEALTH_ARGS[*]:-}")" \
  REPORT_RUN_LIVE_PROBE="$(
    if printf '%s\n' "${HEALTH_ARGS[*]:-}" | grep -q -- '--no-live-probe'; then
      printf 'false'
    else
      printf 'true'
    fi
  )" \
  node <<'NODE' >"$TMP_JSON"
const fs = require('node:fs');

const rawArgs = (process.env.REPORT_SELECTED_PROBES || '').split(/\s+/).filter(Boolean);
const selectedProbes = [];
for (let index = 0; index < rawArgs.length; index += 1) {
  if (rawArgs[index] === '--probe' && rawArgs[index + 1]) {
    selectedProbes.push(rawArgs[index + 1]);
  }
}

const payload = {
  timestamp: process.env.REPORT_TIMESTAMP,
  exitCode: 0,
  configFile: process.env.REPORT_CONFIG_FILE,
  logFile: null,
  options: {
    format: 'json',
    runLiveProbe: process.env.REPORT_RUN_LIVE_PROBE === 'true',
    selectedProbes,
    liveProbeTimeoutSec: Number(process.env.REPORT_LIVE_TIMEOUT || '45'),
  },
  runtime: {
    codexHome: null,
    codexHomeSource: null,
    cloudsdkConfig: null,
    cloudsdkConfigSource: null,
  },
  summary: {
    totalServers: 0,
    successCount: 0,
    failCount: 0,
    successRate: 0,
    liveProbeFailCount: 0,
    permissionWarningCount: 0,
    todayMcpCalls: null,
  },
  servers: [],
  liveProbes: [],
  warnings: [
    {
      category: 'codex',
      message: 'codex CLI unavailable in current environment; report skipped',
    },
  ],
  error: null,
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
NODE
  HEALTH_EXIT_CODE=0
else
  set +e
  bash "$HEALTH_CHECK_SCRIPT" --json "${HEALTH_ARGS[@]}" >"$TMP_JSON"
  HEALTH_EXIT_CODE=$?
  set -e
fi

cp "$TMP_JSON" "$OUTPUT_PATH"

SUMMARY_OUTPUT="$(
  JSON_REPORT_PATH="$OUTPUT_PATH" node <<'NODE'
const fs = require('node:fs');

const reportPath = process.env.JSON_REPORT_PATH;
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const skipped = Array.isArray(report.warnings)
  && report.warnings.some(
    (warning) =>
      warning?.category === 'codex'
      && typeof warning.message === 'string'
      && warning.message.includes('report skipped')
  );
const liveProbeSummary = report.options?.runLiveProbe
  ? `live-probe-failures=${report.summary?.liveProbeFailCount ?? 0}`
  : 'live-probe=skipped';
const status = skipped
  ? 'skipped'
  : report.exitCode === 0
    ? 'ok'
    : report.exitCode === 1
      ? 'warn'
      : 'fail';

console.log(
  [
    `status=${status}`,
    `servers=${report.summary?.successCount ?? 0}/${report.summary?.totalServers ?? 0}`,
    liveProbeSummary,
    `report=${reportPath}`,
    `log=${report.logFile ?? '-'}`,
  ].join(' ')
);
NODE
)"

echo "$SUMMARY_OUTPUT"

if [ -n "$SUMMARY_FILE" ]; then
  JSON_REPORT_PATH="$OUTPUT_PATH" SUMMARY_FILE_PATH="$SUMMARY_FILE" node <<'NODE'
const fs = require('node:fs');

const report = JSON.parse(fs.readFileSync(process.env.JSON_REPORT_PATH, 'utf8'));
const summaryPath = process.env.SUMMARY_FILE_PATH;
const skipped = Array.isArray(report.warnings)
  && report.warnings.some(
    (warning) =>
      warning?.category === 'codex'
      && typeof warning.message === 'string'
      && warning.message.includes('report skipped')
  );
const status = skipped
  ? 'skipped'
  : report.exitCode === 0
    ? 'ok'
    : report.exitCode === 1
      ? 'warn'
      : 'fail';

const lines = [
  '## Codex MCP Health',
  `- Status: ${status}`,
  `- Servers: ${report.summary?.successCount ?? 0}/${report.summary?.totalServers ?? 0}`,
  report.options?.runLiveProbe
    ? `- Live probe failures: ${report.summary?.liveProbeFailCount ?? 0}`
    : '- Live probe: skipped',
  `- Report: \`${process.env.JSON_REPORT_PATH}\``,
];

if (report.logFile) {
  lines.push(`- Log: \`${report.logFile}\``);
}

if (skipped) {
  lines.push('- Note: codex CLI unavailable on runner, placeholder report emitted');
}

fs.appendFileSync(summaryPath, `${lines.join('\n')}\n\n`);
NODE
fi

exit "$HEALTH_EXIT_CODE"
