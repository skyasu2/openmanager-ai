> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-12
> Tags: ai-assistant,routing,decision-trace,context-store,ai-engine

# AI Assistant Routing Decision Trace Hardening Plan

- 상태: In Progress
- 작성일: 2026-05-12
- TODO.md 연결: Active Tasks > AI Assistant routing decision trace hardening

## 목표

AI Assistant의 자연어 라우팅 판단을 하나의 거대 함수로 재작성하지 않고, 현재 안정적으로 동작하는 Provider fallback, Circuit Breaker, quota guard, deterministic fast path를 유지하면서 라우팅 판단 근거를 단일 contract로 추적 가능하게 만든다.

핵심 목표는 세 가지다.

- query signal 추출을 공통 계약으로 정리해 `single/multi`, tool routing, pre-filter, agent routing이 같은 판단 재료를 공유한다.
- 라우팅 결과를 `RoutingDecisionTrace`로 남겨 "왜 이 mode/tool/agent/evidence path로 갔는가"를 테스트와 운영 로그에서 확인 가능하게 한다.
- Context Store가 LLM 응답 문장 regex에 의존하지 않도록 structured findings 저장 경로를 추가한다.

## 현재 상태 분석

| 영역 | 현재 상태 | 판단 |
|------|-----------|------|
| Mode 결정 | `supervisor-mode.ts`가 `selectExecutionMode()`로 single/multi를 결정 | 유지하되 decision trace 입력으로 편입 필요 |
| Tool routing | `routing-policy.ts`의 `getIntentCategory()`와 `createPrepareStep()`가 도구 allowlist를 선택 | 정책은 유효하지만 query intent regex가 별도 관리됨 |
| Agent pre-filter | `orchestrator-context.ts`의 `preFilterQuery()`가 direct response 또는 suggested agent를 반환 | 빠른 응답 경로는 유용하지만 반환 contract가 LLM routing과 다름 |
| LLM agent routing | `orchestrator-execution.ts`가 pre-filter 이후 structured LLM routing 또는 forced routing 수행 | fallback 구조는 유지하되 trace reasonCode 표준화 필요 |
| Decomposition | `orchestrator-decomposition.ts`에서 `isComplexQuery()`가 LLM decomposition 앞 gate로 동작 | 단순 쿼리 LLM call 문제는 현재 코드 기준 잔존하지 않음 |
| Context Store | `saveAgentFindingsToContext()`가 응답 text에서 server/metric/anomaly를 regex로 추출 | structured output 또는 tool result 기반 저장 경로 필요 |
| Retrieval 설명 | 완료 이력 기준 GraphRAG runtime은 tombstone/legacy cleanup 완료, 현행은 KRL/BM25 계열 | 신규 계획에서 graph traversal 복구는 제외 |

## 중복 검토

| 기존 계획서 | 상태 | 관계 |
|-------------|------|------|
| `archive/ai-assistant-semantic-query-routing-plan.md` | Completed | semantic intent frame을 Cloud Run evidence resolver까지 연결한 완료 이력. 이번 작업은 그 이후 orchestrator/tool/pre-filter 판단 trace 정렬이 목적 |
| `archive/ai-assistant-domain-capability-resolver-plan.md` | Completed | domain capability resolver 계약 완료 이력. 이번 작업은 monitoring domain 내부 라우팅 decision trace를 보강 |
| `archive/ai-assistant-weekly-stabilization-plan.md` | Completed | P1 자연어 회귀 closure 완료 이력. 이번 작업은 구조적 유지보수성 개선 |

신규 plan 생성 조건을 충족한다.

- TODO.md에 같은 active/backlog 항목 없음
- `reports/planning` 루트에 진행 중 plan 파일 없음
- 라우팅 계약, observability metadata, Context Store 저장 계약을 포함하는 다단계 아키텍처 변경

## 범위

포함한다.

- AI Engine query routing signal 공통 타입과 extractor 추가
- mode/tool/pre-filter/agent routing에서 공통 signal을 사용하거나 최소한 동일 trace에 reasonCode를 기록
- `RoutingDecisionTrace` 타입, reasonCode, confidence 범위, metadata 노출 경계 정의
- pre-filter direct/suggested agent 결과와 LLM routing 결과의 내부 반환 contract 정렬
- Context Store structured findings 저장 경로 추가
- 기존 regex extractor는 legacy fallback으로 축소하거나 deprecation path를 명시
- deterministic unit/contract test 중심 검증

제외한다.

- Provider 우선순위, Circuit Breaker, quota threshold 변경
- Reporter Evaluator/Optimizer pipeline 재작성
- 전체 orchestrator를 단일 `resolveRouting()` monolith로 병합
- GraphRAG/vector/graph traversal 복구
- production live LLM 반복 QA 또는 비용 큰 E2E
- monitoring 외 신규 domain pack 구현

## 정량 목표 (Success Metrics)

| 지표 | Baseline (2026-05-12) | 목표 | 측정 방법 |
|------|----------------------|------|---------|
| 라우팅 regex 중복 (3파일 합산) | 80개 (45 + 11 + 24) | 신규 routing에 미사용 시 회귀 0, 후속 plan에서 ≤ 50개로 축소 | `grep -cE '/.*/[gi]?'` |
| 추가 LLM call/쿼리 | 0 | 0 (변화 없음) | unit test mock assertion |
| Signal 추출 p50 latency overhead | n/a | ≤ 2ms | vitest bench (deterministic) |
| RoutingDecisionTrace 미생성 경로 | 4개 (mode/tool/preFilter/agent 각각 분리) | 0 (모든 결정 경로 단일 trace에 기록) | contract test |
| Context Store findings source | 100% `legacy_text_regex` | structured/tool_result 우선 경로 도입, fallback 비율은 measurement-only | trace `findingsSource` 집계 |

> "회귀 0"의 정의: 기존 `selectExecutionMode`/`getIntentCategory`/`preFilterQuery`의 모든 단위 테스트 입력에 대해 동일한 분류 결과를 유지.

## 설계 원칙

```text
User Query
  -> QueryRoutingSignals
  -> ModeDecision
  -> ToolDecision
  -> PreFilterDecision
  -> AgentRoutingDecision
  -> RoutingDecisionTrace
  -> Agent / Direct / Evidence / Reporter Pipeline
```

- signal 추출은 최대한 deterministic하게 유지하고, LLM은 agent routing fallback에서만 사용한다.
- 기존 fast path는 제거하지 않고 같은 trace contract를 남기도록 정렬한다.
- user-facing 답변에는 provider 내부 함수명, raw trace JSON, 내부 prompt를 노출하지 않는다.
- trace에는 query 전문 대신 기존 logger 정책에 맞춘 truncate/sanitized 문자열만 허용한다.
- Free Tier 원칙상 구조 개선은 local deterministic test를 우선하고 실 LLM 호출은 최종 QA에서만 제한적으로 판단한다.

## 계약 (Contract)

> Status를 Approved로 올리기 전에 이 섹션을 구현 파일 기준으로 재확인한다.

### 변경 대상 파일 후보

AI Engine:

- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts`
- `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-decomposition.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/routing/query-routing-signals.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/routing/routing-decision-trace.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/agents/agent-findings-schema.ts`

관련 테스트:

- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.test.ts`
- `cloud-run/ai-engine/src/domains/monitoring/routing-policy.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.test.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/routing/query-routing-signals.test.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/routing/routing-decision-trace.test.ts`

### 입출력 계약

| 경계 | 입력 | 출력 | 에러/제약 |
|------|------|------|-----------|
| `extractQueryRoutingSignals` | `query`, optional request/context metadata | normalized `QueryRoutingSignals` | invalid/empty query는 `intent='general'`, `confidence=0` |
| `selectExecutionMode` | `query`, `analysisMode`, optional `signals` | `single | multi` + reasonCode 후보 | 기존 반환 호환 유지, trace helper에서 reasonCode 보강 |
| `createPrepareStep` | tool set, request metadata, optional `signals` | filtered tool set + toolDecision trace | web/RAG toggle 기존 정책 유지 |
| `preFilterQuery` | `query`, session context, optional `signals` | normalized `PreFilterDecision` | direct response도 trace reasonCode 필수 |
| LLM agent routing | query, context, preFilter decision | `AgentRoutingDecision` | LLM failure 시 기존 fallback 유지 |
| `RoutingDecisionTrace` | mode/tool/preFilter/agent/evidence decisions | sanitized internal metadata/log | user-facing raw JSON 노출 금지 |
| `saveAgentFindingsToContext` | structured findings 또는 legacy text response | stored context entry | structured findings 우선, regex fallback은 legacy reasonCode 기록 |

### `QueryRoutingSignals` 초안

```ts
interface QueryRoutingSignals {
  intent:
    | 'metrics'
    | 'anomaly'
    | 'prediction'
    | 'rca'
    | 'advisor'
    | 'logs'
    | 'serverGroup'
    | 'report'
    | 'vision'
    | 'knowledge'
    | 'general';
  scope: 'single_server' | 'server_group' | 'whole_fleet' | 'unknown';
  hasInfraContext: boolean;
  hasAttachment: boolean;
  asksForReport: boolean;
  asksForAction: boolean;
  asksForMutation: boolean;
  asksForFormattingOnly: boolean;
  metric?: 'cpu' | 'memory' | 'disk' | 'load1' | 'network' | 'unknown';
  timeWindow?: 'realtime' | 'recent' | '24h' | 'unknown';
  confidence: number;
  reasonCodes: string[];
}
```

### `RoutingDecisionTrace` 초안

```ts
interface RoutingDecisionTrace {
  version: '2026-05-12-v1';
  signals: QueryRoutingSignals;
  modeDecision?: {
    mode: 'single' | 'multi';
    reasonCodes: string[];
  };
  toolDecision?: {
    intentCategory: QueryRoutingSignals['intent'];
    allowedTools: string[];
    forcedTool?: string;
    reasonCodes: string[];
  };
  preFilterDecision?: {
    action: 'direct_response' | 'suggest_agent' | 'continue';
    suggestedAgent?: string;
    confidence?: number;
    reasonCodes: string[];
  };
  agentDecision?: {
    source: 'pre_filter' | 'llm_routing' | 'fallback';
    selectedAgent?: string;
    confidence?: number;
    reasonCodes: string[];
  };
  contextDecision?: {
    findingsSource: 'structured' | 'tool_result' | 'legacy_text_regex' | 'none';
    reasonCodes: string[];
  };
}
```

### Context findings 초안

```ts
interface AgentStructuredFindings {
  agentName: string;
  affectedServers?: string[];
  metrics?: Array<{
    name: string;
    value?: number;
    unit?: string;
    server?: string;
    timeWindow?: string;
  }>;
  anomalies?: Array<{
    server?: string;
    metric?: string;
    severity: 'info' | 'warning' | 'critical';
    summary: string;
  }>;
  recommendations?: Array<{
    action: string;
    safety: 'read_only' | 'requires_approval' | 'unsupported';
  }>;
}
```

### reasonCode 카탈로그 v1

> Task 0에서 확정. 모든 시나리오의 reasonCode 문자열은 이 카탈로그에서만 선택한다. 신규 코드 추가 시 카탈로그 갱신을 동반한다.

**Signal-level** (`QueryRoutingSignals.reasonCodes`)

| 코드 | 의미 |
|------|------|
| `infra_context_present` | infra/server/metric 키워드 감지 |
| `composite_query` | 복합 의도 연결어 ≥ 2회 또는 1회 + 길이 ≥ 50자 |
| `whole_fleet_metric` | 전체 fleet 대상 metric 질의 |
| `single_server_id_match` | 카탈로그 server-id 직접 매치 |
| `attachment_image` / `attachment_file` | 첨부 감지 |
| `formatting_only_report` | 재서술/포맷팅 요청 (실행 액션 없음) |
| `mutating_command_request` | 변경/실행성 명령어 요청 감지 |

**Mode-level** (`modeDecision.reasonCodes`)

| 코드 | 의미 |
|------|------|
| `mode_multi_report_request` | reporter 패턴 hit |
| `mode_multi_rca` | RCA/근본원인 hit |
| `mode_multi_advisor_with_infra` | advisor + infra context |
| `mode_multi_composite` | composite_query signal |
| `mode_single_default` | 위 조건 모두 미스 |
| `mode_single_formatting_only` | formatting_only_report 예외 |
| `mode_single_degraded_explicit` | `ALLOW_DEGRADED_SINGLE=true` + 명시 single |

**Tool-level** (`toolDecision.reasonCodes`)

| 코드 | 의미 |
|------|------|
| `tool_intent_<category>` | 의도 분류 결과 (anomaly/prediction/rca/...) |
| `tool_force_realtime_metric` | server-id + 현재값 패턴 |
| `tool_force_ranking` | data-ranking intent |
| `tool_force_kb` | topology/architecture |
| `tool_force_web_search` | 외부 정보 필요 |

**PreFilter-level** (`preFilterDecision.reasonCodes`)

| 코드 | 의미 |
|------|------|
| `prefilter_greeting` / `prefilter_general` / `prefilter_help` | direct response 분기 |
| `prefilter_vision_attachment` | vision 강제 |
| `prefilter_suggest_<agent>` | 패턴 매칭으로 agent 제안 |
| `prefilter_continue` | LLM routing으로 진행 |

**Agent-level** (`agentDecision.reasonCodes`)

| 코드 | 의미 |
|------|------|
| `agent_source_pre_filter` | preFilter 결정 채택 |
| `agent_source_llm_routing` | LLM 구조화 출력 채택 |
| `agent_source_fallback_suggested` | LLM 실패 → preFilter suggested 채택 |
| `agent_source_fallback_default_nlq` | 모든 결정 실패 시 NLQ 기본값 |

**Context-level** (`contextDecision.reasonCodes`)

| 코드 | 의미 |
|------|------|
| `findings_structured` | LLM structured output 또는 tool result에서 수신 |
| `findings_legacy_regex` | 텍스트 regex extractor 사용 (deprecated path) |
| `findings_none` | 추출 결과 없음 |

### Intent 매핑 표 (기존 ↔ 신규)

기존 `getIntentCategory()`의 9 카테고리와 신규 `QueryRoutingSignals.intent` 11 카테고리 매핑. tool routing은 기존 9 카테고리를 그대로 사용하고 trace에만 신규 enum을 기록한다 (회귀 위험 제거).

| 기존 (`IntentCategory`) | 신규 (`QueryRoutingSignals.intent`) | 비고 |
|------------------------|-------------------------------------|------|
| `anomaly` | `anomaly` | 1:1 |
| `prediction` | `prediction` | 1:1 |
| `rca` | `rca` | 1:1 |
| `advisor` | `advisor` | 1:1 |
| `math` | `metrics` (+ `reasonCodes: math_expression`) | 기존 math는 metrics 도구 세트 사용 |
| `logs` | `logs` | 1:1 |
| `serverGroup` | `serverGroup` | 1:1 |
| `metrics` | `metrics` | 1:1 |
| `general` | `general` | 1:1 |
| — | `report` | 신규: reporter 패턴 hit, mode decision에 영향 |
| — | `vision` | 신규: 첨부 기반, preFilter에서 처리 |
| — | `knowledge` | 신규: KB force 패턴, tool routing에 영향 |

> tool routing의 `getIntentCategory()` 함수 동작은 본 plan에서 변경하지 않는다. signal extractor는 별도로 동일 입력에 대해 동일 분류를 도출함을 contract test로 보장한다.

### Trace Sanitize 책임 경계

| Layer | 노출 가능 | 제거 |
|-------|----------|------|
| AI Engine 내부 logger (Pino) | 전체 `RoutingDecisionTrace` | — |
| Langfuse trace metadata | sanitized trace (`reasonCodes`, `mode`, `selectedAgent`, signal flags만) | raw query 전문, prompt, provider 함수명 |
| Cloud Run → Vercel BFF response | `metadata.routing` (선택적 요약 필드만) | reasonCodes 외 내부 트레이스 |
| Vercel BFF → 클라이언트 stream | UI 표시용 metadata (mode, agent, fallbackReason) | trace JSON, signal 원본 |

> sanitize 책임: AI Engine `supervisor-stream-response.ts`와 BFF `supervisor/route.ts`. 두 곳 모두에 strip assertion 테스트를 추가한다.

## 테스트 시나리오 (구현 전 확정)

- [x] 시나리오 1: whole-fleet metric peak 질의는 `QueryRoutingSignals.intent='metrics'`, `scope='whole_fleet'`, `metric='load1'`를 반환한다.
- [x] 시나리오 2: 보고서 생성 질의는 mode decision이 `multi`이고 reasonCode에 `mode_multi_report_request`가 포함된다.
- [x] 시나리오 3: formatting-only report request는 기존 예외처럼 `single` mode를 유지하고 reasonCode에 `mode_single_formatting_only`가 포함된다.
- [x] 시나리오 4: advisor/action 질의는 tool decision이 `recommendCommands` 중심 allowlist를 선택하고 mutating command 요청은 `asksForMutation=true` + signal reasonCode `mutating_command_request`로 표시한다.
- [x] 시나리오 5: greeting/general 질의는 pre-filter direct response를 반환하되 `RoutingDecisionTrace.preFilterDecision.action='direct_response'`, reasonCode `prefilter_greeting|prefilter_general|prefilter_help` 중 하나를 남긴다.
- [x] 시나리오 6: pre-filter가 agent를 강제 선택한 경우 LLM routing을 호출하지 않고 (`generateStructuredOutputWithFallback` mock spy 0회 호출) `agentDecision.source='pre_filter'`, reasonCode `agent_source_pre_filter`를 남긴다.
- [x] 시나리오 7: pre-filter로 결정되지 않은 복합 질의는 LLM routing fallback을 사용하고 `agentDecision.source='llm_routing'`, reasonCode `agent_source_llm_routing`을 남긴다.
- [x] 시나리오 8: structured findings가 전달되면 Context Store는 regex 추출보다 structured findings를 우선 저장하고 `contextDecision.findingsSource='structured'`를 남긴다.
- [x] 시나리오 9: structured findings가 없을 때만 legacy text regex fallback이 동작하고 `contextDecision.findingsSource='legacy_text_regex'`, reasonCode `findings_legacy_regex`를 남긴다.
- [x] 시나리오 10: 단순 쿼리(`서버 상태 알려줘` 등)는 decomposition LLM call을 호출하지 않는다. Phase 3 회귀 묶음에서 `orchestrator-decomposition.test.ts`를 함께 실행해 기존 gate를 유지함을 확인했다.
- [x] 시나리오 11: raw routing trace JSON, provider 내부 함수명, prompt 원문은 user-facing answer에 노출되지 않는다. Phase 2에서는 AI Engine `sanitizeRoutingDecisionTrace()` 유닛 테스트로 prompt/provider raw field strip을 고정했다. BFF layer strip assertion은 실제 BFF routing metadata 전달 시점에 별도 보강한다.
- [x] 시나리오 12 (회귀 게이트): 기존 `selectExecutionMode`/`getIntentCategory`/`preFilterQuery`의 대표 단위 테스트 입력 fixture에 대해 신규 signal extractor가 동등한 분류 결과를 도출한다 (contract parity test).
- [x] 시나리오 13 (성능 게이트): signal extractor p50 latency가 ≤ 2ms (vitest bench, 1000-iteration deterministic).
- [ ] 시나리오 14 (비용 게이트): 본 변경 전후 동일 fixture 100건에 대해 LLM call 횟수가 동일하다 (model.generateText mock spy call count parity).

## Task 목록 (3-Phase 분리)

> 착수 전 Status가 Approved인지 확인한다. 구현 Task는 failing spec 커밋 이후 진행한다. 각 Phase는 독립 PR/커밋 세트로 분리해 회귀 격리를 보장한다.

### Phase 0 — Approval Gate

- [x] Task 0 — Draft 검토 및 Approved 전환
  - 산출물: reasonCode 카탈로그 v1 확정, intent 매핑 표 확정, trace sanitize layer 책임 확정, 변경 대상 파일 목록 동결
  - 완료 기준: 본 문서의 "reasonCode 카탈로그 v1", "Intent 매핑 표", "Trace Sanitize 책임 경계" 섹션이 구현 전 변경 없이 채택됨
  - 결과: 2026-05-12 현재 코드 기준으로 `decomposeTask()`는 이미 `isComplexQuery()` gate 뒤에서만 LLM 호출함을 확인했고, Phase 1은 trace-only로 기존 라우팅 분기 결과를 변경하지 않는 범위로 승인

### Phase 1 — Signals + Trace Skeleton (trace-only, behavior 변경 없음)

- [x] Task 1 — failing specs 작성 (시나리오 1, 12, 13)
  - 완료 기준: `QueryRoutingSignals` extractor 시나리오 1, contract parity 시나리오 12, latency bench 시나리오 13이 구현 전 실패
  - 커밋: `test(spec): add query routing signals failing tests`
- [x] Task 2 — QueryRoutingSignals 추출기 추가
  - 위치: `cloud-run/ai-engine/src/services/ai-sdk/routing/query-routing-signals.ts` (신규)
  - 완료 기준: 시나리오 1, 12, 13 통과. 기존 `selectExecutionMode`/`getIntentCategory`/`preFilterQuery`는 **호출만 추가**되고 분기 결과는 변하지 않음 (parity 보장)
  - 커밋: `feat(routing): add QueryRoutingSignals extractor (trace-only)`
- [x] Task 3 — RoutingDecisionTrace skeleton 연결
  - 위치: `cloud-run/ai-engine/src/services/ai-sdk/routing/routing-decision-trace.ts` (신규)
  - 완료 기준: mode/tool/preFilter/agent 경로에서 trace builder만 호출, reasonCode 카탈로그 사용. trace는 logger/Langfuse metadata로만 노출, response 계약 변경 없음
  - 커밋: `feat(routing): wire RoutingDecisionTrace skeleton`
- **Phase 1 회귀 게이트**: 시나리오 1, 12, 13 통과. 기존 routing/pre-filter targeted test 3 files / 82 tests, AI Engine type-check, AI Engine full test 116 files / 1148 tests 통과. 변경은 trace-only이며 response 계약 변경 없음. 시나리오 14는 Phase 2 agent routing trace 연결 시 LLM call parity로 재검증.

### Phase 2 — Decision Contract Alignment

- [x] Task 4 — pre-filter/routing 반환 contract 정렬 + 시나리오 2~7, 11 failing specs
  - 완료 기준: direct response, suggested agent, continue가 normalized `PreFilterDecision` / `AgentRoutingDecision` 타입으로 표현됨. trace sanitize assertion 두 layer에서 동시 통과
  - 커밋: `refactor(routing): align pre-filter and LLM routing decision contract`
- **Phase 2 회귀 게이트**: 시나리오 2~7, 11 통과. targeted routing decision tests 2 files / 11 tests, routing regression tests 4 files / 94 tests, AI Engine type-check, AI Engine full test 117 files / 1155 tests 통과. `routingDecisionTrace`는 sanitized metadata만 `MultiAgentResponse.metadata`에 포함하며 raw prompt/provider internals는 제외.

### Phase 3 — Context Store Structured Findings

- [x] Task 5 — Context Store structured findings 경로 추가
  - 위치: `cloud-run/ai-engine/src/services/ai-sdk/agents/agent-findings-schema.ts` (신규) + `orchestrator-context.ts` 보강
  - 완료 기준: 시나리오 8, 9 통과. structured findings 우선 저장, 미수신 시 legacy regex fallback + `findings_legacy_regex` reasonCode 기록. 기존 session memory contract 회귀 없음
  - 커밋: `feat(context): add structured findings path with legacy regex fallback`
- [x] Task 6 — 기존 fast path 회귀 검증
  - 완료 기준: Reporter Pipeline, deterministic metric peak evidence, advisor read-only guidance, 시나리오 10 (simple query decomposition gate) 모두 통과
- [x] Task 7 — 문서/TODO/QA 정리 + sunset 기준 명시
  - 완료 기준: plan task 체크, architecture note 갱신, QA tracker 기록 판단. **legacy regex sunset 기준** 후속 plan으로 명시: "structured findings 비율이 14일 이동평균 ≥ 80% 유지 후 legacy 제거 plan 별도 착수"
  - 결과: Phase 3 local deterministic 검증 완료. production/browser QA는 배포 전 변경이므로 이번 단계에서는 기록하지 않음. legacy regex sunset 기준은 본 Task 설명에 보존.

### Phase별 산출/검증 매트릭스

| Phase | LoC 상한 | Failing test 선행 | 회귀 게이트 | 비고 |
|-------|:-------:|:----------------:|------------|------|
| 1 | 600 | ✅ | 시나리오 1, 12, 13, 14 | trace-only, 분기 변경 없음 |
| 2 | 500 | ✅ | 시나리오 2~7, 11 | decision contract 정렬 |
| 3 | 600 | ✅ | 시나리오 8, 9, 10 + fast path | context store 경로 완료 |

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `docs(plan):` | 선택 | ❌ | ❌ |
| Task 1 (Phase 1 specs) | `test(spec):` | 선택 | ❌ | ❌ |
| Task 2, 3 (Phase 1 impl) | `feat(routing):` | ✅ | ✅ (Phase 1 끝에 일괄) | ❌ |
| Task 4 (Phase 2) | `refactor(routing):` | ✅ | ✅ | ❌ |
| Task 5 (Phase 3) | `feat(context):` | ✅ | ✅ | ❌ |
| Task 6 | `test:` | ✅ | 판단 필요 | ❌ |
| Task 7 | `docs:` 또는 `test(qa):` | ✅ | ❌ | ❌ |

> Cloud Run 재배포는 각 Phase 마지막에 한 번씩, 총 3회로 제한. trace-only 변경(Phase 1)은 동작 변경 없음이 단위 테스트로 보장되더라도 deployment smoke는 수행한다.

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 1 완료 후 | failing test가 routing/context 계약을 과하게 잠그지 않는지 |
| Task 3 완료 후 | trace metadata가 user-facing으로 새지 않는지, free-tier 비용 증가가 없는지 |
| Task 5 완료 후 | structured findings가 기존 session memory와 호환되는지 |
| 전체 완료 후 | Provider fallback, CB, quota, Reporter Pipeline 회귀 여부 |

## 진행 중 블로커 대응

| 상황 | 기준 |
|------|------|
| 공통 signal 추출이 기존 regex보다 오탐을 늘림 | 해당 signal은 trace-only로 먼저 제한하고 routing decision에는 미적용 |
| trace metadata가 stream/job response 계약을 깨뜨림 | internal metadata/log 전용으로 축소 |
| Context Store 구조화가 agent output 변경을 과도하게 요구 | tool result 기반 저장부터 적용하고 LLM structured output은 후속으로 분리 |
| 범위가 예상보다 2배 이상 확대 | Context Store task(Phase 3)를 별도 plan으로 분리 |
| Phase 1 contract parity 시나리오 12 실패 | signal extractor 분기 차이를 신규 reasonCode `signal_divergence`로 trace에만 기록하고, routing 결정은 기존 함수 결과 그대로 사용. parity 보정 후속 Task로 분리 |
| Phase 1 latency 시나리오 13 미달 (>2ms p50) | signal 추출을 lazy memoize로 전환하고, 미사용 signal field는 on-demand 계산 |
| Phase 3에서 legacy regex 호출이 0%로 떨어지지 않음 | sunset 미적용. measurement-only 운영 유지하면서 후속 plan에서 LLM structured output 적용 범위를 확대 |

## 검증 계획

AI Engine 변경 기준 기본 검증:

- `cd cloud-run/ai-engine && npm run type-check`
- `cd cloud-run/ai-engine && npm run test`

Root 계약 영향이 생기는 경우 추가 검증:

- `npm run test:contract`
- `npm run type-check`
- `npm run lint`

문서/계획 변경 검증:

- `npm run docs:budget`
- `npm run docs:ai-consistency`
- `git diff --check`

## 완료 기준

- [ ] 테스트 시나리오 1~14 전체 통과
- [ ] AI Engine type-check 통과
- [ ] AI Engine test 통과
- [ ] Root contract 영향 시 root 검증 통과
- [ ] routing decision trace가 mode/tool/pre-filter/agent/context 경로를 설명
- [ ] Context Store structured findings 우선 저장 경로 동작
- [ ] Reporter Pipeline, Provider fallback, Circuit Breaker, quota 정책 회귀 없음
- [ ] **정량 목표 충족**: contract parity 시나리오 12 PASS, signal extractor p50 ≤ 2ms, LLM call 횟수 변화 0
- [ ] **Trace 누출 없음**: 시나리오 11이 AI Engine `supervisor-stream-response.ts`, BFF `supervisor/route.ts` 두 layer에서 모두 PASS
- [ ] **Phase별 회귀 격리**: Phase 1, 2, 3 각각 Cloud Run 배포 후 회귀 없음 확인
- [ ] TODO.md 완료 이력 반영 후 plan archive 이동, legacy regex sunset 후속 plan 항목 backlog 등록
