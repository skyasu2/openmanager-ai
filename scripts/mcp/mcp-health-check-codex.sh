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

MCP_OUTPUT=$(timeout 15 codex mcp list 2>&1)
MCP_EXIT_CODE=$?

if [ "$MCP_EXIT_CODE" -ne 0 ]; then
  echo -e "${RED}codex mcp list 실행 실패 (exit: $MCP_EXIT_CODE)${NC}"
  echo "codex mcp list 실행 실패 (exit: $MCP_EXIT_CODE)" >> "$LOG_FILE"
  echo "$MCP_OUTPUT" >> "$LOG_FILE"
  exit 2
fi

SUCCESS_COUNT=0
FAIL_COUNT=0

echo -e "${BLUE}MCP 서버 상태:${NC}"
echo "MCP 서버 상태:" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

for server in "${EXPECTED_SERVERS[@]}"; do
  SERVER_ROW=$(printf '%s\n' "$MCP_OUTPUT" | grep -E "^${server}[[:space:]]" || true)

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

{
  echo ""
  echo "요약:"
  echo "  - 성공: ${SUCCESS_COUNT}/${TOTAL_SERVERS}"
  echo "  - 실패: ${FAIL_COUNT}/${TOTAL_SERVERS}"
  echo "  - 성공률: ${SUCCESS_RATE}%"
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
