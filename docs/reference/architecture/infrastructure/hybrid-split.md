# Hybrid AI Architecture: Vercel vs. Cloud Run

## Architecture Overview

This project uses a **Hybrid Architecture** to balance cost, performance, and scalability.

### 1. Vercel (Frontend & Orchestrator)
**Role**: The "Brain's Interface" and "Router"
- **Hosting**: Next.js App Router (Serverless Functions)
- **Responsibilities**:
  - **UI/UX**: Renders everything the user sees (React Components).
  - **Authentication**: Verifies user login before generating AI responses.
  - **Input Validation**: Sanitizes user queries.
  - **Routing/Failover**:
    - Checks `CLOUD_RUN_ENABLED`.
    - If **True**: Proxies the request to Cloud Run.
    - If **False** or **Failure**: Falls back to executing AI locally (Serverless).

### 2. Google Cloud Run (AI Engine)
**Role**: The "Heavy Lifter"
- **Hosting**: Docker Container (Node.js 24 + Vercel AI SDK)
- **Responsibilities**:
  - **AI SDK Multi-Agent**: Orchestrates agents (NLQ, Analyst, Reporter, Advisor, Verifier).
  - **Agent Execution**: Runs the prompt engineering and tool calls using `@ai-sdk-tools/agents`.
  - **Heavy Computation**: Handles complex queries and multi-step reasoning.
  - **Streaming**: Streams tokens back to Vercel via UIMessageStream (AI SDK v6 native protocol).

### 3. TypeScript ML (Built into AI Engine)
**Role**: The "Mathematician"
- **Hosting**: Same as AI Engine (Node.js)
- **Responsibilities**:
  - **Anomaly Detection**: 6-hour moving avg + 2σ (`SimpleAnomalyDetector.ts`)
  - **Trend Prediction**: Linear regression (`TrendPredictor.ts`)
- **Note**: Rust ML service was removed in v5.84.0 and replaced by these optimized TypeScript implementations.

---

## Request Flow

1. **User** types "Analyze server status".
2. **Vercel Frontend**:
   - `POST /api/ai/supervisor`
   - Validates request.
   - Checks `CLOUD_RUN_ENABLED=true`.
3. **Vercel Proxy**:
   - Forwards request to `https://ai-engine-jdhr.../api/ai/supervisor`.
   - Adds `X-API-Key` for security.
4. **Cloud Run**:
   - Receives request.
   - **Vercel AI SDK** processes the intent and routes to the appropriate agent.
   - **Analyst Agent** performs pattern analysis if needed.
   - Streams response back to Vercel via UIMessageStream.
5. **Vercel**:
   - Pipes the stream to the User's browser.

---

## Status Comparison

| Feature | Vercel (Frontend) | Cloud Run (Backend) |
|:--- |:--- |:--- |
| **State** | **Active** (Serving UI) | **Active** (Waiting for requests) |
| **Scaling** | Auto-scale (Serverless) | Auto-scale (0 to N instances) |
| **Authentication**| NextAuth (User Session) | API Key (`CLOUD_RUN_API_SECRET`) |
| **Timeout** | 10-60 Seconds (Hard limit) | 60 Minutes (Configurable) |
| **Logic** | Display & Routing | AI Reasoning & Processing |

## Data Architecture

The system follows a **Stateless Cloud Run** design where all persistent data lives in Supabase.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW (v8.0.0)                             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐       ┌─────────────────────────────┐
│     Vercel (SSoT Generator)     │       │     Supabase (Database)     │
│  ┌───────────────────────────┐  │       │  ┌───────────────────────┐  │
│  │  public/hourly-data/      │  │ seed  │  │  unified_server_      │  │
│  │  ├─ hour-00.json          │──┼──────►│  │  metrics (optional)   │  │
│  │  ├─ hour-01.json          │  │       │  ├───────────────────────┤  │
│  │  └─ ... (24 files)        │  │       │  │  ai_conversations     │  │
│  │                           │  │       │  │  (대화 이력)          │  │
│  │  • 15 Servers             │  │       │  ├───────────────────────┤  │
│  │  • 1440 Data Points/day   │  │       │  │  embeddings           │  │
│  └───────────────────────────┘  │       │  │  (GraphRAG Vector)    │  │
└─────────────────────────────────┘       │  └───────────────────────┘  │
                                          └─────────────┬───────────────┘
                                                        │ query
                                                        ▼
                                          ┌─────────────────────────────┐
                                          │  Cloud Run (Stateless AI)   │
                                          │  ┌───────────────────────┐  │
                                          │  │ • NO local data files │  │
                                          │  │ • Queries Supabase    │  │
                                          │  │ • Pure AI computation │  │
                                          │  │ • Scale-to-Zero OK    │  │
                                          │  └───────────────────────┘  │
                                          └─────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW                                      │
└─────────────────────────────────────────────────────────────────────────┘

 ┌────────┐      ┌──────────────────────┐      ┌──────────────────────┐
 │  User  │ ───► │   Vercel Frontend    │ ───► │   Cloud Run AI       │
 │        │      │   (Next.js 16)       │      │   (Node.js 24)       │
 └────────┘      └──────────────────────┘      └──────────────────────┘
     │                    │                             │
     │  1. "서버 분석"    │  2. POST /api/ai/supervisor │
     │  ───────────────►  │  ─────────────────────────► │
     │                    │     + X-API-Key header      │
     │                    │                             │
     │                    │  3. UIMessageStream         │
     │  4. 렌더링 결과    │  ◄───────────────────────── │
     │  ◄───────────────  │                             │
     │                    │                             │
```

### Key Principles
- **Single Source of Truth (SSoT)**: `MetricsProvider` singleton → otel-processed (Primary) + hourly-data (Fallback)
- **Database Layer**: Supabase PostgreSQL (15 servers, 360 metrics per 24h window)
- **Stateless AI**: Cloud Run containers have **no local data files** - all data fetched from Supabase
- **Data Sync**: Vercel seeds Supabase on deployment; Cloud Run reads from Supabase at runtime

### Why Stateless?
1. **Scale-to-Zero**: No data loss when containers spin down
2. **Consistency**: All instances see the same data from Supabase
3. **Cost**: No persistent storage costs in Cloud Run

---

---

## Resumable Stream v2 (AI SDK v6)

네트워크 단절 시 스트림을 자동으로 복구하는 Upstash Redis 기반 Resumable Stream 패턴입니다.

### Flow
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Resumable Stream v2 Flow                              │
└─────────────────────────────────────────────────────────────────────────┘

 ┌────────┐      ┌──────────────────────┐      ┌──────────────────────┐
 │  User  │ ───► │   Vercel Frontend    │ ───► │   Cloud Run AI       │
 │        │      │   (Next.js 16)       │      │   (Node.js 24)       │
 └────────┘      └──────────────────────┘      └──────────────────────┘
     │                    │                             │
     │  1. POST /stream/v2│  2. Proxy + Redis Save      │
     │  ───────────────►  │  ─────────────────────────► │
     │                    │     + X-Stream-Id header    │
     │                    │                             │
     │  [네트워크 단절]   │                             │
     │  ───────────────►  │                             │
     │                    │                             │
     │  3. GET /stream/v2?sessionId=xxx&skip=N         │
     │  ───────────────►  │                             │
     │                    │  4. Redis에서 남은 chunk 조회
     │                    │  ─────────────────────────► │
     │                    │                             │
     │  5. 이어서 수신    │  ◄───────────────────────── │
     │  ◄───────────────  │     (skip 이후 chunk)       │
     │                    │                             │
```

### 주요 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| **POST Handler** | `stream/v2/route.ts` | 새 스트림 생성, Redis 저장 |
| **GET Handler** | `stream/v2/route.ts` | 스트림 재개 (skip 파라미터) |
| **Stream State** | `stream/v2/stream-state.ts` | Redis 세션-스트림 매핑 |
| **Upstash Context** | `stream/v2/upstash-resumable.ts` | Redis List 기반 chunk 저장 |

### 설정

| 항목 | 값 | 설명 |
|------|-----|------|
| **Stream TTL** | 10분 | Redis 자동 만료 |
| **Chunk Storage** | Redis List | RPUSH로 순서 보장 |
| **Resume API** | GET + skip 파라미터 | 마지막 수신 chunk 이후부터 |

---

## Circuit Breaker & Quota Tracker

API 장애 시 자동 차단 및 할당량 초과 방지 메커니즘입니다.

### Circuit Breaker 상태 전이

```
┌───────────────────────────────────────────────────────────┐
│                  Circuit Breaker States                    │
│                                                            │
│  ┌──────────┐    5회 실패     ┌──────────┐                │
│  │  CLOSED  │ ─────────────► │   OPEN   │                │
│  │ (정상)   │                 │ (차단)   │                │
│  └────┬─────┘                 └────┬─────┘                │
│       │                            │                       │
│   2회 성공                      30초 후                    │
│       │                            │                       │
│       │                       ┌────▼─────┐                │
│       └────────────────────── │HALF_OPEN │                │
│                               │ (시험)   │                │
│                               └──────────┘                │
└───────────────────────────────────────────────────────────┘
```

### Quota Tracker

| 항목 | 값 | 동작 |
|------|-----|------|
| **Preemptive Threshold** | 80% | 할당량 80% 도달 시 Fallback |
| **Hard Limit** | 100% | 요청 즉시 거부 |
| **Reset Period** | Daily/Monthly | 프로바이더별 상이 |

### Fallback 체인

```
Cerebras (Primary)
    ↓ 실패 또는 quota 80%
Groq (Secondary)
    ↓ 실패 또는 quota 80%
Mistral (Tertiary)
    ↓ 모두 실패 시
Static Fallback Response
```

---

## Controls (Planned)

- **Start (Wake Up)**: Triggers `/warmup` on Cloud Run to spin up an instance (Cold Start mitigation).
- **Stop**: Not applicable (Serverless scales to 0 automatically when idle).
