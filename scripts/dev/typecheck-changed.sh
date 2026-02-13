#!/usr/bin/env bash
# scripts/dev/typecheck-changed.sh
# TypeScript 증분 컴파일을 통한 빠른 검사

set -euo pipefail

echo "🔍 Checking TypeScript project status..."

# Git에서 변경된 파일 확인 (참고용)
CHANGED_FILES=$(git diff --name-only --diff-filter=ACM HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(ts|tsx)$' || true)

ALL_CHANGED=$(echo -e "$CHANGED_FILES\n$STAGED_FILES" | sort -u | grep -v '^$' || true)

if [ -z "$ALL_CHANGED" ]; then
  echo "✅ No TypeScript files changed. Skipping incremental check."
  exit 0
fi

FILE_COUNT=$(echo "$ALL_CHANGED" | wc -l)
echo "📝 $FILE_COUNT TypeScript file(s) modified. Running incremental type-check..."

# TypeScript 증분 컴파일 (tsconfig.json의 설정을 따름)
# --incremental 옵션은 .tsbuildinfo 파일을 생성하여 변경된 부분만 검사합니다.
npx tsc --noEmit --incremental --pretty --project tsconfig.json

echo ""
echo "✅ Incremental type-check passed!"
