#!/bin/bash

# AI 교차검증 활용 통계
# 버전: 1.0.0
# 날짜: 2025-10-15

set -euo pipefail

# 색상 정의
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}📊 AI 교차검증 활용 통계 (최근 30일)${NC}"
echo ""

# Decision Logs 분석
DECISION_LOGS_DIR="/mnt/d/cursor/openmanager-vibe-v5/logs/ai-decisions"

if [ ! -d "$DECISION_LOGS_DIR" ]; then
    echo -e "${YELLOW}⚠️  Decision Logs 디렉터리 없음${NC}"
    exit 1
fi

# AI 교차검증 활용 빈도
echo -e "${GREEN}=== AI 교차검증 활용 빈도 (Decision Logs 기준) ===${NC}"
echo ""

for agent_file in /mnt/d/cursor/openmanager-vibe-v5/.claude/agents/*.md; do
    if [ -f "$agent_file" ]; then
        agent_name=$(basename "$agent_file" .md)
        count=$(grep -l "$agent_name" "$DECISION_LOGS_DIR"/*.md 2>/dev/null | wc -l)
        echo "  $agent_name: $count회"
    fi
done | sort -t':' -k2 -rn

echo ""

# 최근 7일 Decision Logs
echo -e "${GREEN}=== 최근 7일 Decision Logs ===${NC}"
echo ""

find "$DECISION_LOGS_DIR" -name "*.md" -mtime -7 2>/dev/null | wc -l | xargs echo "  생성된 Decision Logs:"

echo ""

# AI 교차검증 성공률
echo -e "${GREEN}=== AI 교차검증 성공률 ===${NC}"
echo ""

TOTAL_LOGS=$(find "$DECISION_LOGS_DIR" -name "*.md" 2>/dev/null | wc -l)
echo "  총 Decision Logs: $TOTAL_LOGS개"

echo ""
echo -e "${CYAN}✅ 통계 생성 완료${NC}"
