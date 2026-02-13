# AI Engine - Cloud Run Service

Vercel AI SDK Multi-Agent Supervisor for OpenManager AI v8.0.0

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

# Run tests
npm run test

# Deploy to Cloud Run
gcloud run deploy ai-engine --source . --region asia-northeast1
```

## Architecture (v8.0.0)

```
src/
├── server.ts                      # Hono HTTP server (+ Graceful Shutdown)
├── routes/                        # API route handlers
├── services/
│   ├── ai-sdk/
│   │   ├── supervisor.ts          # Vercel AI SDK Supervisor
│   │   ├── model-provider.ts      # Multi-provider failover
│   │   └── agents/                # Agent definitions
│   │       ├── base-agent.ts      # Abstract base class (NEW v7.1.0)
│   │       ├── agent-factory.ts   # Factory pattern (NEW v7.1.0)
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

## Agent Implementation Pattern (v8.0.0)

### BaseAgent Abstract Class

모든 에이전트의 기반 클래스로 통합된 실행 인터페이스 제공:

- `run(query, options)`: 동기 실행 - 결과를 기다림
- `stream(query, options)`: 스트리밍 실행 - 실시간 응답
- `isAvailable()`: 에이전트 가용성 확인

**AI SDK v6 통합 기능:**
- `timeout: { totalMs, chunkMs }` - 실행 시간 제한
- `stopWhen: [hasToolCall('finalAnswer'), stepCountIs(N)]` - 종료 조건
- `onStepFinish` - 단계별 모니터링

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

Gemini Flash-Lite 전용 에이전트 (No Fallback - Graceful Degradation):

| Feature | Capability |
|---------|------------|
| **Context Window** | 1M tokens |
| **Multimodal** | Image/PDF/Video/Audio |
| **Google Search** | Grounding 지원 |
| **URL Context** | 웹 페이지 분석 |

**Graceful Degradation**: Gemini 미구성 시 → Analyst Agent로 폴백 (제한된 분석)

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

| Agent | Primary | Fallback | Free Tier |
|-------|---------|----------|-----------|
| Supervisor | Cerebras `llama-3.3-70b` | Groq → Mistral | 1M tokens/day, 60K TPM |
| Orchestrator | Cerebras `llama-3.3-70b` | Groq | 1M tokens/day, 60K TPM |
| NLQ Agent | Cerebras `llama-3.3-70b` | Groq → Mistral | 1M tokens/day, 60K TPM |
| Analyst Agent | Groq `llama-3.3-70b-versatile` | Cerebras → Mistral | ~1K RPD, 12K TPM |
| Reporter Agent | Groq `llama-3.3-70b-versatile` | Cerebras → Mistral | ~1K RPD, 12K TPM |
| Advisor Agent | Mistral `mistral-small-2506` | Groq → Cerebras | Limited (may require paid) |
| **Vision Agent** | **Gemini `2.5-flash-lite`** | **(No Fallback)** | **Free tier available** |
| Evaluator Agent | Cerebras `llama-3.3-70b` | (internal use) | - |
| Optimizer Agent | Mistral `mistral-small-2506` | (internal use) | - |

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
MISTRAL_API_KEY=xxx                # Mistral (Advisor, Verifier)
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
| `/api/ai/embedding` | POST | Text embedding |
| `/api/ai/generate` | POST | Text generation |

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Promptfoo evaluation
npm run prompt:eval
npm run prompt:view

# Security red-team tests
npm run prompt:redteam
```

## Deployment

```bash
# Deploy to Cloud Run
gcloud run deploy ai-engine \
  --source . \
  --region asia-northeast1 \
  --memory 512Mi \
  --cpu 1 \
  --allow-unauthenticated

# Service URL
https://ai-engine-490817238363.asia-northeast1.run.app
```

## Docker

```bash
# Local build
docker build -t ai-engine:local .

# Run locally
docker run -p 8080:8080 --env-file .env ai-engine:local
```

## Version

Current: `8.0.0`

## Changelog

### v7.1.0 (2026-01-27)
- **BaseAgent 추상 클래스 도입** - 통합 실행 인터페이스 (`run()`, `stream()`)
- **AgentFactory 패턴 적용** - 중앙화된 에이전트 생성 및 가용성 관리
- **Vision Agent 추가** - Gemini Flash-Lite 전용 (1M context, multimodal)
- **AI SDK v6.0.50** - `timeout`, `stopWhen` 설정 적용
- **Codex/Gemini 코드 리뷰 반영** - type guard, edge case 처리
- **7-Agent 시스템** - NLQ, Analyst, Reporter, Advisor, Vision, Evaluator, Optimizer

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
