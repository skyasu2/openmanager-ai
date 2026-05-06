> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-06
> Tags: ai-assistant,portable-core,precomputed-state,domain-data-source,multi-agent

# AI Engine Precomputed-State Decoupling Plan

- 상태: Completed
- 작성일: 2026-05-06
- TODO.md 연결: Recent Completed #307
- 선행 완료:
  - [archive/ai-engine-agent-registry-plan.md](archive/ai-engine-agent-registry-plan.md) — AgentRole/AgentRoleRegistry 계약

## 배경

```
현재 잔류 결합:

agents/orchestrator-routing.ts      ← getCurrentState()      서버 상태로 라우팅 결정
agents/orchestrator-execution.ts    ← getKSTDateTime()        시스템 프롬프트 날짜
agents/reporter-pipeline.ts         ← getCurrentState()       보고서 데이터
                                    ← getRecentHistory(6)     1시간 히스토리
agents/reporter-pipeline-report.ts  ← getCurrentState()       보고서 상세
                                    ← getRecentHistory()      히스토리 상세
agents/orchestrator-summary-payload.ts
                                  ← tools-ai-sdk/server-metrics/data.ts
                                     경유 precomputed-state 우회 결합
```

이 4곳이 `precomputed-state`를 직접 import하면, 새 도메인(주식/여행/인사)을 붙일 때
orchestrator 레이어 전체가 "서버 모니터링 데이터"에 고정된다.

단, 아래는 **올바른 결합**이므로 건드리지 않는다:
- `tools-ai-sdk/*.ts` — monitoring tool 구현체이므로 직접 데이터 접근이 맞음
- `domains/monitoring/resource-catalog.ts` — domain이 자신의 카탈로그를 소유
- `domains/monitoring/supervisor-prompt.ts` — `getKSTDateTime()` 1곳 (Task 1에서 분리)

## 목표

1. `getKSTDateTime()`을 `precomputed-state` 비의존 시간 유틸리티로 분리한다.
2. `DomainDataSource` 계약을 Core에 추가해 orchestrator가 도메인 데이터를 추상화된 방식으로 접근하게 한다.
3. `orchestrator-routing` / `reporter-pipeline` 이 직접 `precomputed-state`를 import하지 않도록 전환한다.
4. 기존 monitoring multi-agent의 외부 동작과 응답 계약은 바뀌지 않는다.

완료 후 달성되는 상태:

```
새 도메인 붙이기 = domain pack 파일 묶음 1개와 data adapter 작성
  AssistantDomain:
    routingPolicy    ✅ (이미 분리)
    tools            ✅ (이미 분리)
    artifacts        ✅ (이미 분리)
    facts            ✅ (이미 분리)
    agentRoles       ✅ (이미 분리)
    dataSource       ← 이번 plan
```

이 plan 완료 후에도 `orchestrator-routing.ts`의 resource catalog file read와 routing
prompt/schema의 monitoring wording은 후속 결합 지점으로 남는다. 이번 plan의 목표는
precomputed-state/data helper 의존을 domain data source 경계로 이동하는 것이다.

## 범위

### 포함

- `lib/time-utils.ts` 신규 — `getKSTDateTime()` precomputed-state 비의존 구현
- `data/precomputed-state.ts` — 기존 `getKSTDateTime()` re-export 호환 유지
- `core/assistant-runtime/types.ts` — `DomainDataSource`, `DomainSnapshot`, `DomainHistoryEntry` 추가
- `AssistantDomain`에 `dataSource?: DomainDataSource` 선택 필드 추가
- `domains/monitoring/domain-pack.ts` — `monitoringDataSource` 구현 + domain pack 연결
- `agents/` 직접 import 4개 파일 — context/dataSource 경유로 전환
- `agents/orchestrator-summary-payload.ts` / `orchestrator-summary-fallback.ts` — current-state fallback의 transitive server-metrics data 결합 제거
- `agents/orchestrator-agent-stream.ts` — deterministic current-state fallback 호출에 dataSource context 전달
- `domains/monitoring/supervisor-prompt.ts` — `getKSTDateTime` → `lib/time-utils` 전환

### 제외

- `tools-ai-sdk/*.ts` precomputed-state 의존 (올바른 결합, 건드리지 않음)
- `domains/monitoring/resource-catalog.ts` (domain 소유 카탈로그, 건드리지 않음)
- orchestrator routing 의사결정 로직 변경
- resource catalog 직접 file read 제거
- provider fallback / circuit breaker 변경

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/lib/time-utils.ts`
- `cloud-run/ai-engine/src/lib/time-utils.test.ts`
- `cloud-run/ai-engine/src/data/precomputed-state.ts`
- `cloud-run/ai-engine/src/core/assistant-runtime/types.ts`
- `cloud-run/ai-engine/src/core/assistant-runtime/index.ts`
- `cloud-run/ai-engine/src/core/assistant-runtime/assistant-runtime.contract.test.ts`
- `cloud-run/ai-engine/src/domains/monitoring/domain-pack.ts`
- `cloud-run/ai-engine/src/domains/monitoring/domain-pack.contract.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/assistant-runtime-host.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/assistant-runtime-host.contract.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-wiring.contract.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent-types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-pipeline.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-pipeline.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-pipeline-report.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-summary-payload.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-summary-fallback.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-summary-fallback.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts`

### 명시적 비대상 파일

- `cloud-run/ai-engine/src/tools-ai-sdk/**/*.ts`
  - monitoring tool 구현체는 monitoring data 접근이 맞으므로 직접 precomputed-state 의존을 유지한다.
- `cloud-run/ai-engine/src/domains/monitoring/resource-catalog.ts`
  - monitoring domain-owned catalog로 유지한다.
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts`의 resource catalog file read
  - 현재 구조화 topology fallback의 별도 결합 지점이며 follow-up으로 분리한다.
- provider fallback, circuit breaker, quota, model policy 파일
  - 동작 변경 금지.

### Task 1 — 시간 유틸리티 분리

```typescript
// lib/time-utils.ts — precomputed-state 비의존
export function getKSTDateTime(): {
  date: string;       // "2026-05-06"
  time: string;       // "14:30"
  slotIndex: number;  // 0~143
  minuteOfDay: number;
}
```

precomputed-state의 기존 `getKSTDateTime()`과 동일한 반환 형태.
`precomputed-state`에서는 이 유틸리티를 re-export해 기존 호출자 호환성 유지.

### Task 2 — DomainDataSource 계약 (Core)

```typescript
// core/assistant-runtime/types.ts 추가

export interface DomainSnapshot {
  timestamp: string;
  data: unknown;
}

export interface DomainHistoryEntry {
  timestamp: string;
  slotIndex?: number;
  data: unknown;
}

export interface DomainDataSource {
  /**
   * 현재 시점 스냅샷 반환.
   * monitoring → PrecomputedSlot
   * 주식 → 현재 포트폴리오 상태
   * 인사 → 현재 조직 상태
   */
  snapshot(context: AssistantRequestContext): Promise<DomainSnapshot>;

  /**
   * 최근 N개 히스토리 반환.
   * monitoring → getRecentHistory(count)
   * 주식 → 최근 N개 거래 기록
   */
  history(
    count: number,
    context: AssistantRequestContext
  ): Promise<DomainHistoryEntry[]>;
}

// AssistantDomain 확장
export interface AssistantDomain {
  id: string;
  version: string;
  instructions: DomainInstructionSet;
  routingPolicy: RoutingPolicy;
  tools: ToolRegistry;
  artifacts?: ArtifactRegistry;
  facts?: FactPackBuilder;
  agentRoles?: AgentRoleRegistry;
  dataSource?: DomainDataSource;   // ← 신규
}
```

**설계 원칙:**
- `DomainSnapshot.data`와 `DomainHistoryEntry.data`는 `unknown`으로 받는다.
  domain마다 데이터 형태가 다르므로 Core가 구체적인 구조를 알 필요가 없다.
- `dataSource`가 없으면 orchestrator는 빈 snapshot / 빈 history로 동작한다.
  monitoring처럼 데이터가 필수인 domain은 반드시 구현을 제공해야 한다.
- `dataSource` 호출 실패는 orchestrator 전체 실패로 전파하지 않는다. 호출부는 logger warning 후
  빈 snapshot/history fallback을 사용한다.

### Task 3 — Monitoring DataSource 구현

```typescript
// domains/monitoring/domain-pack.ts 또는 별도 monitoring-data-source-adapter.ts

export const monitoringDomainDataSource: DomainDataSource = {
  async snapshot(_context): Promise<DomainSnapshot> {
    const state = getCurrentState();          // precomputed-state
    return {
      timestamp: getKSTDateTime().date,
      data: state,
    };
  },
  async history(count, _context): Promise<DomainHistoryEntry[]> {
    return getRecentHistory(count).map((slot) => ({
      timestamp: slot.timestamp ?? '',
      slotIndex: slot.slotIndex,
      data: slot,
    }));
  },
};

// monitoringDomainPack에 추가
export const monitoringDomainPack: AssistantDomain = {
  ...
  dataSource: monitoringDomainDataSource,   // ← 추가
};
```

### Task 4 — Orchestrator Context 주입

orchestrator에 dataSource를 흘려보내는 경로:

```
SupervisorRequest.runtimeHost.domain.dataSource
  → resolveSupervisorRuntimeContext()
  → OrchestratorContext.dataSource
  → orchestrator-routing.ts / reporter-pipeline.ts
```

`OrchestratorContext`에 `dataSource?: DomainDataSource` 추가.
이미 `runtimeHost`가 context에 있으므로 추가 배선 비용이 낮다.

구현상 `MultiAgentRequest`와 `AgentRunOptions`에도 `dataSource?: DomainDataSource`를
추가한다. Supervisor stream/single-agent는 `runtimeContext.host.domain.dataSource`를
multi-agent request에 전달하고, agent 실행 경로는 options로 전달한다.

### Task 5 — agent 4개 파일 전환

| 파일 | 기존 | 전환 후 |
|------|------|---------|
| `orchestrator-routing.ts` | `getCurrentState()` 직접 | `request.dataSource?.snapshot()` |
| `orchestrator-execution.ts` | `getKSTDateTime()` 직접 | `lib/time-utils.getKSTDateTime()` |
| `reporter-pipeline.ts` | `getCurrentState()` + `getRecentHistory()` | `dataSource?.snapshot/history()` |
| `reporter-pipeline-report.ts` | 동일 | 함수 인자로 resolved monitoring snapshot/history 수신 |
| `orchestrator-summary-payload.ts` | `tools-ai-sdk/server-metrics/data` 직접 | injected snapshot + optional trend payload |
| `orchestrator-summary-fallback.ts` | current state 직접 fallback | injected snapshot 기반 fallback |
| `orchestrator-agent-stream.ts` | current state fallback 호출 | `AgentRunOptions.dataSource` 전달 |

**타입 변환 원칙:**
- `context.dataSource?.snapshot(ctx)` 반환 타입은 `DomainSnapshot`
- monitoring 전용 코드(`reporter-pipeline-report.ts`)는 `as PrecomputedSlot`으로 casting 허용
- casting 위치를 한 곳으로 모아 나중에 제거하기 쉽게 한다

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러/호환 케이스 |
|----------|-----------|-----------|------------------|
| `getKSTDateTime()` | 없음 | `{ date, time, slotIndex, minuteOfDay }` | precomputed-state import 없이 기존 shape 유지 |
| `DomainDataSource.snapshot(context)` | `AssistantRequestContext` | `Promise<DomainSnapshot>` | 호출부에서 rejection을 warning + empty fallback으로 처리 |
| `DomainDataSource.history(count, context)` | `number`, `AssistantRequestContext` | `Promise<DomainHistoryEntry[]>` | rejection 또는 dataSource 없음은 `[]` |
| `AssistantDomain.dataSource` | 선택 필드 | `DomainDataSource \| undefined` | 없는 domain은 throw 없이 deterministic fallback 생략 |
| `MultiAgentRequest.dataSource` | 선택 필드 | `DomainDataSource \| undefined` | 기존 직접 호출자 호환 유지 |
| `AgentRunOptions.dataSource` | 선택 필드 | `DomainDataSource \| undefined` | 기존 agent 실행 옵션 호환 유지 |
| `monitoringDomainDataSource.snapshot()` | monitoring context | `PrecomputedSlot` wrapped as `DomainSnapshot.data` | 기존 `getCurrentState()`와 동일 data 보존 |
| `monitoringDomainDataSource.history(count)` | count | precomputed history wrapped as entries | 기존 `getRecentHistory(count)` 순서/길이 보존 |

### 테스트 시나리오 (구현 전 확정)

**Task 1:**
- `lib/time-utils.getKSTDateTime()` 이 precomputed-state를 import하지 않는다
- `data/precomputed-state.getKSTDateTime()` re-export가 기존 shape를 유지한다

**Task 2:**
- `DomainDataSource` 계약에 monitoring 도메인 용어가 없다
- `dataSource` 없이 만든 domain으로 orchestrator가 동작한다 (빈 snapshot 허용)

**Task 3:**
- `monitoringDomainDataSource.snapshot()` 반환값이 기존 `getCurrentState()` 결과와 동일한 서버 목록을 포함한다

**Task 4:**
- `runtimeHost.domain.dataSource`가 `OrchestratorContext`에 전파된다
- `dataSource`가 없는 domain에서 orchestrator가 throw하지 않는다

**Task 5:**
- `agents/` 4개 파일이 `precomputed-state`를 직접 import하지 않는다
- `orchestrator-summary-payload.ts`가 `tools-ai-sdk/server-metrics/data`를 import하지 않는다
- `orchestrator-routing.ts`의 기존 라우팅 결과가 변경 전과 동일하다 (replay benchmark)
- `reporter-pipeline.ts`의 보고서 생성이 회귀 없이 통과한다
- `orchestrator-summary-fallback.ts` current-state fallback이 injected snapshot으로 동작한다

## Task 목록

- [x] Task 0 — failing specs: time-utils 독립성/re-export, DomainDataSource 계약, dataSource propagation, agent import guard, summary-payload transitive guard, routing/reporter regression
- [x] Task 1 — `lib/time-utils.ts` 추출 + `data/precomputed-state.ts` re-export + `orchestrator-execution.ts`, `supervisor-prompt.ts` 전환
- [x] Task 2 — `DomainDataSource` / `DomainSnapshot` / `DomainHistoryEntry` Core 계약 추가
- [x] Task 3 — `monitoringDomainDataSource` 구현 + `monitoringDomainPack.dataSource` 연결
- [x] Task 4 — `OrchestratorContext`에 `dataSource` 필드 추가 + context 주입 배선
- [x] Task 5 — `orchestrator-routing.ts` / `reporter-pipeline.ts` / `reporter-pipeline-report.ts` 전환
- [x] Task 5.5 — deterministic summary current-state fallback의 transitive data helper 결합 제거
- [x] Task 6 — targeted/full validation, code review, plan 완료 처리

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|------------|-------------|------------------|---------------|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1 | `refactor(ai):` | ✅ | ❌ | ❌ |
| Task 2 | `refactor(ai):` | ✅ | ❌ | ❌ |
| Task 3 | `refactor(ai):` | ✅ | ❌ | ❌ |
| Task 4~5.5 | `refactor(ai):` | ✅ | ✅ | ❌ |
| Task 6 | `docs:` | ✅ | 판단 필요 | ❌ |

Cloud Run 재배포: Task 5 완료 후 monitoring orchestration 회귀 확인 시.

## 코드리뷰 게이트

| 시점 | 확인 항목 |
|------|-----------|
| Task 0 후 | import guard spec이 direct precomputed-state와 transitive `tools-ai-sdk/server-metrics/data` 결합을 모두 커버하는지 |
| Task 2 후 | `DomainDataSource` 계약에 `PrecomputedSlot`, `ServerSnapshot` 등 monitoring 용어가 없는지 |
| Task 3 후 | `monitoringDomainDataSource`가 기존 getCurrentState 반환값을 손실 없이 wrapping하는지 |
| Task 4 후 | `dataSource` 없는 domain에서 orchestrator가 graceful하게 동작하는지 (throw 없이 빈 결과) |
| Task 5 후 | portable-core route/stream benchmark 회귀 없는지, reporter pipeline 품질 점수 유지되는지 |
| Task 5.5 후 | deterministic current-state fallback이 monitoring snapshot injection 없이는 실행되지 않는지 |

## 완료 기준

- `agents/` 아래 어떤 파일도 `precomputed-state`를 직접 import하지 않는다
- `agents/` 아래 어떤 파일도 `tools-ai-sdk/server-metrics/data`를 통해 precomputed-state를 우회 import하지 않는다
- `lib/time-utils.ts`가 `precomputed-state` 비의존으로 존재한다
- `DomainDataSource` 계약이 Core에 존재하고 monitoring 용어를 포함하지 않는다
- `monitoringDomainPack.dataSource`가 기존 동작을 완전히 보존한다
- AI Engine `type-check` + `npm test` 전체 통과
- root `type-check`, `lint`, `test:quick`, `test:contract` 통과
- portable-core-route-retrieval benchmark 회귀 없음

## 완료 후 달성되는 이식성

```
새 도메인 작성 시 필요한 파일:

domain-pack.ts         AssistantDomain 구현체 (id, version, instructions)
routing-policy.ts      RoutingPolicy 구현
tool-registry.ts       ToolRegistry 구현 (ToolDefinition[])
artifact-registry.ts   ArtifactRegistry 구현 (선택)
agent-roles.ts         AgentRoleRegistry 구현
data-source.ts         DomainDataSource 구현   ← 이번 plan으로 추가
```

## 후속 잔여 결합

- `orchestrator-routing.ts`의 resource catalog file read 제거
- `orchestrator-routing.ts` / `schemas.ts`의 monitoring-specific routing prompt/schema domain ownership
- `agent-runtime-policy.ts` provider/tool 정책 domain ownership

## 진행 로그

- 2026-05-06: Codex subagent 2개로 Draft plan과 코드 경로를 병렬 검토. Contract가
  planning README 기준에 부족하고 `orchestrator-summary-payload.ts`의 transitive
  precomputed-state 결합이 누락된 점을 확인. Contract/Task 0/Task ordering/후속 결합을
  보강하고 Status를 Approved로 전환.
- 2026-05-06: failing specs를 추가한 뒤 구현 완료. `DomainDataSource` 계약과
  monitoring domain dataSource를 추가하고 supervisor/multi-agent/agent stream 경로에
  dataSource를 주입했다. agent runtime의 direct/transitive precomputed-state import guard를
  통과했고, AI Engine `type-check`와 full `npm test` `104 files / 1063 tests` 통과.

이 6개 파일을 작성하면 Core / SDK Host / Agent Engine을 수정 없이 새 도메인 AI assistant가 동작한다.

## 원상 복구 목표

```
baseline HEAD: (착수 시 git rev-parse HEAD로 재기록)
baseline version: v8.11.109
```

Task 5 이후 회귀 발생 시 Task 5 커밋 단위로 revert.

## 진행 로그

- 2026-05-06: 코드 분석에서 agent 레이어 4곳의 precomputed-state 직접 import 식별.
  사용 패턴을 분류:
    - `getKSTDateTime()` → 시간 유틸리티 분리로 해결 (Task 1, 낮은 위험)
    - `getCurrentState()` / `getRecentHistory()` → DomainDataSource 계약으로 해결 (Task 2~5)
  tools-ai-sdk 레이어의 precomputed-state 의존은 올바른 결합으로 판단, 제외.
  plan 초안 작성. Task 0 failing spec부터 시작.
