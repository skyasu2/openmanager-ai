#!/bin/bash

# ==============================================================================
# Cloud Run Deployment Script (AI Engine)
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
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No Google Cloud Project selected."
  echo "Run 'gcloud config set project [PROJECT_ID]' first."
  exit 1
fi

# Check if Artifact Registry repository exists
echo "📋 Checking Artifact Registry..."
if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  echo "⚠️  Repository '$REPOSITORY' not found. Creating..."
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Cloud Run container images"
  echo "✅ Repository created."
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
gcloud builds submit \
  --tag "$IMAGE_URI" \
  --timeout=600s \
  .

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
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --platform managed \
  --region "$REGION" \
  --execution-environment gen2 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 80 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 300 \
  --cpu-boost \
  --cpu-throttling \
  --no-session-affinity \
  --set-env-vars "NODE_ENV=production,BUILD_SHA=${SHORT_SHA}" \
  --set-secrets "SUPABASE_CONFIG=supabase-config:latest,AI_PROVIDERS_CONFIG=ai-providers-config:latest,KV_CONFIG=kv-config:latest,CLOUD_RUN_API_SECRET=cloud-run-api-secret:latest,LANGFUSE_CONFIG=langfuse-config:latest" \
  --update-labels "version=${SHORT_SHA},framework=ai-sdk-v6,tier=free,registry=artifact"

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

    # Cleanup old container images from Artifact Registry (keep latest 3)
    KEEP_IMAGES=3
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
    echo "   Memory:     512Mi (Free: ~200 hours/month)"
    echo "   CPU:        1 vCPU (Free: ~50 hours/month)"
    echo "   Max:        1 instance"
    echo "   Features:   cpu-boost, cpu-throttling, no-session-affinity, gen2"
    echo "=============================================================================="
else
    echo ""
    echo "❌ Deployment Failed."
    exit 1
fi
