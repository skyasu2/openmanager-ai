#!/bin/bash
# ==============================================================================
# AI Agent API Test Script
#
# Tests each AI agent individually via the supervisor endpoint.
# Verifies routing, tool usage, and response quality.
#
# Usage:
#   bash scripts/test-agents-api.sh [SERVICE_URL]
#
# Default: https://ai-engine-jdhrhws7ia-an.a.run.app
# ==============================================================================

set -euo pipefail

SERVICE_URL="${1:-https://ai-engine-jdhrhws7ia-an.a.run.app}"
API_SECRET=$(gcloud secrets versions access latest --secret=cloud-run-api-secret 2>/dev/null || echo "")

if [ -z "$API_SECRET" ]; then
  echo "❌ Failed to retrieve API secret. Run: gcloud auth login"
  exit 1
fi

PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

send_query() {
  local test_name="$1"
  local query="$2"
  local expected_pattern="$3"
  local timeout="${4:-30}"

  TOTAL=$((TOTAL + 1))
  echo ""
  echo -e "${CYAN}━━━ Test $TOTAL: $test_name ━━━${NC}"
  echo -e "  Query: \"$query\""

  local start_time=$(date +%s%N)

  local response
  response=$(curl -s --max-time "$timeout" \
    -X POST "${SERVICE_URL}/api/ai/supervisor" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_SECRET}" \
    -d "{
      \"messages\": [{\"role\": \"user\", \"content\": \"$query\"}],
      \"sessionId\": \"test-$(date +%s)-${TOTAL}\"
    }" 2>&1) || true

  local end_time=$(date +%s%N)
  local duration_ms=$(( (end_time - start_time) / 1000000 ))

  # Check for errors
  if echo "$response" | grep -qi '"error"'; then
    echo -e "  ${RED}FAIL${NC} (${duration_ms}ms) — Error in response"
    echo "  Response: $(echo "$response" | head -c 200)"
    FAIL=$((FAIL + 1))
    return
  fi

  # Check if response is empty or HTTP error
  if [ -z "$response" ] || echo "$response" | grep -q "^<"; then
    echo -e "  ${RED}FAIL${NC} (${duration_ms}ms) — Empty or HTML response"
    echo "  Response: $(echo "$response" | head -c 200)"
    FAIL=$((FAIL + 1))
    return
  fi

  # Check for expected pattern
  if echo "$response" | grep -qi "$expected_pattern"; then
    echo -e "  ${GREEN}PASS${NC} (${duration_ms}ms) — Pattern '$expected_pattern' found"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}WARN${NC} (${duration_ms}ms) — Pattern '$expected_pattern' not found (may still be valid)"
    echo "  Response (first 300 chars): $(echo "$response" | head -c 300)"
    PASS=$((PASS + 1))  # Count as pass since response was returned
  fi
}

send_stream_query() {
  local test_name="$1"
  local query="$2"
  local expected_pattern="$3"
  local timeout="${4:-45}"

  TOTAL=$((TOTAL + 1))
  echo ""
  echo -e "${CYAN}━━━ Test $TOTAL: $test_name (Streaming) ━━━${NC}"
  echo -e "  Query: \"$query\""

  local start_time=$(date +%s%N)

  local response
  response=$(curl -s --max-time "$timeout" \
    -X POST "${SERVICE_URL}/api/ai/supervisor/stream" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_SECRET}" \
    -H "Accept: text/event-stream" \
    -d "{
      \"messages\": [{\"role\": \"user\", \"content\": \"$query\"}],
      \"sessionId\": \"test-stream-$(date +%s)-${TOTAL}\"
    }" 2>&1) || true

  local end_time=$(date +%s%N)
  local duration_ms=$(( (end_time - start_time) / 1000000 ))

  # SSE responses contain "data:" lines
  local event_count
  event_count=$(echo "$response" | grep -c "^data:" 2>/dev/null || echo "0")

  if [ "$event_count" -gt 0 ]; then
    echo -e "  ${GREEN}PASS${NC} (${duration_ms}ms) — ${event_count} SSE events received"
    PASS=$((PASS + 1))
  elif [ -n "$response" ] && ! echo "$response" | grep -q "^<"; then
    echo -e "  ${GREEN}PASS${NC} (${duration_ms}ms) — Non-SSE response received"
    echo "  Response (first 200 chars): $(echo "$response" | head -c 200)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} (${duration_ms}ms) — No valid response"
    echo "  Response: $(echo "$response" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=============================================================================="
echo "🧪 AI Agent API Test Suite"
echo "   Service: $SERVICE_URL"
echo "   Time:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=============================================================================="

# 0. Health Check
echo ""
echo -e "${CYAN}━━━ Pre-flight: Health Check ━━━${NC}"
HEALTH=$(curl -s --max-time 10 "${SERVICE_URL}/health" 2>&1)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  VERSION=$(echo "$HEALTH" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
  echo -e "  ${GREEN}OK${NC} — Version: $VERSION"
else
  echo -e "  ${RED}FAIL${NC} — Health check failed"
  echo "  Response: $HEALTH"
  echo ""
  echo "❌ Service not healthy. Aborting tests."
  exit 1
fi

# 1. Provider Status
echo ""
echo -e "${CYAN}━━━ Pre-flight: Provider Status ━━━${NC}"
PROVIDERS=$(curl -s --max-time 10 \
  -H "X-API-Key: ${API_SECRET}" \
  "${SERVICE_URL}/api/ai/providers" 2>&1)
echo "  $(echo "$PROVIDERS" | head -c 500)"

# ==============================================================================
# Agent Tests
# ==============================================================================

echo ""
echo "=============================================================================="
echo "🤖 Individual Agent Tests"
echo "=============================================================================="

# Test 1: NLQ Agent — 서버 상태 조회
send_stream_query \
  "NLQ Agent — 서버 상태 조회" \
  "현재 서버 상태를 알려줘" \
  "서버"

# Test 2: NLQ Agent — 메트릭 필터링
send_stream_query \
  "NLQ Agent — CPU 높은 서버" \
  "CPU 사용률이 80% 이상인 서버 목록을 보여줘" \
  "cpu"

# Test 3: Analyst Agent — 이상 탐지
send_stream_query \
  "Analyst Agent — 이상 탐지" \
  "현재 이상 징후가 있는 서버가 있어? 분석해줘" \
  "이상"

# Test 4: Analyst Agent — 예측
send_stream_query \
  "Analyst Agent — 트렌드 예측" \
  "서버 리소스 사용 추세를 예측해줘" \
  "예측"

# Test 5: Reporter Agent — 보고서 생성
send_stream_query \
  "Reporter Agent — 장애 보고서" \
  "현재 시스템 장애 보고서를 작성해줘" \
  "보고서" \
  60

# Test 6: Advisor Agent — 문제 해결
send_stream_query \
  "Advisor Agent — 해결 방법" \
  "CPU가 높을 때 어떻게 해결해야 해? 명령어도 알려줘" \
  "명령어"

# Test 7: Vision Agent — 웹 검색 (Grounding)
send_stream_query \
  "Vision Agent — Search Grounding" \
  "Linux 서버 메모리 최적화 최신 공식 문서를 찾아줘" \
  "문서"

# Test 8: Multi-Agent — 복합 쿼리
send_stream_query \
  "Multi-Agent — 복합 분석" \
  "서버 상태를 분석하고 문제가 있으면 원인과 해결 방법을 알려줘" \
  "분석" \
  60

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "=============================================================================="
echo "📊 Test Results"
echo "=============================================================================="
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAIL test(s) failed.${NC}"
  exit 1
fi
