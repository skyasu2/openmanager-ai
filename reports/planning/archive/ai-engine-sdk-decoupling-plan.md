> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-06
> Tags: ai-assistant,portable-core,sdk-decoupling,vercel-ai-sdk,refactoring

# AI Engine SDK Decoupling Plan

- 상태: Completed
- 작성일: 2026-05-06
- TODO.md 연결: Recent Completed > AI Engine SDK decoupling

## 배경

`ai-assistant-portable-core-domain-pack-plan` + `ai-engine-supervisor-domain-wiring-plan` 완료로
도메인 레이어 분리는 달성됐다. 그러나 코드 분석 결과 아래 두 곳에 Vercel AI SDK 결합이
잔류하고 있으며, 향후 SDK 교체 시 이 지점이 유일한 수정 범위가 된다.

```
현재 결합 지도:

core/assistant-runtime/        → AI SDK 의존 0  ✅
domains/monitoring/            → ToolSet 타입 누수 1곳  ⚠️  ← Task 1
services/ai-sdk/
  assistant-runtime-host.ts   → ToolSet, PrepareStepFunction  ✅ (변환 담당자로 올바름)
  supervisor-stream.ts        → streamText() 직접 호출  ⚠️  ← Task 2
  supervisor-single-agent.ts  → generateText() 직접 호출  ⚠️  ← Task 2
```

## 목표

1. `domains/monitoring/` 이 Vercel AI SDK 타입을 전혀 모르는 상태로 만든다.
2. LLM 실행(`streamText` / `generateText`)을 `AssistantRuntimeHost` 경계 안으로 옮겨,
   SDK 교체 시 수정 범위를 execution adapter 1개 파일로 고정한다.

**불변 조건**: 현재 production 동작(provider fallback, circuit breaker, quota, tool filtering,
prepareStep)은 한 줄도 바뀌지 않는다. 순수 behavior-preserving migration이다.

## 범위

### 포함

- `domains/monitoring/tool-registry.ts` → `ToolSet` 제거, `ToolDefinition[]` 반환으로 변경
- `AssistantRuntimeHost` 인터페이스에 `executeLLMStream()` / `executeLLMGenerate()` 추가
- `monitoring-runtime-host.ts`의 execution adapter에서 Vercel AI SDK 구현 제공
- `supervisor-stream.ts` / `supervisor-single-agent.ts` → runtime host 경유로 전환

### 제외

- provider fallback chain 변경 (그대로 유지)
- 실제 다른 LLM SDK 도입 (이 plan은 준비 작업만)
- BFF / Frontend 변경 없음

## 계약 (Contract)

### Task 1 — domain ToolSet 누수 제거

**변경 전:**
```typescript
// domains/monitoring/tool-registry.ts
import type { ToolSet } from 'ai';
export const MONITORING_AGENT_TOOL_REGISTRY: Record<AgentToolName, ToolSet[string]>
```

**변경 후:**
```typescript
// domains/monitoring/tool-registry.ts
import type { ToolDefinition } from '../../core/assistant-runtime';
export const MONITORING_AGENT_TOOL_REGISTRY: Record<AgentToolName, ToolDefinition>
```

ToolDefinition → ToolSet 변환은 `assistant-runtime-host.ts`의 기존 `createDomainToolSet()`이
이미 담당하므로 로직 변경 없음.

### Task 2 — LLM execution 추상화

`AssistantRuntimeExecutionAdapter`에 필수 메서드 추가:

```typescript
interface AssistantRuntimeExecutionAdapter {
  createToolSet(...): ToolSet;                            // 기존
  createSystemPrompt?(...): string;                       // 기존
  createPrepareStep?(...): ...;                           // 기존
  // 신규 (필수 — 미제공 시 throw. fallback 경로 없음)
  executeLLMStream(params: AiSdkStreamExecutionParams): AiSdkStreamExecutionResult;
  executeLLMGenerate(params: AiSdkGenerateExecutionParams): AiSdkGenerateExecutionResult;
}
```

`AiSdkStreamExecutionParams` / `AiSdkGenerateExecutionParams` 명명 원칙:
- ~~`LLMStreamParams`~~ — "SDK-agnostic"이라는 이름이 부정확. 실제 타입은
  `Parameters<typeof streamText>` / `ModelMessage` / `ToolSet` 기반으로 Vercel AI SDK에 묶여 있음.
- 이름을 `AiSdkStreamExecutionParams` 계열로 솔직하게 표현한다.
- 진짜 SDK-neutral 계약이 필요해질 시점에 별도 인터페이스를 추가한다.

**핵심 설계 원칙:**
- `supervisor-stream.ts` / `supervisor-single-agent.ts`는 직접 AI SDK execution을 호출하지
  않는다. runtime host에 execution adapter가 없으면 **명시적으로 throw**한다.
  (~~"미제공 시 기존 직접 호출 경로 유지"~~ — 구현 확인 결과 throw가 올바른 동작이며 계획서가 잘못됐었음)
- monitoring execution adapter가 Vercel AI SDK `streamText`/`generateText`를 감싸서 구현을
  제공한다.

### Task 4.5 — allTools drift guard (신규)

`monitoring-runtime-host.ts`의 `createToolSet()`은 현재 `allTools`(production 전체 tool set)를
그대로 반환한다. `monitoringDomainPack.tools`(domain pack tool registry)와 drift가 생기면
domain pack이 아는 tool과 실제 실행 가능한 tool이 달라진다.

**추가할 guard:**
```typescript
// monitoring-runtime-host.ts 또는 별도 test
// monitoringDomainPack.tools.listTools()의 name 목록이
// allTools의 key 집합에 모두 포함됨을 startup 또는 test에서 검증
```

이 guard는 별도 실행 코드가 아니라 **CI test**로 추가한다.
drift 발생 시 빌드가 실패하도록 해서 도메인 tool 추가/삭제 시 양쪽을 함께 갱신하도록 강제한다.

### 테스트 시나리오

**Task 1:**
- `domains/monitoring/tool-registry.ts`가 `'ai'` 패키지를 import하지 않는다 (정적 import guard)
- `MONITORING_AGENT_TOOL_REGISTRY`의 각 항목이 `ToolDefinition` 계약을 만족한다

**Task 2:**
- monitoring execution adapter의 `executeLLMStream` 호출 시 기존 `streamText` 결과와
  동일한 stream이 반환된다 (mock 기반)
- `executeLLMStream`이 없는 host로 supervisor를 실행하면 즉시 throw한다 (~~fallback guard~~ → throw guard)
- `supervisor-stream.ts`의 provider fallback / circuit breaker 경로가 회귀 없이 통과한다

**Task 4.5:**
- `monitoringDomainPack.tools.listTools()` 반환 name 집합 ⊆ `Object.keys(allTools)` 검증
- drift 발생 시 CI 실패

## Task 목록

- [x] Task 0 — failing specs 작성 (Task 1·2 계약 기반)
- [x] Task 1 — `domains/monitoring/tool-registry.ts` ToolSet 누수 제거
- [x] Task 2 — `AssistantRuntimeExecutionAdapter`에 LLM execution 추상화 추가
- [x] Task 3 — `monitoring-runtime-host.ts` execution adapter에 구현 제공
- [x] Task 4 — `supervisor-stream.ts` / `supervisor-single-agent.ts` host 경유로 전환
- [x] Task 4.5 — `LLMStreamParams` → `AiSdkStreamExecutionParams` 리네임 + allTools drift guard 추가
- [x] Task 5 — targeted/full validation, AI Engine full npm test, plan 완료 처리

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|------------|-------------|------------------|---------------|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1 | `refactor(ai):` | ✅ | ❌ | ❌ |
| Task 2~3 | `refactor(ai):` | ✅ | ❌ | ❌ |
| Task 4 | `refactor(ai):` | ✅ | ✅ | ❌ |
| Task 5 | `docs:` | ✅ | 판단 필요 | ❌ |

## 코드리뷰 게이트

| 시점 | 확인 항목 |
|------|-----------|
| Task 0 후 | import guard spec이 `ToolSet` 누수를 정확히 탐지하는지 |
| Task 1 후 | domain pack이 `'ai'` import를 가지지 않는지, 기존 tool 등록 동작이 유지되는지 |
| Task 2 후 | `LLMStreamParams` 계약이 monitoring 도메인 용어를 포함하지 않는지 |
| Task 4 후 | provider fallback, circuit breaker, quota tracking, web search 재실행 경로 회귀 없는지 |

## 완료 기준

- `domains/` 아래 어떤 파일도 `from 'ai'` import를 가지지 않는다
- `supervisor-stream.ts` / `supervisor-single-agent.ts`의 `streamText` / `generateText`
  직접 호출이 `host.executeLLMStream()` / `host.executeLLMGenerate()` 경유로 전환된다
- execution params 타입명이 `AiSdkStreamExecutionParams` 계열로 정직하게 표현된다
- `monitoringDomainPack.tools` ↔ `allTools` drift guard가 CI test로 추가된다
- AI Engine `type-check` + `npm test` 전체 통과 (워크트리 미커밋 상태에서 실행 필수)
- root `type-check`, `lint`, `test:quick`, `test:contract` 통과
- production behavior 회귀 없음 (targeted supervisor/stream suite 전량 통과)

## 선택적 후속 고려 (이 plan 범위 밖)

AI SDK middleware / telemetry (`wrapLanguageModel`, built-in middleware) 활용:
- provider reasoning 추출이나 공통 default setting을 middleware로 이동 가능
- 현재 Langfuse/custom logging 방식이 틀린 건 아니므로 즉시 필요하지 않음
- 별도 plan에서 결정

## 원상 복구 목표

```
baseline HEAD: 853f3677b
baseline version: v8.11.109
```

Task 4 이후 회귀 발생 시 Task 4 커밋 단위로 revert. `git reset --hard` 사용 금지.

## 진행 로그

- 2026-05-06: 코드 분석 기반으로 계획서 초안 작성. 기존 portable core/domain wiring plan
  완료 후 잔류 SDK 결합 2건을 식별. Task 1은 71줄 파일 1개 수정, Task 2~4는
  supervisor-stream(1385줄) / supervisor-single-agent(742줄) 전환.
  SDD 규칙에 따라 Task 0 failing spec부터 시작.
- 2026-05-06: Contract 섹션을 구현 착수 가능 수준으로 확인하고 Status를 In Progress로
  전환. Task 0 정적/호스트 계약 spec부터 추가.
- 2026-05-06: `domains/monitoring`의 `ai` type import를 제거하고, LLM execution을
  `AssistantRuntimeHost.executeLLMStream/executeLLMGenerate` 경유로 이동. Monitoring
  host가 AI SDK `streamText/generateText` adapter를 제공하도록 정리했다.
- 2026-05-06: 검증 완료. Targeted contract/domain/supervisor tests `4 files / 30 tests`,
  AI Engine `type-check`, AI Engine full test `102 files / 1045 tests`, root `type-check`,
  `lint`, `test:quick`, `test:contract`, `docs:budget`, `docs:ai-consistency`, `git diff --check`
  통과. production 배포는 수행하지 않았다.
- 2026-05-06: Codex 사후 분석(워크트리 미커밋 상태)에서 4개 정합성 문제 식별.
  plan 교정 반영:
  (1) fallback 경로 서술 → throw로 수정 (구현이 올바르고 plan이 잘못됐었음)
  (2) `LLMStreamParams` → `AiSdkStreamExecutionParams` 리네임 필요 (SDK-agnostic 표기 부정확)
  (3) `allTools` ↔ `monitoringDomainPack.tools` drift guard Task 4.5로 추가
  (4) AI SDK middleware는 선택적 후속으로 분리
  Status를 In Progress로 되돌림. Task 4.5 + Task 5 완료 후 다시 Completed.
- 2026-05-06: Task 4.5와 Task 5 완료. Execution params/result 타입명을
  `AiSdkStreamExecutionParams` / `AiSdkGenerateExecutionParams` 계열로 교정하고,
  `monitoringDomainPack.tools.listTools()`가 production `allTools` key 집합에 포함되는지
  contract test로 고정했다. 검증: targeted contract/domain/supervisor tests `4 files / 19 tests`,
  AI Engine `type-check`, AI Engine full test `102 files / 1046 tests`, root `type-check`,
  `lint`, `test:quick`, `test:contract`.
