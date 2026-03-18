#!/usr/bin/env bash
# scripts/dev/typecheck-changed.sh
# 변경 범위를 기준으로 증분 project type-check 실행

set -euo pipefail

echo "🔍 Checking TypeScript project status..."

PRESET_FILES="${TYPECHECK_CHANGED_FILES:-${PRE_PUSH_CHANGED_FILES:-}}"

if [ -n "$PRESET_FILES" ]; then
  ALL_CHANGED=$(printf '%s\n' "$PRESET_FILES" | sort -u | node scripts/dev/typecheck-scope.js || true)
else
  # Git에서 변경된 파일 확인 (참고용)
  CHANGED_FILES=$(git diff --name-only --diff-filter=ACM HEAD 2>/dev/null || true)
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
  ALL_CHANGED=$(printf '%s\n%s\n' "$CHANGED_FILES" "$STAGED_FILES" | sort -u | node scripts/dev/typecheck-scope.js || true)
fi

if [ -z "$ALL_CHANGED" ]; then
  echo "✅ No TypeScript files changed. Skipping incremental check."
  exit 0
fi

FILE_COUNT=$(echo "$ALL_CHANGED" | wc -l)
echo "📝 $FILE_COUNT TypeScript file(s) modified. Running incremental project type-check..."

# TypeScript는 파일 단위가 아니라 project graph 기준으로 타입을 해석한다.
# 여기서는 "변경 파일이 있을 때만" 증분 project check를 트리거해 빠른 피드백을 유지한다.
node scripts/dev/tsc-wrapper.js --noEmit --incremental --pretty false --project tsconfig.json

echo ""
echo "✅ Incremental type-check passed!"
