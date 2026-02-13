#!/bin/bash
# Codex MCP Health Check Script
# 목적: Codex MCP 서버 설정 상태 점검 (현재 9개)
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

EXPECTED_SERVERS=(
  "vercel"
  "serena"
  "supabase"
  "context7"
  "playwright"
  "github"
  "tavily"
  "sequential-thinking"
  "stitch"
)

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
source "$RUNTIME_ENV_RESOLVER"

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

TOTAL_SERVERS=${#EXPECTED_SERVERS[@]}
SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TOTAL_SERVERS))

echo ""
echo -e "${BLUE}요약:${NC}"
echo "  - 성공: ${SUCCESS_COUNT}/${TOTAL_SERVERS}"
echo "  - 실패: ${FAIL_COUNT}/${TOTAL_SERVERS}"
echo "  - 성공률: ${SUCCESS_RATE}%"
if [ -n "$PERMISSION_WARNINGS" ]; then
  echo "  - 환경 경고: 1 (권한 제한, 비치명)"
fi

{
  echo ""
  echo "요약:"
  echo "  - 성공: ${SUCCESS_COUNT}/${TOTAL_SERVERS}"
  echo "  - 실패: ${FAIL_COUNT}/${TOTAL_SERVERS}"
  echo "  - 성공률: ${SUCCESS_RATE}%"
  if [ -n "$PERMISSION_WARNINGS" ]; then
    echo "  - 환경 경고: 1 (권한 제한, 비치명)"
  fi
  echo ""
  echo "로그 파일: $LOG_FILE"
} >> "$LOG_FILE"

echo ""
echo "로그 파일: $LOG_FILE"

if [ "$FAIL_COUNT" -eq 0 ]; then
  exit 0
fi

if [ "$SUCCESS_COUNT" -ge 7 ]; then
  exit 1
fi

exit 2
