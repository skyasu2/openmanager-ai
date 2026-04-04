#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-ai-engine}"
REGION="${CLOUD_RUN_REGION:-asia-northeast1}"
PROJECT_ID="${GCP_PROJECT_ID:-}"
TIMEOUT_S="${AI_ENGINE_SMOKE_TIMEOUT_S:-8}"
RETRIES="${AI_ENGINE_SMOKE_RETRIES:-6}"
RETRY_DELAY_S="${AI_ENGINE_SMOKE_RETRY_DELAY_S:-5}"
AI_ENGINE_URL="${AI_ENGINE_URL:-}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ci/ai-engine-post-deploy-smoke.sh [--url=https://...]

Environment:
  AI_ENGINE_URL                 Explicit target URL (optional)
  GCP_PROJECT_ID                Used when URL is omitted
  CLOUD_RUN_SERVICE_NAME        Default: ai-engine
  CLOUD_RUN_REGION              Default: asia-northeast1
  AI_ENGINE_SMOKE_TIMEOUT_S     Default: 8
  AI_ENGINE_SMOKE_RETRIES       Default: 6
  AI_ENGINE_SMOKE_RETRY_DELAY_S Default: 5
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --url=*)
      AI_ENGINE_URL="${1#--url=}"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

resolve_url() {
  if [ -n "$AI_ENGINE_URL" ]; then
    printf '%s' "${AI_ENGINE_URL%/}"
    return 0
  fi

  if ! command -v gcloud >/dev/null 2>&1; then
    echo "❌ gcloud is required when AI_ENGINE_URL is not provided." >&2
    exit 1
  fi

  if [ -z "$PROJECT_ID" ]; then
    echo "❌ GCP_PROJECT_ID is required when AI_ENGINE_URL is not provided." >&2
    exit 1
  fi

  gcloud run services describe "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --format='value(status.url)'
}

request_check() {
  local path="$1"
  local expected_status="$2"
  local body_pattern="$3"
  local tmp_body
  tmp_body="$(mktemp)"

  local http_status
  http_status="$(curl -sS \
    --max-time "$TIMEOUT_S" \
    -o "$tmp_body" \
    -w '%{http_code}' \
    "${TARGET_URL}${path}" || true)"

  if [ "$http_status" != "$expected_status" ]; then
    echo "expected HTTP ${expected_status}, got ${http_status}" >&2
    cat "$tmp_body" >&2 || true
    rm -f "$tmp_body"
    return 1
  fi

  if ! grep -q "$body_pattern" "$tmp_body"; then
    echo "expected response body to contain pattern: $body_pattern" >&2
    cat "$tmp_body" >&2 || true
    rm -f "$tmp_body"
    return 1
  fi

  rm -f "$tmp_body"
  return 0
}

request_status_only() {
  local path="$1"
  local tmp_body
  tmp_body="$(mktemp)"

  local http_status
  http_status="$(curl -sS \
    --max-time "$TIMEOUT_S" \
    -o "$tmp_body" \
    -w '%{http_code}' \
    "${TARGET_URL}${path}" || true)"

  rm -f "$tmp_body"
  printf '%s' "$http_status"
}

run_with_retry() {
  local label="$1"
  shift

  local attempt=1
  local total_attempts=$((RETRIES + 1))
  while [ "$attempt" -le "$total_attempts" ]; do
    echo "- ${label} (attempt ${attempt}/${total_attempts})"
    if "$@"; then
      echo "  PASS"
      return 0
    fi

    if [ "$attempt" -eq "$total_attempts" ]; then
      echo "  FAIL"
      return 1
    fi

    echo "  retrying in ${RETRY_DELAY_S}s..."
    sleep "$RETRY_DELAY_S"
    attempt=$((attempt + 1))
  done
}

TARGET_URL="$(resolve_url)"

if [ -z "$TARGET_URL" ]; then
  echo "❌ Failed to resolve AI Engine URL." >&2
  exit 1
fi

echo "AI Engine Post-Deploy Smoke"
echo "- target: ${TARGET_URL}"
echo "- timeout: ${TIMEOUT_S}s"
echo "- retries: ${RETRIES}"
echo ""

run_with_retry "GET /health" request_check "/health" "200" '"status":"ok"'
run_with_retry "GET /warmup" request_check "/warmup" "200" '"status":"warmed_up"'

echo "- GET /monitoring (unauthenticated)"
monitoring_status="$(request_status_only "/monitoring")"
if [ "$monitoring_status" = "401" ] || [ "$monitoring_status" = "403" ]; then
  echo "  PASS (${monitoring_status})"
else
  echo "  FAIL (expected 401/403, got ${monitoring_status})"
  exit 1
fi

echo ""
echo "Summary"
echo "- smoke: pass"
echo "- target: ${TARGET_URL}"
