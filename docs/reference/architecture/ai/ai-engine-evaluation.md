# AI Engine 아키텍처 평가 — 성숙도·성능·개선 현황

> AI Engine runtime의 전문가 평가, 성능 기준선, 개선 우선순위
> Owner: platform-architecture
> Status: Active Supporting
> Doc type: Explanation
> Last reviewed: 2026-05-20
> Canonical: docs/reference/architecture/ai/ai-engine-architecture.md
> Tags: ai,architecture,evaluation,performance,maturity

core runtime 기준은 [ai-engine-architecture.md](./ai-engine-architecture.md)에서 관리합니다. 이 파일은 설계 평가, 성능 기준선, 미결 개선 항목을 별도 독자(운영자, 기여자)를 위해 분리 유지합니다.

---

## AI Agent Expert Assessment

| 항목 | 평가 | 상세 |
|------|------|------|
| **에이전트 구조** | 적절 (작업 5 + 내부 품질 단계 2) | Metrics Query/Analyst/Reporter/Advisor/Vision은 도구·프롬프트가 분리됨. Evaluator/Optimizer는 Reporter Pipeline 내부용 **결정론적 단계** |
| **Supervisor→Direct Router→Agent 계층** | 잘 설계됨 | Single-Agent(`streamText`)와 routing-based multi-agent workflow(agent tool loop)의 분리가 명확. `executeForcedRouting`이 BaseAgent 우회하는 이중 경로는 여전히 존재 |
| **Direct routing** | 효율적 | `preFilterQuery()`가 suggested specialist를 내면 confidence와 무관하게 직접 실행하고, suggested agent가 없으면 Metrics Query Agent로 deterministic fallback한다. 서버 모니터링 도메인에서 무료 티어 쿼터 보존에 유리 |
| **ConfigBasedAgent + AgentFactory** | 올바른 패턴 | 서브클래스 폭발 방지, 단일 SSOT 설정. BaseAgent에 ConfigBasedAgent 하나만 구현 → 확장성 확보 |
| **도구 할당** | 적절 | 역할 경계를 좁혀 Metrics Query는 조회/수식/통계, Analyst는 RCA/상관 분석, Reporter는 타임라인/보고서, Advisor는 KB/로그/명령 추천 중심으로 구분 |
| **finalAnswer 패턴** | AI SDK v6 Best Practice | `buildAgentLoopSettings()`가 `stopWhen: [hasToolCall('finalAnswer'), stepCountIs(N)]`를 일괄 제공. cap: Metrics/Advisor 4, Analyst/Reporter 5, Vision 2. 빈 텍스트 시 toolResults 복구 로직 구현 |
| **Cerebras 활용성** | 조건부 강함 | 기본 multi-agent path Orchestrator structured routing은 제거됐지만, text fallback과 legacy structured-output helper에서는 capability gate/모델 정책에 따라 활용 가능 |
| **AI SDK v6 구현 성숙도** | 높음 | Frontend `useChat`/`DefaultChatTransport`, 서버 `createUIMessageStreamResponse`·`streamText`·`generateText`·`Output.object` 조합. SDK core abstraction 우회 없이 커스텀 복원력 계층 구현 |
| **업계 비교** | 실용적 수준 | AutoGen보다 구조적이고 LangGraph보다 가볍다. 서버 모니터링 도메인에 필요한 tool use와 fallback 제어를 현실적으로 구현 |

## Model & Routing Notes (2026-05-16)

| 항목 | 상세 분석 |
|------|-----------|
| **모델 배분** | Text agent는 `Groq → Mistral → Z.AI → Cerebras` round-robin cursor + context/capability gate. Vision은 Gemini 단일 provider, 미가용 시 Analyst Agent로 degradation |
| **AI SDK 적용 방식** | 프론트엔드 `useChat`/`DefaultChatTransport`, 서버 `createUIMessageStreamResponse`·`streamText`·`generateText`·`Output.object`, 작업 에이전트 BaseAgent 내부 tool loop |
| **문서 검증 범위** | 2026-05-20 기준 직접 검증: Z.AI chat/tool path, provider order, capability gate, quota metadata, Gemini-only Vision 계약, Cerebras account header. 외부 provider 무료 티어/성능 수치는 모델 전략 변경 전 재검증 필요 |

## System Architecture Expert Assessment

| 항목 | 평가 | 상세 |
|------|------|------|
| **Round-Robin Provider Mesh** | 적절 | provider capability gate + circuit breaker + quota tracker + retry/fallback 순서가 명확. 429 cooldown provider를 후순위로 밀어 무료 tier provider 부하 분산 |
| **CB + Quota + Retry 레이어링** | 건전, CB 통합 완료 | `getAvailableProviders()`에서 CB `isAllowed()` 사전 체크 → OPEN 상태 provider 제외 |
| **타임아웃 체계** | 양호 | Tool(25s)→Agent(45s), single non-stream Supervisor(50s/40s warning), single stream hardStreaming(120s/96s warning), multi-agent workflow 90s 한도 |
| **Vercel 플랜** | Pro (유일한 유료 예외) | `timeout-config.ts`에 Pro 60s 반영 완료 |
| **Free Tier 현실성** | 충분 | 1vCPU/512Mi에서 경량 객체, I/O-bound LLM 호출. 병목은 provider RPM |
| **Cold Start 최적화** | 잘 설계됨 | Lazy route loading + deferred service init + cpu-boost |
| **Secret 관리** | 적절 | 5개 JSON 그룹 (tavilyBackup 통합 완료), GCP Secret Manager `:latest` |
| **Knowledge Retrieval Lite** | 기능 | BM25 + metadata boost 기반. cosine vector path 기본 비활성 (P2), Supabase `search_knowledge_text` RPC 의존 |
| **Observability** | 충분 | Langfuse + Pino + Cloud Logging + Vercel↔Cloud Run W3C Trace Context 전파. OTLP exporter 기반 full distributed tracing은 아직 아님 |
| **확장성 한계** | Provider RPM이 첫 병목 | LLM 쿼터/쿨타임 정책이 병목 가능, 추적 필요 |

## Architecture Maturity Summary

| Dimension | Score | Evidence |
|-----------|:-----:|----------|
| Resilience | A+ | CB + capability gate + structured/tool route 분리 fallback |
| Observability | A | Langfuse + Pino + Cloud Logging + W3C traceparent. OTLP full span stitching은 아직 아님 |
| Security | A | 52-패턴 Injection 방어 + Zod + Rate Limit + 출력 필터링 |
| Caching | A | legacy `/api/ai/supervisor` response cache와 `/stream/v2` Redis state 분리 운영 |
| Data Architecture | A | 144-slot O(1) Pre-computed State, ~100토큰 컨텍스트 |
| Cost Efficiency | A | 전 구간 Free Tier 최적화, 샘플링 적용 |
| Session Continuity | B+→A- | localStorage sessionId 영속화 (30분 TTL) |
| Job Recovery | B→B+ | 실패 Job 재시도 (max 2회) |

## Agent Performance Baseline

| Agent | Provider Selection | Route Type | Tool Count | Quality Gate |
|-------|--------------------|------------|:----------:|:------------:|
| Metrics Query | Round-robin text mesh, min 16K context | tool-calling text path | 10 | — |
| Analyst | Round-robin text mesh, min 32K context | tool-calling text path | 8 | — |
| Reporter | Round-robin text mesh, min 32K context | Reporter pipeline + tool path | 12 | score ≥ 0.75 |
| Advisor | Round-robin text mesh, min 32K context | tool-calling text path | 4 | — |
| Vision | Gemini `gemini-2.5-flash-lite` only | multimodal primary; Analyst fallback when unavailable | 2 | — |
| Evaluator | 결정론적 (LLM 없음) | pipeline internal | 3 | — |
| Optimizer | 결정론적 (LLM 없음) | pipeline internal | 3 | — |

> Latency는 provider 정책, quota, attachment size, routing path에 따라 크게 변동하므로 **현재 provider selection 계약**만 SSOT로 유지합니다.

## Runtime Latency Snapshot (Observed Samples, 2026-04-18)

아래 수치는 production/Cloud Run QA 실측 표본이며, 장기 평균이나 SLO가 아닙니다.

| Surface / Path | Observed Samples | Sample Average | Interpretation |
|------|------|------|------|
| Multi topology probe (`resolvedMode=multi`) | `0.403s`, `0.595s` | `0.499s` | 매우 빠름. KB-direct + finalAnswer 수렴 경로 |
| General topology / incident probe | `9.17s`, `5.12s`, `7.02s` | `7.10s` | 일반 multi 경로 기준 정상 범위 |
| Mixed advisory probe | `12.91s`, `3.23s`, `29.26s` | `15.13s` | 편차 큼. Advisor/RAG/fallback 영향 |
| Reporter Agent historical QA | `~1s`, `2.9s` | `~1.95s` | 빠름 |
| Analyst Agent historical QA | `~18s`, `~25s` | `~21.5s` | 무거운 전체 분석 경로. 정상 범위 |
| Job queue chat E2E | `~8.0s` | `8.0s` | medium/job-queue 기준 정상 |
| Vision Agent historical sample | `3.7s` | sample `1` | 장기 표본 부족, 참고치 |

**Current interpretation**
- `Metrics Query / Reporter`: 사용성 기준 빠름
- `Analyst`: 기능상 무거워 18~25s 정상 범위
- tail latency 리스크 중심: `Advisor / Mistral` 계열

**Sample sources**: `reports/qa/runs/2026/` QA-20260415-0284~0286, QA-20260309-0069, QA-20260310-0088~0089

## Response Process UI — 확인 가능/불가 경계

UI(`AI 처리 과정`, `분석 근거`, `handoff path`, `traceId`)는 **정성 검증용**으로 충분하지만 **정량 성능 SSOT는 아닙니다.**

| 확인 가능 | 확인 불가 |
|-----------|-----------|
| 어떤 도구/에이전트 사용 | provider/model별 실제 평균 응답속도 |
| handoff 존재 여부 | provider retry/fallback depth |
| fallback 상태 메시지 | `avg / p95 / p99` |
| `processingTime`, `resolvedMode`, `latencyTier` | 어느 provider가 최종 성공 청크를 반환했는지 |

정량 검증 근거: `ttfbMs`/`processingTimeMs` 메타데이터, Langfuse trace, Cloud Logging, production QA run JSON

## Pending Improvements

### P1
- **Latency rollup 부재**: `ttfbMs`·`processingTimeMs`·`X-AI-Latency-Ms`는 기록되지만 agent/provider별 `avg/p95` 집계 리포트 없음

### P2
- Vision 최신 표본 보강 (현재 sample 1건)
- Supervisor/Direct Router 타임아웃 정렬 점검
- `console.log` → `logger.info` 통일 (`orchestrator-routing.ts`, `reporter-pipeline.ts`)
- RAG cosine threshold 0.3 → 0.5 상향
- Handoff Ring Buffer Redis 이관
- 스트리밍 `fullStream` 전환 (tool_call 인터리빙)
- `resolveModelWithFallback()` 공통 유틸 추출
