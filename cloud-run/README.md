# Cloud Run Deployment Guide

This directory contains the AI Engine microservice for OpenManager AI.

## Services

- **`ai-engine`**: Node.js LangGraph Supervisor for multi-agent orchestration (Gemini + Groq)

> **Note**: Rust ML service was removed in v5.84.0. All ML features (anomaly detection, trend prediction) are now handled by TypeScript within the AI Engine.

## 🚀 Deployment Instructions

### Prerequisites
- Google Cloud CLI (`gcloud`) installed and authenticated.
- Project ID set: `gcloud config set project [YOUR_PROJECT_ID]`

### Deploy AI Engine

```bash
cd ai-engine
gcloud run deploy ai-engine \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-secrets="GOOGLE_API_KEY=GOOGLE_API_KEY:latest" \
  --set-secrets="GROQ_API_KEY=GROQ_API_KEY:latest" \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest" \
  --set-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-secrets="CLOUD_RUN_API_SECRET=CLOUD_RUN_API_SECRET:latest"
```

### Verify
Check the health endpoint:
- AI Engine: `[AI_URL]/health` -> `{"status":"ok"}`

## 🛠️ Local Development (Docker Compose)

Run locally without deploying:

```bash
docker-compose up --build
```
- AI Engine: http://localhost:8080

## ML Features (TypeScript)

> **상세 문서**: [Monitoring & ML Engine](../docs/reference/architecture/ai/monitoring-ml.md)

### Components

| Component | Algorithm | Library |
|-----------|-----------|---------|
| SimpleAnomalyDetector | Moving Avg + 2σ | None (Custom) |
| IsolationForestDetector | Isolation Forest | `isolation-forest` |
| TrendPredictor | Linear Regression | None (Custom) |
| AdaptiveThreshold | Temporal Bucketing + EMA | None (Custom) |
| HybridAnomalyDetector | Ensemble (Statistical + IF) | None (Custom) |
| UnifiedAnomalyEngine | 3-way Ensemble + EventEmitter | None (Custom) |

### Location

```
ai-engine/src/lib/ai/monitoring/
├── SimpleAnomalyDetector.ts    # 통계 기반 탐지
├── IsolationForestDetector.ts  # ML 기반 다변량 탐지
├── TrendPredictor.ts           # 선형 회귀 예측
├── AdaptiveThreshold.ts        # 시간대별 적응형 임계값
├── HybridAnomalyDetector.ts    # 앙상블 투표
└── UnifiedAnomalyEngine.ts     # 통합 엔진 (Production)
```

### Performance

| Component | Latency | Use Case |
|-----------|---------|----------|
| Statistical | ~1-5ms | 빠른 1차 필터 |
| Isolation Forest | ~10-50ms | 다변량 정밀 분석 |
| Unified Engine | ~20-50ms | 프로덕션 전체 파이프라인 |
