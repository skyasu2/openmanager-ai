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

이 계획서는 2026-05-05 Task -1 baseline/current behavior integrity gate를 통과해 `Approved` 상태로 승격했다. 구현 작업은 Task 0A current-code boundary failing test부터 시작한다.

1. 현재 AI assistant/chat 동작에 알려진 회귀가 없어야 한다.
2. 현재 동작 검증에서 실패가 나오면 portable core 작업과 섞지 않고 별도 버그 수정으로 먼저 닫는다.
3. 기존 Vercel + Cloud Run + Supabase/Redis/Cloud Tasks 운영 토폴로지는 유지한다.
4. 배포 환경 스펙 증설, 신규 provider 호출 증가, API route 삭제는 이 계획의 해결책으로 사용하지 않는다.
5. 구현 커밋은 항상 "현 동작 고정 테스트 → behavior-preserving migration → 검증" 순서로만 진행한다.
6. 아직 존재하지 않는 `cloud-run/ai-engine/src/core/**` 대상 dependency guard는 Task 0A에서 작성하지 않는다. 해당 guard는 Task 2에서 core scaffold가 생긴 뒤 Task 0B/scaffold-aware spec checkpoint로 추가한다.

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

## AI 벤치마크/테스트 도구 인벤토리

portable core 분리 전후의 회귀 기준은 "새 외부 도구를 많이 붙이는 것"이 아니라, 현재 검증 체계를 비용 0원 deterministic benchmark로 확장하는 것이다.

### 현재 사용 중인 도구

| 도구/위치 | 용도 | 실행 방식 | 비용/외부 호출 | 현재 상태 |
|-----------|------|-----------|----------------|-----------|
| Vitest root targeted suites | frontend/BFF/contract/intent 회귀 | `npx vitest run ...` 및 `npm run test:quick` | 없음 | 기본 gate. artifact intent eval과 bench가 포함됨 |
| AI Engine Vitest | Cloud Run supervisor/agent/tool/retrieval/fact pack 회귀 | `cd cloud-run/ai-engine && npm test` | 없음 | 기본 gate. provider/tool은 mock 중심 |
| Artifact intent deterministic benchmark | artifact false-positive/false-negative 방어 | `tests/intent-classifier/intent-classifier.eval.test.ts`, `tests/artifacts/intent-classifier.bench.ts` | 없음 | 현재 corpus `124/124`, precision/recall `1.0000` |
| Artifact intent production replay | QA/운영자 패턴 기반 artifact drift 방어 | `tests/intent-classifier/intent-classifier.production-replay.test.ts` | 없음 | production-style corpus `19/19`, precision/recall `1.0000` |
| Promptfoo golden eval | prompt/model manual A/B, NLQ/Analyst/Reporter/Supervisor micro benchmark | `cd cloud-run/ai-engine && npm run prompt:eval` | live provider 호출 가능 | 수동 전용. 25 cases, providers 2, estimated calls 50, `llm-rubric=0` |
| Promptfoo redteam | prompt injection/off-domain/security refusal smoke | `cd cloud-run/ai-engine && npm run prompt:redteam` | live provider 호출 가능 | 수동 전용. 10 cases, estimated calls 10, `llm-rubric=0` |
| Promptfoo config contract | Promptfoo 비용/구성 drift 방어 | `src/lib/promptfoo-config-contract.test.ts` | 없음 | `llm-rubric < 20%`, defaultTest judge 금지, warning script 확인 |
| QA tracker / Playwright MCP evidence | production release-facing behavior evidence | `npm run qa:status`, recorded QA runs | 실환경 QA 시 외부 호출 가능 | 최신 counted run `QA-20260505-0412`, pending `0` |
| Retrieval/provider drift tests | Knowledge Retrieval Lite, provider policy stale 문구 회귀 | targeted Vitest suites | 없음 | retrieval refactor archive와 M7 eval guard 기반 |

### 현재 도구의 역할 분리

```text
CI / 로컬 기본 gate
  -> Vitest deterministic contract
  -> artifact intent eval/replay
  -> Promptfoo config contract

수동 / 릴리즈 전 보조 평가
  -> Promptfoo live provider eval
  -> Promptfoo redteam
  -> Playwright MCP production QA

도입 보류
  -> LLM-as-a-Judge 기반 Ragas/DeepEval/TruLens/Giskard/garak broad scan
```

### portable core 작업에 추가할 벤치마크

현재 외부 프레임워크를 추가하지 않고, 먼저 Vitest 기반 deterministic benchmark를 늘린다. 이 세 항목은 portable core 리팩터링의 behavior-preserving migration 기준으로 사용한다.

| 추가 벤치마크 | 목적 | 위치 후보 | 비용 | 착수 시점 |
|---------------|------|-----------|------|-----------|
| Route / Tool Trace Replay Benchmark | stream/job/artifact, single/multi, `AssistantPlan.executionMode`, tool call sequence 보존 | `tests/ai-route-replay/*.test.ts`, `cloud-run/ai-engine/src/services/ai-sdk/*routing*.test.ts` | 0원 | Task 0C |
| Retrieval Evidence Recall Benchmark | RAG/Retrieval Lite evidence top-k, expected path/document id, `suppressedReason` 보존 | `tests/retrieval/evidence-recall.bench.ts`, `cloud-run/ai-engine/src/lib/knowledge-retrieval-lite*.test.ts` | 0원 | Task 0C |
| Stream Contract Snapshot Benchmark | `data-start`/`data-mode`/`data-tool-call`/`data-tool-result`/`text-*`/`data-done` event shape 보존 | `tests/ai-stream/stream-contract-replay.test.ts`, existing stream route tests | 0원 | Task 0C |

### 외부 무료 도구 도입 판단

| 도구 | 판단 | 이유 |
|------|------|------|
| Ragas | 지금은 보류, manual/nightly 후보 | RAG faithfulness/answer relevancy에는 유용하지만 metric에 따라 LLM judge 호출과 Python dependency가 늘어남 |
| DeepEval | 지금은 보류, manual report/task-quality 후보 | agent task completion 품질 평가에는 적합하지만 기본 gate에 넣기엔 LLM judge 비용과 dependency surface가 큼 |
| TruLens | 지금은 보류, RAG triad 수동 후보 | RAG feedback에는 좋지만 provider feedback 함수를 쓰면 비용이 생김 |
| Giskard | 지금은 보류, 월간 security scan 후보 | LLM scan은 유용하지만 broad scan은 호출량과 Python dependency가 큼 |
| garak | 지금은 보류, 월간 adversarial scan 후보 | jailbreak/prompt-injection probe가 많아 수동 실행만 적합 |
| Inspect AI / OpenAI Evals / lm-eval-harness | 현재 범위 보류 | app-level route/tool/RAG 회귀보다 model capability eval 성격이 강함 |

도입 기준:

- 기본 CI/로컬 gate에는 live LLM judge를 넣지 않는다.
- 외부 도구는 `manual` 또는 `nightly`로만 시작하고, 예상 provider call 수와 free-tier 영향 preflight가 있어야 한다.
- 먼저 route/tool/retrieval/stream deterministic benchmark가 충분하지 않은 구체적 gap이 확인되어야 한다.

웹 검토 근거(2026-05-05):

- Promptfoo 공식 문서는 eval/redteam/CI/CD를 모두 지원하는 LLM app 평가 도구로 설명한다. 현재 repo에 이미 들어와 있으므로 신규 도구보다 기존 Promptfoo contract/preflight 강화가 우선이다. ([intro](https://www.promptfoo.dev/docs/intro/), [redteam quickstart](https://www.promptfoo.dev/docs/red-team/quickstart/))
- Ragas는 RAG/agent/tool-use metric을 제공하지만 LLM 기반 metric이 1회 이상 LLM 호출을 쓸 수 있다고 명시한다. 기본 gate가 아니라 수동 후보로 둔다. ([metrics](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/))
- DeepEval은 LLM-as-a-Judge를 핵심 평가 방식으로 다룬다. 품질 리포트에는 유용하지만 비용 0원 deterministic gate와는 맞지 않는다. ([LLM-as-a-Judge guide](https://deepeval.com/guides/guides-llm-as-a-judge))
- TruLens feedback provider는 OpenAI/Bedrock/LiteLLM/LangChain 기반 LLM provider와 relevance/correctness/tool trace scoring을 제공한다. RAG feedback 수동 분석 후보로만 둔다. ([LLM provider reference](https://www.trulens.org/reference/trulens/feedback/llm_provider/))
- Giskard와 garak은 LLM vulnerability scanning/red-team 쪽이 강하지만 broad scan은 호출량과 dependency surface가 커서 월간/릴리즈 전 수동 scan 후보가 맞다. ([Giskard scan](https://docs.giskard.ai/hub/sdk/scan/index.html), [garak probes](https://docs.garak.ai/garak/garak-components/vulnerability-probes))
- Inspect AI와 lm-evaluation-harness는 모델/agent capability benchmark에는 강하지만, 이 작업의 1차 목표인 OpenManager app-level route/tool/RAG/stream contract 보존과는 우선순위가 낮다. ([Inspect AI](https://inspect.aisi.org.uk/), [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness))

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

### 현재 결합 지점과 이관 우선순위

아래 순서로 이관한다. 먼저 public-safe contract literal과 compatibility normalizer를 분리하고, 그 다음 prompt/source/tool registry를 옮긴다. `agent-configs.ts` tool registry 이동은 tool availability 회귀 위험이 가장 크므로 domain registry contract와 route corpus가 고정된 뒤 진행한다.

| 순서 | 파일 | 현재 결합 | 이관 목표 | 회귀 리스크 |
|------|------|-----------|-----------|-------------|
| 1 | `src/lib/ai/route-decision.ts`, `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts` | `server-snapshot` / `incident-report` / `monitoring-analysis` artifact kind literal | `ArtifactRegistry`가 kind allowlist를 제공하고 기존 normalizer는 compatibility wrapper로 유지 | 낮음-중간: metadata shape 보존 필요 |
| 2 | `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts` | monitoring system prompt, `precomputed-state`, resource catalog 직접 import | monitoring domain pack의 prompt/fact source adapter로 이동 | 중간: route/tool selection corpus 보존 필요 |
| 3 | `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.ts` | monitoring tools 직접 import와 agent별 registry 구성 | monitoring `ToolRegistry` + agent allowlist wrapper | 높음: tool 노출/차단 회귀 가능 |
| 4 | `cloud-run/ai-engine/src/services/monitoring/*`, `cloud-run/ai-engine/src/tools-ai-sdk/monitoring-tools.ts` | fact/tool 구현이 runtime host에 직접 노출 | monitoring domain pack 내부 구현으로 수렴 | 중간: deterministic fact/result shape 보존 필요 |
| 5 | `src/lib/ai/chat-artifacts/*`, `src/components/ai/*ArtifactCard.tsx` | frontend core가 monitoring artifact union/card를 직접 인지 | domain renderer registry와 safe fallback renderer | 중간: restore/XSS/UI 회귀 가능 |

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

### 테스트 시나리오와 착수 가능 시점

Task 0은 "지금 실패시킬 수 있는 테스트"와 "scaffold 이후에 의미가 생기는 테스트"를 분리한다. 후속 테스트는 각 구현 task 직전 spec checkpoint로 작성한다.

| 시나리오 | 최초 작성 시점 | 실패 조건 | 비고 |
|----------|----------------|-----------|------|
| current boundary detector | Task 0A | 현재 public/shared 파일이 monitoring artifact literal, `precomputed-state`, monitoring tool registry를 직접 포함하면 실패 | 현재 코드 기준 즉시 작성 가능 |
| artifact registry boundary | Task 0A | `server-snapshot`, `incident-report`, `monitoring-analysis`가 registry가 아닌 route/core literal로 남으면 실패 | `route-decision.ts`, `supervisor-mode.ts` 우선 |
| supervisor source/prompt boundary | Task 0A | `supervisor-routing.ts`가 `precomputed-state` 또는 monitoring prompt를 직접 소유하면 실패 | Task 3 이관 전까지 expected failing |
| agent tool registry boundary | Task 0A | `agent-configs.ts`가 monitoring tool 구현을 직접 import하면 실패 | Task 3 이관 전까지 expected failing |
| core dependency guard | Task 2 직전/직후 scaffold checkpoint | `cloud-run/ai-engine/src/core/**`가 `services/monitoring`, `tools-ai-sdk/*monitoring*`, `precomputed-state`, monitoring artifact 파일을 import하면 실패 | core path 생성 전에는 작성하지 않음 |
| runtime registration | Task 2 checkpoint | mock `sampleDomainPack` 등록 시 core 파일 수정이 필요하면 실패 | `AssistantDomain` interface 생성 후 작성 |
| monitoring migration | Task 3 checkpoint | 기존 monitoring query corpus의 route decision/tool selection이 migration 전후 달라지면 실패 | behavior-preserving migration guard |
| artifact registry | Task 3 checkpoint | monitoring artifact kind가 monitoring registry 밖 core literal로 남으면 실패 | Task 0A detector를 실제 registry 계약으로 확장 |
| adapter portability | Task 4 checkpoint | in-memory state/job/session adapter로 local deterministic smoke가 실패하면 실패 | Redis/Cloud Tasks/Supabase 비의존성 확인 |
| current adapter compatibility | Task 4 checkpoint | 기존 Redis/Cloud Tasks/Supabase 경로가 wrapper adapter로 유지되지 않으면 실패 | production topology 유지 |
| metadata safety | Task 4 checkpoint | domain pack raw provider error 또는 secret-like 문자열이 public response에 노출되면 실패 | public-safe metadata invariant |
| frontend renderer registry | Task 5 checkpoint | sample artifact renderer 등록에 AI message rendering core 수정이 필요하면 실패 | renderer security tests 포함 |

### Task 1 inventory 산출물

Task 1은 단순 파일 나열이 아니라 아래 형식의 분류표를 산출한다. 분류 근거가 불명확한 파일은 `shared-but-domain-tainted`로 보수적으로 분류하고, migration target과 필요한 guard를 함께 적는다.

| 필드 | 설명 |
|------|------|
| File | repo-relative path |
| Current layer | frontend core, BFF, Cloud Run runtime, agent config, tool, monitoring service, UI renderer 등 |
| Classification | `core-candidate`, `domain`, `shared-but-domain-tainted`, `adapter`, `compatibility-wrapper` 중 하나 |
| Domain signals | server/CPU/memory/disk/network/incident/RCA/artifact kind/prompt glossary 같은 monitoring term 포함 여부 |
| Infra/provider signals | Supabase/Redis/Cloud Tasks/Vercel/Cloud Run/provider 직접 호출 또는 env 의존성 |
| Deterministic portability | live provider/external DB 없이 mock/in-memory adapter로 동작 가능한지 |
| Migration target | core, monitoring domain pack, runtime adapter, frontend renderer registry, compatibility wrapper 중 하나 |
| Guard needed | dependency guard, corpus parity, metadata safety, renderer security, adapter smoke 등 |
| Risk | low/medium/high와 이유 |

분류 기준:

- `core-candidate`: domain glossary/literal이 없고, 외부 provider/infra는 interface 또는 adapter를 통해서만 접근하며, mock/in-memory adapter로 deterministic test가 가능하다.
- `domain`: monitoring prompt, tool schema, artifact kind, fact/evidence builder, server metric 용어를 소유한다.
- `shared-but-domain-tainted`: 여러 경로에서 쓰이지만 exported type, literal, prompt, normalizer에 monitoring term이 섞여 있다.
- `adapter`: Supabase, Redis, Cloud Tasks, Vercel, Cloud Run, provider SDK 같은 실행 환경을 감싼다.
- `compatibility-wrapper`: 기존 public API/metadata shape를 보존하기 위해 남기는 얇은 wrapper이며 새 domain logic을 소유하지 않는다.

### Frontend renderer registry 보안 계약

Task 5 구현 전 아래 제약을 먼저 고정한다.

- renderer는 `ArtifactRegistry.normalize()`를 통과한 typed artifact만 받는다. unknown/raw payload를 직접 렌더링하지 않는다.
- renderer 등록 key는 `domainId + artifactKind + artifactVersion` allowlist여야 한다. unknown artifact는 safe unsupported fallback으로 표시한다.
- registered renderer는 기본적으로 pure render function이어야 하며, 직접 `fetch`, data-loading `useEffect`, storage write를 수행하지 않는다. 추가 데이터는 runtime/adapter가 사전에 artifact payload로 제공한다.
- `dangerouslySetInnerHTML`은 registry renderer에서 금지한다. 예외가 필요하면 shared sanitized markdown/html component로 격리하고 sanitizer test를 먼저 추가한다.
- sanitize 책임은 registry normalize 단계와 shared UI renderer가 나눠 가진다. domain renderer가 raw HTML/string escaping을 직접 책임지는 구조는 금지한다.
- security test는 `<script>`, event handler attribute, `javascript:` URL, oversized payload, unknown artifact kind를 포함한다.

### Backlog 연결 게이트

portable core task가 완료될 때 기존 Backlog와 중복 설계가 생기지 않도록 아래 시점에 TODO.md를 재검토한다.

| Backlog 항목 | 겹치는 Task | 재검토 시점 | 조치 기준 |
|--------------|-------------|-------------|-----------|
| AI artifact workspace/schema registry and replay pack | Task 3 `ArtifactRegistry` | Task 3 완료 직후 | ArtifactRegistry가 schema registry 범위를 충분히 포함하면 Backlog를 replay/workspace persistence만 남기도록 축소한다. 포함하지 않으면 별도 implementation task로 유지한다. |
| Planner shadow production telemetry review | Task 4 `AssistantRuntimeAdapters` / observability metadata | Task 4 완료 직후 | runtime adapter/metadata가 shadow telemetry 집계 hook을 제공하면 Backlog를 production review 실행만 남기고, 제공하지 않으면 adapter gap으로 Task 4 follow-up을 연다. |

## Task 목록

> 착수 전 Status가 Approved인지 확인한다.

- [x] Task -1 — 현재 동작 무결성 게이트 통과 및 baseline 재기록
- [x] Task 0A — 현재 코드 기준 boundary violation failing tests 작성
- [ ] Task 0B — Task 2+ scaffold-aware contract/dependency spec checkpoint 추가
- [x] Task 0C — portable core baseline benchmark 보강: route/tool trace replay, retrieval evidence recall, stream contract snapshot
- [ ] Task 1 — read-only inventory: `core-candidate`, `domain`, `shared-but-domain-tainted`, `adapter`, `compatibility-wrapper` 분류표 작성
- [ ] Task 2 — `AssistantDomain` / registry / adapter interface 추가
- [ ] Task 3 — monitoring prompt/routing/tool/fact/artifact를 `monitoringDomainPack`으로 이관
- [ ] Task 3 후속 — Backlog `AI artifact workspace/schema registry and replay pack` 범위 재분류
- [ ] Task 4 — runtime host가 domain pack과 adapter를 주입받도록 supervisor/job/ask path 정렬
- [ ] Task 4 후속 — Backlog `Planner shadow production telemetry review` 범위 재분류
- [ ] Task 5 — frontend artifact renderer registry와 history restore boundary 정렬
- [ ] Task 6 — mock sample domain pack으로 cross-project portability smoke 추가
- [ ] Task 7 — targeted tests, type-check, docs/planning 상태 갱신

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task -1 | 없음 또는 `test:` | 선택 | ❌ | ❌ |
| Task 0A | `test(spec):` | 선택 | ❌ | ❌ |
| Task 0B | `test(spec):` | 선택 | ❌ | ❌ |
| Task 0C | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1 | `docs:` 또는 `test:` | 선택 | ❌ | ❌ |
| Task 2~4 | `refactor:` | ✅ | ✅ | 필요 시 |
| Task 5 | `refactor:` | ✅ | ❌ | ✅ |
| Task 6 | `test:` | 선택 | ❌ | ❌ |
| Task 7 | `docs:` | ✅ | 판단 필요 | 판단 필요 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task -1 완료 후 | baseline 검증이 충분한지, 남은 회귀/QA pending이 없는지 |
| Task 0A 완료 후 | 현재 코드 위반 탐지 테스트가 portability 목표를 과도하게/부족하게 표현하지 않는지 |
| Task 0B 및 각 scaffold checkpoint 후 | 새 core/domain/adapter guard가 실제 생성된 경로와 계약을 정확히 겨냥하는지 |
| Task 0C 완료 후 | route/tool/retrieval/stream benchmark가 live provider 호출 없이 migration 기준선을 충분히 잡는지 |
| Task 2 완료 후 | core interface가 monitoring 도메인 용어를 포함하지 않는지 |
| Task 4 완료 후 | 기존 OpenManager route behavior와 cost guard가 유지되는지 |
| Task 5 완료 후 | frontend renderer registry가 pure/sanitized renderer 계약을 지키고 XSS/unsafe artifact 렌더링을 만들지 않는지 |
| 전체 완료 후 | 새 도메인 추가 시 core 수정이 필요 없는지 |

## 완료 기준

- [ ] 테스트 시나리오 전체 통과
- [ ] `cloud-run/ai-engine/src/core/**` dependency guard 통과
- [ ] mock sample domain pack smoke 통과
- [ ] 기존 monitoring assistant targeted corpus 통과
- [ ] Route / Tool Trace Replay Benchmark 통과
- [ ] Retrieval Evidence Recall Benchmark 통과
- [ ] Stream Contract Snapshot Benchmark 통과
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
- 2026-05-05: Task -1 baseline/current behavior integrity gate 통과. 기준 HEAD는 `8989906d59a8c0ed1c02dc8c5e08dfc7fd31c50d`, production `/api/version`은 `v8.11.106` / commit `0f305d7858a4d3691059528a5de9e3b1ba12bc0a`, QA tracker는 pending `0` 및 Active Gate Warning `None`이다. 검증: root targeted AI suite, Cloud Run targeted supervisor/fact/retrieval suite `29/29`, root `type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`, AI Engine `npm test` `95 files / 1012 tests`, `docs:budget`, `docs:ai-consistency`, `git diff --check`. 계약 섹션과 테스트 시나리오가 확정되어 plan status를 `Approved`로 승격했다. 다음 단계는 Task 0A current-code boundary failing tests 작성이다.
- 2026-05-05: 계획서 리뷰에서 지적된 Task 0 착수점, 결합 이관 순서, Task 1 inventory 기준, frontend renderer 보안 계약, Backlog 연결 게이트를 반영했다. Task 0은 현재 코드 기준 `0A` boundary detector와 Task 2 이후 `0B` scaffold-aware guard로 분리했다.
- 2026-05-05: 현재 AI 벤치마크/테스트 도구를 분석해 plan에 반영했다. 기존 도구는 Vitest deterministic contract, artifact intent eval/replay, Promptfoo manual golden/redteam, Promptfoo config contract, QA tracker/Playwright evidence로 분류했다. portable core 작업 전 추가 도입은 외부 LLM judge 도구가 아니라 Task 0C의 route/tool trace replay, retrieval evidence recall, stream contract snapshot deterministic benchmark로 제한한다.
- 2026-05-05: Task 0A 완료. `c38bd68c3`에서 current-code boundary guard를 추가했고, `d84b6be84`에서 monitoring artifact registry, monitoring supervisor prompt/source module, monitoring tool registry로 domain ownership을 분리했다. 검증: boundary guard, root `type-check`/`lint`/`test:quick`/`test:contract`, AI Engine `type-check`/`npm test` `95 files / 1012 tests`, GitLab pipeline `2501000082` success. 다음 단계는 Task 0C deterministic benchmark 보강이다.
- 2026-05-05: Task 0C 완료. `portable-core-route-retrieval.bench.test.ts`로 route/tool trace replay와 retrieval evidence recall baseline을 고정하고, `portable-core-stream-contract.bench.test.ts`로 UI message stream event shape를 고정했다. 모두 live provider/외부 DB 호출 없이 Vitest에서 실행된다. 다음 단계는 Task 1 inventory 분류표 작성이다.
