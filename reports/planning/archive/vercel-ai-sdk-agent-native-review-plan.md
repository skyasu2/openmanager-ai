# Vercel AI SDK Native Agent API 전환 검토 계획

> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: ai,vercel-ai-sdk,agent,streaming,architecture,review

---

## 배경

Vercel AI SDK v6에는 멀티에이전트 패턴을 위한 네이티브 API가 있다.

```
ToolLoopAgent (= Experimental_Agent alias)
createAgentUIStream
pipeAgentUIStreamToResponse
```

현재 구현은 `ToolLoopAgent`는 이미 사용하고 있으나, 에이전트 간 라우팅·핸드오프·스트림 조립은 자체 코드로 구현되어 있다.

- **에이전트 선택**: `orchestrator-direct-routing.ts` (deterministic pre-filter)
- **handoff 기록**: `orchestrator-handoff.ts` (`recordHandoff()` 수동)
- **스트림 조립**: `orchestrator-agent-stream.ts` (async generator 루프 수동 작성)
- **UI 이벤트 포맷**: 자체 정의 (`agent-status`, `data-handoff`, `data-done` 등)

이 계획서는 SDK 네이티브 방식으로 전환할 경우의 **득실을 검토**하고, Free Tier 제약에서 현재 구조를 어떻게 개선할지 결정하기 위한 것이다.

## 공식 문서 비교 요약

| 출처 | 핵심 기준 | 현재 구조에 대한 해석 |
|------|-----------|----------------------|
| Vercel AI SDK Agents Overview | `ToolLoopAgent`는 agent loop에 적합하지만, 신뢰 가능한 반복 결과와 명시 제어가 필요하면 structured workflow를 사용 | 전문 agent 내부 loop는 유지, 상위 routing은 workflow로 유지 |
| Vercel AI SDK Workflow Patterns | Routing / Orchestrator-Worker / Evaluator-Optimizer를 별도 패턴으로 구분 | 현재는 Orchestrator-Worker가 아니라 Routing + ToolLoop Agents |
| LangChain Multi-agent Overview | multi-agent는 context management, specialization, parallelization이 필요할 때 사용. Router 패턴은 routing step이 specialized agents로 dispatch | 현재 “routing-based multi-agent workflow” 표현이 정확 |
| OpenAI Agents SDK Handoffs | handoff는 agent가 다른 agent에 conversation control을 넘길 때 적합 | 사용자와 직접 이어지는 동적 handoff가 필요할 때만 채택 |
| Azure AI Agent Orchestration Patterns | 가장 낮은 복잡도로 요구사항을 만족시키고, quota/resource 제약을 우선 고려 | Free Tier에서는 supervisor LLM 재도입보다 direct routing 강화가 적합 |

---

## SDK 네이티브 방식 개요

### 현재 방식

```
사용자 쿼리
  → selectExecutionMode() [regex]
  → resolveDirectRoutingTarget() [deterministic pre-filter]
  → BaseAgent.run() [ToolLoopAgent 내부]
  → orchestrator-agent-stream.ts [수동 yield 루프]
  → 자체 SSE 이벤트 emit
```

### SDK 네이티브 방식

```
사용자 쿼리
  → supervisorAgent (LLM) [handoff tool로 에이전트 선택]
  → transferToNlq / transferToAnalyst / ... [tool 반환값 = agent 인스턴스]
  → SDK가 자동으로 다음 에이전트 실행
  → createAgentUIStream [스트림 조립 SDK 담당]
  → pipeAgentUIStreamToResponse [응답 emit SDK 담당]
```

### 코드 대조

**현재 (자체 조립)**
```ts
// orchestrator-agent-stream.ts
async function* runOrchestratorStream(request, agentName) {
  yield { type: 'agent-status', data: { agent: agentName } };
  const agent = AgentFactory.create(agentName);
  for await (const chunk of agent.stream(request)) {
    yield chunk;
  }
  recordHandoff('Orchestrator', agentName, 'Direct routing');
  yield { type: 'handoff', data: { from: 'Orchestrator', to: agentName } };
}
```

**SDK 네이티브**
```ts
// 선언적 에이전트 정의
const nlqAgent = new ToolLoopAgent({
  model: groqModel,
  tools: { getServerMetrics, getServerMetricsAdvanced, finalAnswer },
  system: nlqSystemPrompt,
});

const supervisorAgent = new ToolLoopAgent({
  model: groqModel,
  tools: {
    transferToNlq: tool({
      description: '서버 메트릭/상태 질의',
      parameters: z.object({ reason: z.string() }),
      execute: async () => ({ agent: nlqAgent }),
    }),
    transferToAnalyst: tool({
      description: '이상 탐지/추세 분석',
      parameters: z.object({ reason: z.string() }),
      execute: async () => ({ agent: analystAgent }),
    }),
  },
});

// 스트림 조립 SDK 담당
const stream = await createAgentUIStream({
  agent: supervisorAgent,
  uiMessages: messages,
});
await pipeAgentUIStreamToResponse({ response, ...stream });
```

---

## 검토 항목

### R1. 에이전트 선택 방식 — 핵심 트레이드오프

| 항목 | 현재 (Direct Router) | SDK 네이티브 |
|------|---------------------|-------------|
| 선택 주체 | deterministic pre-filter | Supervisor LLM (handoff tool 호출) |
| Groq RPD 소모 | 0 (에이전트 선택 시) | +1 (Supervisor LLM 호출) |
| 라우팅 정확도 | regex/pre-filter 한계 | LLM 판단 — 표현 자유도 높음 |
| 방향 | Orchestrator LLM 제거 완료 | LLM 다시 투입 |

**검토 포인트**: 현재 NLQ N1 목표(intentFrame을 routing primary signal로)가 완성되면 Supervisor LLM이 이미 한 번 분류한 결과를 handoff tool로 전달하는 패턴이 가능하다. 그 시점에 SDK 네이티브 handoff 방식이 의미있어진다.

### R2. 스트림 조립 코드량

- 현재: `orchestrator-agent-stream.ts` + `orchestrator-agent-stream-helpers.ts` + `orchestrator-agent-stream-summary.ts` 합산 ~600줄
- SDK 네이티브: `createAgentUIStream` 1줄로 대체 가능한 범위가 얼마나 되는지 측정 필요
- **검토 포인트**: provider fallback (`retry-with-fallback.ts`), quota 관리, evidence card 조립, EvidenceCard/RetrievalMetadata 등 프로젝트 고유 로직이 SDK 파이프라인 안에서 어떻게 처리되는지 확인 필요

### R3. UI 이벤트 포맷 호환성

- 현재 프론트엔드(`stream-data-handler.ts`)는 자체 이벤트 포맷을 파싱한다:
  `data-agent-status`, `data-handoff`, `data-done`, `data-rag-sources` 등
- SDK 네이티브는 `UIMessage` 표준 포맷을 출력한다
- **검토 포인트**: 프론트엔드 파싱 레이어 교체 범위 측정 필요. `useAIChatCore` → `useHybridAIQuery` → `stream-data-handler.ts` 전체 영향

### R4. Free Tier 예산 영향

- SDK 네이티브 handoff = Supervisor LLM 1회 추가 소모
- Orchestrator LLM 제거로 아낀 Groq RPD를 다시 소모하는 구조
- **검토 포인트**: intentFrame 신뢰 경로(N1)가 완성된 후 Groq 호출 1회를 NLQ 분류 + handoff 결정에 묶어서 쓸 수 있는지 설계 필요

### R5. 구현 리스크

- SDK `Experimental_*` 접두사 — 아직 breaking change 가능성 있음
- `createAgentUIStream` 타입 파라미터가 복잡 (`CALL_OPTIONS`, `TOOLS`, `OUTPUT`, `MESSAGE_METADATA`)
- **검토 포인트**: SDK 버전 고정 정책과 업그레이드 비용 평가 필요

---

## 검토 결론 기록란

검토 완료일: 2026-05-16

결론: **부분 전환 보류 / 현재 Direct Router 강화**

근거:
- R1: SDK native handoff는 Supervisor LLM 1회를 다시 추가한다. Orchestrator LLM 제거로 확보한 Groq RPD 절감 효과를 되돌리므로 production 기본값으로 부적합하다.
- R2: `createAgentUIStream`은 stream 조립 boilerplate를 줄일 수 있지만, 현재 stream에는 provider fallback, quota admission, evidence card, custom metadata, output guard가 결합되어 있어 즉시 대체 범위가 작다.
- R3: 프론트엔드는 자체 `data-*` 이벤트와 metadata를 파싱한다. SDK UIMessage stream으로 바꾸면 `stream-data-handler.ts`와 sidebar metadata 계약 변경이 커진다.
- R4: Free Tier 기준에서는 “NLQ LLM 1회 → routing hint 재사용”이 “NLQ LLM + supervisor handoff LLM”보다 낫다.
- R5: AI SDK v6 최신 API는 사용할 수 있으나, native agent UI stream 전환은 별도 migration/compat layer 검증 후 진행해야 한다.

다음 단계:
- 현재 `ToolLoopAgent` 기반 전문 agent는 유지한다.
- 상위 routing은 `SemanticIntentFrame`의 `executionMode`뿐 아니라 `intent/capabilityId/inputType`을 agent target hint로 활용한다.
- regex/pre-filter는 direct response와 fallback으로 축소하고, high-confidence NLQ frame을 우선한다.

---

## 선택한 개선안 — Semantic Intent Direct Routing

### AS-IS

```text
QueryGuard + Groq NLQ
  → intentFrame.executionMode는 mode 선택에 사용
  → agent target은 Cloud Run preFilter regex가 다시 판단
```

### TO-BE

```text
QueryGuard + Groq NLQ
  → intentFrame.executionMode: single/multi mode 선택
  → intentFrame.intent/capabilityId/inputType: specialist agent hint
  → preFilter regex: direct response + fallback
```

## 계약 (Contract)

### 변경 대상 파일

- `src/lib/ai/entity-extractor.ts`
- `src/lib/ai/semantic-intent-frame.ts`
- `src/app/api/ai/nlq/extract-entities/route.ts`
- `cloud-run/ai-engine/src/core/assistant-runtime/types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러/폴백 |
|----------|-----------|-----------|-----------|
| `/api/ai/nlq/extract-entities` | `query: string` | `intentFrame.intent` 확장값 + 기존 entity payload | provider 실패 시 `confidence:0` 기존 fallback |
| `toDomainIntentFrame()` | `SemanticIntentFrame` | `DomainIntentFramePayload` | unknown/low confidence/high ambiguity는 reason code로 거부 |
| `resolveDirectRoutingTarget()` | `PreFilterResult`, optional `intentFrame/inputType` | `DirectRoutingTarget` | high-confidence frame 없음 → preFilter → Metrics fallback |
| `executeMultiAgent*()` | `MultiAgentRequest.metadata` | selected specialist agent | metadata invalid → 기존 preFilter fallback |

### 테스트 시나리오

- [x] metric_current/metric_trend semantic frame이 unknown intent로 버려지지 않고 DomainIntentFrame으로 매핑된다.
- [x] high-confidence `incident_report` frame은 regex가 metrics fallback을 제안해도 Reporter Agent를 선택한다.
- [x] high-confidence `ops_advice` frame은 Advisor Agent를 선택한다.
- [x] high-confidence `metric_trend` frame은 Analyst Agent를 선택한다.
- [x] `log_paste`/`mixed` 입력은 semantic frame이 없을 때 Analyst Agent로 간다.
- [x] frame confidence가 낮으면 기존 preFilter/fallback을 유지한다.

## Task 목록

- [x] Task 0 — plan 결론/계약 보강
- [x] Task 1 — failing spec 작성: semantic frame → agent target routing
- [x] Task 2 — implementation: NLQ intent 확장 + Cloud Run direct routing metadata 연결
- [x] Task 3 — targeted 검증 및 TODO 상태 갱신

## 완료 기준

- [x] AI Engine targeted routing tests 통과
- [x] Root targeted semantic intent tests 통과
- [x] AI Engine type-check 통과
- [x] Root type-check 통과
- [x] docs:budget / docs:ai-consistency 통과

## 검증 결과

- Root targeted: `src/lib/ai/entity-extractor.test.ts`, `src/lib/ai/semantic-intent-frame.test.ts`, `src/app/api/ai/nlq/extract-entities/route.test.ts` — 3 files / 36 tests PASS
- AI Engine targeted: `orchestrator-direct-routing.test.ts`, `routing-policy-consistency.test.ts`, `supervisor-semantic-metadata.test.ts`, `orchestrator-execution.timeout.test.ts` — 4 files / 32 tests PASS
- Root: `npm run type-check`, `npm run lint`, `npm run test:quick` PASS
- AI Engine: `npm run type-check`, `npm run test` PASS — 129 files / 1267 tests
- Docs: `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` PASS

---

## 참고 링크

- SDK 공식: `createAgentUIStream` / `pipeAgentUIStreamToResponse` — `ai` 패키지 타입 정의
- 현재 구현 SSOT:
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts`
  - `src/hooks/ai/utils/stream-data-handler.ts`
- 연관 계획서:
  - `reports/planning/nlq-preprocessing-redesign-plan.md` (N1 — 전제 조건)
  - `reports/planning/provider-quota-rebalance-plan.md` (Q3 — 전제 조건)
