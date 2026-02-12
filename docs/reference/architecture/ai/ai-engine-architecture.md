# AI Engine Architecture

> **v7.1.4** | Updated 2026-02-08

## Overview

The AI Engine for OpenManager AI is a **Multi-Agent System** built on **Vercel AI SDK v6** with `@ai-sdk-tools/agents`. It uses a dual-mode Supervisor pattern with specialized agents for different tasks, running on **Google Cloud Run** with frontend on **Vercel**.

### AI SDK v6 Key Features

| Feature | Description |
|---------|-------------|
| **UIMessageStream** | Native streaming protocol (replaces custom SSE) |
| **DefaultChatTransport** | Built-in transport with `resume: true` |
| **finalAnswer Tool** | Agent termination pattern (`hasToolCall` + `stepCountIs`) |
| **Resumable Stream v2** | Automatic stream reconnection via Redis |
| **prepareStep** | Pre-step optimization for agent routing |

## Architecture (v6.1.0, Updated 2026-01-25)

### Deployment Mode

| Mode | Backend | Status |
|------|---------|--------|
| **Cloud Run** | `cloud-run/ai-engine/` (Vercel AI SDK) | ✅ Active (Primary) |
| **Vercel** | `src/app/` (Next.js Frontend) | ✅ Active (Frontend Only) |
| ~~Cloud Run~~ | ~~`cloud-run/rust-inference/`~~ | ❌ Removed |
| ~~Cloud Run~~ | ~~LangGraph/LangChain~~ | ❌ Removed (v5.92.0) |

> **Note**: LangGraph/LangChain migrated to Vercel AI SDK (2025-12-28) due to Cerebras multi-turn tool calling limitations. New architecture uses `@ai-sdk-tools/agents` for multi-agent orchestration.

### Agent Stack

| Agent | Primary Provider | Fallback | Role | Tools |
|-------|------------------|----------|------|-------|
| **Orchestrator** | Cerebras llama-3.3-70b | Mistral mistral-small-2506 | Fast intent routing (~200ms) | Agent handoffs |
| **NLQ Agent** | Cerebras llama-3.3-70b | Groq → Mistral | Server metrics queries (simple + complex) | `getServerMetrics`, `getServerMetricsAdvanced`, `filterServers` |
| **Analyst Agent** | Groq llama-3.3-70b-versatile | Cerebras → Mistral | Anomaly detection, trend prediction | `detectAnomalies`, `predictTrends`, `analyzePattern`, `correlateMetrics`, `findRootCause` |
| **Reporter Agent** | Groq llama-3.3-70b-versatile | Cerebras → Mistral | Incident reports, timeline | `buildIncidentTimeline`, `findRootCause`, `correlateMetrics`, `searchKnowledgeBase` |
| **Advisor Agent** | Mistral mistral-small-2506 | Groq → Cerebras | Troubleshooting, knowledge search | `searchKnowledgeBase` (GraphRAG), `recommendCommands` |
| **Vision Agent** | Gemini 2.5-flash-lite | **(No Fallback)** | Screenshot/log analysis, Google Search Grounding | `analyzeScreenshot`, `analyzeLargeLog`, `searchWithGrounding` |
| **Evaluator Agent** | Cerebras llama-3.3-70b | - | Report quality evaluation (internal) | `evaluateIncidentReport`, `validateReportStructure` |
| **Optimizer Agent** | Mistral mistral-small-2506 | - | Report quality improvement (internal) | `refineRootCauseAnalysis`, `enhanceSuggestedActions` |
| **Verifier** | Mistral mistral-small-2506 | Cerebras llama-3.3-70b | Response validation | N/A |

> **Note**: 외부 라우팅 대상 Agent는 5개 (NLQ, Analyst, Reporter, Advisor, Vision)입니다. Evaluator/Optimizer는 Reporter Pipeline 내부에서만 사용되며, Verifier는 별도의 검증 컴포넌트입니다.

> **Dual-Mode Strategy**: Single-agent mode for simple queries (low latency), Multi-agent mode for complex queries (specialized handling). Cerebras for fast routing/NLQ, Groq for analysis/reporting stability.

### Frontend Features → Agent Mapping

| Feature | Vercel API Route | Cloud Run Endpoint | Primary Agent | Handoff Agents |
|---------|------------------|-------------------|---------------|----------------|
| **AI Chat (NLQ)** | `/api/ai/supervisor` | `/api/ai/supervisor` | Orchestrator | NLQ, Analyst, Reporter, Advisor |
| **Auto Incident Report** | `/api/ai/incident-report` | `/api/ai/incident-report` | Reporter | - (Direct call) |
| **Intelligent Monitoring** | `/api/ai/intelligent-monitoring` | `/api/ai/analyze-server` | Analyst | - (Direct call) |

> **Note**: Advisor는 Chat을 통한 Orchestrator handoff로만 사용됩니다 (전용 UI 없음).

### Free Tier Limits (2025-01 기준)

| Provider | Daily Limit | TPM | RPM | Usage |
|----------|-------------|-----|-----|-------|
| **Cerebras** | 1M tokens/day | 60K | 30 | Orchestrator, NLQ Agent |
| **Groq** | ~1K requests/day | 12K | Variable | Analyst, Reporter Agent |
| **Mistral** | Limited (may require paid) | - | - | Advisor, Verifier |

> **주의**: OpenRouter 무료 모델은 일일 50회 제한으로 저사용량 시나리오에만 적합합니다.

### Key Features

- **Dual-Mode Supervisor**: Single-agent (simple) vs Multi-agent (complex) mode auto-selection
- **Agent Handoffs**: Pattern-based routing with `matchOn` keywords and regex
- **Multi-Step Tool Calling**: Vercel AI SDK `maxSteps` for reliable tool execution
- **Fallback Chains**: Per-agent provider fallbacks (Cerebras → Groq, Groq → Cerebras)
- **User-Triggered Design**: All AI features are explicitly user-initiated (no auto-triggers)
- **Circuit Breaker**: Model health monitoring with automatic failover
- **GraphRAG Integration**: Advisor agent uses hybrid vector + graph search
- **Protocol Adaptation**: UIMessageStream native protocol (v6)
- **Response Verification**: Verifier agent validates outputs before response

#### New in v7.1.0 (2026-01-27)

- **BaseAgent Abstract Class**: 모든 에이전트의 공통 실행 로직 캡슐화
- **AgentFactory Pattern**: 중앙화된 에이전트 생성 및 가용성 관리
- **Vision Agent**: Gemini Flash-Lite 전용 (1M context, multimodal, Google Search Grounding)
- **AI SDK v6.0.50**: `timeout: { totalMs, chunkMs }` 설정 지원
- **3-Way Fallback**: 각 에이전트별 3중 프로바이더 폴백 체인
- **Graceful Degradation**: Vision Agent 미가용 시 Analyst Agent로 자동 폴백

#### New in v6.1.0 (2026-01-25)

- **AI SDK v6 Native Protocol**: UIMessageStream for streaming
- **Resumable Stream v2**: `resumable-stream` package with Redis state
- **finalAnswer Pattern**: `hasToolCall('finalAnswer')` + `stepCountIs(N)` for clean termination
- **prepareStep Optimization**: Agent routing order (RCA → Reporter → Analyst)
- **DefaultChatTransport**: Built-in transport with `resume: true` for auto-reconnect
- **v1 Removal**: Legacy stream endpoint removed (508 lines deleted)

#### New in v5.87.0 (2026-01-13)

- **LangGraph → Vercel AI SDK Migration**: Complete rewrite using `@ai-sdk-tools/agents`
- **Dual-Mode Supervisor**: Auto-selects single vs multi-agent based on query complexity
- **Agent Specialization**:
  - NLQ Agent (Cerebras → Groq fallback): Simple + complex server queries
  - Analyst Agent (Groq → Cerebras fallback): Anomaly detection, trend prediction
  - Reporter Agent (Groq → Cerebras fallback): Incident reports, timeline
  - Advisor Agent (Mistral): Troubleshooting with GraphRAG
- **Fallback Optimization**: Cerebras for fast routing, Groq for analysis stability

#### Previous Versions

<details>
<summary>v5.91.0 and earlier (LangGraph era)</summary>

**v5.91.0** (LangGraph)
- RCA Agent, Capacity Agent, Agent Dependencies
- Workflow Caching, Web Search Migration to Tavily

**v5.90.0**
- Triple-Provider Strategy, Rate Limit Distribution

**v5.89.0**
- Dual-Provider Architecture, Advanced NLQ Tool

**v5.88.0**
- Gemini API Key Failover, LangChain maxRetries Fix

**v5.87.0**
- GraphRAG Hybrid Search, Redis L2 Caching

</details>

### Agent Lifecycle (v7.1.0)

#### BaseAgent & AgentFactory Pattern

모든 에이전트는 `BaseAgent` 추상 클래스를 상속받아 통합된 실행 인터페이스를 제공합니다.

```typescript
// BaseAgent 인터페이스
abstract class BaseAgent {
  abstract getName(): string;
  abstract getConfig(): AgentConfig | null;

  // 동기 실행
  async run(query: string, options?: AgentRunOptions): Promise<AgentResult>;

  // 스트리밍 실행
  async *stream(query: string, options?: AgentRunOptions): AsyncGenerator<AgentStreamEvent>;

  // 가용성 확인
  isAvailable(): boolean;
}

// AgentRunOptions
interface AgentRunOptions {
  timeoutMs?: number;      // 최대 실행 시간 (default: 45000)
  maxSteps?: number;       // 최대 LLM 호출 횟수 (default: 5)
  temperature?: number;    // 응답 다양성 (default: 0.4)
  webSearchEnabled?: boolean;  // 웹 검색 허용 (default: true)
}
```

#### AgentFactory 사용법

```typescript
import { AgentFactory, runAgent, streamAgent } from './agent-factory';

// 에이전트 생성
const nlq = AgentFactory.create('nlq');
const vision = AgentFactory.create('vision');

// 가용성 확인
const available = AgentFactory.isAvailable('vision');
const status = AgentFactory.getAvailabilityStatus();

// 편의 함수
const result = await runAgent('nlq', '서버 상태 알려줘');
for await (const event of streamAgent('analyst', '이상 탐지')) {
  console.log(event);
}
```

#### 실행 흐름

```
1. Orchestrator가 쿼리 분석
2. preFilterQuery()로 패턴 매칭
3. AgentFactory.create()로 적절한 에이전트 생성
4. BaseAgent.run() 또는 stream()으로 실행
5. stopWhen 조건 충족 시 종료:
   - hasToolCall('finalAnswer')
   - stepCountIs(maxSteps)
6. 결과 반환 (toolsCalled, usage, metadata)
```

### Resilience & Performance

#### 3-Way Provider Fallback

모든 에이전트는 3중 Fallback 체계를 갖추고 있어 특정 제공자(API) 장애 시 자동으로 다음 순위 모델로 전환됩니다.

```
Primary (Cerebras) ──[fail]──► Secondary (Groq) ──[fail]──► Tertiary (Mistral)
       │                              │                            │
       └──────────────────────────────┴────────────────────────────┘
                              ↓ Success
                         Response to User
```

| Agent | Primary | Secondary | Tertiary |
|-------|---------|-----------|----------|
| Orchestrator | Cerebras | Mistral | - |
| NLQ Agent | Cerebras | Groq | Mistral |
| Analyst Agent | Groq | Cerebras | Mistral |
| Reporter Agent | Groq | Cerebras | Mistral |
| Advisor Agent | Mistral | Groq | - |

#### Circuit Breaker & Retry

| 메커니즘 | 동작 |
|---------|------|
| **Circuit Breaker** | API 실패 반복 시 해당 제공자를 일시 차단하여 불필요한 대기 시간 감소 |
| **Exponential Backoff** | Rate Limit(429) 발생 시 지수적으로 재시도 간격 증가 (1s → 2s → 4s) |
| **Health Check** | 주기적으로 차단된 제공자의 복구 상태 확인 후 자동 복원 |

#### Fast Path & Forced Routing

LLM 호출 없이 RegExp 기반 Pre-filter가 처리하여 속도와 비용을 최적화합니다.

| 패턴 | 처리 방식 | 예시 |
|------|----------|------|
| **Fast Path** | 단순 인사말은 LLM 없이 즉시 응답 | "안녕", "고마워" |
| **Forced Routing** | 키워드 매칭으로 특정 에이전트 직접 호출 | "보고서 만들어줘" → Reporter |
| **LLM Routing** | 복잡한 의도는 Orchestrator가 LLM으로 판단 | "왜 서버가 느려졌어?" |

```typescript
// Pre-filter 우선순위
1. Fast Path Check (RegExp)     // ~1ms
2. Forced Routing (Keywords)    // ~1ms
3. LLM Intent Classification    // ~200ms (Cerebras)
```

#### Reporter Pipeline (Evaluator-Optimizer)

Reporter Agent는 고품질 보고서를 위해 3단계 파이프라인을 실행합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                  Reporter Pipeline                          │
│  ┌──────────┐   ┌───────────┐   ┌───────────┐              │
│  │ Generate │ → │ Evaluate  │ → │ Optimize  │ → Re-evaluate│
│  │ (Draft)  │   │ (0.75점)  │   │ (Improve) │              │
│  └──────────┘   └───────────┘   └───────────┘              │
│                      │                                      │
│                  quality ≥ 0.75? ─────→ Return              │
│                      │                                      │
│                  No: Iterate (max 2회)                      │
└─────────────────────────────────────────────────────────────┘
```

| 설정 | 값 | 설명 |
|------|-----|------|
| **qualityThreshold** | 0.75 | 최소 품질 점수 |
| **maxIterations** | 2 | 최대 개선 반복 |
| **timeout** | 40초 | 파이프라인 타임아웃 |

#### Task Decomposition

복잡한 쿼리는 Orchestrator가 **Task Decomposition** 패턴으로 분할 처리합니다.

```typescript
// Orchestrator-Worker 패턴
1. Query 분석 → Task 분할
2. 병렬/순차 실행 결정
3. Worker Agent별 Task 할당
4. 결과 병합 (Aggregation)
```

| 실행 모드 | 조건 | 예시 |
|----------|------|------|
| **Parallel** | 독립적 작업 | "모든 서버 CPU와 메모리 현황" |
| **Sequential** | 의존적 작업 | "장애 원인 분석 후 해결책 제시" |
| **Hybrid** | 혼합 | 병렬 수집 → 순차 분석 |

#### Vision Agent (Gemini Flash-Lite)

Vision Agent는 Gemini Flash-Lite 전용으로, 다른 프로바이더로 폴백하지 않습니다 (Graceful Degradation).

| Feature | Capability |
|---------|------------|
| **Context Window** | 1M tokens |
| **Multimodal** | Image/PDF/Video/Audio |
| **Google Search** | Grounding 지원 |
| **URL Context** | 웹 페이지 분석 |

**사용 사례:**
- 대시보드 스크린샷 분석 (Grafana, CloudWatch, Datadog)
- 대용량 로그 파일 분석
- 최신 공식 문서 검색 (Google Search Grounding)
- URL 콘텐츠 분석

**Graceful Degradation:**
```typescript
import { getVisionAgentOrFallback, isVisionQuery } from './vision-agent';

// Vision 쿼리 감지
if (isVisionQuery(query)) {
  const { agent, isFallback, fallbackReason } = getVisionAgentOrFallback(query);

  if (isFallback) {
    // Gemini 미구성 → Analyst Agent로 폴백
    console.warn(fallbackReason);
  }

  if (agent) {
    const result = await agent.run(query);
  }
}
```

#### Observability (Langfuse)

모든 에이전트의 실행 과정이 Langfuse로 추적되어 실시간 모니터링 및 디버깅이 가능합니다.

| 추적 항목 | 설명 |
|----------|------|
| **Input/Output** | 각 에이전트의 입력 메시지 및 응답 |
| **Tool Calls** | 호출된 도구 목록 및 결과 |
| **Latency** | 에이전트별 처리 시간 |
| **Token Usage** | Prompt/Completion 토큰 수 |
| **Handoff Chain** | 에이전트 간 위임 경로 |

### Agent Communication Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Return-to-Supervisor** | Agent sets `returnToSupervisor=true` | Need different agent's expertise |
| **Command Pattern** | Explicit `toAgent` in DelegationRequest | Direct delegation to specific agent |
| **Verification Loop** | Verifier checks output before response | Quality assurance & hallucination check |

### Tool Registry (22개 도구)

에이전트가 사용할 수 있는 22개 도구가 6개 카테고리로 구성되어 있습니다.

| Category | Tool | Agent | Description |
|----------|------|-------|-------------|
| **Metrics (5)** | `getServerMetrics` | NLQ | 서버 메트릭 조회 |
| | `getServerMetricsAdvanced` | NLQ | 고급 메트릭 분석 |
| | `filterServers` | NLQ | 서버 필터링 |
| | `getServerList` | NLQ | 서버 목록 |
| | `getServerSummary` | NLQ | 서버 요약 |
| **RCA (3)** | `findRootCause` | Analyst, Reporter | 근본 원인 분석 |
| | `correlateMetrics` | Analyst, Reporter | 메트릭 상관관계 |
| | `buildIncidentTimeline` | Reporter | 인시던트 타임라인 |
| **Analyst (3)** | `detectAnomalies` | Analyst | 이상 탐지 |
| | `predictTrends` | Analyst | 트렌드 예측 |
| | `analyzePattern` | Analyst | 패턴 분석 |
| **Reporter (4)** | `searchWebWithTavily` | Reporter | 웹 검색 (Tavily) |
| | `extractWebContent` | Reporter | URL 콘텐츠 추출 |
| | `generateReport` | Reporter | 보고서 생성 |
| | `formatIncidentReport` | Reporter | 인시던트 형식화 |
| **Evaluation (6)** | `evaluateReport` | Reporter Pipeline | 보고서 평가 |
| | `optimizeReport` | Reporter Pipeline | 보고서 최적화 |
| | `checkCompleteness` | Verifier | 완전성 검증 |
| | `checkAccuracy` | Verifier | 정확도 검증 |
| | `checkClarity` | Verifier | 명확성 검증 |
| | `checkActionability` | Verifier | 실행가능성 검증 |
| **Control (1)** | `finalAnswer` | All | 에이전트 종료 신호 |

> **Note**: `finalAnswer`는 AI SDK v6 베스트 프랙티스에 따른 에이전트 종료 도구입니다. `stopWhen: [hasToolCall('finalAnswer')]` 패턴과 함께 사용됩니다.

## Architecture Diagram

> 📊 **Mermaid Live Editor**: [Edit Online](https://mermaid.live)

```mermaid
graph TD
    subgraph Client["🖥️ Client"]
        User["💬 User Query"]
    end

    subgraph Vercel["▲ Vercel (Frontend)"]
        API["Next.js API Route<br/>/api/ai/supervisor"]
    end

    subgraph CloudRun["☁️ Google Cloud Run"]
        ModeSelect{"🔀 Mode Selection"}
        
        subgraph SingleMode["⚡ Single-Agent Mode"]
            SingleAgent["Direct Tool Calling<br/>Cerebras/Mistral"]
        end
        
        subgraph MultiMode["🧠 Multi-Agent Mode"]
            Orchestrator["🎯 Orchestrator<br/>Cerebras llama-3.3-70b"]
            NLQ["🔍 NLQ Agent<br/>Server Metrics"]
            Analyst["📊 Analyst Agent<br/>Anomaly/Trend"]
            Reporter["📑 Reporter Agent<br/>Incident Report"]
            Advisor["💡 Advisor Agent<br/>GraphRAG"]
            Verifier["✅ Verifier<br/>Response Validation"]
        end
    end

    subgraph DataLayer["💾 Data Layer"]
        Metrics["📈 Server Metrics<br/>hourly-data/*.json"]
        RAG["🔗 GraphRAG<br/>pgVector + Supabase"]
        Cache["⚡ Redis Cache<br/>Upstash"]
    end

    User -->|POST| API
    API -->|Proxy| ModeSelect
    ModeSelect -->|Simple Query| SingleAgent
    ModeSelect -->|Complex Query| Orchestrator
    
    Orchestrator -->|Handoff| NLQ
    Orchestrator -->|Handoff| Analyst
    Orchestrator -->|Handoff| Reporter
    Orchestrator -->|Handoff| Advisor
    
    NLQ --> Metrics
    Analyst --> Metrics
    Reporter --> RAG
    Advisor --> RAG
    
    NLQ --> Verifier
    Analyst --> Verifier
    Reporter --> Verifier
    Advisor --> Verifier
    
    SingleAgent --> Cache
    Verifier --> Cache
    
    SingleAgent -->|UIMessageStream| User
    Verifier -->|UIMessageStream| User
```

<details>
<summary>📋 ASCII Fallback (Mermaid 렌더링 실패 시)</summary>

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client                                         │
│                     ┌──────────────┐                                    │
│                     │  User Query  │                                    │
│                     └──────┬───────┘                                    │
└────────────────────────────┼────────────────────────────────────────────┘
                             │ POST /api/ai/supervisor
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend + Proxy)                            │
│                  ┌──────────────────────┐                               │
│                  │   Next.js API Route  │                               │
│                  └──────────┬───────────┘                               │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │ Proxy to Cloud Run
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Google Cloud Run (AI Engine)                         │
│                                                                          │
│                    ┌────────────────────┐                               │
│                    │   Mode Selection   │                               │
│                    └─────────┬──────────┘                               │
│                              │                                           │
│            ┌─────────────────┴─────────────────┐                        │
│            │ Simple                     Complex │                        │
│            ▼                                   ▼                         │
│  ┌──────────────────┐            ┌──────────────────────┐               │
│  │  Single-Agent    │            │     Orchestrator     │               │
│  │  (Low Latency)   │            │   Cerebras 70b       │               │
│  └────────┬─────────┘            └──────────┬───────────┘               │
│           │                                  │                           │
│           │                    ┌─────────────┼─────────────┐            │
│           │                    ▼             ▼             ▼            │
│           │              ┌─────────┐   ┌─────────┐   ┌─────────┐       │
│           │              │   NLQ   │   │ Analyst │   │Reporter │       │
│           │              └────┬────┘   └────┬────┘   └────┬────┘       │
│           │                   │             │             │             │
│           │                   │       ┌─────────┐         │             │
│           │                   │       │ Advisor │         │             │
│           │                   │       │ +RAG    │         │             │
│           │                   │       └────┬────┘         │             │
│           │                   │             │             │             │
│           │                   └─────────────┼─────────────┘             │
│           │                                 ▼                            │
│           │                    ┌────────────────────┐                   │
│           │                    │     Verifier       │                   │
│           │                    │ Response Validation│                   │
│           │                    └─────────┬──────────┘                   │
│           │                              │                               │
│           └──────────────────────────────┤                               │
│                                          ▼                               │
│                              ┌────────────────────┐                     │
│                              │  UIMessageStream   │                     │
│                              └────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  hourly-data  │    │   Supabase    │    │    Upstash    │
│  (Metrics)    │    │   (GraphRAG)  │    │    (Cache)    │
└───────────────┘    └───────────────┘    └───────────────┘
```
</details>

### Interactive Diagrams (FigJam)

| Diagram | Description | Link |
|---------|-------------|------|
| **System Architecture** | Full AI engine overview | [View](https://www.figma.com/online-whiteboard/create-diagram/9a4b29bd-0376-4e0a-8e22-3b9bd008854a) |
| **Agent Routing Flow** | Supervisor → Agent routing | [View](https://www.figma.com/online-whiteboard/create-diagram/22dbc5b3-44c1-44e7-9eee-1fa0cf8e402a) |
| **Multi-Agent Communication** | Inter-agent delegation | [View](https://www.figma.com/online-whiteboard/create-diagram/a32f26ab-5d3c-40f6-a8ed-4eb5ec0ed843) |
| **Supervisor Execution Flow** | Query → Supervisor → Agents → Verifier flow | [View](https://www.figma.com/online-whiteboard/create-diagram/eb37f54b-2795-4320-bd2e-c41854a7ec52) |

---

## Related Documentation

- **[AI Engine Internals](./ai-engine-internals.md)** - API 명세, 데이터 계층, 환경변수, 파일 구조
- **[Monitoring & ML Engine](./monitoring-ml.md)** - 이상탐지, 트렌드 예측, 적응형 임계값 시스템
- **[RAG & Knowledge Engine](./rag-knowledge-engine.md)** - 검색 및 지식 그래프 아키텍처
- **[Data Architecture](../data/data-architecture.md)** - 서버 데이터 아키텍처
