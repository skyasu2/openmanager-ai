#!/bin/bash
# Vercel 환경변수 동기화 스크립트
# Usage: ./scripts/env/sync-vercel.sh [production|preview]

set -e

ENV="${1:-production}"
ENV_FILE=".env.local"
VERCEL_BIN="${VERCEL_BIN:-vercel}"

echo "🔄 Vercel $ENV 환경변수 동기화 시작..."

# Cloud Run 필수 변수
REQUIRED_VARS=(
  "CLOUD_RUN_ENABLED"
  "CLOUD_RUN_AI_URL"
  "CLOUD_RUN_API_SECRET"
  "SESSION_SECRET"
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

OPTIONAL_VARS=(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
)

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# .env.local 파일 확인
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ $ENV_FILE 파일이 없습니다${NC}"
  exit 1
fi

get_env_value() {
  local key="$1"
  local raw

  raw=$(grep "^$key=" "$ENV_FILE" | head -n 1 | cut -d '=' -f2-)
  raw="${raw%\"}"
  raw="${raw#\"}"

  printf '%s' "$raw"
}

sync_var() {
  local key="$1"
  local required="${2:-true}"
  local value

  value=$(get_env_value "$key")

  if [ -z "$value" ]; then
    if [ "$required" = "true" ]; then
      echo -e "${RED}❌ $key: 필수 변수인데 로컬에 값이 없습니다${NC}"
      return 1
    else
      echo -e "${YELLOW}ℹ️  $key: 선택 변수, 로컬에 값이 없어 건너뜀${NC}"
    fi
    return 0
  fi

  if printf '%s\n' "$value" | "$VERCEL_BIN" env add "$key" "$ENV" --force > /dev/null 2>&1; then
    echo -e "${GREEN}✅ $key: 동기화 완료${NC}"
  else
    echo -e "${RED}❌ $key: 동기화 실패${NC}"
    return 1
  fi
}

# 필수 변수 동기화
echo ""
echo "📋 필수 환경변수 동기화:"
for VAR in "${REQUIRED_VARS[@]}"; do
  sync_var "$VAR" true || exit 1
done

echo ""
echo "📋 선택 환경변수 동기화:"
for VAR in "${OPTIONAL_VARS[@]}"; do
  sync_var "$VAR" false || exit 1
done

echo ""
echo "🔍 검증 중..."

# Health check (배포 후에만 의미 있음)
if [ "$ENV" = "production" ]; then
  sleep 2
  HEALTH=$(curl -s "https://openmanager-ai.vercel.app/api/health?service=ai" 2>&1)

  if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ AI Health Check 통과${NC}"
    echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
  else
    echo -e "${YELLOW}⚠️  재배포 후 Health Check 필요${NC}"
    echo "   git commit --allow-empty -m 'chore: trigger redeploy' && git push"
  fi
fi

echo ""
echo "✅ 동기화 완료!"
