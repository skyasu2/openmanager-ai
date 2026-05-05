> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-05
> Tags: ai-assistant,portable-core,domain-pack,modularization,ai-engine

# AI Assistant Portable Core Domain Pack Plan

- 상태: Approved
- 작성일: 2026-05-05
- TODO.md 연결: Active Tasks > `AI assistant portable core/domain pack modularization`
- 기준 archive: [ai-assistant-architecture-evolution-plan.md](archive/ai-assistant-architecture-evolution-plan.md) > `2026-05-05 도메인 재사용성 평가`

## 목표

OpenManager의 AI assistant/chat 구현을 다른 프로젝트로 이식 가능한 구조로 분리한다.

목표는 "현재 서버 모니터링 assistant를 복사해서 수정"하는 것이 아니라, 아래 구조를 만드는 것이다.

```text
Portable AI Assistant Core
- provider/model/fallback policy
- streaming and job execution
- tool loop runtime
- AssistantPlan / AssistantResult metadata
- session/cache/queue/storage adapters
- observability and public-safe error metadata

Domain Pack
- prompts and domain glossary
- routing policy
- tool registry and tool schemas
- artifact schemas
- fact/evidence builder
- optional frontend renderer registry
```

다른 프로젝트가 DB, VM, physical server, Cloud Run, Vercel, bare container, managed cloud 같은 서로 다른 실행 환경을 쓰더라도 core는 바꾸지 않고 adapter/domain pack만 교체해서 assistant/chat 기능을 재사용할 수 있어야 한다.

## 현재 판정

완료된 기존 작업은 이 목표의 기반이다.

- `AssistantPlan` / `AssistantResult` metadata facade는 있음.
- `/api/ai/ask` wrapper-only facade는 있음.
- `BaseAgent` / `AgentFactory` / tool loop / provider fallback은 core 후보로 존재함.
- `MonitoringFactPack`은 domain fact boundary의 첫 구현이다.

하지만 현재 구현은 아직 portable core로 분리된 상태가 아니다.

- `RouteDecision` artifact kind가 `server-snapshot`, `incident-report`, `monitoring-analysis`에 고정되어 있다.
- supervisor prompt와 routing policy가 CPU, memory, server, incident, RCA 같은 monitoring 도메인에 직접 결합되어 있다.
- agent config와 tool registry가 monitoring tool set을 직접 import한다.
- frontend artifact card와 chat metadata가 monitoring artifact union을 직접 안다.

## 작업 착수 원칙

이 계획서는 2026-05-05 Task -1 baseline/current behavior integrity gate를 통과해 `Approved` 상태로 승격했다. 구현 작업은 Task 0 failing test부터 시작한다.

1. 현재 AI assistant/chat 동작에 알려진 회귀가 없어야 한다.
2. 현재 동작 검증에서 실패가 나오면 portable core 작업과 섞지 않고 별도 버그 수정으로 먼저 닫는다.
3. 기존 Vercel + Cloud Run + Supabase/Redis/Cloud Tasks 운영 토폴로지는 유지한다.
4. 배포 환경 스펙 증설, 신규 provider 호출 증가, API route 삭제는 이 계획의 해결책으로 사용하지 않는다.
5. 구현 커밋은 항상 "현 동작 고정 테스트 → behavior-preserving migration → 검증" 순서로만 진행한다.

## 원상 복구 목표 지점

구현 착수 전 기준점은 아래 상태로 기억한다.

```text
baseline branch: main
baseline HEAD: 8989906d59a8c0ed1c02dc8c5e08dfc7fd31c50d
baseline version: 8.11.106
baseline runtime topology: Vercel frontend/BFF + Cloud Run AI Engine + Supabase/Redis/Cloud Tasks
baseline scope note: 이 plan/TODO 문서 변경은 구현 전 planning 변경이며 runtime behavior 변경이 아니다.
```

구현을 시작하는 시점에는 아래를 다시 기록한다.

- `git rev-parse HEAD`
- `git status --short`
- production `/api/version`
- 최근 QA tracker status
- AI assistant targeted test 결과

rollback 기준:

- 구현 중 user-facing 회귀가 확인되면 구현 커밋 단위로 revert한다.
- `git reset --hard` 또는 사용자 변경을 되돌리는 방식은 사용하지 않는다.
- 원상 복구 목표는 "baseline runtime behavior"이며, planning 문서는 필요 시 별도 보존한다.

## 구현 전 현재 동작 무결성 게이트

portable core 분리는 현재 동작이 정상이라는 전제 위에서만 진행한다. 따라서 Task 0 전 아래 검증을 먼저 통과해야 한다.

### 필수 로컬 검증

- `npm run type-check`
- `npm run lint`
- `npm run test:quick`
- `npm run test:contract`
- `cd cloud-run/ai-engine && npm run type-check`
- `cd cloud-run/ai-engine && npm test`
- `git diff --check`

### 필수 targeted AI 검증

- `/api/ai/ask` wrapper-only facade targeted tests
- `/api/ai/supervisor/stream/v2` stream metadata/routeDecision tests
- `/api/ai/jobs` metadata/worker trigger tests
- artifact intent classifier production replay tests
- Cloud Run supervisor mode/planner shadow tests
- MonitoringFactPack tests
- AI chat history restore/facade metadata tests

### QA/운영 상태 확인

- `npm run qa:status`
- 최근 AI assistant 관련 pending/deferred/wont-fix 항목 검토
- pending 회귀가 있으면 이 plan을 `Draft`로 유지하고 별도 bugfix task로 먼저 처리

### 실패 처리 규칙

| 실패 유형 | 처리 |
|-----------|------|
| 기존 AI assistant/chat 회귀 | portable core 작업 중단, 별도 bugfix로 수정 후 재검증 |
| flaky/test infra 문제 | 원인 분류 후 재실행 근거 기록, 무시 금지 |
| production QA pending | 현재 기능 영향 여부를 판단해 blocker면 선해결 |
| 비용/외부 provider 호출 필요 | deterministic mock/contract test로 대체, 실호출은 별도 gate |

## 범위

### 포함

- portable core와 monitoring domain pack의 경계 정의
- `AssistantDomain`, `RoutingPolicy`, `ToolRegistry`, `ArtifactRegistry`, `FactPackBuilder`, storage/queue/session adapter 계약 정의
- current monitoring assistant를 첫 번째 `monitoringDomainPack`으로 이관
- 기존 public API shape 유지: `/api/ai/ask`, `/api/ai/supervisor/stream/v2`, `/api/ai/jobs`, artifact routes는 compatibility wrapper로 유지
- core가 monitoring tool, server metric, incident artifact를 직접 import하지 않음을 테스트로 고정
- 최소 1개 sample domain pack을 mock-only로 등록해 core 변경 없이 smoke 가능함을 증명
- local/in-memory adapter와 current Redis/Cloud Tasks/Supabase adapter의 책임 분리

### 제외

- 실제 새 제품 도메인 전체 구현
- 기본 DB write 증가
- 신규 LLM/provider 호출 증가
- Cloud Run/Vercel 스펙 증설
- GraphRAG 재도입
- managed agent platform 전환
- 기존 monitoring assistant 기능 삭제
- production route 제거 또는 breaking API change

## 계약 (Contract)

> Status를 Approved로 올리기 전에 이 섹션의 타입 이름과 테스트 시나리오를 확정한다.

### 변경 대상 후보

- `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/agent-factory.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`
- `cloud-run/ai-engine/src/services/monitoring/*`
- `cloud-run/ai-engine/src/tools-ai-sdk/*`
- `src/lib/ai/assistant-contract.ts`
- `src/lib/ai/route-decision.ts`
- `src/lib/ai/chat-artifacts/*`
- `src/components/ai/*ArtifactCard.tsx`
- `src/hooks/ai/useAIChatCore.ts`
- `src/app/api/ai/ask/route.ts`
- 신규 후보: `cloud-run/ai-engine/src/core/assistant-runtime/*`
- 신규 후보: `cloud-run/ai-engine/src/domains/monitoring/*`
- 신규 후보: `src/lib/ai/domain-renderers/*`

### 핵심 타입 계약 초안

```ts
type AssistantDomain = {
  id: string;
  version: string;
  instructions: DomainInstructionSet;
  routingPolicy: RoutingPolicy;
  tools: ToolRegistry;
  artifacts?: ArtifactRegistry;
  facts?: FactPackBuilder;
};

type RoutingPolicy = {
  decide(input: AssistantRequestContext): AssistantRouteCandidate;
};

type ToolRegistry = {
  listTools(context: AssistantRequestContext): ToolDefinition[];
  resolveTool(name: string): ToolDefinition | undefined;
};

type ArtifactRegistry = {
  classify(input: AssistantRequestContext): ArtifactCandidate | undefined;
  normalize(value: unknown): AssistantArtifact | undefined;
};

type FactPackBuilder = {
  build(input: DomainFactInput): DomainFactPack;
};

type AssistantRuntimeAdapters = {
  stateStore: AssistantStateStore;
  jobQueue: AssistantJobQueue;
  sessionStore: AssistantSessionStore;
  artifactStore?: AssistantArtifactStore;
  vectorStore?: AssistantVectorStore;
};
```

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|-------------|
| `createAssistantRuntime()` | core config + domain pack + adapters | `AssistantRuntime` | 필수 adapter/domain 누락 시 startup validation error |
| `AssistantRuntime.handle()` | `AssistantRequest` | stream/job/artifact result | public-safe error metadata, raw provider error 비노출 |
| `RoutingPolicy.decide()` | request context | route candidate | unknown intent는 single/chat fallback |
| `ToolRegistry.resolveTool()` | tool name | tool definition | unknown tool은 undefined, runtime은 tool unavailable error |
| `ArtifactRegistry.normalize()` | unknown payload | typed artifact | invalid payload는 undefined, legacy restore는 throw 금지 |
| `FactPackBuilder.build()` | domain source snapshot | deterministic fact pack | source unavailable은 recoverable domain error |

### 인프라/이식 계약

- core는 특정 배포 환경을 요구하지 않는다.
- 최소 실행 조건은 Node runtime + LLM provider adapter + in-memory state adapter다.
- Redis, Cloud Tasks, Supabase, vector DB, object storage는 adapter로만 연결한다.
- VM/physical server/container/cloud managed runtime 차이는 deployment adapter와 env config로 흡수한다.
- 기본 테스트와 CI는 live LLM/외부 DB 호출 없이 deterministic mock adapter로 통과해야 한다.
- production에서 외부 서비스 호출이 필요한 경우 rate limit, quota guard, circuit breaker는 core 계층에서 일관 적용한다.

### 경계 불변조건

- `cloud-run/ai-engine/src/core/**`는 `services/monitoring`, `tools-ai-sdk/*monitoring*`, `precomputed-state`, monitoring artifact 파일을 import하지 않는다.
- monitoring domain pack만 server ID, CPU, memory, disk, network, incident, RCA 용어를 안다.
- core contract에는 domain-specific artifact kind literal을 추가하지 않는다.
- frontend core message/history는 domain artifact union을 직접 import하지 않고 renderer registry를 통해 렌더링한다.
- `/api/ai/ask`는 compatibility facade를 유지하되 내부 runtime은 domain id를 받을 수 있어야 한다.
- 기존 OpenManager monitoring assistant의 user-facing route behavior는 migration 중 유지한다.

### 테스트 시나리오 (구현 전 확정)

- [ ] core dependency guard: `cloud-run/ai-engine/src/core/**`가 monitoring/precomputed/tool domain 파일을 import하면 실패한다.
- [ ] runtime registration: mock `sampleDomainPack`을 등록하면 core 파일 수정 없이 chat request를 처리한다.
- [ ] monitoring migration: 기존 monitoring query corpus의 route decision과 tool selection이 migration 전후 동일하다.
- [ ] artifact registry: `server-snapshot`, `incident-report`, `monitoring-analysis`는 core literal이 아니라 monitoring artifact registry에서만 정의된다.
- [ ] adapter portability: in-memory state/job/session adapter로 local deterministic smoke가 통과한다.
- [ ] current adapter compatibility: 기존 Redis/Cloud Tasks/Supabase 경로는 wrapper adapter로 유지된다.
- [ ] metadata safety: domain pack이 raw provider error나 secret-like 문자열을 넣어도 public response에는 노출되지 않는다.
- [ ] frontend renderer registry: sample artifact renderer를 등록하면 AI message rendering core를 수정하지 않고 렌더링된다.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다.

- [x] Task -1 — 현재 동작 무결성 게이트 통과 및 baseline 재기록
- [ ] Task 0 — failing contract/dependency tests 작성
- [ ] Task 1 — read-only inventory: `core`, `domain`, `shared-but-domain-tainted` 파일 목록 작성
- [ ] Task 2 — `AssistantDomain` / registry / adapter interface 추가
- [ ] Task 3 — monitoring prompt/routing/tool/fact/artifact를 `monitoringDomainPack`으로 이관
- [ ] Task 4 — runtime host가 domain pack과 adapter를 주입받도록 supervisor/job/ask path 정렬
- [ ] Task 5 — frontend artifact renderer registry와 history restore boundary 정렬
- [ ] Task 6 — mock sample domain pack으로 cross-project portability smoke 추가
- [ ] Task 7 — targeted tests, type-check, docs/planning 상태 갱신

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task -1 | 없음 또는 `test:` | 선택 | ❌ | ❌ |
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1 | `docs:` 또는 `test:` | 선택 | ❌ | ❌ |
| Task 2~4 | `refactor:` | ✅ | ✅ | 필요 시 |
| Task 5 | `refactor:` | ✅ | ❌ | ✅ |
| Task 6 | `test:` | 선택 | ❌ | ❌ |
| Task 7 | `docs:` | ✅ | 판단 필요 | 판단 필요 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task -1 완료 후 | baseline 검증이 충분한지, 남은 회귀/QA pending이 없는지 |
| Task 0 완료 후 | failing tests가 portability 목표를 과도하게/부족하게 표현하지 않는지 |
| Task 2 완료 후 | core interface가 monitoring 도메인 용어를 포함하지 않는지 |
| Task 4 완료 후 | 기존 OpenManager route behavior와 cost guard가 유지되는지 |
| Task 5 완료 후 | frontend renderer registry가 XSS/unsafe artifact 렌더링을 만들지 않는지 |
| 전체 완료 후 | 새 도메인 추가 시 core 수정이 필요 없는지 |

## 완료 기준

- [ ] 테스트 시나리오 전체 통과
- [ ] `cloud-run/ai-engine/src/core/**` dependency guard 통과
- [ ] mock sample domain pack smoke 통과
- [ ] 기존 monitoring assistant targeted corpus 통과
- [ ] root `npm run type-check`
- [ ] root `npm run lint`
- [ ] root `npm run test:quick`
- [ ] root `npm run test:contract`
- [ ] AI Engine `npm run type-check`
- [ ] AI Engine `npm test`
- [ ] `npm run docs:budget`
- [ ] `npm run docs:ai-consistency`
- [ ] `git diff --check`

## 진행 로그

- 2026-05-05: 사용자가 목표를 "다른 프로젝트에서도 AI assistant/chat 기능을 처음부터 만들지 않고 가져다 쓸 수 있는 portable core와 domain pack 교체 구조"로 명확히 정의했다. 기존 archive plan은 이 목표의 기반이지만 완료 상태이므로 새 Active plan으로 분리했다.
- 2026-05-05: Task -1 baseline/current behavior integrity gate 통과. 기준 HEAD는 `8989906d59a8c0ed1c02dc8c5e08dfc7fd31c50d`, production `/api/version`은 `v8.11.106` / commit `0f305d7858a4d3691059528a5de9e3b1ba12bc0a`, QA tracker는 pending `0` 및 Active Gate Warning `None`이다. 검증: root targeted AI suite, Cloud Run targeted supervisor/fact/retrieval suite `29/29`, root `type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`, AI Engine `npm test` `95 files / 1012 tests`, `docs:budget`, `docs:ai-consistency`, `git diff --check`. 계약 섹션과 테스트 시나리오가 확정되어 plan status를 `Approved`로 승격했다. 다음 단계는 Task 0 failing contract/dependency tests 작성이다.
