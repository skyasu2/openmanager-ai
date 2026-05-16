# Vercel AI SDK Multi-Agent Conformance Plan

> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: ai,ai-sdk,multi-agent,orchestrator,cloud-run,free-tier

---

## 배경

2026-05-16 코드 기준으로 OpenManager AI Engine의 multi-agent 구현이 Vercel AI SDK v6 공식 패턴에 얼마나 부합하는지 재평가하고 1차 개선을 진행했다. 결론은 **실행 기반은 AI SDK에 잘 올라타 있으며, orchestration은 도메인 특화 custom path를 유지하되 loop/metadata 계약을 공통화하는 하이브리드 구조**다.

공식 문서 기준 핵심 축은 다음과 같다.

| 기준 | 공식 패턴 | 현재 적용 |
|------|-----------|-----------|
| Reusable Agent | `ToolLoopAgent`에 model/instructions/tools/loop 설정을 캡슐화 | `BaseAgent`는 적용, forced routing/agent stream은 `generateText`/`streamText` 직접 호출하되 loop settings SSOT 공유 |
| Loop Control | `stopWhen`, `prepareStep`, `stepCountIs`, `hasToolCall`로 tool loop 제어 | 주요 경로에 `stopWhen` 적용, `prepareStep`은 single-agent 중심, multi path는 `buildAgentLoopSettings()`로 maxSteps/stopWhen 일관화 |
| Structured Routing | `generateText + Output.object` + schema validation | Orchestrator routing/decomposition에 적용, text JSON fallback 보유 |
| Subagents | parent agent가 tool execute 함수에서 subagent를 호출 | 커스텀 Orchestrator가 함수 호출/Promise 병렬 실행. AI SDK subagent-as-tool 패턴은 미적용 |
| UI Streaming | `createUIMessageStreamResponse` 또는 `createAgentUIStreamResponse` | custom data event 때문에 `createUIMessageStreamResponse` 사용. 적절 |
| Testing | `ai/test` mock provider로 deterministic test | AI SDK mock/vi mock 기반 conformance 테스트 추가. `agentLoop` metadata와 internal-only taxonomy 검증 |

---

## 종합 평가

### 부합도 점수

| 영역 | 점수 | 판정 |
|------|:---:|------|
| AI SDK core primitive 사용 | 9/10 | `ToolLoopAgent`, `streamText`, `generateText`, `Output.object`, `UIMessageStream` 사용이 명확 |
| Agent loop 계약 일관성 | 8/10 | `BaseAgent`와 forced/stream direct 경로는 병행되지만 `buildAgentLoopSettings()`로 `maxSteps`, `stopWhen`, retry, telemetry를 공통화 |
| Multi-agent orchestration | 7/10 | Orchestrator/Worker/decomposition/parallel 실행은 구현됨. 단 AI SDK subagent-as-tool idiom과는 다름 |
| Free Tier 적합성 | 9/10 | deterministic-first, provider mesh, quota/circuit breaker, 추가 LLM loop 억제가 강점 |
| Observability/metadata | 9/10 | providerAttempts/route metadata와 stream/non-stream `routingDecisionTrace` parity를 같은 done metadata 표면으로 정렬 |
| 테스트 가능성 | 8/10 | conformance pack 추가로 forced/BaseAgent/stream loop와 factory taxonomy를 고정 |

**현재 총평: 8.6 / 10**

현재 구조는 "AI SDK와 어긋난 구현"이 아니라 **AI SDK primitive를 기반으로 도메인 특화 Orchestrator를 얹은 구조**다. 1차 개선으로 direct path와 wrapper path의 loop 계약을 좁혔고, 2차 개선으로 stream trace parity와 Reporter pipeline stage naming을 정렬했다. 남은 큰 선택지는 AI SDK subagent-as-tool PoC와 UI stream adapter 전환 여부다.

---

## 2026-05-16 3차 구조 재검토

Provider quota rebalance와 Reporter evaluator/optimizer 변경을 검토하면서, 공식 best practice와 현재 Free Tier 제약을 비교했다.

| 검토 대상 | 장점 | 단점 | 판단 |
|----------|------|------|------|
| 모든 specialist를 AI SDK subagent-as-tool로 전환 | AI SDK idiom에 더 가까움, parent/child agent 경계 명확 | LLM 호출 수와 latency 증가, Free Tier RPM 병목 확대 | 보류. 독립 장문 evidence 수집 PoC로만 검토 |
| Evaluator/Optimizer 제거 | 구조 단순화, pipeline 코드 감소 | Reporter 품질 점수/개선 기준을 잃음. 현재는 deterministic 평가라 LLM 비용이 없음 | 유지. 다만 휴리스틱은 보수화 |
| Reporter optimizer 휴리스틱 유지 | 실행 명령어가 빠르게 보강됨 | 단순 백틱 문구를 실행 가능한 조치로 과대평가할 수 있음 | command-like 패턴만 actionability로 인정 |
| Provider spider-web fallback 유지 | 단일 provider 장애/429에 대한 회복력, quota 분산 | 순서/문서 drift 위험 | 유지. `agent-runtime-policy`와 문서 검증으로 고정 |
| Reporter/Advisor maxSteps 축소 | retry storm/RPM 소모 감소 | 복잡한 요청에서 답변이 짧아질 수 있음 | 유지. 필요 시 task-specific override로만 확장 |

**공식 기준**
- Vercel AI SDK loop control: `stopWhen`, `stepCountIs`, tool loop ceiling을 명시적으로 두는 패턴을 따른다.
- Anthropic effective agents: evaluator-optimizer는 평가 기준이 명확할 때 적합하며, 단순 workflow가 충분하면 과도한 agent화를 피한다.
- Azure/Google SRE resilience: retry storm과 cascading failure 방지를 위해 circuit breaker, retry budget, provider fallback의 증폭 방지가 필요하다.

따라서 현재 개선 방향은 **Agent-as-tool 전면 전환이 아니라, 기존 custom Orchestrator를 유지하면서 loop ceiling, provider order, deterministic evaluator를 더 엄격히 관리하는 구조**다.

---

## 개선 필요한 부분

이 섹션은 실제 장애·회귀·운영 혼선을 줄이기 위해 필요한 작업이다.

### P1. Agent loop 설정 SSOT화

**문제**
- `BaseAgent.createToolLoopAgent()`는 `ToolLoopAgent`를 사용한다.
- `executeForcedRouting()`은 `generateTextWithRetry()`를 직접 호출한다.
- `executeAgentStream()`은 `streamText()`를 직접 호출한다.
- 세 경로 모두 `stopWhen`을 쓰지만 `maxSteps`, temperature, token cap, timeout, provider retry 표현이 각자 다르다.

**개선 계약**
- `agent-runtime-policy.ts`를 기준으로 `buildAgentLoopSettings(agentName, surface)` helper를 만든다.
- non-stream/stream/forced 경로가 같은 `maxSteps`, stop conditions, output token cap 기준을 공유한다.
- AI SDK 내부 retry 증폭 방지(`maxRetries: 0|1`) 정책을 경로별로 문서화하고 테스트한다.

### P1. Forced routing과 BaseAgent 경로의 결과 metadata 정규화

**문제**
- `BaseAgent.run()` 결과는 `steps`, `finishReason`, `fallbackUsed` 중심이다.
- forced routing 결과는 `totalRounds`, `providerAttempts`, `usedFallback` 중심이다.
- stream 경로는 사용자 이벤트 중심이라 non-stream의 `routingDecisionTrace`와 완전히 같은 표면을 보장하지 않는다.

**개선 계약**
- supervisor 최종 metadata에 아래 필드를 표준화한다.

```text
agentLoop: {
  implementation: "tool-loop-agent" | "core-generate-text" | "core-stream-text" | "deterministic-pipeline",
  stopReasons: string[],
  maxSteps: number,
  stepsExecuted: number
}
providerAttempts?: ProviderAttemptTelemetry[]
routingDecisionTrace?: sanitized trace
```

### P1. Evaluator/Optimizer 공개 agent 가용성 오해 제거

**문제**
- `AGENT_CONFIGS` 주석은 Evaluator/Optimizer가 deterministic pipeline 내부 단계라고 설명한다.
- 하지만 `AgentFactory.getAvailabilityStatus()`는 `config.getModel() !== null`만 보므로 내부 단계도 사용 가능 agent처럼 보일 수 있다.

**개선 계약**
- `AgentConfig`에 `visibility: 'routable' | 'pipeline-internal'` 또는 동등한 필드를 추가한다.
- `AgentFactory.getAvailableTypes()`와 `getAvailabilityStatus()`가 internal stage를 public-routable로 표시하지 않도록 고정한다.
- UI/metadata에서는 `Evaluator/Optimizer Agent`가 아니라 `Reporter Pipeline: evaluator/optimizer stage`로 노출한다.

### P1. AI SDK conformance test pack 추가

**필수 테스트 시나리오**
- forced routing, BaseAgent, stream 경로가 모두 `hasToolCall('finalAnswer') + stepCountIs(policy.maxSteps)` 계약을 사용한다.
- forced routing 실패 시 provider fallback attempt가 public-safe metadata로 남는다.
- stream/non-stream multi 경로가 같은 `finalAgent`, `handoffCount`, `provider/modelId`, `routingDecisionTrace` shape를 갖는다.
- raw tool-call JSON은 사용자 본문으로 노출되지 않는다.
- Evaluator/Optimizer는 public routing availability에서 제외된다.

---

## 개선 가능한 부분

이 섹션은 품질·표준 부합도는 높이지만, 현재 Free Tier/latency/복잡도 조건에서 즉시 필수는 아니다.

### O1. Subagent-as-tool 패턴의 제한적 도입

AI SDK 공식 subagent 패턴은 parent agent가 tool을 통해 subagent를 호출하는 구조다. 현재는 custom Orchestrator가 직접 specialist 함수를 호출한다.

**적용 후보**
- 장문 로그 분석처럼 context isolation 이득이 큰 작업
- 독립 evidence 수집 후 요약만 parent로 돌려주는 작업

**보류 이유**
- subagent는 latency와 LLM 호출 수를 늘린다.
- 현재 provider Free Tier에서는 default 병렬 subagent가 RPM 병목을 키울 수 있다.

### O2. `createAgentUIStreamResponse` 전환 검토

현재 custom `createUIMessageStreamResponse`는 handoff/status/tool/result data event를 세밀하게 제어한다. AI SDK `createAgentUIStreamResponse`는 더 idiomatic하지만, 현재 커스텀 이벤트 표면을 그대로 흡수하려면 adapter가 필요하다.

**판정**: 당장 전환하지 않는다. `Agent` interface wrapper가 자연스럽게 정리된 뒤 비교한다.

### O3. AI SDK DevTools local-only 관측

공식 DevTools는 multi-step run/step/tool 호출을 보기 좋게 확인할 수 있다. 다만 민감 payload와 local-only 제약이 있으므로 production에는 넣지 않는다.

**적용 후보**
- local smoke/debug 전용 opt-in script
- `.devtools/` gitignore 유지

### O4. Mock provider 기반 path parity benchmark

실 LLM 호출 없이 `ai/test` mock model로 아래를 비교한다.

- single vs multi route selection
- forced vs structured routing fallback
- stream vs non-stream metadata
- provider retry amplification 없음

---

## 제외 범위

| 항목 | 제외 이유 |
|------|----------|
| LangGraph/AutoGen 전환 | 현재 시스템은 TS 코드 중심 deterministic-first 제어가 핵심이며, 외부 graph runtime은 과함 |
| 모든 multi-agent 요청의 병렬 subagent화 | Free Tier RPM/latency 리스크가 큼 |
| paid provider/model 도입 | 프로젝트 Free Tier 원칙 위반 |
| provider-native reasoning 기본 활성화 | token/trace 비용 증가, 현재 답변 품질 이슈의 직접 원인이 아님 |
| 실 LLM 반복 QA를 CI에 포함 | 자동 CI는 외부 LLM 호출 금지 원칙 유지 |

---

## 작업 계획

## 구현 계약

### 변경 대상 파일

| Task | 파일 | 계약 |
|------|------|------|
| T1 | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-loop-settings.ts` | agent loop 설정의 SSOT. `stopWhen`, `maxSteps`, `maxOutputTokens`, `maxRetries`, `implementation` metadata를 surface별로 반환 |
| T1 | `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent.ts` | `ToolLoopAgent` 생성 시 `buildAgentLoopSettings(..., 'tool-loop-agent')` 사용. 기존 public result shape 유지 |
| T1 | `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts` | forced routing `generateTextWithRetry` 호출 시 같은 stop/max settings 사용. provider fallback 동작 유지 |
| T1 | `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts` | stream direct path `streamText` 호출 시 같은 stop/max settings 사용. raw tool-call suppression 유지 |
| T3 | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.ts` | `AgentConfig.visibility` 추가. 기본 routable, Evaluator/Optimizer는 `pipeline-internal` |
| T3 | `cloud-run/ai-engine/src/services/ai-sdk/agents/agent-factory.ts` | public availability 계열에서 pipeline-internal stage 제외. 직접 `create('evaluator')` 호환은 유지하지 않고 `null` 반환 |
| T4 | `docs/reference/architecture/ai/ai-engine-architecture.md` | 구현 완료 후 conformance 표와 residual risk 갱신 |

### Backward Compatibility

| 표면 | 유지 | 변경 |
|------|------|------|
| `SupervisorResponse.metadata.stepsExecuted` | 유지 | 내부적으로 `agentLoop.stepsExecuted`를 추가할 수 있으나 기존 필드는 삭제하지 않음 |
| `MultiAgentResponse.metadata.totalRounds` | 유지 | `agentLoop.maxSteps`/`implementation` 추가 가능 |
| `providerAttempts` | 기존 non-stream 필드 유지 | stream path는 동일 shape로 추가 가능 |
| `AgentFactory.create('nlq'|'analyst'|'reporter'|'advisor'|'vision')` | 유지 | 없음 |
| `AgentFactory.create('evaluator'|'optimizer')` | 기존에는 생성 가능했으나 실제 LLM agent가 아니므로 `null` 반환으로 정정 | public API 오해 제거 목적 |
| UI data events | 기존 `data-*` 이벤트 유지 | 이번 단계에서 `createAgentUIStreamResponse`로 전환하지 않음 |

### 테스트 파일

| Task | 테스트 파일 | Assertion |
|------|-------------|-----------|
| T1 | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-loop-settings.test.ts` | agent별 maxSteps, implementation, stopWhen helper가 policy를 따른다 |
| T1 | `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.test.ts` | forced routing이 `stepCountIs(getAgentMaxSteps(agent))`로 호출된다 |
| T1 | `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts` | stream path가 policy maxSteps와 maxOutputTokens를 사용한다 |
| T3 | `cloud-run/ai-engine/src/services/ai-sdk/agents/agent-factory.test.ts` | Evaluator/Optimizer가 public availability와 direct create에서 제외된다 |
| T3 | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.test.ts` 또는 기존 config 테스트 | pipeline-internal visibility가 명시된다 |

### T0. Failing conformance tests 먼저 추가

- [x] `agent-runtime-policy` 기반 stopWhen/maxSteps 계약 테스트
- [x] forced routing vs BaseAgent metadata parity 테스트
- [x] stream vs non-stream done metadata shape 테스트
- [x] Evaluator/Optimizer internal-only availability 테스트
- [x] raw tool-call JSON suppression 테스트

### T1. Agent loop settings helper 도입

- [x] `buildAgentLoopSettings(agentName, surface)` 추가
- [x] `BaseAgent`, `executeForcedRouting`, `executeAgentStream`에서 공통 helper 사용
- [x] retry amplification 방지 옵션을 helper 결과와 함께 문서화

### T2. Multi-agent metadata 표준화

- [x] `agentLoop` metadata 추가
- [x] `providerAttempts` shape를 stream/non-stream에서 통일
- [x] `routingDecisionTrace`를 stream done event에도 표준 포함

### T3. Pipeline internal stage taxonomy 정리

- [x] `AgentConfig.visibility` 또는 동등 필드 추가
- [x] Evaluator/Optimizer public availability 제외
- [x] Reporter pipeline UI/metadata naming 정렬

### T4. 문서/QA 정리

- [x] `ai-engine-architecture.md` conformance 표 갱신
- [x] mock provider 기반 AI SDK conformance QA 기록
- [x] `docs:ai-consistency`, AI Engine type/test, root contract gate 실행

### 2026-05-16 1차 구현 검증 결과

| Command | Result |
|---------|--------|
| `cloud-run/ai-engine npm run test -- --run agent-loop-settings/agent-runtime-policy/agent-factory/orchestrator-routing/orchestrator-agent-stream` | PASS, 5 files / 79 tests |
| `cloud-run/ai-engine npm run type-check` | PASS |
| `cloud-run/ai-engine npm run test` | PASS, 127 files / 1234 tests |
| `npm run docs:budget` | PASS |
| `npm run docs:ai-consistency` | PASS |
| `npm run docs:links:internal` | PASS |
| `npm run test:contract` | PASS, 3 files / 24 tests |
| `npm run type-check` | PASS |
| `git diff --check` | PASS |

### 2026-05-16 2차 구현 검증 결과

| Command | Result |
|---------|--------|
| `cloud-run/ai-engine npm run test -- --run orchestrator-execution.timeout reporter-pipeline` | PASS, 2 files / 27 tests |
| `cloud-run/ai-engine npm run test -- --run orchestrator-agent-stream orchestrator-routing orchestrator-execution.timeout reporter-pipeline` | PASS, 4 files / 64 tests |
| `cloud-run/ai-engine npm run type-check` | PASS |
| `cloud-run/ai-engine npm run test` | PASS, 127 files / 1237 tests |
| `npm run test:contract` | PASS, 3 files / 24 tests |
| `npm run docs:budget` | PASS |
| `npm run docs:ai-consistency` | PASS |
| `npm run docs:links:internal` | PASS |
| `npm run type-check` | PASS |
| `git diff --check` | PASS |

### 2026-05-16 3차 구조 재검토 및 quota rebalance 검증 결과

| Command | Result |
|---------|--------|
| `cloud-run/ai-engine npx vitest run src/services/ai-sdk/agents/config/agent-runtime-policy.test.ts src/services/ai-sdk/agents/config/agent-model-selectors.test.ts src/services/ai-sdk/agents/config/agent-loop-settings.test.ts src/services/ai-sdk/provider-model-policy.test.ts src/services/ai-sdk/provider-model-metadata.test.ts src/services/ai-sdk/agents/orchestrator-routing.test.ts` | PASS, 6 files / 61 tests |
| `cloud-run/ai-engine npx vitest run src/tools-ai-sdk/incident-evaluation-tools.test.ts src/services/ai-sdk/agents/reporter-pipeline.test.ts` | PASS, 2 files / 41 tests |
| `cloud-run/ai-engine npx vitest run src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/model-provider.verifier-context.test.ts` | PASS, 2 files / 10 tests |
| `cloud-run/ai-engine npm run type-check` | PASS |
| `cloud-run/ai-engine npm run test` | PASS, 127 files / 1243 tests |
| `npm run docs:budget` | PASS |
| `npm run docs:ai-consistency` | PASS |
| `git diff --check` | PASS |

---

## SDD 게이트

이 계획은 AI stream/tool schema, multi-agent metadata, public agent taxonomy에 영향을 줄 수 있는 **계약 변경**이다. 따라서 구현 전 아래를 완료해야 한다.

- [x] T0 failing tests를 먼저 추가한다.
- [x] `agentLoop` metadata shape와 호환 필드 유지 범위를 확정한다.
- [x] stream/non-stream parity에서 기존 UI가 읽는 필드의 backward compatibility를 표로 고정한다.
- [x] Status를 `Approved`로 변경한 뒤 구현한다.

---

## 검증 게이트

```bash
cd cloud-run/ai-engine && npm run type-check
cd cloud-run/ai-engine && npm run test
npm run test:contract
npm run docs:ai-consistency
git diff --check
```

실 provider smoke는 기본 게이트가 아니다. 필요 시 Free Tier 한도 내에서 단일 targeted smoke만 수행한다.
