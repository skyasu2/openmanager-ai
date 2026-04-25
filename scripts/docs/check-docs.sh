#!/bin/bash
# 문서 품질 검증 스크립트
# Usage: bash scripts/docs/check-docs.sh [--fix]

set -euo pipefail

DOCS_DIR="docs"
REPORTS_DIR="logs/docs-reports"
ACTIVE_CONFIG="active.markdownlint-cli2.jsonc"
HISTORICAL_CONFIG="historical.markdownlint-cli2.jsonc"
FIX_MODE=false
HAS_ERROR=0
STRICT_DOCS_MODE="${DOCS_STRICT_CHANGED:-false}"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 인자 파싱
if [[ "${1:-}" == "--fix" ]]; then
  FIX_MODE=true
fi

# 리포트 디렉토리 생성
mkdir -p "$REPORTS_DIR"

echo -e "${BLUE}📚 문서 품질 검증 시작${NC}"
echo "========================================"
echo "  - Strict changed-doc gate: ${STRICT_DOCS_MODE}"

# 1. Markdown Lint 검사 (Active / Historical 분리)
echo -e "\n${YELLOW}[1/7] Markdown Lint 검사${NC}"

echo "  - Active docs lint"
if $FIX_MODE; then
  npx markdownlint-cli2 --config "$ACTIVE_CONFIG" \
    "$DOCS_DIR/**/*.md" \
    "!$DOCS_DIR/analysis/**/*.md" \
    "!$DOCS_DIR/reviews/**/*.md" \
    --fix 2>&1 | tee "$REPORTS_DIR/markdownlint-active.log" || true
  echo -e "    ${GREEN}✅ Active lint 자동 수정 완료${NC}"
else
  if npx markdownlint-cli2 --config "$ACTIVE_CONFIG" \
    "$DOCS_DIR/**/*.md" \
    "!$DOCS_DIR/analysis/**/*.md" \
    "!$DOCS_DIR/reviews/**/*.md" \
    "!$DOCS_DIR/status.md" \
    2>&1 | tee "$REPORTS_DIR/markdownlint-active.log"; then
    echo -e "    ${GREEN}✅ Active lint 통과${NC}"
  else
    echo -e "    ${RED}❌ Active lint 실패${NC}"
    HAS_ERROR=1
  fi
fi

echo "  - Historical docs lint"
if $FIX_MODE; then
  npx markdownlint-cli2 --config "$HISTORICAL_CONFIG" \
    "$DOCS_DIR/analysis/**/*.md" \
    "$DOCS_DIR/reviews/**/*.md" \
    --fix 2>&1 | tee "$REPORTS_DIR/markdownlint-historical.log" || true
  echo -e "    ${GREEN}✅ Historical lint 자동 수정 완료${NC}"
else
  if npx markdownlint-cli2 --config "$HISTORICAL_CONFIG" \
    "$DOCS_DIR/analysis/**/*.md" \
    "$DOCS_DIR/reviews/**/*.md" \
    "$DOCS_DIR/status.md" \
    2>&1 | tee "$REPORTS_DIR/markdownlint-historical.log"; then
    echo -e "    ${GREEN}✅ Historical lint 통과${NC}"
  else
    echo -e "    ${YELLOW}⚠️  Historical lint 경고 (허용 규칙 외 이슈 존재)${NC}"
  fi
fi

# 2. 내부 링크 유효성 검사 (docs 전체)
echo -e "\n${YELLOW}[2/7] 내부 링크 유효성 검사 (docs 전체)${NC}"
if node scripts/docs/check-internal-links.js "$DOCS_DIR" 2>&1 | tee "$REPORTS_DIR/internal-links.log"; then
  echo -e "${GREEN}✅ 내부 링크 검사 통과${NC}"
else
  echo -e "${RED}❌ 내부 링크 검사 실패${NC}"
  HAS_ERROR=1
fi

# 3. AI 운영 문서 정합성 검사
echo -e "\n${YELLOW}[3/7] AI 운영 문서 정합성 검사${NC}"
if npm run --silent docs:ai-consistency 2>&1 | tee "$REPORTS_DIR/ai-docs-consistency.log"; then
  echo -e "${GREEN}✅ AI 운영 문서 정합성 검사 통과${NC}"
else
  echo -e "${RED}❌ AI 운영 문서 정합성 검사 실패${NC}"
  HAS_ERROR=1
fi

# 4. 오래된 문서 감지 (90일 이상)
echo -e "\n${YELLOW}[4/7] 오래된 문서 감지 (90일+)${NC}"
STALE_DOCS=$(find "$DOCS_DIR" -name "*.md" -not -path "*/archived/*" -mtime +90 -type f 2>/dev/null | head -10)

if [[ -z "$STALE_DOCS" ]]; then
  echo -e "${GREEN}✅ 오래된 문서 없음${NC}"
else
  echo -e "${YELLOW}⚠️  90일 이상 미수정 문서:${NC}"
  echo "$STALE_DOCS" | while read -r file; do
    DAYS=$(( ($(date +%s) - $(stat -c %Y "$file")) / 86400 ))
    echo -e "  ${YELLOW}•${NC} $file (${DAYS}일 전)"
  done
fi

# 5. 문서 예산 리포트
echo -e "\n${YELLOW}[5/7] 문서 예산 리포트${NC}"
DOC_BUDGET_ARGS=(--write)
if [[ "$STRICT_DOCS_MODE" == "true" ]]; then
  DOC_BUDGET_ARGS+=(--strict)
fi

if node scripts/docs/doc-budget-report.js "${DOC_BUDGET_ARGS[@]}" 2>&1 | tee "$REPORTS_DIR/doc-budget-report.log"; then
  echo -e "${GREEN}✅ 문서 예산 리포트 생성 완료${NC}"
else
  echo -e "${RED}❌ 문서 예산 리포트 생성 실패${NC}"
  HAS_ERROR=1
fi

# 6. 문서 통계
echo -e "\n${YELLOW}[6/7] 문서 통계${NC}"
TOTAL_DOCS=$(find "$DOCS_DIR" -name "*.md" -type f | wc -l)
TOTAL_LINES=$(find "$DOCS_DIR" -name "*.md" -type f -exec cat {} \; | wc -l)
LARGE_DOCS=$(find "$DOCS_DIR" -name "*.md" -type f -exec wc -l {} \; | awk '$1 > 400 {print $2}' | wc -l)

echo -e "  📄 총 문서 수: ${GREEN}${TOTAL_DOCS}${NC}개"
echo -e "  📝 총 라인 수: ${GREEN}${TOTAL_LINES}${NC}줄"
echo -e "  📏 400줄 초과 문서: ${YELLOW}${LARGE_DOCS}${NC}개"

npm run --silent docs:inventory >/dev/null
echo -e "  📦 인벤토리 갱신: ${GREEN}reports/docs/docs-inventory.md${NC}"

# 7. 컴포넌트 의존도 맵 갱신
echo -e "\n${YELLOW}[7/7] 컴포넌트 의존도 맵 갱신${NC}"
if npm run --silent docs:components:map >/dev/null 2>&1; then
  echo -e "  🗺️  의존도 맵 갱신: ${GREEN}docs/reference/architecture/system/component-dependency-map.md${NC}"
  echo -e "  📊 기계판독 리포트: ${GREEN}reports/docs/component-dependency-map.json${NC}"
else
  echo -e "  ${YELLOW}⚠️  의존도 맵 갱신 실패 (non-blocking)${NC}"
fi

echo -e "\n========================================"
echo -e "${BLUE}📚 문서 검증 완료${NC}"
echo -e "리포트: ${REPORTS_DIR}/"

if [[ $HAS_ERROR -ne 0 ]]; then
  exit 1
fi
