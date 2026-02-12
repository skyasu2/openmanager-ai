---
name: cloud-run-deploy
description: Cloud Run AI Engine deployment workflow with free tier optimization. Triggers when user requests Cloud Run deployment, AI engine deploy, or production release. Use for deploying AI Engine to Google Cloud Run.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep
---

# Cloud Run Deployment Skill

**Target Token Efficiency**: 65% (350 tokens -> 120 tokens)

## Purpose

Automate Cloud Run AI Engine deployment with free tier optimized configuration, without manual script explanation.

## Trigger Keywords

- "deploy cloud run"
- "cloud run deploy"
- "deploy ai engine"
- "ai engine deploy"
- "production deploy"
- "배포"
- "클라우드 런 배포"
- "AI 엔진 배포"
- "프로덕션 배포"
- "gcp deploy"

## Context

- **Project**: OpenManager AI v8.0.0
- **Region**: asia-northeast1 (Seoul)
- **Service**: ai-engine
- **Tier**: FREE TIER OPTIMIZED
- **Free Limits**: 180,000 vCPU-sec, 360,000 GB-sec, 2M requests/month

## Configuration (Free Tier)

### Cloud Run
| Resource | Value | Free Hours/Month |
|----------|-------|------------------|
| CPU | 1 vCPU | ~50 hours |
| Memory | 512Mi | ~200 hours |
| Max Instances | 3 | - |
| Concurrency | 80 | - |
| Timeout | 300s | - |

### Cloud Build
| Resource | Value | Free Limit |
|----------|-------|------------|
| Machine | default (e2-medium) | 120 min/day |

> **⚠️ FREE TIER RULES (절대 위반 금지)**:
> - `deploy.sh`에 `--machine-type` 옵션 추가 금지
> - `cloudbuild.yaml`에 `machineType` 설정 추가 금지
> - `E2_HIGHCPU_8`, `N1_HIGHCPU_8` 등 커스텀 머신은 **무료 대상 아님**
> - 기본 머신(e2-medium)만 일 120분 무료 빌드 제공

## Workflow

### 1. Pre-deployment Check

```bash
# Check current working directory
cd /mnt/d/cursor/openmanager-ai/cloud-run/ai-engine

# Verify GCP project
gcloud config get-value project

# Check for uncommitted changes
git status --short
```

**Expected**:
- Project: `openmanager-free-tier`
- Clean working tree (recommended)

### 2. TypeScript Build Check

```bash
# Verify TypeScript compiles
npm run build --prefix /mnt/d/cursor/openmanager-ai/cloud-run/ai-engine
```

**Expected**:
- No compilation errors
- `dist/` directory updated

### 3. Execute Deployment

```bash
# Run deployment script
cd /mnt/d/cursor/openmanager-ai/cloud-run/ai-engine && bash deploy.sh
```

**Deployment Steps** (automated by script):
1. Build container image (Cloud Build, ~2-3 min)
2. Deploy to Cloud Run (~1 min)
3. Health check
4. Cleanup old images/revisions (background)

### 4. Verify Deployment

```bash
# Health check
curl -s https://ai-engine-490817238363.asia-northeast1.run.app/health | jq

# Check monitoring endpoint
curl -s https://ai-engine-490817238363.asia-northeast1.run.app/monitoring | jq '.agents'
```

**Expected Health Response**:
```json
{
  "status": "healthy",
  "version": "8.0.x",
  "agents": {
    "active": 4,
    "available": ["NLQ", "Analyst", "Reporter", "Advisor"]
  }
}
```

## Report Summary Format

```
🚀 Cloud Run Deployment Results
├─ Service: ai-engine
├─ Region: asia-northeast1
├─ Version: {SHORT_SHA}
├─ URL: https://ai-engine-*.run.app
├─ Status: ✅ Success / ❌ Failed
│
├─ Resource Config (FREE TIER):
│   ├─ CPU: 1 vCPU (~50 hrs/month free)
│   ├─ Memory: 512Mi (~200 hrs/month free)
│   └─ Max Instances: 3
│
└─ Health Check: ✅ Pass / ❌ Fail
```

## Token Optimization Strategy

**Before (Manual)**:
```
User: "배포해줘"
Assistant: [reads Dockerfile, explains config, explains free tier, runs commands, checks logs]
Tokens: ~350
```

**After (Skill)**:
```
User: "deploy cloud run"
Skill: [executes workflow, reports summary]
Tokens: ~120 (65% reduction)
```

## Edge Cases

배포 문제 해결: [references/edge-cases.md](references/edge-cases.md)

- Build Failure
- Deployment Timeout
- Health Check Failure
- Permission Denied
- Free Tier 초과

## Rollback

롤백 절차: [references/rollback.md](references/rollback.md)

**빠른 롤백**:
```bash
# 이전 리비전으로 트래픽 전환
gcloud run services update-traffic ai-engine \
  --region asia-northeast1 \
  --to-revisions REVISION_NAME=100
```

## Related Files

| File | Purpose |
|------|---------|
| `cloud-run/ai-engine/Dockerfile` | Multi-stage build config |
| `cloud-run/ai-engine/deploy.sh` | Deployment script |
| `cloud-run/ai-engine/cloudbuild.yaml` | CI/CD config (optional) |

## Success Criteria

- Build: Completed without errors
- Deploy: Service updated successfully
- Health: HTTP 200 from `/health`
- Agents: All 5 agents active

## Related Skills

- `lint-smoke` - Pre-deployment code quality check

## Changelog

- 2026-02-02: v1.1.0 - Cloud Build free tier optimization
  - Removed machineType: E2_HIGHCPU_8 from cloudbuild.yaml
  - Removed --machine-type=e2-highcpu-8 from deploy.sh
  - Added free tier guard rules to prevent recurrence
- 2026-01-06: v1.0.0 - Initial implementation
  - Free tier optimized configuration
  - 1 vCPU, 512Mi memory, 3 max instances
  - Integrated health check verification
  - 10 trigger keywords (Korean/English)
