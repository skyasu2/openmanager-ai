#!/usr/bin/env bash
# scripts/dev/lint-changed.sh
# 변경된 파일만 Biome을 사용하여 빠르게 검사 및 수정

set -euo pipefail

echo "🔍 Linting changed files only (Biome)..."

# Git에서 변경된 파일 가져오기 (staged + unstaged)
# Biome 지원 확장자: ts, tsx, js, jsx, json, css
EXT_PATTERN='\.(ts|tsx|js|jsx|json|css)$'
CHANGED_FILES=$(git diff --name-only --diff-filter=ACM HEAD 2>/dev/null | grep -E "$EXT_PATTERN" || true)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E "$EXT_PATTERN" || true)

# 합치기 및 중복 제거
ALL_CHANGED=$(echo -e "$CHANGED_FILES\n$STAGED_FILES" | sort -u | grep -v '^$' || true)

if [ -z "$ALL_CHANGED" ]; then
  echo "✅ No supported files changed. Skipping lint."
  exit 0
fi

FILE_COUNT=$(echo "$ALL_CHANGED" | wc -l)
echo "📝 $FILE_COUNT file(s) modified. Running Biome check & write..."

# Biome 실행
# local node_modules의 biome 우선 사용, xargs -d '\n'으로 파일명 내 공백 안전 처리
if [ -f "./node_modules/.bin/biome" ]; then
  echo "$ALL_CHANGED" | xargs -d '\n' ./node_modules/.bin/biome check --write --no-errors-on-unmatched
else
  echo "$ALL_CHANGED" | xargs -d '\n' npx @biomejs/biome check --write --no-errors-on-unmatched
fi

echo ""
echo "✅ Biome linting completed successfully!"
