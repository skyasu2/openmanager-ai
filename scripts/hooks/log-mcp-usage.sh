#!/bin/bash
# MCP 도구 사용 로깅 (PostToolUse hook)
# 호출될 때마다 .claude/mcp-usage.log에 한 줄 추가

TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"
LOG_FILE="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')/.claude/mcp-usage.log"

# mcp__ 접두사가 있는 도구만 로깅
if [[ "$TOOL_NAME" == mcp__* ]]; then
  # mcp__vercel__getDeployments → vercel / getDeployments
  SERVER=$(echo "$TOOL_NAME" | cut -d'_' -f4)
  METHOD=$(echo "$TOOL_NAME" | cut -d'_' -f5-)
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "${TIMESTAMP}|${SERVER}|${METHOD}" >> "$LOG_FILE"
fi
