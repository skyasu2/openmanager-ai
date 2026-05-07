# Cloud Run Deployment Guide

This directory contains the AI Engine microservice for OpenManager AI.

## Services

- **`ai-engine`**: Node.js AI Engine for multi-agent orchestration (Cerebras/Groq/Mistral/Gemini via Vercel AI SDK)

> **Note**: Rust ML service was removed in v5.84.0. All ML features (anomaly detection, trend prediction) are now handled by TypeScript within the AI Engine.

## 🚀 Deployment Instructions

### Prerequisites
- Google Cloud CLI (`gcloud`) installed and authenticated.
- Project ID set: `gcloud config set project [YOUR_PROJECT_ID]`

### Deploy AI Engine

```bash
cd ai-engine
./deploy.sh
```

현재 레포 공식 배포 경로는 `./deploy.sh`입니다.
- `deploy.sh`는 `gcloud builds submit`로 Cloud Build에서 Docker를 원격 빌드합니다.
- 수동 실행 기본값은 `scripts/docker-preflight.sh`의 로컬 Docker build-only 사전 점검을 먼저 수행합니다.
- GitLab CI `deploy_ai_engine`는 중복 로컬 빌드를 피하기 위해 `LOCAL_DOCKER_PREFLIGHT=false`로 실행하고, Cloud Build를 운영 이미지 빌드 권위로 둡니다.
- 실 배포는 `gcloud run deploy --image ...`로 진행되며, 로컬 Docker 결과물을 바로 사용하지 않습니다.
- 운영 반영 시에는 `--source .` 방식보다 위 스크립트를 사용해 태깅/라벨/가드레일/클린업 규칙을 일관되게 적용하세요.

원하면 빠른 실험/검증 목적(권장 아님)으로만 아래와 같이 `--source` 배포를 사용할 수 있습니다.

```bash
cd ai-engine
gcloud run deploy ai-engine \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-secrets="SUPABASE_CONFIG=supabase-config:latest,AI_PROVIDERS_CONFIG=ai-providers-config:latest,KV_CONFIG=kv-config:latest,CLOUD_RUN_API_SECRET=cloud-run-api-secret:latest,LANGFUSE_CONFIG=langfuse-config:latest"
```

### Verify
Check the health endpoint:
- AI Engine: `[AI_URL]/health` -> `{"status":"ok"}`

## 🛠️ Local Development (Docker Compose)

Run locally without deploying:

```bash
docker compose up --build
```
- AI Engine: http://localhost:8080
- Local Compose reads `cloud-run/.env` and prefers `GEMINI_API_KEY` / `GEMINI_API_KEY_PRIMARY` for Gemini.

## ML Features (TypeScript)

> **상세 문서**: [Monitoring & ML Engine](../docs/reference/architecture/ai/monitoring-ml.md)

### Components

| Component | Algorithm | Library |
|-----------|-----------|---------|
| SimpleAnomalyDetector | Moving Avg + 2σ | None (Custom) |
| TrendPredictor | Linear Regression | None (Custom) |
| TrendPredictor.enhanced | Threshold crossing / recovery ETA | None (Custom) |

### Location

```
ai-engine/src/lib/ai/monitoring/
├── SimpleAnomalyDetector.ts    # 통계 기반 탐지
├── TrendPredictor.ts           # 선형 회귀 예측
├── TrendPredictor.enhanced.ts  # 임계값 도달/복귀 ETA 예측
└── TrendPredictor.types.ts     # 예측 타입 정의
```

### Performance

| Component | Latency | Use Case |
|-----------|---------|----------|
| SimpleAnomalyDetector | ~1-5ms | 빠른 실시간 이상 탐지 |
| TrendPredictor | ~1-3ms | 선형 추세 예측 |
| TrendPredictor.enhanced | ~2-5ms | 임계값 도달/복귀 시점 추정 |
