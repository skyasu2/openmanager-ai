# AI Engine - Cloud Run Service

Vercel AI SDK Multi-Agent Supervisor for OpenManager AI v8.11.113

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Type check
npm run type-check

# Run tests (Fast default)
npm run test

# Run full test suite including Vision tests
npm run test:all

# Deploy to Cloud Run
# 권장: 운영 배포 스크립트(Cloud Build 원격 빌드 + Free Tier 가드레일)
bash deploy.sh

# Artifact Registry cleanup 재점검
# 1일 보존 임계 + keep latest 3 + cleanup background job 반영 후 용량/삭제 로그 점검
bash scripts/check-artifact-registry-cleanup.sh

# Cleanup policy 적용 계획 출력 (외부 상태 변경 없음)
bash scripts/apply-cleanup-policies.sh

# Artifact Registry cleanup policy dry-run 저장
MODE=dry-run bash scripts/apply-cleanup-policies.sh

# Cleanup policy 실제 적용
MODE=apply bash scripts/apply-cleanup-policies.sh

# GitLab CI 수동/스케줄 재점검
# job: observe_artifact_registry_cleanup
# 권장: 2026-04-22 이후 daily 10:00 KST schedule 또는 필요 시 Run pipeline(web)에서 manual 실행

# 실험용/임시 목적만: 로컬 소스로 직접 배포
# (운영 반영에는 권장하지 않음)
gcloud run deploy ai-engine --source . --region asia-northeast1
```

### Cleanup Policy

- Artifact Registry: `cloud-run/ai-engine/config/artifact-registry-cleanup-policy.json`
  - delete: `ai-engine` images older than `1d`
  - keep: latest `3` versions for rollback
- Deploy cleanup: GitLab CI runs `deploy.sh` with cleanup enabled.
  - images: keep latest `3`
  - Cloud Build source uploads: keep latest `5`
  - Cloud Run revisions: keep latest `3`
- Cloud Storage lifecycle:
  - `openmanager-free-tier_cloudbuild/source/`: delete after `7d`
  - `run-sources-openmanager-free-tier-asia-northeast1/services/ai-engine/`: delete after `7d`
- Apply:
  - plan only: `bash scripts/apply-cleanup-policies.sh`
  - Artifact Registry dry-run: `MODE=dry-run bash scripts/apply-cleanup-policies.sh`
  - active: `MODE=apply bash scripts/apply-cleanup-policies.sh`
- Verification:
  - local: `bash scripts/check-artifact-registry-cleanup.sh`
  - GitLab CI: `observe_artifact_registry_cleanup`

## Architecture

```
src/
├── server.ts                      # Hono HTTP server (+ Graceful Shutdown)
├── routes/                        # API route handlers
├── services/
│   ├── ai-sdk/
│   │   ├── supervisor.ts          # Vercel AI SDK Supervisor
│   │   ├── model-provider.ts      # Multi-provider failover
│   │   └── agents/                # Agent definitions
│   │       ├── base-agent.ts      # ToolLoopAgent-based base class
│   │       ├── agent-factory.ts   # ConfigBasedAgent factory
│   │       ├── vision-agent.ts    # Gemini Vision (NEW v7.1.0)
│   │       ├── orchestrator.ts    # Multi-agent orchestration
│   │       └── config/            # Agent configurations
│   ├── observability/
│   │   └── langfuse.ts            # LLM Observability (FREE)
│   └── resilience/
│       └── circuit-breaker.ts     # Fault tolerance
├── tools-ai-sdk/                  # AI SDK Tools
├── data/
│   └── precomputed-state.ts       # O(1) server state lookup
└── lib/
    ├── model-config.ts            # LLM Configuration
    └── redis-client.ts            # Upstash Redis cache
```

## Agent Implementation Pattern

### BaseAgent + ToolLoopAgent (AI SDK v6 Official Pattern)

모든 에이전트는 `BaseAgent` 추상 클래스를 통해 AI SDK v6의 공식 `ToolLoopAgent`를 내부적으로 사용:

- `run(query, options)`: `ToolLoopAgent.generate()` 위임 - 결과를 기다림
- `stream(query, options)`: `ToolLoopAgent.stream()` 위임 - 실시간 응답
- `isAvailable()`: 에이전트 가용성 확인

**ToolLoopAgent 설정:**
- `stopWhen: [hasToolCall('finalAnswer'), stepCountIs(N)]` - 종료 조건
- `timeout: { totalMs, chunkMs }` - 실행 시간 제한
- `onStepFinish` - 단계별 모니터링
- 5개 라우팅 LLM Agent와 2개 내부 pipeline config가 `ConfigBasedAgent` 단일 클래스를 공유 (per-type 서브클래스 제거)

### AgentFactory Pattern

중앙화된 에이전트 생성:

```typescript
// 타입 기반 생성
const nlq = AgentFactory.create('nlq');
const analyst = AgentFactory.create('analyst');
const vision = AgentFactory.create('vision');

// 가용성 확인
if (AgentFactory.isAvailable('vision')) {
  const agent = AgentFactory.create('vision');
  const result = await agent.run('스크린샷 분석해줘');
}

// 전체 상태 조회
const status = AgentFactory.getAvailabilityStatus();
// { nlq: true, analyst: true, vision: false, ... }
```

### Vision Agent

Gemini Flash Primary + OpenRouter Fallback:

| Feature | Capability |
|---------|------------|
| **Context Window** | 1M tokens |
| **Multimodal** | Image/PDF/Video/Audio |
| **Google Search** | Grounding 지원 |
| **URL Context** | 웹 페이지 분석 |

**Graceful Degradation**: Gemini/OpenRouter 모두 미구성 시 → Analyst Agent로 폴백 (제한된 분석)

```typescript
import { getVisionAgentOrFallback, isVisionQuery } from './vision-agent';

if (isVisionQuery(query)) {
  const { agent, isFallback, fallbackReason } = getVisionAgentOrFallback(query);
  if (agent) {
    const result = await agent.run(query);
  }
}
```

## LLM Providers (Role-Based Assignment)

| Agent | Primary | Fallback Chain | Free Tier |
|-------|---------|---------------|-----------|
| Supervisor (single-agent) | Groq `meta-llama/llama-4-scout-17b-16e-instruct` | → Cerebras → Mistral | 30 RPM, 30K TPM, 1K RPD, 500K TPD |
| NLQ Agent | Groq `meta-llama/llama-4-scout-17b-16e-instruct` | → Cerebras `llama3.1-8b` when context permits → Mistral | 30 RPM, 30K TPM, 1K RPD, 500K TPD |
| Analyst/Reporter/Advisor/Verifier | Groq long-context path; Cerebras `llama3.1-8b` only when context permits | → Mistral | Free-tier constrained; quota guarded |
| Orchestrator | Groq primary; Cerebras `llama3.1-8b` short-context fallback | → Mistral | Free-tier constrained; quota guarded |
| Summarization fallback | Mistral `mistral-small-latest` | → Groq → Cerebras | Workspace-tier dependent; low RPM |
| **Vision Agent** | **Gemini `gemini-2.5-flash-lite`** | **→ OpenRouter Gemma fallback** | **15 RPM, 1K RPD** |

### Agent Usage by Feature

| Feature | Primary Agent | Access Path |
|---------|---------------|-------------|
| AI Chat | Orchestrator → NLQ/Analyst/Reporter/Advisor | `/api/ai/supervisor` |
| Auto Incident Report | Reporter (direct) | `/api/ai/incident-report` |
| Intelligent Monitoring | Analyst (direct) | `/api/ai/analyze-server` |

> **Note**: Advisor는 Chat에서 Orchestrator handoff를 통해서만 사용됩니다.

## Observability - Langfuse (FREE Tier)

**무료 사용 가능**: [langfuse.com/pricing](https://langfuse.com/pricing)

| 항목 | Hobby (무료) |
|------|-------------|
| 비용 | $0 |
| 이벤트 | ~50K-100K/월 |
| 데이터 보존 | 90일 |
| 신용카드 | 불필요 |

### 환경 변수 설정

```bash
# Langfuse (FREE - https://cloud.langfuse.com)
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### 기능
- LLM 호출 트레이싱
- 토큰 사용량 추적
- 비용 분석
- 성능 모니터링

## Resilience - Circuit Breaker

Provider 장애 시 자동 복구:

```
CLOSED → (3회 실패) → OPEN → (30초 후) → HALF_OPEN → (성공) → CLOSED
```

### 모니터링 엔드포인트

```bash
# Circuit Breaker 상태 조회
curl https://ai-engine-xxx.run.app/monitoring

# Circuit Breaker 리셋
curl -X POST https://ai-engine-xxx.run.app/monitoring/reset
```

## Environment Variables

```bash
# Required - AI Providers (최소 1개)
CEREBRAS_API_KEY=xxx               # Cerebras (Primary - Supervisor, NLQ)
GROQ_API_KEY=xxx                   # Groq (Analyst, Reporter)
MISTRAL_API_KEY=xxx                # Mistral last-resort text fallback
MISTRAL_MODEL_ID=mistral-small-latest
# OPENROUTER_API_KEY=xxx           # 제거됨 (2026-01-07) - Summarizer Agent 통합

# Optional - Observability (FREE)
LANGFUSE_SECRET_KEY=xxx
LANGFUSE_PUBLIC_KEY=xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com

# Optional - Supabase
SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Optional - Upstash Redis
UPSTASH_REDIS_REST_URL=xxx
UPSTASH_REDIS_REST_TOKEN=xxx

# Security
CLOUD_RUN_API_SECRET=xxx           # API Key for /api/* endpoints
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/warmup` | GET | Precomputed state warmup |
| `/monitoring` | GET | Circuit Breaker status |
| `/monitoring/reset` | POST | Reset Circuit Breakers |
| `/api/ai/supervisor` | POST | AI Chat (streaming) |
| `/api/ai/generate` | POST | Text generation |

## Testing

```bash
# Low-cost production smoke (default: 0 LLM calls)
npm run test:cloud:essential -- --url=https://ai-engine-xxx.asia-northeast1.run.app

# Unit tests (default, vision-excluded)
npm run test

# Unit tests including Vision coverage (required for Vision Agent changes)
npm run test:all

# Watch mode
npm run test:watch

# Promptfoo evaluation
npm run prompt:eval
npm run prompt:view

# Security red-team tests
npm run prompt:redteam
```

### Cost-safe Cloud validation policy

- Default cloud smoke (`test:cloud:essential`) checks only `/health`, `/warmup`, `/api/ai/supervisor/health`.
- It skips token-consuming generation calls by default.
- Use `test:cloud:essential:llm-once` only when you explicitly need a single end-to-end inference check.

## Deployment

```bash
# Recommended deployment
# - includes free-tier guard
# - runs local Docker preflight in build-only mode by default
bash deploy.sh

# Enable full local runtime check before Cloud Build
LOCAL_DOCKER_PREFLIGHT_SKIP_RUN=false bash deploy.sh

# Disable local Docker preflight explicitly when needed
LOCAL_DOCKER_PREFLIGHT=false bash deploy.sh

# Service URL (dynamic lookup)
gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)'
```

## Docker

```bash
# Preflight build + health check (optional)
npm run docker:preflight

# Build only (skip local run)
SKIP_RUN=true npm run docker:preflight
```

Notes:
- In WSL environments, the preflight script automatically falls back to `cmd.exe /c docker ...` when `/var/run/docker.sock` is unavailable.
- `bash deploy.sh` now uses build-only preflight by default; set `LOCAL_DOCKER_PREFLIGHT_SKIP_RUN=false` when you want the local container `/health` check too.
- If build fails due to lock mismatch, sync dependencies in `cloud-run/ai-engine` and retry.

## Version

Current: `8.11.113`

## Changelog

### v8.0.0 (2026-02-16)
- **ToolLoopAgent 채택** - AI SDK v6 공식 에이전트 패턴으로 BaseAgent 내부 마이그레이션
- **ConfigBasedAgent 통합** - 라우팅 LLM Agent와 내부 pipeline config의 per-type 서브클래스 제거, 단일 ConfigBasedAgent로 통합
- **AgentFactory 단순화** - switch문 제거, config key 매핑 방식으로 전환

### v7.1.0 (2026-01-27)
- **BaseAgent 추상 클래스 도입** - 통합 실행 인터페이스 (`run()`, `stream()`)
- **AgentFactory 패턴 적용** - 중앙화된 에이전트 생성 및 가용성 관리
- **Vision Agent 추가** - Gemini Flash-Lite 전용 (1M context, multimodal)
- **AI SDK v6.0.50** - `timeout`, `stopWhen` 설정 적용
- **Codex/Gemini 코드 리뷰 반영** - type guard, edge case 처리
- **5개 라우팅 LLM Agent + 2개 내부 pipeline stage** - NLQ, Analyst, Reporter, Advisor, Vision + Evaluator/Optimizer

### v5.88.0 (2026-01-16)
- Summarizer Agent 제거 (NLQ Agent로 통합)
- OpenRouter 프로바이더 제거 (Tri-provider: Cerebras/Groq/Mistral)
- 5-Agent 시스템으로 단순화

### v5.83.14 (2026-01-04)
- Free Tier 한도 정보 정확화 (Cerebras 1M, Groq ~1K, OpenRouter 50)
- Agent Usage by Feature 섹션 추가
- Summarizer Agent 문서화

### v5.84.0 (2025-12-29)
- Vercel AI SDK v6 migration (from LangGraph)
- Langfuse Observability integration (FREE tier)
- Circuit Breaker for provider fault tolerance
- streamText real-time token streaming
- Graceful shutdown with trace flushing
- Docker v4.0 optimization

See [CHANGELOG.md](../../CHANGELOG.md) for full release history.
