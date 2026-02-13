#!/bin/bash
# MCP Health Check Script
# 목적: MCP 서버 연결 상태 정기 점검 (현재 9개)
# 작성: 2025-10-16
# 사용: ./scripts/mcp/mcp-health-check.sh

set -uo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 디렉토리 생성
LOG_DIR="logs/mcp-health"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# 현재 시간
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo -e "${BLUE}🏥 MCP Health Check${NC}"
echo -e "${BLUE}==================${NC}"
echo "시작 시간: $TIMESTAMP"
echo ""

# 1. PROJECT_ROOT 환경변수 검증 (Codex AI Review 권장)
echo -e "${YELLOW}🔍 Checking PROJECT_ROOT environment variable...${NC}"
if [ -z "${PROJECT_ROOT:-}" ]; then
  echo -e "${RED}❌ PROJECT_ROOT is not set in .env.local${NC}"
  echo -e "${YELLOW}💡 Fix: Add PROJECT_ROOT=${REPO_ROOT} to .env.local${NC}"
  echo "PROJECT_ROOT: ❌ NOT SET" >> "$LOG_FILE"
elif [ ! -d "$PROJECT_ROOT" ]; then
  echo -e "${RED}❌ PROJECT_ROOT points to non-existent directory: $PROJECT_ROOT${NC}"
  echo "PROJECT_ROOT: ❌ INVALID PATH" >> "$LOG_FILE"
else
  echo -e "${GREEN}✅ PROJECT_ROOT is valid: $PROJECT_ROOT${NC}"
  echo "PROJECT_ROOT: ✅ $PROJECT_ROOT" >> "$LOG_FILE"
fi
echo ""

# 로그 시작
{
  echo "==================================="
  echo "MCP Health Check - $TIMESTAMP"
  echo "==================================="
  echo ""
} >> "$LOG_FILE"

# MCP 서버 목록 (9개)
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

# MCP 상태 확인
echo -e "${BLUE}📊 MCP 서버 연결 상태:${NC}"
echo "📊 MCP 서버 연결 상태:" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# claude mcp list 실행 (타임아웃 20초)
MCP_OUTPUT=$(timeout 20 claude mcp list 2>&1)
MCP_EXIT_CODE=$?

if [ "$MCP_EXIT_CODE" -ne 0 ]; then
  if [ "$MCP_EXIT_CODE" -eq 124 ]; then
    echo -e "${RED}❌ claude mcp list 타임아웃 (20초)${NC}"
    echo "❌ claude mcp list 타임아웃 (20초)" >> "$LOG_FILE"
  else
    echo -e "${RED}❌ claude mcp list 실행 실패 (exit: $MCP_EXIT_CODE)${NC}"
    echo "❌ claude mcp list 실행 실패 (exit: $MCP_EXIT_CODE)" >> "$LOG_FILE"
  fi
  echo "$MCP_OUTPUT" >> "$LOG_FILE"
  echo -e "${YELLOW}💡 점검: claude mcp list를 로컬 쉘에서 직접 실행해 원본 오류를 확인하세요.${NC}"
  exit 2
fi

PERMISSION_WARNING_PATTERN='failed to clean up stale arg0 temp dirs|could not update PATH: Permission denied|Permission denied \(os error 13\)'
PERMISSION_WARNINGS=$(printf '%s\n' "$MCP_OUTPUT" | grep -E "$PERMISSION_WARNING_PATTERN" || true)

# 연결 성공 카운터
SUCCESS_COUNT=0
FAIL_COUNT=0

if [ -n "$PERMISSION_WARNINGS" ]; then
  echo -e "${YELLOW}⚠️  환경 경고:${NC} 권한 제한으로 일부 정리 작업이 실패했습니다."
  echo "⚠️  환경 경고: 권한 제한으로 일부 정리 작업이 실패했습니다." >> "$LOG_FILE"
  printf '%s\n' "$PERMISSION_WARNINGS" | sed 's/^/  - /'
  printf '%s\n' "$PERMISSION_WARNINGS" | sed 's/^/  - /' >> "$LOG_FILE"
  echo ""
fi

# 각 서버 상태 확인
for server in "${EXPECTED_SERVERS[@]}"; do
  SERVER_ROW=$(printf '%s\n' "$MCP_OUTPUT" | grep -E "^${server}:" || true)

  if [ -z "$SERVER_ROW" ]; then
    echo -e "${RED}❌${NC} $server: 목록에 없음"
    echo "❌ $server: 목록에 없음" >> "$LOG_FILE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  if printf '%s\n' "$SERVER_ROW" | grep -Eq '✓ Connected| connected | enabled '; then
    echo -e "${GREEN}✅${NC} $server: 연결 성공"
    echo "✅ $server: 연결 성공" >> "$LOG_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo -e "${YELLOW}⚠️${NC} $server: 비활성/미연결"
    echo "⚠️ $server: 비활성/미연결" >> "$LOG_FILE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo "" >> "$LOG_FILE"

# 연결 성공률 계산
TOTAL_SERVERS=${#EXPECTED_SERVERS[@]}
SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TOTAL_SERVERS))

# 결과 요약
echo -e "${BLUE}📈 연결 요약:${NC}"
echo "📈 연결 요약:" >> "$LOG_FILE"
echo -e "  - 연결 성공: ${GREEN}$SUCCESS_COUNT${NC}/$TOTAL_SERVERS"
echo -e "  - 연결 실패: ${RED}$FAIL_COUNT${NC}/$TOTAL_SERVERS"
echo -e "  - 성공률: ${GREEN}$SUCCESS_RATE%${NC}"
if [ -n "$PERMISSION_WARNINGS" ]; then
  echo -e "  - 환경 경고: ${YELLOW}1${NC} (권한 제한, 비치명)"
fi
echo "  - 연결 성공: $SUCCESS_COUNT/$TOTAL_SERVERS" >> "$LOG_FILE"
echo "  - 연결 실패: $FAIL_COUNT/$TOTAL_SERVERS" >> "$LOG_FILE"
echo "  - 성공률: $SUCCESS_RATE%" >> "$LOG_FILE"
if [ -n "$PERMISSION_WARNINGS" ]; then
  echo "  - 환경 경고: 1 (권한 제한, 비치명)" >> "$LOG_FILE"
fi
echo ""
echo "" >> "$LOG_FILE"

# 상태 판정
if [ "$SUCCESS_COUNT" -eq "$TOTAL_SERVERS" ]; then
  echo -e "${GREEN}✅ 모든 MCP 서버 정상 연결 (${TOTAL_SERVERS}/${TOTAL_SERVERS})${NC}"
  echo "✅ 모든 MCP 서버 정상 연결 (${TOTAL_SERVERS}/${TOTAL_SERVERS})" >> "$LOG_FILE"
  STATUS="SUCCESS"
elif [ "$SUCCESS_COUNT" -ge 7 ]; then
  echo -e "${YELLOW}⚠️  일부 MCP 서버 연결 문제 (확인 필요)${NC}"
  echo "⚠️  일부 MCP 서버 연결 문제 (확인 필요)" >> "$LOG_FILE"
  STATUS="WARNING"
else
  echo -e "${RED}❌ 다수의 MCP 서버 연결 실패 (긴급 조치 필요)${NC}"
  echo "❌ 다수의 MCP 서버 연결 실패 (긴급 조치 필요)" >> "$LOG_FILE"
  STATUS="CRITICAL"
fi

echo ""
echo "" >> "$LOG_FILE"

# 문제 해결 가이드
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}💡 문제 해결 방법:${NC}"
  echo "💡 문제 해결 방법:" >> "$LOG_FILE"
  echo "  1. claude mcp list 직접 실행하여 에러 메시지 확인"
  echo "  2. ~/.config/claude-code/settings.json 설정 확인"
  echo "  3. MCP 서버 재시작: claude mcp restart"
  echo "  4. OAuth 인증 필요 시: 해당 MCP 서버 재연결"
  echo "  1. claude mcp list 직접 실행하여 에러 메시지 확인" >> "$LOG_FILE"
  echo "  2. ~/.config/claude-code/settings.json 설정 확인" >> "$LOG_FILE"
  echo "  3. MCP 서버 재시작: claude mcp restart" >> "$LOG_FILE"
  echo "  4. OAuth 인증 필요 시: 해당 MCP 서버 재연결" >> "$LOG_FILE"
  echo ""
  echo "" >> "$LOG_FILE"
fi

# 로그 위치 안내
echo -e "${BLUE}📁 로그 저장 위치:${NC} $LOG_FILE"
echo "📁 로그 저장 위치: $LOG_FILE" >> "$LOG_FILE"
echo ""
echo "" >> "$LOG_FILE"

# 종료 시간
END_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "종료 시간: $END_TIMESTAMP"
echo "종료 시간: $END_TIMESTAMP" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 상태별 종료 코드
if [ "$STATUS" = "SUCCESS" ]; then
  exit 0
elif [ "$STATUS" = "WARNING" ]; then
  exit 1
else
  exit 2
fi
