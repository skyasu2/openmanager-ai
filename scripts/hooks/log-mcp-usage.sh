#!/bin/bash
# MCP 도구 사용 로깅 (PostToolUse hook)
# 호출될 때마다 .claude/mcp-usage.log에 한 줄 추가
#
# 로그 형식: TIMESTAMP|SERVER|METHOD
# 예: 2026-02-14 10:30:00|vercel|getDeployments
#
# 분석 명령어:
#   # 서버별 호출 횟수
#   cut -d'|' -f2 .claude/mcp-usage.log | sort | uniq -c | sort -rn
#
#   # 오늘 사용량
#   grep "$(date +%Y-%m-%d)" .claude/mcp-usage.log | cut -d'|' -f2 | sort | uniq -c
#
#   # 서버별 메서드 상세
#   cut -d'|' -f2,3 .claude/mcp-usage.log | sort | uniq -c | sort -rn

TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"
LOG_FILE="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')/.claude/mcp-usage.log"

# mcp__ 접두사가 있는 도구만 로깅
if [[ "$TOOL_NAME" == mcp__* ]]; then
  # mcp__vercel__getDeployments → vercel / getDeployments
  STRIPPED="${TOOL_NAME#mcp__}"
  SERVER="${STRIPPED%%__*}"
  METHOD="${STRIPPED#*__}"
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "${TIMESTAMP}|${SERVER}|${METHOD}" >> "$LOG_FILE"
fi
