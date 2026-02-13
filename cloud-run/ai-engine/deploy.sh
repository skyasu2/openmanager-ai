#!/bin/bash

# ==============================================================================
# Cloud Run Deployment Script (AI Engine)
#
# v7.1 - 2026-02-13 (Free Tier Guardrail Enforcement)
#   - Added hard guard checks for free-tier runtime limits
#   - Added forbidden option checks (machine-type/highcpu)
#   - Added cloudbuild.yaml value consistency validation
#
# v7.0 - 2026-02-02 (Cloud Run ₩0 Cost Optimization)
#   - Added --cpu-throttling (CPU only billed during requests)
#   - Added --no-session-affinity (reduce instance stickiness)
#   - Ensures live service matches deploy.sh settings
#
# v6.0 - 2026-02-02 (Cloud Build Free Tier Optimization)
#   - Removed --machine-type=e2-highcpu-8 (not covered by free tier)
#   - Uses default e2-medium (free: 120 min/day)
#   - ⚠️ FREE TIER RULE: Do NOT add --machine-type option
#
# v5.0 - 2026-01-08 (Artifact Registry Migration)
#   - gcr.io → Artifact Registry (asia-northeast1-docker.pkg.dev)
#   - Auto-create Artifact Registry repository if not exists
#
# v4.0 - 2026-01-06 (Docker & Cloud Run Optimization)
#   - BuildKit enabled for cache mounts
#   - Startup/Liveness probes optimized
#   - Memory updated to 512Mi for Free Tier compliance
#   - Added --service-min-instances for warm pool (optional)
#   - Parallel image cleanup for faster deployment
#
# v3.0 - 2026-01-06:
#   - Added --execution-environment=gen2
#   - Added --timeout=300 for long-running AI requests
#
# v2.0 - 2026-01-01:
#   - Added --cpu-boost for faster cold start
#   - Added --session-affinity for stateful connection
#
# v1.0 - 2025-12-28: Initial version
# ==============================================================================

set -e # Exit on error

# Configuration
SERVICE_NAME="ai-engine"
# IMPORTANT: asia-northeast1 is the production region (used by Vercel)
REGION="asia-northeast1"
REPOSITORY="cloud-run"

# Free-tier runtime limits (non-negotiable)
FREE_TIER_MIN_INSTANCES="0"
FREE_TIER_MAX_INSTANCES="1"
FREE_TIER_CONCURRENCY="80"
FREE_TIER_CPU="1"
FREE_TIER_MEMORY="512Mi"
FREE_TIER_TIMEOUT="300"

if [ "${FREE_TIER_GUARD_ONLY:-false}" = "true" ]; then
  PROJECT_ID="guard-only"
else
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
  if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: No Google Cloud Project selected."
    echo "Run 'gcloud config set project [PROJECT_ID]' first."
    exit 1
  fi
fi

# Check if Artifact Registry repository exists
if [ "${FREE_TIER_GUARD_ONLY:-false}" != "true" ]; then
  echo "📋 Checking Artifact Registry..."
  if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
    echo "⚠️  Repository '$REPOSITORY' not found. Creating..."
    gcloud artifacts repositories create "$REPOSITORY" \
      --repository-format=docker \
      --location="$REGION" \
      --description="Cloud Run container images"
    echo "✅ Repository created."
  fi
fi

# Image Tagging (Timestamp + Short SHA)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "manual")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TAG="v-${TIMESTAMP}-${SHORT_SHA}"
# Artifact Registry format: REGION-docker.pkg.dev/PROJECT/REPOSITORY/IMAGE:TAG
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:${TAG}"

echo "=============================================================================="
echo "🚀 Starting Deployment for: $SERVICE_NAME"
echo "   Project:    $PROJECT_ID"
echo "   Region:     $REGION"
echo "   Repository: $REPOSITORY (Artifact Registry)"
echo "   Image:      $IMAGE_URI"
echo "=============================================================================="

# Ensure script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

fail_free_tier_guard() {
  echo "❌ [Free Tier Guard] $1"
  exit 1
}

assert_no_forbidden_args() {
  for arg in "$@"; do
    local_arg="${arg,,}"
    case "$local_arg" in
      *--machine-type*|*e2_highcpu_8*|*n1_highcpu_8*|*e2-highcpu-8*|*n1-highcpu-8*)
        fail_free_tier_guard "Forbidden option detected: $arg"
        ;;
    esac
  done
}

extract_cloudbuild_flag_value() {
  local flag="$1"
  awk -v target="$flag" '
    BEGIN { found = 0 }
    {
      line = $0
      gsub(/\r$/, "", line)
    }
    found == 0 {
      if (line ~ /^[[:space:]]*-[[:space:]]*'\''[^'\'']+'\''[[:space:]]*$/) {
        candidate = line
        sub(/^[[:space:]]*-[[:space:]]*'\''/, "", candidate)
        sub(/'\''[[:space:]]*$/, "", candidate)
        if (candidate == target) {
          found = 1
        }
      }
      next
    }
    found == 1 {
      if (line ~ /^[[:space:]]*$/) next
      if (line ~ /^[[:space:]]*#/) next
      if (line ~ /^[[:space:]]*-[[:space:]]*'\''[^'\'']+'\''[[:space:]]*$/) {
        value = line
        sub(/^[[:space:]]*-[[:space:]]*'\''/, "", value)
        sub(/'\''[[:space:]]*$/, "", value)
        print value
        exit
      }
      if (line ~ /^[[:space:]]*-[[:space:]]*[^[:space:]]+[[:space:]]*$/) {
        value = line
        sub(/^[[:space:]]*-[[:space:]]*/, "", value)
        sub(/[[:space:]]*$/, "", value)
        print value
        exit
      }
      exit
    }
  ' "$SCRIPT_DIR/cloudbuild.yaml"
}

assert_cloudbuild_flag_value() {
  local flag="$1"
  local expected="$2"
  local actual
  actual=$(extract_cloudbuild_flag_value "$flag")
  if [ -z "$actual" ]; then
    fail_free_tier_guard "cloudbuild.yaml missing $flag"
  fi
  if [ "$actual" != "$expected" ]; then
    fail_free_tier_guard "cloudbuild.yaml $flag must be $expected (current: $actual)"
  fi
}

enforce_free_tier_guards() {
  echo ""
  echo "🛡️ Enforcing free-tier guardrails..."

  if [ "$FREE_TIER_MIN_INSTANCES" != "0" ]; then
    fail_free_tier_guard "FREE_TIER_MIN_INSTANCES must be 0"
  fi
  if [ "$FREE_TIER_MAX_INSTANCES" != "1" ]; then
    fail_free_tier_guard "FREE_TIER_MAX_INSTANCES must be 1"
  fi
  if [ "$FREE_TIER_CPU" != "1" ]; then
    fail_free_tier_guard "FREE_TIER_CPU must be 1"
  fi
  if [ "$FREE_TIER_MEMORY" != "512Mi" ]; then
    fail_free_tier_guard "FREE_TIER_MEMORY must be 512Mi"
  fi

  if grep -Ev '^[[:space:]]*#' "$SCRIPT_DIR/cloudbuild.yaml" | grep -Eq 'machineType|--machine-type|E2_HIGHCPU_8|N1_HIGHCPU_8|e2-highcpu-8|n1-highcpu-8'; then
    fail_free_tier_guard "cloudbuild.yaml contains forbidden machine-type/highcpu settings"
  fi

  assert_cloudbuild_flag_value "--min-instances" "$FREE_TIER_MIN_INSTANCES"
  assert_cloudbuild_flag_value "--max-instances" "$FREE_TIER_MAX_INSTANCES"
  assert_cloudbuild_flag_value "--concurrency" "$FREE_TIER_CONCURRENCY"
  assert_cloudbuild_flag_value "--cpu" "$FREE_TIER_CPU"
  assert_cloudbuild_flag_value "--memory" "$FREE_TIER_MEMORY"
  assert_cloudbuild_flag_value "--timeout" "$FREE_TIER_TIMEOUT"

  echo "   ✅ Free-tier guardrails passed"
}

enforce_free_tier_guards

if [ "${FREE_TIER_GUARD_ONLY:-false}" = "true" ]; then
  echo "ℹ️ FREE_TIER_GUARD_ONLY=true, skipping build/deploy."
  exit 0
fi

# 0. Sync SSOT Config & Data Files
echo ""
echo "📋 Syncing SSOT config and data files..."

# Config files
mkdir -p config
cp ../../src/config/rules/system-rules.json ./config/system-rules.json
echo "   ✅ system-rules.json synced to config/"

# Hourly-data files (24h metrics SSOT)
mkdir -p data/hourly-data
cp ../../src/data/hourly-data/*.json ./data/hourly-data/
echo "   ✅ hourly-data synced ($(ls -1 data/hourly-data/*.json | wc -l) files)"

# OTel processed data (PRIMARY data source — pre-aggregated by build-time pipeline)
mkdir -p data/otel-processed/hourly
cp ../../src/data/otel-processed/resource-catalog.json ./data/otel-processed/
cp ../../src/data/otel-processed/hourly/*.json ./data/otel-processed/hourly/
echo "   ✅ otel-processed synced (resource-catalog + $(ls -1 data/otel-processed/hourly/*.json | wc -l) hourly files)"

# 1. Build Container Image (Cloud Build with BuildKit)
echo ""
echo "📦 Building Container Image..."
echo "   Using BuildKit for cache optimization..."
echo "   Target: Artifact Registry"

# Use Cloud Build with BuildKit enabled
# ⚠️ FREE TIER: Do NOT add --machine-type (default e2-medium = free 120 min/day)
#    e2-highcpu-8 등 커스텀 머신은 무료 대상 아님!
BUILD_CMD=(
  gcloud builds submit
  --tag "$IMAGE_URI"
  --timeout=600s
  .
)
assert_no_forbidden_args "${BUILD_CMD[@]}"
"${BUILD_CMD[@]}"

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting."
  exit 1
fi

# 2. Deploy to Cloud Run
echo ""
echo "🚀 Deploying to Cloud Run..."
# ============================================================================
# FREE TIER OPTIMIZED Configuration
# Monthly Free: 180,000 vCPU-sec, 360,000 GB-sec, 2M requests
#
# With 1 vCPU + 512Mi:
# - vCPU: 180,000 sec = 50 hours of active time
# - Memory: 360,000 / 0.5 = 720,000 sec = 200 hours
# ============================================================================
DEPLOY_CMD=(
  gcloud run deploy "$SERVICE_NAME"
  --image "$IMAGE_URI"
  --platform managed
  --region "$REGION"
  --execution-environment gen2
  --allow-unauthenticated
  --min-instances "$FREE_TIER_MIN_INSTANCES"
  --max-instances "$FREE_TIER_MAX_INSTANCES"
  --concurrency "$FREE_TIER_CONCURRENCY"
  --cpu "$FREE_TIER_CPU"
  --memory "$FREE_TIER_MEMORY"
  --timeout "$FREE_TIER_TIMEOUT"
  --cpu-boost
  --cpu-throttling
  --no-session-affinity
  --set-env-vars "NODE_ENV=production,BUILD_SHA=${SHORT_SHA}"
  --set-secrets "SUPABASE_CONFIG=supabase-config:latest,AI_PROVIDERS_CONFIG=ai-providers-config:latest,KV_CONFIG=kv-config:latest,CLOUD_RUN_API_SECRET=cloud-run-api-secret:latest,LANGFUSE_CONFIG=langfuse-config:latest"
  --update-labels "version=${SHORT_SHA},framework=ai-sdk-v6,tier=free,registry=artifact"
)
assert_no_forbidden_args "${DEPLOY_CMD[@]}"
"${DEPLOY_CMD[@]}"

if [ $? -eq 0 ]; then
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
    echo ""
    echo "✅ Deployment Successful!"
    echo "🌍 Service URL: $SERVICE_URL"
    echo "=============================================================================="

    # 3. Health Check
    echo ""
    echo "🏥 Running health check..."
    sleep 5
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" || echo "000")
    if [ "$HEALTH_STATUS" = "200" ]; then
      echo "   ✅ Health check passed (HTTP 200)"
    else
      echo "   ⚠️  Health check returned HTTP $HEALTH_STATUS (may still be starting)"
    fi

    # 4. Cleanup old images and sources (parallel, non-blocking)
    echo ""
    echo "🧹 Cleaning up old resources (background)..."

    # Cleanup old container images from Artifact Registry (keep latest 2)
    KEEP_IMAGES=2
    AR_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}"
    (
      OLD_DIGESTS=$(gcloud artifacts docker images list "$AR_IMAGE" \
        --format="value(digest)" --sort-by=~CREATE_TIME 2>/dev/null | tail -n +$((KEEP_IMAGES + 1)))

      if [ -n "$OLD_DIGESTS" ]; then
        for digest in $OLD_DIGESTS; do
          gcloud artifacts docker images delete "${AR_IMAGE}@${digest}" \
            --quiet --delete-tags 2>/dev/null &
        done
        wait
        echo "   ✅ Old images cleaned up (Artifact Registry)"
      fi
    ) &

    # Cleanup old Cloud Build sources (keep latest 10)
    KEEP_SOURCES=10
    BUCKET_NAME="${PROJECT_ID}_cloudbuild"
    (
      if gsutil ls "gs://${BUCKET_NAME}/" >/dev/null 2>&1; then
        OLD_SOURCES=$(gsutil ls -l "gs://${BUCKET_NAME}/source/" 2>/dev/null | \
          grep -v "TOTAL:" | sort -k2 -r | tail -n +$((KEEP_SOURCES + 1)) | awk '{print $3}')

        if [ -n "$OLD_SOURCES" ]; then
          echo "$OLD_SOURCES" | xargs -P 10 gsutil rm 2>/dev/null || true
          echo "   ✅ Old build sources cleaned up"
        fi
      fi
    ) &

    # Cleanup old Cloud Run revisions (keep latest 3)
    KEEP_REVISIONS=3
    (
      OLD_REVISIONS=$(gcloud run revisions list \
        --service="$SERVICE_NAME" \
        --region="$REGION" \
        --format="value(name)" \
        --sort-by="~metadata.creationTimestamp" 2>/dev/null | tail -n +$((KEEP_REVISIONS + 1)))

      if [ -n "$OLD_REVISIONS" ]; then
        for rev in $OLD_REVISIONS; do
          gcloud run revisions delete "$rev" --region="$REGION" --quiet 2>/dev/null || true
        done
        echo "   ✅ Old revisions cleaned up"
      fi
    ) &

    # Wait for all cleanup tasks
    wait

    echo "=============================================================================="
    echo "📊 Deployment Summary (FREE TIER OPTIMIZED):"
    echo "   Service:    $SERVICE_NAME"
    echo "   Version:    $SHORT_SHA"
    echo "   URL:        $SERVICE_URL"
    echo "   Registry:   Artifact Registry (${REGION})"
    echo "   Memory:     ${FREE_TIER_MEMORY} (Free: ~200 hours/month)"
    echo "   CPU:        ${FREE_TIER_CPU} vCPU (Free: ~50 hours/month)"
    echo "   Max:        ${FREE_TIER_MAX_INSTANCES} instance"
    echo "   Features:   cpu-boost, cpu-throttling, no-session-affinity, gen2"
    echo "=============================================================================="
else
    echo ""
    echo "❌ Deployment Failed."
    exit 1
fi
