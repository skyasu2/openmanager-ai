#!/bin/bash
# Codex MCP Health Check Script
# 목적: Codex MCP 서버 설정 상태 점검 (설정 파일 기반 SSOT)
# 사용: ./scripts/mcp/mcp-health-check-codex.sh [--json] [--no-live-probe] [--probe <server>]

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LOG_DIR="logs/mcp-health"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d)-codex.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CODEX_LOCAL_RUNNER="$REPO_ROOT/scripts/mcp/codex-local.sh"
RUNTIME_ENV_RESOLVER="$REPO_ROOT/scripts/mcp/resolve-runtime-env.sh"
GITHUB_MCP_AUTH_SYNC="$REPO_ROOT/scripts/mcp/sync-github-mcp-auth.sh"
USAGE_COUNTER="$REPO_ROOT/scripts/mcp/count-codex-mcp-usage.sh"
EXPECTED_SERVERS=()
CONFIG_FILE="$REPO_ROOT/.codex/config.toml"
DEFAULT_LIVE_PROBE_TIMEOUT_SEC=45
LIVE_PROBE_TIMEOUT_SEC="${MCP_LIVE_PROBE_TIMEOUT_SEC:-}"
RUN_LIVE_PROBE=1
SELECTED_PROBES=()
AVAILABLE_LIVE_PROBE_SERVERS=("supabase-db" "stitch")
OUTPUT_FORMAT="text"
JSON_STATE_DIR=""
SERVER_STATUS_FILE=""
LIVE_PROBE_STATUS_FILE=""
WARNING_STATUS_FILE=""
JSON_EMITTED=0
LAST_ERROR=""
TODAY_CALLS=""
SUCCESS_COUNT=0
FAIL_COUNT=0
LIVE_PROBE_FAIL_COUNT=0
PERMISSION_WARNING_COUNT=0

print_usage() {
  cat <<EOF
Usage: bash scripts/mcp/mcp-health-check-codex.sh [options]

Options:
  --json              Emit machine-readable JSON to stdout (text logs go to stderr)
  --no-live-probe     Skip live MCP tool probes and check config/enabled state only
  --probe <server>    Run live probe only for the selected server
  -h, --help          Show this help message

Available live probes:
  ${AVAILABLE_LIVE_PROBE_SERVERS[*]}
EOF
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --json)
        OUTPUT_FORMAT="json"
        shift
        ;;
      --no-live-probe)
        RUN_LIVE_PROBE=0
        shift
        ;;
      --probe)
        if [ $# -lt 2 ]; then
          LAST_ERROR="--probe requires a server name"
          echo -e "${RED}--probe requires a server name${NC}"
          exit 2
        fi
        SELECTED_PROBES+=("$2")
        shift 2
        ;;
      -h|--help)
        print_usage
        exit 0
        ;;
      *)
        LAST_ERROR="Unknown option: $1"
        echo -e "${RED}Unknown option: $1${NC}"
        print_usage
        exit 2
        ;;
    esac
  done

  if [ "$RUN_LIVE_PROBE" -eq 0 ] && [ "${#SELECTED_PROBES[@]}" -gt 0 ]; then
    LAST_ERROR="--no-live-probe and --probe cannot be used together"
    echo -e "${RED}--no-live-probe and --probe cannot be used together${NC}"
    exit 2
  fi
}

# OPENMANAGER_STORYBOOK_MCP_MODE:
# - auto (default): Storybook MCP endpoint가 살아있을 때만 expected 대상에 포함
# - off: 항상 제외
# - on: 항상 포함
get_storybook_mode() {
  local mode="${OPENMANAGER_STORYBOOK_MCP_MODE:-auto}"
  mode="$(printf '%s' "$mode" | tr '[:upper:]' '[:lower:]')"
  case "$mode" in
    on|off|auto)
      printf '%s\n' "$mode"
      ;;
    *)
      printf 'off\n'
      ;;
  esac
}

read_storybook_url() {
  local config_file="$1"
  local url=""
  url="$(
    awk '
      /^\[mcp_servers\.storybook\]$/ {
        in_section = 1
        next
      }
      /^\[mcp_servers\./ {
        if (in_section) {
          exit
        }
      }
      in_section && /^[[:space:]]*url[[:space:]]*=/ {
        line = $0
        sub(/^[^"]*"/, "", line)
        sub(/".*$/, "", line)
        print line
        exit
      }
    ' "$config_file"
  )"
  if [ -n "$url" ]; then
    printf '%s\n' "$url"
    return 0
  fi
  printf 'http://localhost:6006/mcp\n'
}

is_storybook_reachable() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    if curl -sS -m 2 -o /dev/null "$url" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

adjust_expected_servers_for_storybook_mode() {
  local mode=""
  local include_storybook=1
  local storybook_url=""
  local server=""
  local filtered=()

  mode="$(get_storybook_mode)"
  case "$mode" in
    on)
      include_storybook=1
      ;;
    off)
      include_storybook=0
      ;;
    auto)
      storybook_url="$(read_storybook_url "$CONFIG_FILE")"
      if is_storybook_reachable "$storybook_url"; then
        include_storybook=1
      else
        include_storybook=0
      fi
      ;;
  esac

  if [ "$include_storybook" -eq 1 ]; then
    return 0
  fi

  for server in "${EXPECTED_SERVERS[@]}"; do
    if [ "$server" != "storybook" ]; then
      filtered+=("$server")
    fi
  done
  EXPECTED_SERVERS=("${filtered[@]}")

  echo "  - Storybook MCP expected list excluded (mode: $mode)"
  echo "  - Storybook MCP expected list excluded (mode: $mode)" >> "$LOG_FILE"
}

array_contains() {
  local target="$1"
  shift
  local item=""
  for item in "$@"; do
    if [ "$item" = "$target" ]; then
      return 0
    fi
  done
  return 1
}

normalize_record_field() {
  printf '%s' "$1" | tr '\t\r\n' '   '
}

init_json_state() {
  if [ "$OUTPUT_FORMAT" != "json" ]; then
    return 0
  fi

  JSON_STATE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/openmanager-mcp-health.XXXXXX" 2>/dev/null)" || {
    LAST_ERROR="Unable to initialize JSON state directory"
    echo -e "${RED}Unable to initialize JSON state directory${NC}"
    exit 2
  }
  SERVER_STATUS_FILE="$JSON_STATE_DIR/server-status.tsv"
  LIVE_PROBE_STATUS_FILE="$JSON_STATE_DIR/live-probe-status.tsv"
  WARNING_STATUS_FILE="$JSON_STATE_DIR/warnings.tsv"
  : > "$SERVER_STATUS_FILE"
  : > "$LIVE_PROBE_STATUS_FILE"
  : > "$WARNING_STATUS_FILE"
}

record_server_status() {
  if [ -z "$SERVER_STATUS_FILE" ]; then
    return 0
  fi
  printf '%s\t%s\t%s\n' \
    "$(normalize_record_field "$1")" \
    "$(normalize_record_field "$2")" \
    "$(normalize_record_field "$3")" >> "$SERVER_STATUS_FILE"
}

record_live_probe_status() {
  if [ -z "$LIVE_PROBE_STATUS_FILE" ]; then
    return 0
  fi
  printf '%s\t%s\t%s\t%s\n' \
    "$(normalize_record_field "$1")" \
    "$(normalize_record_field "$2")" \
    "$(normalize_record_field "$3")" \
    "$(normalize_record_field "$4")" >> "$LIVE_PROBE_STATUS_FILE"
}

record_warning() {
  if [ -z "$WARNING_STATUS_FILE" ]; then
    return 0
  fi
  printf '%s\t%s\n' \
    "$(normalize_record_field "$1")" \
    "$(normalize_record_field "$2")" >> "$WARNING_STATUS_FILE"
}

emit_json() {
  if [ "$OUTPUT_FORMAT" != "json" ] || [ "$JSON_EMITTED" -eq 1 ]; then
    return 0
  fi

  local selected_probes_csv=""
  selected_probes_csv="$(IFS=,; printf '%s' "${SELECTED_PROBES[*]:-}")"

  JSON_EXIT_CODE="${1:-0}" \
  JSON_TIMESTAMP="$TIMESTAMP" \
  JSON_CONFIG_FILE="$CONFIG_FILE" \
  JSON_LOG_FILE="$LOG_FILE" \
  JSON_CODEX_HOME="${CODEX_HOME:-}" \
  JSON_CODEX_HOME_SOURCE="${OPENMANAGER_CODEX_HOME_SOURCE:-}" \
  JSON_CLOUDSDK_CONFIG="${CLOUDSDK_CONFIG:-}" \
  JSON_CLOUDSDK_CONFIG_SOURCE="${OPENMANAGER_GCLOUD_CONFIG_SOURCE:-}" \
  JSON_RUN_LIVE_PROBE="$RUN_LIVE_PROBE" \
  JSON_SELECTED_PROBES="$selected_probes_csv" \
  JSON_LIVE_PROBE_TIMEOUT_SEC="$LIVE_PROBE_TIMEOUT_SEC" \
  JSON_DEFAULT_LIVE_PROBE_TIMEOUT_SEC="$DEFAULT_LIVE_PROBE_TIMEOUT_SEC" \
  JSON_AVAILABLE_LIVE_PROBE_SERVERS="$(IFS=,; printf '%s' "${AVAILABLE_LIVE_PROBE_SERVERS[*]}")" \
  JSON_PROBE_CALL_TOOLS='{"supabase-db":"list_projects","stitch":"list_projects"}' \
  JSON_TOTAL_SERVERS="${#EXPECTED_SERVERS[@]}" \
  JSON_SUCCESS_COUNT="$SUCCESS_COUNT" \
  JSON_FAIL_COUNT="$FAIL_COUNT" \
  JSON_SUCCESS_RATE="${SUCCESS_RATE:-0}" \
  JSON_LIVE_PROBE_FAIL_COUNT="$LIVE_PROBE_FAIL_COUNT" \
  JSON_PERMISSION_WARNING_COUNT="$PERMISSION_WARNING_COUNT" \
  JSON_TODAY_CALLS="$TODAY_CALLS" \
  JSON_LAST_ERROR="$LAST_ERROR" \
  node - "$SERVER_STATUS_FILE" "$LIVE_PROBE_STATUS_FILE" "$WARNING_STATUS_FILE" <<'NODE' >&3
const fs = require('node:fs');

const [serverFile, probeFile, warningFile] = process.argv.slice(2);

function parseTsv(file, width) {
  if (!file || !fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      while (parts.length < width) parts.push('');
      return parts.slice(0, width);
    });
}

const serverRows = parseTsv(serverFile, 3).map(([name, status, detail]) => ({
  name,
  status,
  detail,
}));

const liveProbeRows = parseTsv(probeFile, 4).map(([server, stage, status, detail]) => ({
  server,
  stage: stage || null,
  status,
  detail,
}));

const warningRows = parseTsv(warningFile, 2).map(([category, message]) => ({
  category,
  message,
}));

const selectedProbes = (process.env.JSON_SELECTED_PROBES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const availableLiveProbeServers = (process.env.JSON_AVAILABLE_LIVE_PROBE_SERVERS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const defaultLiveProbeTimeoutSec = Number(process.env.JSON_DEFAULT_LIVE_PROBE_TIMEOUT_SEC || '45');
const liveProbeTimeoutOverrideRaw = (process.env.JSON_LIVE_PROBE_TIMEOUT_SEC || '').trim();
const liveProbeTimeoutOverride = liveProbeTimeoutOverrideRaw === ''
  ? null
  : Number(liveProbeTimeoutOverrideRaw);
const runLiveProbe = process.env.JSON_RUN_LIVE_PROBE === '1';
const probeCallTools = (() => {
  try {
    return JSON.parse(process.env.JSON_PROBE_CALL_TOOLS || '{}');
  } catch {
    return {};
  }
})();

const todayCallsRaw = process.env.JSON_TODAY_CALLS || '';
const todayCalls = todayCallsRaw === '' ? null : Number(todayCallsRaw);

function parseProbeTargets(configFile, probeServers) {
  if (!configFile || !fs.existsSync(configFile) || probeServers.length === 0) {
    return [];
  }

  const sectionMap = new Map();
  let activeServer = null;

  for (const rawLine of fs.readFileSync(configFile, 'utf8').split('\n')) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^\[mcp_servers\.([A-Za-z0-9._-]+)\]$/);
    if (sectionMatch) {
      activeServer = probeServers.includes(sectionMatch[1]) ? sectionMatch[1] : null;
      if (activeServer && !sectionMap.has(activeServer)) {
        sectionMap.set(activeServer, {
          command: null,
          args: [],
          startupTimeoutSec: null,
        });
      }
      continue;
    }

    if (!activeServer || line === '' || line.startsWith('#')) {
      continue;
    }

    const target = sectionMap.get(activeServer);
    const commandMatch = line.match(/^command\s*=\s*"([^"]+)"\s*$/);
    if (commandMatch) {
      target.command = commandMatch[1];
      continue;
    }

    const argsMatch = line.match(/^args\s*=\s*(\[[^\n]*\])\s*$/);
    if (argsMatch) {
      try {
        const args = JSON.parse(argsMatch[1]);
        target.args = Array.isArray(args) ? args : [];
      } catch {
        target.args = [];
      }
      continue;
    }

    const timeoutMatch = line.match(/^startup_timeout_sec\s*=\s*(\d+)\s*$/);
    if (timeoutMatch) {
      target.startupTimeoutSec = Number(timeoutMatch[1]);
    }
  }

  return probeServers.map((server) => {
    const target = sectionMap.get(server) || {};
    const configuredTimeoutSec = typeof target.startupTimeoutSec === 'number'
      ? target.startupTimeoutSec
      : null;
    const timeoutSec = liveProbeTimeoutOverride ?? configuredTimeoutSec ?? defaultLiveProbeTimeoutSec;
    const selected = runLiveProbe && (selectedProbes.length === 0 || selectedProbes.includes(server));

    return {
      server,
      selected,
      command: target.command ?? null,
      args: Array.isArray(target.args) ? target.args : [],
      configuredTimeoutSec,
      timeoutSec,
      callTool: probeCallTools[server] ?? null,
    };
  });
}

const probeTargets = parseProbeTargets(process.env.JSON_CONFIG_FILE, availableLiveProbeServers);
const probeTargetMap = new Map(probeTargets.map((target) => [target.server, target]));

const payload = {
  timestamp: process.env.JSON_TIMESTAMP || null,
  exitCode: Number(process.env.JSON_EXIT_CODE || '0'),
  configFile: process.env.JSON_CONFIG_FILE || null,
  logFile: process.env.JSON_LOG_FILE || null,
  options: {
    format: 'json',
    runLiveProbe,
    selectedProbes,
    liveProbeTimeoutSec: liveProbeTimeoutOverride ?? defaultLiveProbeTimeoutSec,
    usesConfigTimeouts: liveProbeTimeoutOverride == null,
  },
  runtime: {
    codexHome: process.env.JSON_CODEX_HOME || null,
    codexHomeSource: process.env.JSON_CODEX_HOME_SOURCE || null,
    cloudsdkConfig: process.env.JSON_CLOUDSDK_CONFIG || null,
    cloudsdkConfigSource: process.env.JSON_CLOUDSDK_CONFIG_SOURCE || null,
  },
  summary: {
    totalServers: Number(process.env.JSON_TOTAL_SERVERS || '0'),
    successCount: Number(process.env.JSON_SUCCESS_COUNT || '0'),
    failCount: Number(process.env.JSON_FAIL_COUNT || '0'),
    successRate: Number(process.env.JSON_SUCCESS_RATE || '0'),
    liveProbeFailCount: Number(process.env.JSON_LIVE_PROBE_FAIL_COUNT || '0'),
    permissionWarningCount: Number(process.env.JSON_PERMISSION_WARNING_COUNT || '0'),
    todayMcpCalls: Number.isNaN(todayCalls) ? null : todayCalls,
  },
  servers: serverRows,
  probeTargets,
  liveProbes: liveProbeRows.map((row) => ({
    ...probeTargetMap.get(row.server),
    server: row.server,
    stage: row.stage,
    status: row.status,
    detail: row.detail,
  })),
  warnings: warningRows,
  error: process.env.JSON_LAST_ERROR || null,
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
NODE
  JSON_EMITTED=1
}

cleanup_on_exit() {
  local exit_code=$?
  emit_json "$exit_code"
  if [ -n "$JSON_STATE_DIR" ] && [ -d "$JSON_STATE_DIR" ]; then
    rm -rf "$JSON_STATE_DIR"
  fi
}

validate_selected_probes() {
  local server=""

  if [ "${#SELECTED_PROBES[@]}" -eq 0 ]; then
    return 0
  fi

  for server in "${SELECTED_PROBES[@]}"; do
    if ! array_contains "$server" "${AVAILABLE_LIVE_PROBE_SERVERS[@]}"; then
      LAST_ERROR="Unsupported live probe target: ${server}"
      echo -e "${RED}Unsupported live probe target: ${server}${NC}"
      echo "Supported live probes: ${AVAILABLE_LIVE_PROBE_SERVERS[*]}"
      exit 2
    fi
    if ! has_server "$server"; then
      LAST_ERROR="Selected live probe server not found in config: ${server}"
      echo -e "${RED}Selected live probe server not found in config: ${server}${NC}"
      exit 2
    fi
  done
}

should_probe_server() {
  local server="$1"
  if [ "$RUN_LIVE_PROBE" -ne 1 ]; then
    return 1
  fi
  if [ "${#SELECTED_PROBES[@]}" -eq 0 ]; then
    return 0
  fi
  array_contains "$server" "${SELECTED_PROBES[@]}"
}

parse_args "$@"
if [ "$OUTPUT_FORMAT" = "json" ]; then
  exec 3>&1
  exec 1>&2
fi
init_json_state
trap cleanup_on_exit EXIT

echo -e "${BLUE}Codex MCP Health Check${NC}"
echo -e "${BLUE}======================${NC}"
echo "시작 시간: $TIMESTAMP"
echo ""

{
  echo "==================================="
  echo "Codex MCP Health Check - $TIMESTAMP"
  echo "==================================="
  echo ""
} >> "$LOG_FILE"

if [ ! -x "$CODEX_LOCAL_RUNNER" ]; then
  LAST_ERROR="프로젝트 Codex 실행기 누락: $CODEX_LOCAL_RUNNER"
  echo -e "${RED}프로젝트 Codex 실행기 누락: $CODEX_LOCAL_RUNNER${NC}"
  echo "프로젝트 Codex 실행기 누락: $CODEX_LOCAL_RUNNER" >> "$LOG_FILE"
  exit 2
fi

if [ ! -f "$RUNTIME_ENV_RESOLVER" ]; then
  LAST_ERROR="런타임 환경 해석기 누락: $RUNTIME_ENV_RESOLVER"
  echo -e "${RED}런타임 환경 해석기 누락: $RUNTIME_ENV_RESOLVER${NC}"
  echo "런타임 환경 해석기 누락: $RUNTIME_ENV_RESOLVER" >> "$LOG_FILE"
  exit 2
fi

# project .codex/config.toml is the SSOT, but the diagnostic runtime path can
# fall back to a writable home CODEX_HOME when the project directory is not
# writable in the current shell environment.
: "${OPENMANAGER_CODEX_HOME_MODE:=auto}"
export OPENMANAGER_CODEX_HOME_MODE
# shellcheck source=/dev/null
source "$RUNTIME_ENV_RESOLVER"

if [ -x "$GITHUB_MCP_AUTH_SYNC" ]; then
  CODEX_HOME="$REPO_ROOT/.codex" "$GITHUB_MCP_AUTH_SYNC" || true
fi

load_expected_servers() {
  if [ ! -f "$CONFIG_FILE" ]; then
    LAST_ERROR="Codex 설정 파일 누락: $CONFIG_FILE"
    echo -e "${RED}Codex 설정 파일 누락: $CONFIG_FILE${NC}"
    echo "Codex 설정 파일 누락: $CONFIG_FILE" >> "$LOG_FILE"
    exit 2
  fi

  mapfile -t EXPECTED_SERVERS < <(
    awk '
      /^\[mcp_servers\.[A-Za-z0-9._-]+\]$/ {
        line = $0
        sub(/^\[mcp_servers\./, "", line)
        sub(/\]$/, "", line)
        if (line !~ /\.env$/) {
          print line
        }
      }
    ' "$CONFIG_FILE"
  )

  if [ "${#EXPECTED_SERVERS[@]}" -eq 0 ]; then
    LAST_ERROR="MCP 서버 설정 파싱 실패: $CONFIG_FILE"
    echo -e "${RED}MCP 서버 설정 파싱 실패: $CONFIG_FILE${NC}"
    echo "MCP 서버 설정 파싱 실패: $CONFIG_FILE" >> "$LOG_FILE"
    exit 2
  fi

  echo "  - MCP config: $CONFIG_FILE (${#EXPECTED_SERVERS[@]} servers)"
  {
    echo "  - MCP config: $CONFIG_FILE (${#EXPECTED_SERVERS[@]} servers)"
  } >> "$LOG_FILE"
}

has_server() {
  local target="$1"
  local s=""
  for s in "${EXPECTED_SERVERS[@]}"; do
    if [ "$s" = "$target" ]; then
      return 0
    fi
  done
  return 1
}

get_server_env_value() {
  local server="$1"
  local key="$2"
  awk -v section="[mcp_servers.${server}.env]" -v target="$key" '
    BEGIN { in_section = 0 }
    $0 ~ /^\[.*\]$/ {
      in_section = ($0 == section)
      next
    }
    in_section {
      pattern = "^[[:space:]]*" target "[[:space:]]*="
      if ($0 ~ pattern) {
        line = $0
        sub(/^[^"]*"/, "", line)
        sub(/"[[:space:]]*$/, "", line)
        print line
        exit
      }
    }
  ' "$CONFIG_FILE"
}

get_server_config_value() {
  local server="$1"
  local key="$2"
  awk -v section="[mcp_servers.${server}]" -v target="$key" '
    BEGIN { in_section = 0 }
    $0 ~ /^\[.*\]$/ {
      in_section = ($0 == section)
      next
    }
    in_section {
      pattern = "^[[:space:]]*" target "[[:space:]]*="
      if ($0 ~ pattern) {
        line = $0
        sub("^[[:space:]]*" target "[[:space:]]*=[[:space:]]*", "", line)
        print line
        exit
      }
    }
  ' "$CONFIG_FILE"
}

get_server_command() {
  local raw=""
  raw="$(get_server_config_value "$1" "command")"
  printf '%s\n' "$raw" | sed -E 's/^[[:space:]]*"//; s/"[[:space:]]*$//'
}

get_server_args_json() {
  get_server_config_value "$1" "args"
}

get_server_probe_timeout_sec() {
  local server="$1"
  local raw=""

  if [ -n "$LIVE_PROBE_TIMEOUT_SEC" ]; then
    printf '%s\n' "$LIVE_PROBE_TIMEOUT_SEC"
    return 0
  fi

  raw="$(get_server_config_value "$server" "startup_timeout_sec" | tr -d '[:space:]')"
  if printf '%s' "$raw" | grep -Eq '^[0-9]+$' && [ "$raw" -gt 0 ]; then
    printf '%s\n' "$raw"
    return 0
  fi

  printf '%s\n' "$DEFAULT_LIVE_PROBE_TIMEOUT_SEC"
}

run_live_probe() {
  local server="$1"
  local stage="$2"
  local transport_command="$3"
  local transport_args_json="$4"
  local call_tool="$5"
  local probe_timeout_sec="$6"
  shift 6
  local probe_env=("$@")
  local probe_output=""
  local probe_status=0
  local probe_label="$server"

  if [ -n "$stage" ]; then
    probe_label="${server}/${stage}"
  fi

  echo "  - ${probe_label}: probing (timeout ${probe_timeout_sec}s)"
  echo "  - ${probe_label}: probing (timeout ${probe_timeout_sec}s)" >> "$LOG_FILE"

  set +e
  probe_output=$(env "${probe_env[@]}" \
    MCP_PROBE_SERVER="$server" \
    MCP_PROBE_COMMAND="$transport_command" \
    MCP_PROBE_ARGS_JSON="$transport_args_json" \
    MCP_PROBE_CALL_TOOL="$call_tool" \
    timeout "$probe_timeout_sec" node --input-type=module <<'NODE' 2>&1
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

const command = process.env.MCP_PROBE_COMMAND;
const args = JSON.parse(process.env.MCP_PROBE_ARGS_JSON || '[]');
const callTool = process.env.MCP_PROBE_CALL_TOOL || '';
const serverName = process.env.MCP_PROBE_SERVER || 'unknown';

const client = new Client({ name: `${serverName}-health-check`, version: '1.0.0' });
const transport = new StdioClientTransport({
  command,
  args,
  env: { ...process.env },
});

try {
  await client.connect(transport);
  const toolsRes = await client.request({ method: 'tools/list', params: {} }, ListToolsResultSchema);
  const tools = toolsRes.tools ?? [];
  const result = { ok: true, toolCount: tools.length };

  if (callTool && tools.some((tool) => tool.name === callTool)) {
    const callRes = await client.request(
      { method: 'tools/call', params: { name: callTool, arguments: {} } },
      CallToolResultSchema,
    );
    result.callTool = callTool;
    result.callIsError = !!callRes.isError;
  }

  console.log(JSON.stringify(result));
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  process.exitCode = 1;
} finally {
  try {
    await transport.close();
  } catch {}
}
NODE
)
  probe_status=$?
  set -e

  if [ "$probe_status" -eq 0 ] && printf '%s\n' "$probe_output" | grep -q '"ok":true'; then
    echo -e "${GREEN}OK${NC}   ${probe_label}: live probe"
    echo "OK   ${probe_label}: live probe" >> "$LOG_FILE"
    record_live_probe_status "$server" "$stage" "ok" "success (timeout ${probe_timeout_sec}s)"
    return 0
  fi

  if [ "$probe_status" -eq 124 ]; then
    echo -e "${YELLOW}WARN${NC} ${probe_label}: live probe timed out (${probe_timeout_sec}s)"
    echo "WARN ${probe_label}: live probe timed out (${probe_timeout_sec}s)" >> "$LOG_FILE"
    record_live_probe_status "$server" "$stage" "warn" "timed out (${probe_timeout_sec}s)"
    return 1
  fi

  echo -e "${YELLOW}WARN${NC} ${probe_label}: live probe failed"
  echo "WARN ${probe_label}: live probe failed" >> "$LOG_FILE"
  printf '%s\n' "$probe_output" | sed 's/^/  - /' | sed -n '1,4p'
  printf '%s\n' "$probe_output" | sed 's/^/  - /' | sed -n '1,4p' >> "$LOG_FILE"
  record_live_probe_status "$server" "$stage" "warn" "$(printf '%s\n' "$probe_output" | sed -n '1p')"
  return 1
}

load_expected_servers
adjust_expected_servers_for_storybook_mode
validate_selected_probes

echo -e "${BLUE}Runtime Paths${NC}"
echo "  - CODEX_HOME: $CODEX_HOME (${OPENMANAGER_CODEX_HOME_SOURCE})"
echo "  - CLOUDSDK_CONFIG: $CLOUDSDK_CONFIG (${OPENMANAGER_GCLOUD_CONFIG_SOURCE})"
echo ""

{
  echo "Runtime Paths:"
  echo "  - CODEX_HOME: $CODEX_HOME (${OPENMANAGER_CODEX_HOME_SOURCE})"
  echo "  - CLOUDSDK_CONFIG: $CLOUDSDK_CONFIG (${OPENMANAGER_GCLOUD_CONFIG_SOURCE})"
  echo ""
} >> "$LOG_FILE"

MCP_OUTPUT=$(timeout 15 "$CODEX_LOCAL_RUNNER" mcp list 2>&1)
MCP_EXIT_CODE=$?

if [ "$MCP_EXIT_CODE" -ne 0 ]; then
  LAST_ERROR="project codex mcp list 실행 실패 (exit: $MCP_EXIT_CODE)"
  echo -e "${RED}project codex mcp list 실행 실패 (exit: $MCP_EXIT_CODE)${NC}"
  echo "project codex mcp list 실행 실패 (exit: $MCP_EXIT_CODE)" >> "$LOG_FILE"
  echo "$MCP_OUTPUT" >> "$LOG_FILE"
  exit 2
fi

PERMISSION_WARNING_PATTERN='failed to clean up stale arg0 temp dirs|could not update PATH: Permission denied|Permission denied \(os error 13\)'
PERMISSION_WARNINGS=$(printf '%s\n' "$MCP_OUTPUT" | grep -E "$PERMISSION_WARNING_PATTERN" || true)
MCP_TABLE=$(printf '%s\n' "$MCP_OUTPUT" | awk 'BEGIN { in_table=0 } /^Name[[:space:]]+Command[[:space:]]+Args/ { in_table=1 } in_table { print }')

if [ -z "$MCP_TABLE" ]; then
  LAST_ERROR="project codex mcp list 출력 파싱 실패 (서버 테이블 없음)"
  echo -e "${RED}project codex mcp list 출력 파싱 실패 (서버 테이블 없음)${NC}"
  echo "project codex mcp list 출력 파싱 실패 (서버 테이블 없음)" >> "$LOG_FILE"
  echo "$MCP_OUTPUT" >> "$LOG_FILE"
  exit 2
fi

if [ -n "$PERMISSION_WARNINGS" ]; then
  PERMISSION_WARNING_COUNT=$(printf '%s\n' "$PERMISSION_WARNINGS" | grep -c . || true)
  echo -e "${YELLOW}환경 경고${NC}: 샌드박스 권한 제한으로 일부 정리 작업이 실패했습니다."
  echo "환경 경고: 샌드박스 권한 제한으로 일부 정리 작업이 실패했습니다." >> "$LOG_FILE"
  printf '%s\n' "$PERMISSION_WARNINGS" | sed 's/^/  - /'
  printf '%s\n' "$PERMISSION_WARNINGS" | sed 's/^/  - /' >> "$LOG_FILE"
  while IFS= read -r warning_line; do
    if [ -n "$warning_line" ]; then
      record_warning "permission" "$warning_line"
    fi
  done <<< "$PERMISSION_WARNINGS"
  echo ""
fi

echo -e "${BLUE}MCP 서버 상태:${NC}"
echo "MCP 서버 상태:" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

for server in "${EXPECTED_SERVERS[@]}"; do
  SERVER_ROW=$(printf '%s\n' "$MCP_TABLE" | grep -E "^${server}[[:space:]]" || true)

  if [ -z "$SERVER_ROW" ]; then
    echo -e "${RED}FAIL${NC} $server: 목록에 없음"
    echo "FAIL $server: 목록에 없음" >> "$LOG_FILE"
    record_server_status "$server" "fail" "missing"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  if printf '%s\n' "$SERVER_ROW" | grep -q " enabled "; then
    echo -e "${GREEN}OK${NC}   $server: enabled"
    echo "OK   $server: enabled" >> "$LOG_FILE"
    record_server_status "$server" "ok" "enabled"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo -e "${YELLOW}WARN${NC} $server: disabled"
    echo "WARN $server: disabled" >> "$LOG_FILE"
    record_server_status "$server" "warn" "disabled"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo -e "${BLUE}실동작 프로브:${NC}"
echo "실동작 프로브:" >> "$LOG_FILE"

if [ "$RUN_LIVE_PROBE" -ne 1 ]; then
  echo "  - skipped (--no-live-probe)"
  echo "  - skipped (--no-live-probe)" >> "$LOG_FILE"
elif [ ! -d "$REPO_ROOT/node_modules/@modelcontextprotocol/sdk" ]; then
  echo -e "${YELLOW}WARN${NC} live probe skipped: @modelcontextprotocol/sdk 미설치"
  echo "WARN live probe skipped: @modelcontextprotocol/sdk 미설치" >> "$LOG_FILE"
  record_warning "live-probe" "@modelcontextprotocol/sdk 미설치"
else
  if should_probe_server "supabase-db"; then
    SUPABASE_TOKEN=$(get_server_env_value "supabase-db" "SUPABASE_ACCESS_TOKEN")
    SUPABASE_COMMAND="$(get_server_command "supabase-db")"
    SUPABASE_ARGS_JSON="$(get_server_args_json "supabase-db")"
    SUPABASE_TIMEOUT_SEC="$(get_server_probe_timeout_sec "supabase-db")"
    if [ -z "$SUPABASE_TOKEN" ]; then
      echo -e "${YELLOW}WARN${NC} supabase-db: live probe skipped (SUPABASE_ACCESS_TOKEN missing)"
      echo "WARN supabase-db: live probe skipped (SUPABASE_ACCESS_TOKEN missing)" >> "$LOG_FILE"
      record_live_probe_status "supabase-db" "preflight" "warn" "skipped (SUPABASE_ACCESS_TOKEN missing)"
      LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
    elif [ -z "$SUPABASE_COMMAND" ] || [ -z "$SUPABASE_ARGS_JSON" ]; then
      echo -e "${YELLOW}WARN${NC} supabase-db: live probe skipped (launch config missing)"
      echo "WARN supabase-db: live probe skipped (launch config missing)" >> "$LOG_FILE"
      record_live_probe_status "supabase-db" "preflight" "warn" "skipped (launch config missing)"
      LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
    else
      if ! run_live_probe \
        "supabase-db" \
        "full" \
        "$SUPABASE_COMMAND" \
        "$SUPABASE_ARGS_JSON" \
        "list_projects" \
        "$SUPABASE_TIMEOUT_SEC" \
        "SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN"; then
        LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
      fi
    fi
  fi

  if should_probe_server "stitch"; then
    STITCH_PROJECT_ID=$(get_server_env_value "stitch" "STITCH_PROJECT_ID")
    STITCH_USE_SYSTEM_GCLOUD=$(get_server_env_value "stitch" "STITCH_USE_SYSTEM_GCLOUD")
    STITCH_COMMAND="$(get_server_command "stitch")"
    STITCH_ARGS_JSON="$(get_server_args_json "stitch")"
    STITCH_TIMEOUT_SEC="$(get_server_probe_timeout_sec "stitch")"
    if [ -z "$STITCH_PROJECT_ID" ] || [ -z "$STITCH_USE_SYSTEM_GCLOUD" ]; then
      echo -e "${YELLOW}WARN${NC} stitch: live probe skipped (stitch env missing)"
      echo "WARN stitch: live probe skipped (stitch env missing)" >> "$LOG_FILE"
      record_live_probe_status "stitch" "preflight" "warn" "skipped (stitch env missing)"
      LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
    elif [ -z "$STITCH_COMMAND" ] || [ -z "$STITCH_ARGS_JSON" ]; then
      echo -e "${YELLOW}WARN${NC} stitch: live probe skipped (launch config missing)"
      echo "WARN stitch: live probe skipped (launch config missing)" >> "$LOG_FILE"
      record_live_probe_status "stitch" "preflight" "warn" "skipped (launch config missing)"
      LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
    else
      if ! run_live_probe \
        "stitch" \
        "readiness" \
        "$STITCH_COMMAND" \
        "$STITCH_ARGS_JSON" \
        "" \
        "$STITCH_TIMEOUT_SEC" \
        "STITCH_PROJECT_ID=$STITCH_PROJECT_ID" \
        "STITCH_USE_SYSTEM_GCLOUD=$STITCH_USE_SYSTEM_GCLOUD" \
        "CLOUDSDK_CONFIG=${CLOUDSDK_CONFIG:-$HOME/.config/gcloud}"; then
        LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
      elif ! run_live_probe \
        "stitch" \
        "tool-call" \
        "$STITCH_COMMAND" \
        "$STITCH_ARGS_JSON" \
        "list_projects" \
        "$STITCH_TIMEOUT_SEC" \
        "STITCH_PROJECT_ID=$STITCH_PROJECT_ID" \
        "STITCH_USE_SYSTEM_GCLOUD=$STITCH_USE_SYSTEM_GCLOUD" \
        "CLOUDSDK_CONFIG=${CLOUDSDK_CONFIG:-$HOME/.config/gcloud}"; then
        LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
      fi
    fi
  fi
fi

TOTAL_SERVERS=${#EXPECTED_SERVERS[@]}
SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TOTAL_SERVERS))

echo ""
echo -e "${BLUE}요약:${NC}"
echo "  - 성공: ${SUCCESS_COUNT}/${TOTAL_SERVERS}"
echo "  - 실패: ${FAIL_COUNT}/${TOTAL_SERVERS}"
echo "  - 성공률: ${SUCCESS_RATE}%"
if [ "$RUN_LIVE_PROBE" -eq 1 ]; then
  echo "  - 실동작 프로브 실패: ${LIVE_PROBE_FAIL_COUNT}"
else
  echo "  - 실동작 프로브: skipped"
fi
if [ -n "$PERMISSION_WARNINGS" ]; then
  echo "  - 환경 경고: 1 (권한 제한, 비치명)"
fi

{
  echo ""
  echo "요약:"
  echo "  - 성공: ${SUCCESS_COUNT}/${TOTAL_SERVERS}"
  echo "  - 실패: ${FAIL_COUNT}/${TOTAL_SERVERS}"
  echo "  - 성공률: ${SUCCESS_RATE}%"
  if [ "$RUN_LIVE_PROBE" -eq 1 ]; then
    echo "  - 실동작 프로브 실패: ${LIVE_PROBE_FAIL_COUNT}"
  else
    echo "  - 실동작 프로브: skipped"
  fi
  if [ -n "$PERMISSION_WARNINGS" ]; then
    echo "  - 환경 경고: 1 (권한 제한, 비치명)"
  fi
  echo ""
  echo "로그 파일: $LOG_FILE"
} >> "$LOG_FILE"

echo ""
echo "로그 파일: $LOG_FILE"

if [ -x "$USAGE_COUNTER" ]; then
  TODAY=$(date +%Y-%m-%d)
  USAGE_OUTPUT=$("$USAGE_COUNTER" --all-roots --day "$TODAY" --top 5 2>/dev/null || true)
  TODAY_CALLS=$(printf '%s\n' "$USAGE_OUTPUT" | awk -F': ' '/^Total MCP calls:/ {print $2; exit}')
  if [ -n "$TODAY_CALLS" ]; then
    echo ""
    echo -e "${BLUE}오늘 MCP 사용량:${NC} ${TODAY_CALLS} calls (${TODAY})"
    {
      echo ""
      echo "오늘 MCP 사용량: ${TODAY_CALLS} calls (${TODAY})"
    } >> "$LOG_FILE"
  fi
fi

if [ "$FAIL_COUNT" -eq 0 ] && { [ "$RUN_LIVE_PROBE" -ne 1 ] || [ "$LIVE_PROBE_FAIL_COUNT" -eq 0 ]; }; then
  exit 0
fi

WARNING_THRESHOLD=$((TOTAL_SERVERS - 1))
if [ "$WARNING_THRESHOLD" -lt 0 ]; then
  WARNING_THRESHOLD=0
fi

if [ "$RUN_LIVE_PROBE" -eq 1 ] && [ "$FAIL_COUNT" -eq 0 ] && [ "$LIVE_PROBE_FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

if [ "$SUCCESS_COUNT" -ge "$WARNING_THRESHOLD" ] && { [ "$RUN_LIVE_PROBE" -ne 1 ] || [ "$LIVE_PROBE_FAIL_COUNT" -eq 0 ]; }; then
  exit 1
fi

exit 2
