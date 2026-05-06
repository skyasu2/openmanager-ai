> Owner: project
> Status: Draft
> Doc type: Plan
> Last reviewed: 2026-05-06
> Tags: ai-assistant,portable-core,agent-registry,multi-agent,domain-pack,refactoring

# AI Engine Domain-Owned Agent Registry Plan

- 상태: Draft
- 작성일: 2026-05-06
- TODO.md 연결: Backlog > AI Engine domain-owned agent registry
- 선행 완료:
  - [ai-assistant-portable-core-domain-pack-plan.md](archive/ai-assistant-portable-core-domain-pack-plan.md) — core/domain/adapter 분리
  - [ai-engine-supervisor-domain-wiring-plan.md](archive/ai-engine-supervisor-domain-wiring-plan.md) — supervisor host 배선
  - [ai-engine-sdk-decoupling-plan.md](archive/ai-engine-sdk-decoupling-plan.md) — SDK execution 경계

## 배경

Core/domain/tool/artifact/fact 분리는 완료됐다. 남은 결합 지점은 **multi-agent 레이어**다.

```
현재 결합 지도:

core/assistant-runtime/        ✅ 도메인 중립
domains/monitoring/            ✅ 분리됨
services/ai-sdk/
  assistant-runtime-host.ts   ✅ SDK 경계 명확
  supervisor-stream.ts        ✅ host 경유
  agents/
    agent-factory.ts          ⚠️ AgentType 7개 하드코딩 (nlq|analyst|reporter|advisor|vision|evaluator|optimizer)
    config/agent-configs.ts   ⚠️ NLQ/Analyst 등 서버 모니터링 설명/pattern이 직접 기술됨
    orchestrator-routing.ts   ⚠️ AGENT_NAMES, precomputed-state, generateText 직접 사용
    orchestrator-agent-stream.ts ⚠️ streamText, generateText 직접 호출 (1167줄)
```

새 도메인(주식/여행/인사/재무)을 붙이려면 현재 `AssistantDomain`과 함께
agent 역할 registry도 domain이 소유해야 한다. 그렇지 않으면 `agent-factory.ts`의
7개 고정 타입과 `agent-configs.ts`의 monitoring 설명을 직접 건드려야 한다.

## 목표

1. `AgentRole` 계약을 `core/assistant-runtime`에 추가하고,
   `AssistantDomain`이 선택적으로 agent role manifest를 제공할 수 있게 한다.
2. `agent-configs.ts`의 monitoring 설명/pattern을 monitoring domain 쪽으로 이동한다.
3. `AgentFactory`가 hardcoded `AgentType` 대신 domain registry를 읽도록 전환한다.
4. sample domain이 자체 agent role 1~2개를 core 수정 없이 등록하는 smoke test를 추가한다.
5. 기존 monitoring multi-agent 동작은 한 줄도 바뀌지 않는다.

**불변 조건**: `orchestrator-agent-stream.ts`의 provider fallback / circuit breaker /
quality retry / handoff 로직은 건드리지 않는다.

## 범위

### 포함

- `core/assistant-runtime/types.ts`에 `AgentRole`, `AgentRoleRegistry` 계약 추가
- `AssistantDomain`에 `agentRoles?: AgentRoleRegistry` 선택 필드 추가
- `domains/monitoring/`에 monitoring agent role manifest 파일 추가
- `agent-configs.ts` / `agent-factory.ts` → domain registry 경유 fallback 지원
- `AgentFactory.createByDomain()` 추가 (기존 `AgentFactory.create(type)` 유지)
- sample domain에 agent role 1~2개 추가 + smoke test

### 제외

- `orchestrator-agent-stream.ts`의 `streamText` / `generateText` 직접 호출 전환
  (SDK 실행 추상화는 별도 plan에서 — 1167줄, 위험 구간)
- multi-agent orchestration 로직 변경
- provider fallback chain / circuit breaker 변경
- BFF / Frontend 변경

## 계약 (Contract)

### 신규 타입 (core/assistant-runtime/types.ts)

```typescript
export interface AgentRole {
  id: string;                          // e.g. 'nlq', 'analyst'
  name: string;                        // e.g. 'NLQ Agent'
  description: string;                 // orchestrator routing 참고 텍스트
  matchPatterns?: (string | RegExp)[]; // 자동 routing 패턴 (optional)
  capabilities?: string[];             // e.g. ['metric-query', 'log-search']
}

export interface AgentRoleRegistry {
  listRoles(): AgentRole[];
  resolveRole(id: string): AgentRole | undefined;
}
```

### AssistantDomain 확장

```typescript
export interface AssistantDomain {
  id: string;
  version: string;
  instructions: DomainInstructionSet;
  routingPolicy: RoutingPolicy;
  tools: ToolRegistry;
  artifacts?: ArtifactRegistry;
  facts?: FactPackBuilder;
  agentRoles?: AgentRoleRegistry;   // 신규 — 선택적
}
```

`agentRoles`가 없으면 `AgentFactory`는 기존 `AGENT_TYPE_TO_CONFIG_KEY` 경로를 유지한다.
있으면 registry를 우선한다.

### AgentFactory 확장

```typescript
// 기존 — 유지
AgentFactory.create(type: AgentType): BaseAgent | null

// 신규 — domain registry 경유
AgentFactory.createByDomain(
  roleId: string,
  domain: AssistantDomain
): BaseAgent | null
```

### 불변 조건 테스트

- `AgentFactory.create('nlq')` 기존 경로가 domain 변경 없이 동작한다
- monitoring domain의 `agentRoles`가 기존 7개 agent를 모두 등록한다
- sample domain의 `agentRoles`가 2개 role을 등록하고, `AgentFactory.createByDomain()`이
  monitoring import 없이 동작한다

## Task 목록

- [ ] Task 0 — failing specs: AgentRole 계약, domain registry smoke, factory fallback
- [ ] Task 1 — `core/assistant-runtime/types.ts`에 `AgentRole` / `AgentRoleRegistry` 추가
- [ ] Task 2 — `domains/monitoring/agent-roles.ts` 작성 (기존 7개 agent 설명 이관)
- [ ] Task 3 — `monitoringDomainPack`에 `agentRoles` 필드 추가
- [ ] Task 4 — `AgentFactory.createByDomain()` 추가 (기존 `create(type)` 유지)
- [ ] Task 5 — sample domain에 agent role 2개 추가 + smoke test
- [ ] Task 6 — targeted/full validation 및 plan 완료 처리

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|------------|-------------|------------------|---------------|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~2 | `refactor(ai):` | ✅ | ❌ | ❌ |
| Task 3~4 | `refactor(ai):` | ✅ | ❌ | ❌ |
| Task 5 | `test:` | 선택 | ❌ | ❌ |
| Task 6 | `docs:` | ✅ | 판단 필요 | ❌ |

Cloud Run 재배포는 Task 3~4 완료 후 monitoring 동작 회귀 확인이 필요할 때만 수행.

## 코드리뷰 게이트

| 시점 | 확인 항목 |
|------|-----------|
| Task 0 후 | spec이 monitoring 7개 agent 동작을 충분히 고정하는지 |
| Task 1 후 | `AgentRole` 계약에 monitoring 도메인 용어가 포함되지 않는지 |
| Task 3 후 | `monitoringDomainPack.agentRoles`가 기존 `AGENT_NAMES` 7개를 모두 커버하는지 |
| Task 4 후 | `AgentFactory.create(type)` 기존 경로가 회귀 없이 동작하는지 |
| Task 5 후 | sample domain smoke가 monitoring import 0개인지 (dependency guard) |

## 완료 기준

- `core/assistant-runtime/types.ts`에 `AgentRole`, `AgentRoleRegistry` 계약 존재
- `domains/monitoring/agent-roles.ts`가 기존 7개 agent 설명을 소유
- `AgentFactory.createByDomain()` 가 domain registry 경유로 동작
- sample domain smoke: monitoring import 0개로 agent role 2개 등록/실행 통과
- AI Engine `type-check` + `npm test` 전체 통과
- root `type-check`, `lint`, `test:quick`, `test:contract` 통과
- 기존 monitoring multi-agent 동작 회귀 없음

## 이 plan 이후 남는 것 (후속 plan 후보)

| 항목 | 필요 조건 | 우선순위 |
|------|-----------|----------|
| `orchestrator-agent-stream.ts` SDK 직접 호출 추상화 | 이 plan 완료 후 | 낮음 — 범용 엔진 완성용, 현 제품엔 불필요 |
| `orchestrator-routing.ts`의 `precomputed-state` 직접 의존 제거 | 도메인 data source 계약 필요 | 중간 |

이 두 항목까지 완료되면 "다른 도메인 붙이기 = domain pack + agent roles + data adapter만 작성"
수준이 된다.

## 원상 복구 목표

```
baseline HEAD: (SDK decoupling 완료 커밋 기준 — 작업 착수 시 git rev-parse HEAD로 재기록)
baseline version: v8.11.109
```

## 진행 로그

- 2026-05-06: Codex 사후 분석에서 agents 레이어가 마지막 도메인 결합 지점임을 확인.
  core/domain/tool/artifact/fact/SDK 경계는 완료. agent role registry 분리가 남은
  1순위 항목으로 식별됨. plan 초안 작성. SDD 규칙에 따라 Task 0 failing spec부터 시작.
