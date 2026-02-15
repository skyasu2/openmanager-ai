#!/bin/bash
# Codex MCP Health Check Script
# 목적: Codex MCP 서버 설정 상태 점검 (설정 파일 기반 SSOT)
# 사용: ./scripts/mcp/mcp-health-check-codex.sh

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
USAGE_COUNTER="$REPO_ROOT/scripts/mcp/count-codex-mcp-usage.sh"
EXPECTED_SERVERS=()
CONFIG_FILE=""
LIVE_PROBE_TIMEOUT_SEC="${MCP_LIVE_PROBE_TIMEOUT_SEC:-120}"

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
  echo -e "${RED}프로젝트 Codex 실행기 누락: $CODEX_LOCAL_RUNNER${NC}"
  echo "프로젝트 Codex 실행기 누락: $CODEX_LOCAL_RUNNER" >> "$LOG_FILE"
  exit 2
fi

if [ ! -f "$RUNTIME_ENV_RESOLVER" ]; then
  echo -e "${RED}런타임 환경 해석기 누락: $RUNTIME_ENV_RESOLVER${NC}"
  echo "런타임 환경 해석기 누락: $RUNTIME_ENV_RESOLVER" >> "$LOG_FILE"
  exit 2
fi

# shellcheck source=/dev/null
: "${OPENMANAGER_CODEX_HOME_MODE:=project}"
export OPENMANAGER_CODEX_HOME_MODE
source "$RUNTIME_ENV_RESOLVER"

load_expected_servers() {
  CONFIG_FILE="$CODEX_HOME/config.toml"
  if [ ! -f "$CONFIG_FILE" ]; then
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

run_live_probe() {
  local server="$1"
  local _transport_command="$2"
  local _transport_args_json="$3"
  local _call_tool="$4"
  local env_prefix="$5"
  local probe_output=""

  probe_output=$(eval "$env_prefix" timeout "$LIVE_PROBE_TIMEOUT_SEC" node --input-type=module <<'NODE' 2>&1
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
  if printf '%s\n' "$probe_output" | grep -q '"ok":true'; then
    echo -e "${GREEN}OK${NC}   ${server}: live probe"
    echo "OK   ${server}: live probe" >> "$LOG_FILE"
    return 0
  fi

  echo -e "${YELLOW}WARN${NC} ${server}: live probe failed"
  echo "WARN ${server}: live probe failed" >> "$LOG_FILE"
  printf '%s\n' "$probe_output" | sed 's/^/  - /' | sed -n '1,4p'
  printf '%s\n' "$probe_output" | sed 's/^/  - /' | sed -n '1,4p' >> "$LOG_FILE"
  return 1
}

load_expected_servers

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
  echo -e "${RED}project codex mcp list 실행 실패 (exit: $MCP_EXIT_CODE)${NC}"
  echo "project codex mcp list 실행 실패 (exit: $MCP_EXIT_CODE)" >> "$LOG_FILE"
  echo "$MCP_OUTPUT" >> "$LOG_FILE"
  exit 2
fi

PERMISSION_WARNING_PATTERN='failed to clean up stale arg0 temp dirs|could not update PATH: Permission denied|Permission denied \(os error 13\)'
PERMISSION_WARNINGS=$(printf '%s\n' "$MCP_OUTPUT" | grep -E "$PERMISSION_WARNING_PATTERN" || true)
MCP_TABLE=$(printf '%s\n' "$MCP_OUTPUT" | awk 'BEGIN { in_table=0 } /^Name[[:space:]]+Command[[:space:]]+Args/ { in_table=1 } in_table { print }')

if [ -z "$MCP_TABLE" ]; then
  echo -e "${RED}project codex mcp list 출력 파싱 실패 (서버 테이블 없음)${NC}"
  echo "project codex mcp list 출력 파싱 실패 (서버 테이블 없음)" >> "$LOG_FILE"
  echo "$MCP_OUTPUT" >> "$LOG_FILE"
  exit 2
fi

SUCCESS_COUNT=0
FAIL_COUNT=0
LIVE_PROBE_FAIL_COUNT=0

if [ -n "$PERMISSION_WARNINGS" ]; then
  echo -e "${YELLOW}환경 경고${NC}: 샌드박스 권한 제한으로 일부 정리 작업이 실패했습니다."
  echo "환경 경고: 샌드박스 권한 제한으로 일부 정리 작업이 실패했습니다." >> "$LOG_FILE"
  printf '%s\n' "$PERMISSION_WARNINGS" | sed 's/^/  - /'
  printf '%s\n' "$PERMISSION_WARNINGS" | sed 's/^/  - /' >> "$LOG_FILE"
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
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  if printf '%s\n' "$SERVER_ROW" | grep -q " enabled "; then
    echo -e "${GREEN}OK${NC}   $server: enabled"
    echo "OK   $server: enabled" >> "$LOG_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo -e "${YELLOW}WARN${NC} $server: disabled"
    echo "WARN $server: disabled" >> "$LOG_FILE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo -e "${BLUE}실동작 프로브:${NC}"
echo "실동작 프로브:" >> "$LOG_FILE"

if [ ! -d "$REPO_ROOT/node_modules/@modelcontextprotocol/sdk" ]; then
  echo -e "${YELLOW}WARN${NC} live probe skipped: @modelcontextprotocol/sdk 미설치"
  echo "WARN live probe skipped: @modelcontextprotocol/sdk 미설치" >> "$LOG_FILE"
else
  if has_server "supabase"; then
    SUPABASE_TOKEN=$(get_server_env_value "supabase" "SUPABASE_ACCESS_TOKEN")
    if [ -z "$SUPABASE_TOKEN" ]; then
      echo -e "${YELLOW}WARN${NC} supabase: live probe skipped (SUPABASE_ACCESS_TOKEN missing)"
      echo "WARN supabase: live probe skipped (SUPABASE_ACCESS_TOKEN missing)" >> "$LOG_FILE"
      LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
    else
      if ! run_live_probe \
        "supabase" \
        "npx" \
        "[\"-y\",\"@supabase/mcp-server-supabase@0.5.9\"]" \
        "list_projects" \
        "SUPABASE_ACCESS_TOKEN=\"$SUPABASE_TOKEN\" MCP_PROBE_SERVER=\"supabase\" MCP_PROBE_COMMAND=\"npx\" MCP_PROBE_ARGS_JSON='[\"-y\",\"@supabase/mcp-server-supabase@0.5.9\"]' MCP_PROBE_CALL_TOOL=\"list_projects\""; then
        LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
      fi
    fi
  fi

  if has_server "stitch"; then
    STITCH_PROJECT_ID=$(get_server_env_value "stitch" "STITCH_PROJECT_ID")
    STITCH_USE_SYSTEM_GCLOUD=$(get_server_env_value "stitch" "STITCH_USE_SYSTEM_GCLOUD")
    if [ -z "$STITCH_PROJECT_ID" ] || [ -z "$STITCH_USE_SYSTEM_GCLOUD" ]; then
      echo -e "${YELLOW}WARN${NC} stitch: live probe skipped (stitch env missing)"
      echo "WARN stitch: live probe skipped (stitch env missing)" >> "$LOG_FILE"
      LIVE_PROBE_FAIL_COUNT=$((LIVE_PROBE_FAIL_COUNT + 1))
    else
      if ! run_live_probe \
        "stitch" \
        "bash" \
        "[\"-lc\",\"CLOUDSDK_CONFIG=\\\"\\${CLOUDSDK_CONFIG:-\\$HOME/.config/gcloud}\\\" npx -y @_davideast/stitch-mcp proxy\"]" \
        "list_projects" \
        "STITCH_PROJECT_ID=\"$STITCH_PROJECT_ID\" STITCH_USE_SYSTEM_GCLOUD=\"$STITCH_USE_SYSTEM_GCLOUD\" CLOUDSDK_CONFIG=\"${CLOUDSDK_CONFIG:-$HOME/.config/gcloud}\" MCP_PROBE_SERVER=\"stitch\" MCP_PROBE_COMMAND=\"bash\" MCP_PROBE_ARGS_JSON='[\"-lc\",\"CLOUDSDK_CONFIG=\\\"\\${CLOUDSDK_CONFIG:-\\$HOME/.config/gcloud}\\\" npx -y @_davideast/stitch-mcp proxy\"]' MCP_PROBE_CALL_TOOL=\"list_projects\""; then
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
echo "  - 실동작 프로브 실패: ${LIVE_PROBE_FAIL_COUNT}"
if [ -n "$PERMISSION_WARNINGS" ]; then
  echo "  - 환경 경고: 1 (권한 제한, 비치명)"
fi

{
  echo ""
  echo "요약:"
  echo "  - 성공: ${SUCCESS_COUNT}/${TOTAL_SERVERS}"
  echo "  - 실패: ${FAIL_COUNT}/${TOTAL_SERVERS}"
  echo "  - 성공률: ${SUCCESS_RATE}%"
  echo "  - 실동작 프로브 실패: ${LIVE_PROBE_FAIL_COUNT}"
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

if [ "$FAIL_COUNT" -eq 0 ] && [ "$LIVE_PROBE_FAIL_COUNT" -eq 0 ]; then
  exit 0
fi

WARNING_THRESHOLD=$((TOTAL_SERVERS - 1))
if [ "$WARNING_THRESHOLD" -lt 0 ]; then
  WARNING_THRESHOLD=0
fi

if [ "$FAIL_COUNT" -eq 0 ] && [ "$LIVE_PROBE_FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

if [ "$SUCCESS_COUNT" -ge "$WARNING_THRESHOLD" ] && [ "$LIVE_PROBE_FAIL_COUNT" -eq 0 ]; then
  exit 1
fi

exit 2
