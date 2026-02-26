# AI Engine Architecture

> OpenManager AI Engine의 멀티 에이전트 아키텍처 기준 문서
> Owner: platform-architecture
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-26
> Canonical: docs/reference/architecture/ai/ai-engine-architecture.md
> Tags: ai,architecture,multi-agent,cloud-run
>
> **v8.4.0** | Updated 2026-02-26
> (ai-model-policy.md 내용 통합됨, 2026-02-14)

## 1. Overview

OpenManager AI의 AI Engine은 **Vercel AI SDK v6** 기반 **Multi-Agent System**입니다.
Dual-Mode Supervisor 패턴으로 특화된 에이전트를 오케스트레이션하며, **Google Cloud Run**에서 실행되고 프론트엔드는 **Vercel**에 배포됩니다.

| 구분 | 내용 |
|------|------|
| **NLP 엔진** | 자체 구현 없음 (외부 LLM API 사용) |
| **기반 모델** | Cerebras gpt-oss-120b, Groq llama-3.3-70b, Mistral Large, Gemini 2.5 Flash |
| **호스팅** | Cerebras, Groq, Mistral, Google AI (Gemini), OpenRouter 인프라 |
| **비용** | 프로덕션 서비스는 무료 tier 한도 내 운영 |

> **[비용 분리 원칙]**: `Free Tier` 원칙은 **프로덕션 인프라/API 비용**에만 적용됩니다.
> 개발 환경 (Claude Code 등 AI 코딩 에이전트)에서는 품질 확보를 위해 유료 토큰을 사용합니다.

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  유저 브라우저                                                │
│  └─ React 19 + Next.js 16.1 (Vercel)                       │
│     └─ useAIChatCore → useHybridAIQuery                     │
│        ├─ 단순 쿼리 (≤20점): SSE 스트리밍                     │
│        └─ 복잡 쿼리 (>45점): 비동기 Job Queue                 │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /api/ai/supervisor
                     │ X-API-Key + W3C Trace Context
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloud Run AI Engine (Hono, 1 vCPU / 512Mi)                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Supervisor (진입점) — "단순 vs 복잡?" [15개 regex]       │ │
│  │  ├─ Single-Agent → streamText() + 26개 도구            │ │
│  │  └─ Multi-Agent  → Orchestrator에 위임                 │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Orchestrator (멀티에이전트 조율)                         │ │
│  │  ├─ Pre-Filter (regex, ≥80% 신뢰도면 LLM 스킵)         │ │
│  │  ├─ Task Decomposition (LLM #1)                        │ │
│  │  ├─ Agent Routing (LLM #2)                             │ │
│  │  └─ Agent Execution (LLM #3+)                          │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ 7 Agents × 26 Tools × 5 Providers                      │ │
│  └────────────────────────────────────────────────────────┘ │
│           │              │              │                     │
│     ┌─────┴─────┐  ┌────┴────┐  ┌─────┴──────┐             │
│     │ OTel Data │  │ GraphRAG│  │   Redis    │             │
│     │ (144 슬롯) │  │ pgVector│  │  (Upstash) │             │
│     └───────────┘  └─────────┘  └────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Supervisor vs Orchestrator (분리 이유)

| | Supervisor | Orchestrator |
|---|---|---|
| **레벨** | High-level (진입점) | Low-level (멀티에이전트) |
| **결정** | "단순 vs 복잡 쿼리?" | "어떤 에이전트가 처리?" |
| **방법** | 15개 regex 패턴 (LLM 호출 없음) | LLM 2-3회 호출 (분해 + 라우팅) |
| **실행** | `streamText()` 실시간 스트리밍 | `generateObject()` 배치 처리 |
| **타임아웃** | 30초 | 5초 (라우팅만) |
| **호출 시점** | 모든 쿼리 | multi-agent 모드에서만 |

**분리 유지 근거**: 스트리밍 모델이 다르고, LLM 호출 그래프 분리, 각자 독립 테스트 가능.

## 3. LLM Provider 배분 (3-Way Fallback)

각 provider가 최소 1개 에이전트의 Primary를 담당하여 부하 분산 + 상시 health check 효과를 확보합니다.

| Provider | Primary 에이전트 | 모델 | Free Tier |
|----------|----------------|------|-----------|
| **Cerebras** | Supervisor, NLQ, Verifier | `gpt-oss-120b` (120B MoE, 5.1B active) | 1M TPD, 3000 tok/s |
| **Groq** | Analyst, Reporter, Orchestrator | `llama-3.3-70b-versatile` (70B) | 100K TPD, 12K TPM |
| **Mistral** | Advisor + RAG Embedding | `mistral-large-latest` / `mistral-embed` (1024d) | Tier 0: 1 RPS, 40K~500K TPM |
| **Gemini** | Vision | `gemini-2.5-flash` (1M context) | 1000 RPD, 250K TPM |
| **OpenRouter** | Vision Fallback | `nvidia/nemotron-nano-12b-v2-vl:free` | Provider별 상이 |

### Fallback 체인

모든 에이전트는 3-way fallback으로, 2개 provider 동시 장애 시에도 서비스 가능합니다.

| Agent | Primary | → 2nd | → 3rd (Last Resort) |
|-------|---------|-------|---------------------|
| Supervisor | Cerebras | Groq | Mistral |
| NLQ | Cerebras | Groq | Mistral |
| Verifier | Cerebras | Groq | Mistral |
| Orchestrator | Groq | Cerebras | Mistral |
| Analyst | Groq | Cerebras | Mistral |
| Reporter | Groq | Cerebras | Mistral |
| **Advisor** | **Mistral** | **Cerebras** | **Groq** |
| Vision | Gemini | OpenRouter | — |
| RAG Embedding | Mistral (`mistral-embed`) | local fallback (SHA256) | — |

> **Mistral Free Tier (Tier 0) 분석 결과 및 정책 변경 반영**:
> 미스트랄 La Plateforme 홈페이지의 공식 데이터에 따르면, 과거 "2 RPM"으로 알려졌던 한도는 **초당 1회(1 RPS) 및 40,000~500,000 TPM**으로 보다 명시적이고 엄격한 정책(Tier 0)으로 변경되었습니다.
> (오픈 모델은 500K TPM, 상업용 `mistral-large` 프리미엄 모델은 더 낮은 TPM. 10억 토큰/월 한도 적용 중)
> 이에 맞춰 현재 시스템에 완벽히 구현된 **3-Way Fallback**(서킷 브레이커 + 사전 Quota 전환) 설계가 모델 한계 극복에 더욱 주요하게 작용합니다.
> 상세 테스트 스크립트 참조: `cloud-run/ai-engine/scripts/test-mistral-rpm*.ts`

## 4. Agent 구성 (7개)

### 공개 에이전트 (5개)

| 에이전트 | 역할 | 주요 도구 | 트리거 키워드 |
|---------|------|----------|-------------|
| **NLQ** | 서버 메트릭 조회/요약 | getServerMetrics, filterServers, searchWeb | 서버, CPU, 메모리, 요약 |
| **Analyst** | 이상 탐지, 예측, RCA | detectAnomalies, predictTrends, findRootCause | 이상, 예측, 원인 |
| **Reporter** | 장애 보고서 생성 | buildIncidentTimeline, correlateMetrics, searchWeb | 보고서, 장애, 인시던트 |
| **Advisor** | 해결방안, CLI 추천 | searchKnowledgeBase, recommendCommands, searchWeb | 해결, 방법, 명령어 |
| **Vision** | 스크린샷/로그 분석, Search Grounding | analyzeScreenshot, analyzeLargeLog, searchWithGrounding | 스크린샷, 로그, 최신, 문서 |

### 내부 Pipeline 에이전트 (2개)

| 에이전트 | 역할 | 도구 |
|---------|------|------|
| **Evaluator** | 보고서 품질 평가 | evaluateIncidentReport, validateReportStructure |
| **Optimizer** | 보고서 개선 | refineRootCauseAnalysis, enhanceSuggestedActions |

### Agent Factory

모든 에이전트는 `ConfigBasedAgent` 단일 클래스로 구현되며, `AgentFactory`가 생성을 관리합니다.

```typescript
const nlq = AgentFactory.create('nlq');
const result = await runAgent('nlq', '서버 상태 알려줘');
for await (const event of streamAgent('analyst', '이상 탐지')) { ... }
```

## 5. 요청 처리 흐름

### Single-Agent (단순 쿼리)

```
유저: "서버 CPU가 왜 높아?"
  │
  ├─ ① 입력 검증 (Zod) → 보안 (API Key) → Rate Limit
  ├─ ② Supervisor: selectExecutionMode() [regex] → 'single'
  ├─ ③ getSupervisorModel() → Cerebras (CB 확인)
  ├─ ④ streamText() + prepareStep (intent='rca')
  │    ├─ Step 1: findRootCause() → 결과
  │    ├─ Step 2: correlateMetrics() → 상관 분석
  │    └─ Step 3: finalAnswer() → 루프 종료
  ├─ ⑤ SSE 스트리밍 → 유저 실시간 응답
  └─ ⑥ Langfuse 트레이싱 (비동기)
```

### Multi-Agent (복잡 쿼리)

```
유저: "장애 분석 보고서 작성해줘"
  │
  ├─ ① Supervisor: selectExecutionMode() → 'multi' (보고서 패턴)
  ├─ ② Orchestrator: preFilterQuery() → 신뢰도 90%
  ├─ ③ Reporter Pipeline 실행
  │    ├─ Reporter Agent: 초안 생성 (Groq)
  │    ├─ Evaluator Agent: 품질 평가 (4차원 점수)
  │    ├─ 품질 < 75%? → Optimizer Agent 개선 (최대 2회)
  │    └─ 최종 보고서 반환
  └─ ④ SSE 스트리밍 → 유저
```

### Intent Classification (경량 regex 기반)

| 카테고리 | 패턴 예시 | 라우팅 |
|----------|----------|--------|
| 보고서 | `보고서`, `리포트`, `인시던트` | Multi → Reporter |
| 원인 분석 | `왜.*높아`, `원인.*뭐`, `rca` | Multi → Analyst |
| 문제 해결 | `어떻게.*해결`, `조치.*방법` | Multi → Advisor |
| 예측/추세 | `예측`, `트렌드`, `앞으로` | Multi → Analyst |
| 요약 | `서버.*요약`, `핵심.*알려` | Multi → NLQ |
| **기타** | 단순 조회 | **Single-Agent** |

## 6. Tool Registry (26개)

| Category | 도구 | 에이전트 | 설명 |
|----------|------|---------|------|
| **Metrics (6)** | getServerMetrics | NLQ | 서버 메트릭 조회 |
| | getServerMetricsAdvanced | NLQ | 시간 범위 집계 |
| | filterServers | NLQ | 조건부 필터링 |
| | getServerByGroup/Advanced | NLQ | 그룹별 조회 |
| | getServerLogs | NLQ/Reporter | 시스템/에러/앱 로그 |
| **RCA (3)** | findRootCause | Analyst, Reporter | 근본 원인 분석 |
| | correlateMetrics | Analyst, Reporter | 메트릭 상관 분석 |
| | buildIncidentTimeline | Reporter | 인시던트 타임라인 |
| **Analyst (4)** | detectAnomalies[AllServers] | Analyst | 2sigma 이상 탐지 |
| | predictTrends | Analyst | 선형 회귀 예측 |
| | analyzePattern | Analyst | 시계열 패턴 분석 |
| **Knowledge (3)** | searchKnowledgeBase | Reporter/Advisor | GraphRAG 벡터+그래프 검색 |
| | recommendCommands | Reporter/Advisor | CLI 추천 |
| | searchWeb | NLQ/Reporter/Advisor | 외부 실시간 웹 검색 |
| **Evaluation (6)** | evaluateIncidentReport | Pipeline | 보고서 품질 평가 |
| | validateReportStructure | Pipeline | 구조 검증 |
| | scoreRootCauseConfidence | Pipeline | RCA 신뢰도 |
| | refine/enhance/extend | Pipeline | 개선 도구 3종 |
| **Vision (4)** | analyzeScreenshot | Vision | 대시보드 스크린샷 분석 |
| | analyzeLargeLog | Vision | 1M context 로그 파싱 |
| | searchWithGrounding | Vision | Google Search Grounding |
| | analyzeUrlContent | Vision | URL 문서 추출 |
| **Control (1)** | finalAnswer | All | 에이전트 종료 신호 |

### 검색 제어 정책

- **웹 검색 제어 (`enableWebSearch`)**
  - 기본 정책: 요청 단에서 `enableWebSearch` 값이 `true`일 때만 Web Search를 사용.
  - `false`일 때는 `searchWeb` 도구를 라우팅 단계에서 제거하여 NLQ/Reporter/Advisor가 웹 검색을 호출하지 않음.
  - Vercel API 라우터(`src/app/api/ai/supervisor/route.ts`)에서 수신한 `enableWebSearch` 값을 Cloud Run 프록시 바디에 함께 전달.
- **RAG 제어 (`enableRAG`)**
  - `false`일 때는 `searchKnowledgeBase` 도구를 제외하여 지식기반 조회가 발생하지 않음.
  - 해당 제어값 역시 Cloud Run 요청 체인으로 일관 전달.

## 7. Resilience 계층

```
┌──────────────────────────────────────────┐
│ Circuit Breaker (provider별)              │
│  5회 실패 → OPEN (30초) → HALF_OPEN     │
├──────────────────────────────────────────┤
│ Quota Tracker (Redis 기반)                │
│  80% 도달 → 사전 전환 (Pre-emptive)      │
├──────────────────────────────────────────┤
│ Retry with Fallback (3-way)              │
│  429/502/503/504 → 다음 provider         │
│  408/500 → 동일 provider 재시도 (2회)     │
├──────────────────────────────────────────┤
│ Timeout 계층                              │
│  Supervisor 30s → Agent 45s → Tool 25s   │
└──────────────────────────────────────────┘
```

### Reporter Pipeline (Evaluator-Optimizer)

```
Generate (Draft) → Evaluate (Score) → Optimize (Improve) → Re-evaluate
                       │
                   quality >= 0.75? → Return
                       │
                   No: Iterate (max 2회)
```

## 8. Data Pipeline

### Pre-computed State (144 슬롯)

```
public/data/otel-data/hourly/*.json (24개 파일)
  │  15서버 × 24시간 × 10분 간격 = 144 슬롯
  ▼
precomputed-state.ts → buildPrecomputedStates()
  │  getCurrentState() → 현재 시간 슬롯 반환
  ▼
도구에서 사용 (getServerMetrics, detectAnomalies 등)
```

### RAG Pipeline

```
쿼리 → HyDE 확장 (Cerebras) → Mistral Embedding (1024d)
     → Supabase pgvector 검색 → LLM Reranker (Cerebras)
     → 상위 문서 반환
```

## 9. API Endpoints (9개)

| 엔드포인트 | 메서드 | 역할 |
|-----------|--------|------|
| `/api/ai/supervisor` | POST | 메인 AI 채팅 (SSE 스트리밍) |
| `/api/ai/embedding[/batch]` | POST | 텍스트 임베딩 (Mistral) |
| `/api/ai/generate[/stream]` | POST | 독립 텍스트 생성 |
| `/api/ai/graphrag` | POST | GraphRAG 지식 검색 |
| `/api/ai/approval` | POST | 의사결정 승인 워크플로우 |
| `/api/ai/feedback` | POST | 유저 피드백 수집 |
| `/api/ai/providers` | GET | Provider 상태 + 쿼타 |
| `/api/ai` | GET | 사용량 분석 |
| `/api/jobs` | POST | 비동기 Job 관리 |

## 10. Observability

| 도구 | 역할 |
|------|------|
| **Langfuse** | 트레이스, 토큰 사용량, 품질 점수, 핸드오프 체인 |
| **Pino Logger** | 구조화 로깅 (GCP Cloud Logging 호환) |
| **OpenTelemetry** | W3C Trace Context 전파 (Vercel → Cloud Run) |
| **/monitoring** | Circuit Breaker 상태, 쿼타 요약, 에이전트 가용성 |

## 11. 코드 구조

```
cloud-run/ai-engine/src/
├── server.ts                          # Hono 서버 (미들웨어, lazy route loading)
├── routes/                            # 9개 API 라우트
├── services/
│   ├── ai-sdk/
│   │   ├── model-provider.ts          # Provider 선택 (3-way fallback)
│   │   ├── model-provider-core.ts     # Provider 생성 (Cerebras/Groq/Mistral/Gemini/OpenRouter)
│   │   ├── model-provider-status.ts   # API Key 검증 + 토글 상태
│   │   ├── supervisor.ts              # Supervisor 공개 API
│   │   ├── supervisor-stream.ts       # Single-Agent 스트리밍 실행
│   │   ├── supervisor-routing.ts      # 모드 선택 + 의도 분류
│   │   └── agents/
│   │       ├── orchestrator.ts        # Orchestrator 파사드
│   │       ├── orchestrator-execution.ts   # 멀티에이전트 실행
│   │       ├── orchestrator-routing.ts     # 에이전트 라우팅 + 강제 라우팅
│   │       ├── orchestrator-decomposition.ts # 태스크 분해
│   │       ├── base-agent.ts          # BaseAgent 추상 클래스
│   │       ├── agent-factory.ts       # AgentFactory (생성 + 가용성)
│   │       ├── reporter-pipeline.ts   # Evaluator-Optimizer 파이프라인
│   │       └── config/
│   │           ├── agent-configs.ts   # 7개 에이전트 설정 (SSOT)
│   │           └── agent-model-selectors.ts  # 에이전트별 모델 선택
│   ├── resilience/
│   │   ├── circuit-breaker.ts         # CB (CLOSED/OPEN/HALF_OPEN)
│   │   ├── quota-tracker.ts           # 쿼타 추적 + Pre-emptive Fallback
│   │   └── retry-with-fallback.ts     # 3-way retry + exponential backoff
│   └── observability/
│       └── langfuse.ts                # Langfuse 파사드 (trace/score/usage)
├── tools-ai-sdk/                      # 26개 도구 정의
├── lib/
│   ├── embedding.ts                   # Mistral Embedding (1024d, 3h 캐시)
│   ├── mistral-provider.ts            # Mistral Singleton (임베딩 전용)
│   ├── query-expansion.ts             # HyDE 쿼리 확장 (Cerebras)
│   ├── reranker.ts                    # LLM Reranker (Cerebras)
│   └── llamaindex-rag-service.ts      # RAG 오케스트레이션
└── data/
    └── precomputed-state.ts           # 144 슬롯 사전 계산
```

## 12. 핵심 수치

| 항목 | 값 |
|------|-----|
| 에이전트 | 7개 (공개 5 + 내부 Pipeline 2) |
| 도구 | 26개 (7개 카테고리) |
| LLM Provider | 5개 (Cerebras, Groq, Mistral, Gemini, OpenRouter) |
| Fallback 체인 | 3-way (모든 에이전트) |
| 데이터 슬롯 | 144개 (24h x 6/hr, 10분 간격) |
| 모니터링 서버 | 15개 (사전 생성 OTel 데이터) |
| Cold Start | ~2-3초 (lazy loading + deferred init) |
| 인프라 | Cloud Run 1vCPU / 512Mi (Free Tier) |
| AI SDK | Vercel AI SDK v6.0.86 |

### AI SDK v6 주요 기능

| Feature | Description |
|---------|-------------|
| **UIMessageStream** | Native streaming protocol |
| **DefaultChatTransport** | Built-in transport with `resume: true` |
| **finalAnswer Tool** | Agent termination (`hasToolCall` + `stepCountIs`) |
| **prepareStep** | Intent 기반 도구 필터링 (Single-Agent) |
| **generateObject** | 구조화 라우팅 (Orchestrator) |

## Version History

<details>
<summary>v8.3.3 (2026-02-23) - 3-Way Provider Redistribution</summary>

- **Cerebras → gpt-oss-120b** (120B MoE, tool calling, 3000 tok/s)
- **Mistral → Advisor Primary** (mistral-large-latest, Frontier model)
- **3-way fallback 전면 적용**: 모든 에이전트 (Cerebras ↔ Groq ↔ Mistral)
- **@llamaindex 의존성 전면 제거**: AI SDK `generateText` + Cerebras로 대체
- **RAG LLM 추론 Cerebras 이관**: HyDE, Reranker, Triplet, Generate
- **Mistral RPM 실측 테스트 완료**: 60+ embed/min, 15+ chat/min
</details>

<details>
<summary>v8.0.0 (2026-02-15) - ConfigBasedAgent + Reporter Pipeline</summary>

- **ConfigBasedAgent**: 7개 에이전트 단일 클래스 구현
- **Reporter Pipeline**: Evaluator-Optimizer 패턴 (품질 ≥ 0.75)
- **Vision Agent**: Gemini 2.5 Flash + OpenRouter Fallback
- **Task Decomposition**: Parallel/Sequential/Hybrid 실행
</details>

<details>
<summary>v7.1.0 (2026-01-27) - BaseAgent + AgentFactory</summary>

- **BaseAgent Abstract Class**: 공통 실행 로직 캡슐화
- **AgentFactory Pattern**: 중앙화된 에이전트 생성 및 가용성 관리
- **AI SDK v6.0.50**: `timeout: { totalMs, chunkMs }` 지원
- **3-Way Fallback** 도입
</details>

<details>
<summary>v6.1.0 (2026-01-25) - AI SDK v6 Native Protocol</summary>

- **UIMessageStream**: Native streaming protocol
- **Resumable Stream v2**: Redis 기반 자동 재연결
- **finalAnswer Pattern**: 에이전트 종료 일관성
- **prepareStep Optimization**: 의도 기반 도구 필터링
</details>

---

## 13. Architecture Evaluation (v8.3.3)

### AI Agent Expert Assessment

| 항목 | 평가 | 상세 |
|------|------|------|
| **7-Agent 구성** | 적절 (5 Active + 2 Internal) | NLQ/Analyst/Reporter/Advisor/Vision은 도구·프롬프트가 명확히 차별화됨. Evaluator/Optimizer는 Reporter Pipeline 내부용으로 **LLM 호출 없이 결정론적 스코어링만 수행** |
| **Supervisor→Orchestrator→Agent 계층** | 잘 설계됨 | Single-Agent(streamText)와 Multi-Agent(generateObject 라우팅)의 분리가 명확. `executeForcedRouting`이 BaseAgent 우회하는 이중 경로 존재 |
| **3-Layer 라우팅** | 효율적 | Pre-filter가 confidence=0.8 반환 → Forced Routing 임계값(≥0.8)과 일치 → LLM Routing은 서버 키워드 없는 쿼리에서만 동작. 서버 모니터링 도메인에서 합리적 |
| **ConfigBasedAgent + AgentFactory** | 올바른 패턴 | 서브클래스 폭발 방지, 단일 SSOT 설정. BaseAgent에 ConfigBasedAgent 하나만 구현 → 확장성 확보 |
| **도구 할당** | 적절 | 에이전트별 도구 중복(findRootCause 등)은 Cross-cutting 용도로 정당. NLQ=조회, Analyst=분석으로 구분 |
| **finalAnswer 패턴** | AI SDK v6 Best Practice | `stopWhen: [hasToolCall('finalAnswer'), stepCountIs(N)]` 적용. 빈 텍스트 시 toolResults 복구 로직 구현 |
| **MoE(gpt-oss-120b) 활용성** | **탁월함 (최우수)** | Cerebras 플랫폼의 120B 파라미터(gpt-oss-120b)를 Supervisor, NLQ의 메인으로 사용하여 **가장 복잡한 논리와 다양한 도구 조율 영역을 성공적으로 커버**함. OpenAI의 o4-mini/Claude Opus급 지능을 갖추었음을 확인 |
| **AI SDK v6 구현 성숙도** | 매우 높음 | `createCerebras` 프로바이더 연동, Circuit Breaker 및 Fallback 체인이 완벽하게 결합됨. SDK v6 네이티브한 멀티 에이전트 스트리밍 환경을 구축함 |
| **업계 비교** | 실용적 수준 | AutoGen보다 구조적, LangGraph보다 단순. 서버 모니터링 도메인에 적합한 추론 복잡성과 도구 활용성(Tool Use) 유지 |

### Model Evolution & Performance Benchmarking (v8.3.3)

| 항목 | 상세 분석 |
|------|-----------|
| **모델 변경 이력과 당위성** | 기존 70B(Llama 등)에서 Cerebras `gpt-oss-120b` (120B MoE)로 Supervisor 및 주요 에이전트를 승격시킴 (v8.3.3). 이는 기존 파라미터 대비 약 1.7배 거대한 구조와 뛰어난 코드/도구 인식 능력을 확보하기 위함으로 명확히 기록됨. |
| **추론 속도(TPS) 차이** | **Cerebras (gpt-oss-120b)**가 `3,000 tok/s` 이상의 압도적 속도를 지원하여, 기존 대비 레이턴시(TTFB 및 전체 응답시간)를 비약적으로 단축. 이는 Groq(약 250~300 tok/s) 대비 10배에 달하는 스피드로, 동시 다발적인 데이터 조회가 필요한 NLQ/Supervisor 환경에 압도적인 우위를 제공함. |
| **코드-문서 간격 검증** | `model-provider.ts` 내 Cerebras (`gpt-oss-120b`) 설정과 3-way fallback 설정(`Groq`, `Mistral`)이 소스코드와 `ai-engine-architecture.md` 리포트 간 **단 한 치의 오차도 없이 100% 동기화(SSOT)**되어 있음. |

### System Architecture Expert Assessment

| 항목 | 평가 | 상세 |
|------|------|------|
| **3-Way Fallback** | 적절 | 5개 에이전트 모델 선택 함수가 동일 패턴 반복 → 공통 유틸 추출 가능 (P2) |
| **CB + Quota + Retry 레이어링** | 건전, CB 통합 완료 | `getAvailableProviders()`에서 CB `isAllowed()` 사전 체크 → OPEN 상태 provider 제외 |
| **타임아웃 체계** | 양호 | Tool(25s)→Agent(45s)→Orchestrator(50s)→Supervisor(50s)→CB(55s). Supervisor=Orchestrator=50s headroom 부재 (P2) |
| **Vercel 플랜** | Pro ($20/mo) | `timeout-config.ts`에 Pro 60s 반영 완료 |
| **Free Tier 현실성** | 충분 | 1vCPU/512Mi에서 경량 객체, I/O-bound LLM 호출. 병목은 provider RPM |
| **Cold Start 최적화** | 잘 설계됨 | Lazy route loading + deferred service init + cpu-boost |
| **Secret 관리** | 적절 | 5개 JSON 그룹, GCP Secret Manager `:latest` |
| **RAG 파이프라인** | 기능 | cosine threshold 0.3은 낮음 (P2), Mistral embed 단일 의존 |
| **Observability** | 충분 | Langfuse + Pino + Cloud Logging. 분산 트레이싱(Vercel↔CloudRun) 미구현 |
| **확장성 한계** | Provider RPM이 첫 병목 | Groq 30 RPM, Gemini 15 RPM. max-instances=1 수평 확장 불가 |

### Pending Improvements (P2)

- Supervisor/Orchestrator 타임아웃 headroom: Orchestrator 45s로 조정
- `console.log` → `logger.info` 통일 (orchestrator-routing.ts, reporter-pipeline.ts)
- RAG cosine threshold 0.3 → 0.5 상향
- Handoff Ring Buffer Redis 이관
- 스트리밍 `fullStream` 전환 (tool_call 인터리빙)
- 3-way fallback 모델 선택 공통 유틸 `resolveModelWithFallback()` 추출

---

## Related Documentation

- **[System Architecture](../system/system-architecture-current.md)** - 배포/데이터 흐름 포함 전체 구조
- **[Monitoring & ML Engine](./monitoring-ml.md)** - 이상탐지, 트렌드 예측
- **[RAG & Knowledge Engine](./rag-knowledge-engine.md)** - 검색 및 지식 그래프
- **[Resilience Architecture](../infrastructure/resilience.md)** - CB 상태 전이, 쿼타 임계값
- **[Data Architecture](../data/data-architecture.md)** - 서버 데이터 아키텍처
