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

TYPECHECK_CHANGED_TIMEOUT_SECONDS="${TYPECHECK_CHANGED_TIMEOUT_SECONDS:-60}"
TYPECHECK_CHANGED_SOFT_TIMEOUT="${TYPECHECK_CHANGED_SOFT_TIMEOUT:-false}"

# TypeScript는 파일 단위가 아니라 project graph 기준으로 타입을 해석한다.
# pre-push에서는 응답성 보장을 위해 timeout을 두고, 시간 초과 시 CI/Vercel 검증으로 이관한다.
TYPECHECK_CMD=(
  node
  scripts/dev/tsc-wrapper.js
  --noEmit
  --pretty
  false
  --project
  tsconfig.json
)

if command -v timeout >/dev/null 2>&1; then
  set +e
  timeout "${TYPECHECK_CHANGED_TIMEOUT_SECONDS}s" "${TYPECHECK_CMD[@]}"
  TYPECHECK_EXIT_CODE=$?
  set -e

  if [ "$TYPECHECK_EXIT_CODE" -eq 124 ]; then
    echo "⚠️ Incremental type-check timed out after ${TYPECHECK_CHANGED_TIMEOUT_SECONDS}s."
    if [ "$TYPECHECK_CHANGED_SOFT_TIMEOUT" = "true" ]; then
      echo "ℹ️ Pre-push에서는 해당 검증을 soft-skip하고 CI/Vercel 전체 타입체크에 위임합니다."
      exit 0
    fi
    exit 124
  fi

  if [ "$TYPECHECK_EXIT_CODE" -ne 0 ]; then
    exit "$TYPECHECK_EXIT_CODE"
  fi
else
  "${TYPECHECK_CMD[@]}"
fi

echo ""
echo "✅ Incremental type-check passed!"
