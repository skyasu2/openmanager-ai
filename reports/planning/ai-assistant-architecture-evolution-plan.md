> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-04
> Tags: ai-assistant,architecture,assistant-plan,artifact,deterministic-analytics,vercel-ai-sdk,multi-agent,planner,durable-workflow,mcp

# AI Assistant Architecture Evolution Plan

- 상태: Approved (M3~M7 completed; Streaming UI S1~S3 completed; no active implementation milestone)
- 작성일: 2026-05-03
- TODO.md 연결: Recent Completed #274 > `AI Assistant Architecture Evolution M7 (MonitoringFactPack + eval guard)`
- 기준 문서: [ai-assistant-initial-design-comparison.md](../../docs/reference/architecture/ai/ai-assistant-initial-design-comparison.md)
- 선행 완료:
  - [AI Assistant Route Decision Metadata Plan](ai-assistant-route-decision-metadata-plan.md) — M1 완료
  - [AI Assistant Plan Result Facade Plan](ai-assistant-plan-result-facade-plan.md) — M2 완료
- 관련 분리 계획:
  - [AI Streaming UI Improvement Plan](ai-streaming-ui-improvement-plan.md) — S1~S3 완료 및 v8.11.88 배포/QA 기록 보존

## 목표

현재 `Vercel BFF + Cloud Run AI Engine` 기반 Option A 인프라는 유지한다. 대신 AI Assistant의 제품/분석 목표를 다음 방향으로 진화시킨다.

- 제품 목표: 채팅 텍스트보다 typed artifact를 우선하는 Option C 흡수
- 분석 목표: LLM이 메트릭을 판단하지 않고 deterministic monitoring core가 fact를 계산하는 Option E 흡수
- 런타임 기준: Vercel AI SDK는 streaming, structured output, tool orchestration 계층으로 사용하고 metric decision engine으로 사용하지 않음
- 멀티에이전트 기준: 폐기하지 않되 기본 정체성으로 두지 않고, Planner가 조건부로 선택하는 고비용 escalation path로 축소
- 개선 방식: big-bang rewrite 없이 M1/M2 read-only contract 위에 단계적으로 authority와 schema를 수렴

최종 목표 구조:

```text
User query
  -> BFF facade
  -> Cloud Run Planner creates authoritative AssistantPlan
     -> executionMode = deterministic | single-agent | multi-agent
  -> Deterministic monitoring core creates MonitoringFactPack
  -> LLM formats/explains facts through Vercel AI SDK
  -> AssistantResult returns typed ArtifactEnvelope or chat result
  -> Frontend renders by result kind, not by duplicated routing logic
```

## 현재 기준선

- M1: `RouteDecision` metadata가 frontend stream/job/artifact, BFF job, Cloud Run supervisor result 경로에 read-only로 보존됨
- M2: `AssistantPlan`/`AssistantResult` read-only facade가 `RouteDecision` 위에 추가됨
- 아직 routing authority는 frontend/BFF/Cloud Run에 분산되어 있음
- M4: `IncidentReportArtifact`, `MonitoringAnalysisArtifact`, `ServerSnapshotArtifact` 신규 생성 경로에 envelope-compatible metadata가 부여되고 legacy restore는 `restored-legacy`로 정규화됨
- M5: planner shadow, execution mode, escalation/drift reason, thinking On/Off delta corpus가 완료됨
- M6: `/api/ai/ask` wrapper-only facade가 기존 stream/job/artifact route를 내부 위임으로 감싼다. 기본 endpoint는 유지하고 frontend opt-in은 env flag로 제어한다.
- M7: `MonitoringFactPack`, retrieval `insufficient_evidence` guard, provider smoke freshness stale guard가 완료됨
- 현재 supervisor는 `auto` mode에서 `selectExecutionMode()`로 single/multi를 고른다. M5~M7 이후에도 실제 routing authority는 아직 frontend/BFF/Cloud Run에 분산되어 있다. 다음 작업은 새 planner가 아니라 facade opt-in 범위, route catalog, artifact workspace/schema registry, provider reasoning capability policy를 별도 gate로 다루는 것이다.

## 현재 동작 분석 기반 작업 계획

2026-05-03 코드 기준 실제 동작은 아래 3개 public execution surface로 나뉜다.

| Surface | 현재 권위자 | 현재 동작 | 개선 방향 |
|---------|-------------|-----------|-----------|
| Frontend artifact path | frontend `useAIChatCore` | artifact-shaped intent면 `generateIncidentReportArtifact`, `generateMonitoringAnalysisArtifact`, `generateServerSnapshotArtifact`를 client path에서 실행하고 `RouteDecision`/`AssistantPlan`/`AssistantResult` metadata를 붙인다. | M4 metadata는 유지한다. M5에서는 Cloud Run Planner candidate와 비교할 수 있도록 동일 query corpus에서 shadow plan을 기록한다. |
| Frontend stream/job decision | frontend `useQueryExecution` + BFF job route | complexity score와 forced keyword로 `stream` 또는 `job`을 고르고, `/api/ai/jobs`는 BFF가 `job_queue_api` plan을 만든다. `analysisMode=thinking`은 threshold `19 → 11`로 낮춰 borderline query를 job queue로 더 보낸다. | M5 shadow mode에서 frontend decision과 Cloud Run candidate plan의 drift를 기록한다. M6 전까지 기존 route authority는 유지한다. Thinking On/Off corpus를 별도 regression guard로 유지한다. |
| Cloud Run supervisor mode | Cloud Run `resolveSupervisorModeDecision` | Cloud Run이 `auto` mode에서 `selectExecutionMode()`로 `single`/`multi`를 다시 고르고, stream done metadata에 plan/result facade를 붙인다. `analysis_mode_thinking` source는 thinking 버튼이 실제 `single → multi` 승격을 만든 경우에만 사용한다. | M5에서 `executionMode`를 `deterministic`/`single-agent`/`multi-agent`로 확장하고, multi-agent는 escalation reason이 있을 때만 candidate가 되게 한다. |

M5 구현 전에는 현재 동작을 먼저 고정한다. 이 작업은 기능 변경이 아니라 regression baseline 작성이다.

| 단계 | 목적 | 산출물 | 완료 기준 |
|------|------|--------|-----------|
| M5-B.0 Current behavior baseline | 현재 routing/metadata 동작을 테스트 corpus로 고정 | stream/job/artifact/multi-agent baseline fixture | 현재 production route authority를 바꾸지 않고 기존 테스트가 통과 |
| M5-B.1 ExecutionMode contract spec | `AssistantPlan`이 future execution mode를 담을 수 있게 계약 확장 시나리오 정의 | failing tests for `executionMode`, `escalationReasonCodes`, `plannerShadow` | legacy `AssistantPlan`/`AssistantResult` normalize가 throw 없이 동작 |
| M5-B.2 Cloud Run shadow planner | Cloud Run이 authoritative candidate plan을 만들되 실행 경로는 바꾸지 않음 | `plannerShadow` metadata, public-safe drift reason | frontend/BFF 기존 decision과 shadow candidate가 함께 보존 |
| M5-B.3 Drift corpus and threshold | 단순 조회가 multi-agent로 과잉 승격되는지 측정 | query corpus: simple metric, artifact, RCA/report, advisor, vision, low-retrieval | drift가 높으면 authority 이전 금지 |
| M5-B.4 Multi-agent escalation guard | multi-agent를 고비용 분석 모드로 제한 | escalation reason allowlist + tests | 단순 metric lookup/server snapshot은 multi-agent candidate가 되지 않음 |
| M5-B.5 Rollout decision | M6 `/api/ai/ask`와 authority 이전 가능 여부 판단 | go/no-go checklist | shadow drift, latency, free-tier 영향이 허용 범위일 때만 M6 진행. **정량 기준**: baseline corpus 최소 50개 query에서 shadow plan과 local decision mismatch가 10% 이하(5건 이하), shadow planner latency overhead가 p95 기준 200ms 이하, free-tier quota 영향이 일일 한도의 5% 이내 |
| M5-B.6 Thinking On/Off measurement | Thinking 버튼을 유지하되 실제 차이를 측정 가능하게 고정 | frontend route delta corpus + Cloud Run mode delta corpus | On/Off 차이가 metadata와 tests로 설명되고, provider-native reasoning으로 오인되지 않음 |

비교 기준:

| 현재 동작 | 목표 동작 |
|-----------|-----------|
| `RouteDecision.mode`는 `single`/`multi`만 표현 | `AssistantPlan.executionMode`가 `deterministic`/`single-agent`/`multi-agent`를 표현 |
| frontend가 artifact/job/stream을 먼저 결정 | Cloud Run Planner candidate가 같은 결정을 shadow로 제시 |
| Cloud Run은 stream 내부에서 다시 `single`/`multi` 결정 | Cloud Run Planner가 execution mode와 escalation reason을 함께 제시 |
| artifact path는 이미 envelope-compatible metadata 보유 | artifact path도 planner shadow/drift 비교 대상에 포함 |
| low retrieval은 품질 문제가 LLM 응답으로 섞일 수 있음 | `insufficient_evidence` reason으로 명시하고 multi-agent 자동 승격 금지 |

M5a 완료 기록 (2026-05-03):
- `AssistantPlan.executionMode` optional contract와 public-safe `escalationReasonCodes` / `plannerShadow` normalizer 추가
- frontend artifact path는 `deterministic`, Cloud Run supervisor plan은 현재 resolved `single`/`multi`를 `single-agent`/`multi-agent`로 표시
- frontend stream/job decision, attachment streaming, artifact path, Cloud Run supervisor current behavior baseline을 테스트로 고정
- routing authority, LLM/provider 호출, Cloud Run/Vercel route surface는 변경하지 않음

M5b 완료 기록 (2026-05-03):
- frontend streaming transport와 BFF job trigger가 local `RouteDecision`을 Cloud Run request에 전달한다.
- Cloud Run은 기존 실행 경로를 바꾸지 않고 `plannerShadow` candidate를 `AssistantPlan` metadata에 추가한다.
- drift는 `execution_path_mismatch`, `execution_mode_mismatch`, `artifact_kind_mismatch`, `local_decision_missing` 같은 public-safe reason code로만 노출한다.
- 단순 metric lookup 및 server snapshot artifact는 deterministic candidate로 유지하고, RCA/report/advisor/vision만 multi-agent escalation candidate가 된다.
- 50개 baseline corpus에서 shadow/local mismatch 허용치 `≤5/50`, latency overhead `≤200ms`, 신규 LLM/provider 호출 없음 기준을 unit test로 고정했다.

M5c 완료 기록 (2026-05-03):
- Thinking 버튼은 제거하지 않고, provider-native reasoning이 아닌 routing-intensity toggle로 유지한다.
- frontend route decision helper를 분리해 On/Off corpus를 측정 가능하게 했다. 현재 corpus 6개 기준 job queue는 `auto 2/6` → `thinking 4/6`, `streaming → job-queue` 전환은 2건이다.
- Cloud Run mode delta corpus를 추가했다. 현재 corpus 6개 기준 multi는 `auto 2/6` → `thinking 4/6`, `single → multi` 전환은 2건이다.
- `modeSelectionSource=analysis_mode_thinking`은 thinking 버튼이 실제 승격 원인일 때만 사용하고, 원래도 multi였던 보고서/RCA/토폴로지 요청은 `auto_complexity`로 남긴다.

M5 이후 코드 교차 감사 반영 (2026-05-03):
- frontend `useQueryExecution`은 여전히 stream/job route authority를 갖는다. `/api/ai/ask` 도입 후에도 즉시 제거하지 않는다.
- BFF stream route와 job route는 `queryAsOf`, `analysisMode`, sanitized `localRouteDecision`, `AssistantPlan` metadata를 Cloud Run 또는 Redis job metadata로 전달한다.
- Cloud Run planner shadow는 candidate/drift/latency 관측용이다. M6에서 이 로직을 새로 구현하지 않고 기존 stream/job/artifact route를 wrapper로 감싼다.
- monitoring tool layer는 이미 `sourceMode`, `queryAsOf`, `evidenceRefs`를 반환한다. M7 `MonitoringFactPack`은 새 데이터 소스가 아니라 기존 deterministic tool result를 canonical bundle로 묶는 계약이다.
- provider model policy는 deprecation/quota/capability/smokeEvidence와 stale finding guard를 갖지만 `lastVerified`, `expiresAt`, `reasoningCapability`는 없다. provider-native thinking은 policy freshness가 명시 필드로 준비된 뒤 opt-in으로만 연결한다.

## 범위

### 포함

- M3: 기준 문서와 실제 M2 contract 정합성 보정
- M4: `ArtifactEnvelope` 및 artifact versioning contract 정의
- **M5a** (contract + baseline): `ExecutionMode` contract 확장 + current behavior baseline corpus 고정 — Task 4의 전반부
- **M5b** (shadow + drift + escalation): Cloud Run shadow planner, drift 측정/threshold, multi-agent escalation guard, rollout decision — Task 4 후반 + Task 5
- **M5c** (thinking route delta measurement): thinking On/Off가 frontend routing 및 Cloud Run mode selection에 주는 차이를 corpus로 고정
- M6: `/api/ai/ask` BFF facade 설계 및 기존 stream/job/artifact route wrapping — 완료. 초기 구현은 wrapper-only이며 기존 route authority를 즉시 제거하지 않음
- M7: deterministic `MonitoringFactPack`와 provider/retrieval eval guard 도입 — 완료. precomputed-state와 monitoring tool layer 위에 typed boundary를 씌웠으며 shadow planner와 직접 의존 없음

### 제외

- Vercel BFF + Cloud Run AI Engine 분리 구조 제거
- 기존 `/api/ai/supervisor/stream/v2`, `/api/ai/jobs`, artifact route 즉시 삭제
- WebSocket 전환
- 실시간 ingestion 전환
- vector/GraphRAG 재도입
- Supabase에 개인 chat/artifact history를 기본 저장하는 정책 변경
- Cloud Run/Vercel 스펙 증설
- streaming UI 구현 세부사항: `ai-streaming-ui-improvement-plan.md`에서 추적. **교차점 주의**: S1(전체 페이지 SSE)은 M6 `/api/ai/ask` facade transport와, S2(Cold Start 카운트다운)는 M5 shadow planner latency 측정과 교차 가능. 동시 구현 시 transport/latency 계약을 먼저 정렬할 것
- Durable Workflow Graph, MCP-Native Tool Fabric, Managed Agent Platform으로의 runtime 전환. 2026-05-04 검토 기준으로는 현재 architecture evolution scope가 아니라 향후 trigger 기반 재검토 항목이다.

## 아키텍처 결정

| 항목 | 결정 |
|------|------|
| 기반 인프라 | Option A 유지: Vercel BFF + Cloud Run AI Engine + Redis/Cloud Tasks |
| 제품 방향 | Option C 흡수: chat-first가 아니라 artifact-first 결과물 강화 |
| 분석 방향 | Option E 흡수: deterministic core가 fact 계산, LLM은 설명/요약/포맷팅 |
| Vercel AI SDK 역할 | provider/runtime abstraction, stream, structured output, tool orchestration |
| 멀티에이전트 역할 | 유지하되 기본 실행 경로가 아니라 RCA/report/vision/advisory/cross-domain evidence에만 쓰는 escalation path |
| migration 방식 | read-only metadata → shadow authoritative plan → facade endpoint → route 축소 |

## 계약 (Contract)

> Approved 범위 중 M3~M7은 완료되었다. 이 계획서는 완료된 로드맵과 향후 판단 기준을 보존한다. 신규 구현은 artifact workspace/schema registry, facade authority 이전, provider-native reasoning, durable workflow/MCP/managed agent 도입처럼 별도 contract가 필요한 항목이 생길 때 새 plan 또는 기존 plan update로 다룬다.

### 공통 불변조건

- 기존 production route는 deprecation 전까지 backward compatible 해야 한다.
- `RouteDecision`, `AssistantPlan`, `AssistantResult` legacy metadata 복원은 throw 없이 동작해야 한다.
- 신규 contract는 secret, provider raw error, internal owner metadata를 client로 노출하지 않는다.
- 신규 LLM/provider 호출은 기본값으로 추가하지 않는다. 필요한 경우 deterministic guard와 rate-limit 기준을 먼저 둔다.
- 단순 상태 조회, metric filter/ranking, server snapshot은 multi-agent를 기본 선택하지 않는다.
- multi-agent 선택은 항상 public-safe `reasonCodes`로 설명 가능해야 하며, handoff metadata는 legacy-safe하게 보존되어야 한다.
- 배포 환경 비용은 Free Tier 원칙을 유지한다. Vercel Pro는 예외적으로 허용되지만 설계 기본값으로 사용하지 않는다.
- OTel 데이터 SSOT는 기존 precomputed fixture를 유지한다.

### M3 — 문서 및 contract 정합성

| 항목 | 계약 |
|------|------|
| 기준 문서 | `ai-assistant-initial-design-comparison.md`는 현재 M2 구현과 future authoritative contract를 분리해서 설명 |
| 점수표 | 9개 기준 × 5점이면 총점 분모는 `/45`로 표기 |
| 코드 참조 | 실제 `AssistantPlan`/`AssistantResult` shape는 `src/lib/ai/assistant-contract.ts` 기준으로 인용 |
| 남은 gap | M4~M7로 이어지는 gap table을 문서에 추가 |
| 현재 상태 판정 | 현재 구현은 Option A 개선 중간 단계이고, C/E는 M4~M7 목표 원칙임을 명시 |
| AI SDK v6 정합성 | 새 structured output 목표는 `generateText`/`streamText` + `Output.object` 방향으로 설명하고, 현 `generateObjectWithFallback`은 compatibility path로 분리 |
| Vercel duration 정합성 | Vercel 제약을 60초 hard limit로 단정하지 않고 plan/runtime/route별 duration, stream 안정성, 비용 제약으로 설명 |
| Best practice 반영 | tool guardrail, eval/recall, OTel/LLM observability, token limit 관점을 M4~M7 gap으로 연결 |

테스트/검증:
- [x] `npm run docs:budget`
- [x] `npm run docs:ai-consistency`
- [x] `git diff --check`

### M4 — ArtifactEnvelope 및 artifact versioning

변경 후보 파일:
- `src/lib/ai/chat-artifacts/types.ts`
- `src/lib/ai/chat-artifacts/*-artifact.ts`
- `src/components/ai/*ArtifactCard.tsx`
- `src/hooks/ai/utils/chat-history-storage.ts`
- `src/hooks/ai/utils/message-transform-internals.ts`
- `src/hooks/ai/utils/message-helpers.ts`
- 관련 artifact/card/history test

계약 초안:

```ts
type ArtifactEnvelope<TArtifact extends ChatArtifact = ChatArtifact> = {
  artifactVersion: string;
  kind: TArtifact['kind'];
  generatedAt: string;
  dataSlot?: string;
  sourceMode: 'otel-static' | 'tool-result' | 'restored-legacy';
  traceId?: string;
  evidence?: ArtifactEvidence[];
  providerSummary?: ProviderSummary;
  payload: TArtifact;
};
```

결정 필요:
- 기존 artifact object에 envelope 필드를 직접 추가할지, wrapper 형태로 둘지
- legacy history restore에서 envelope가 없는 artifact를 어떤 `sourceMode`로 보정할지
- `EvidenceCard`와 artifact evidence를 같은 타입으로 통합할지, frontend 전용 축약 타입을 둘지

테스트 시나리오:
- [x] legacy artifact payload는 envelope 없이도 렌더링된다.
- [x] 신규 artifact는 `artifactVersion`, `kind`, `generatedAt`, `sourceMode`를 항상 가진다.
- [x] history restore는 envelope metadata를 보존한다.
- [x] provider raw error나 internal metadata는 `providerSummary`에 들어가지 않는다.

### M5 — Authoritative Cloud Run Planner shadow mode + multi-agent escalation policy

변경 후보 파일:
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream-response.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`
- `src/app/api/ai/supervisor/stream/v2/route.ts`
- `src/app/api/ai/jobs/route.ts`
- `src/lib/ai/assistant-contract.ts`
- `src/lib/ai/route-decision.ts`

계약 초안:
- Cloud Run은 request를 받아 authoritative candidate `AssistantPlan`을 생성한다.
- 첫 단계는 shadow mode로만 노출한다. BFF/frontend의 기존 routing 동작은 즉시 변경하지 않는다.
- shadow plan과 local routeDecision이 다르면 drift metadata를 기록한다.
- drift가 일정 기준 이하로 안정화되기 전에는 frontend routing authority를 제거하지 않는다.
- `AssistantPlan`은 실행 모드를 `deterministic`, `single-agent`, `multi-agent`로 분리한다.
- multi-agent는 폐기하지 않지만 기본값으로 두지 않는다. Planner가 아래 escalation 조건을 만족할 때만 선택한다.

```ts
type AssistantExecutionMode =
  | 'deterministic'
  | 'single-agent'
  | 'multi-agent';

type MultiAgentEscalationReason =
  | 'rca_requested'
  | 'incident_report_requested'
  | 'cross_domain_evidence_required'
  | 'advisor_requested'
  | 'vision_input_present'
  | 'analysis_mode_thinking'
  | 'single_path_low_confidence';
```

Escalation 기준:

| 요청 유형 | 목표 executionMode | 기준 reason code |
|-----------|--------------------|------------------|
| 단순 인사/기능 안내 | `single-agent` 또는 deterministic guidance | `simple_chat` |
| 현재 서버 상태, CPU top N, 메모리 90% 이상 | `deterministic` 또는 `single-agent` | `metric_lookup` |
| 서버 상태 스냅샷 artifact | `deterministic` | `artifact_snapshot_requested` |
| RCA, 원인 분석, 상관관계 분석 | `multi-agent` | `rca_requested`, `cross_domain_evidence_required` |
| 장애 보고서/report 작성 | `multi-agent` 또는 report pipeline | `incident_report_requested` |
| 대응 방안/명령어 추천 | `multi-agent` | `advisor_requested` |
| image/file 포함 | `multi-agent` | `vision_input_present` |
| retrieval 근거 부족 | multi-agent 자동 승격 금지, 근거 부족 응답 우선 | `insufficient_evidence` |

비목표:
- multi-agent를 삭제하지 않는다.
- `mode='single'` emergency/degraded path를 즉시 제거하지 않는다.
- 기존 `handoffs`, `resolvedMode`, `modeSelectionSource`, `degradedFromMode` metadata를 깨지 않는다.
- 단순 metric query를 multi-agent로 보내 품질이 높아졌다고 간주하지 않는다. 비용, latency, drift까지 함께 평가한다.

테스트 시나리오:
- [x] Cloud Run planner가 chat/artifact/job plan을 shadow candidate로 생성한다.
- [x] BFF는 local decision을 Cloud Run으로 전달하고 Cloud Run은 shadow plan을 metadata로 보존하되 기존 실행 경로를 바꾸지 않는다.
- [x] local decision과 shadow plan mismatch가 public-safe reason code로 기록된다.
- [x] provider/LLM 실패 시 deterministic fallback plan이 생성된다.
- [x] 단순 metric lookup은 `multi-agent`로 escalation되지 않는다.
- [x] RCA/report/advisor/vision 요청은 `multi-agent` candidate와 escalation reason을 가진다.
- [x] retrieval low-confidence는 multi-agent 자동 승격이 아니라 `insufficient_evidence` 계약으로 노출된다.
- [x] 기존 `resolvedMode`/`handoffs` metadata는 legacy client에서 그대로 복원된다.

### M6 — `/api/ai/ask` BFF facade

변경 후보 파일:
- `src/app/api/ai/ask/route.ts`
- `src/app/api/ai/supervisor/stream/v2/route.ts`
- `src/app/api/ai/jobs/route.ts`
- `src/app/api/ai/incident-report/route.ts`
- `src/app/api/ai/intelligent-monitoring/route.ts`
- `src/hooks/ai/useHybridAIQuery.ts`
- `src/hooks/ai/useAIChatCore.ts`
- `src/types/ai-jobs.ts`

계약 초안:
- `/api/ai/ask`는 단일 public BFF facade로 request를 받는다.
- 초기 구현은 기존 stream/job/artifact route를 내부적으로 감싼다.
- facade 내부에서 별도 planner/route decision을 새로 만들지 않는다. 기존 route가 만든 `RouteDecision`/`AssistantPlan`/`AssistantResult`를 보존한다.
- frontend opt-in은 최소 1개 path부터 시작하고, 기존 `/api/ai/supervisor/stream/v2`, `/api/ai/jobs`, artifact route contract는 유지한다.
- 응답은 `AssistantPlan`/`AssistantResult` metadata를 포함한다.
- 기존 route는 즉시 삭제하지 않고 compatibility surface로 유지한다.

테스트 시나리오:
- [x] simple chat request는 streaming-compatible response로 위임된다.
- [x] long-running request는 job response로 위임된다.
- [x] artifact-shaped request는 artifact result metadata를 보존한다.
- [x] `/api/ai/ask`는 자체 planner를 실행하지 않고 기존 route wrapper로만 동작한다.
- [x] local `RouteDecision`/`AssistantPlan`/`queryAsOf` metadata는 facade 경유 후에도 보존된다.
- [x] 기존 route contract test는 계속 통과한다.

### M7 — MonitoringFactPack, provider freshness, retrieval recall guard

변경 후보 파일:
- `cloud-run/ai-engine/src/data/precomputed-state.ts`
- `cloud-run/ai-engine/src/data/precomputed-state.types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`
- `cloud-run/ai-engine/src/lib/knowledge-retrieval-lite.ts`
- `cloud-run/ai-engine/src/lib/retrieval-contract.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/*provider*`
- provider/retrieval 관련 test 및 smoke script

계약 초안:

```ts
type MonitoringFactPack = {
  factPackVersion: string;
  dataSlot: string;
  sourceMode: 'replay-json' | 'live-otel';
  queryAsOf: string;
  thresholds: Record<string, { warning: number; critical: number }>;
  summary: {
    total: number;
    online: number;
    warning: number;
    critical: number;
    offline: number;
  };
  signals: MonitoringSignal[];
  evidenceRefs: MonitoringEvidenceRef[];
};
```

테스트 시나리오:
- [x] 같은 dataSlot과 query scope는 같은 `MonitoringFactPack`을 생성한다.
- [x] CPU/Memory/Disk/Network severity는 threshold rule로 결정되며 LLM output에 의존하지 않는다.
- [x] 기존 monitoring tool result의 `sourceMode`, `queryAsOf`, `evidenceRefs`가 fact pack에 손실 없이 보존된다.
- [x] retrieval lite recall fixture가 최소 기준을 만족하지 못하면 fallback reason을 노출한다.
- [x] provider model policy freshness smoke가 stale provider metadata를 탐지한다.

## Task 목록

- [x] Task 0 — M3 문서 정합성 failing/docs check 기준 확정
- [x] Task 1 — M3 기준 문서 보정: 점수표 `/45`, M2 actual contract, M4~M7 gap table, AI SDK/Vercel/best-practice 정합성
- [x] Task 2 — M4 `ArtifactEnvelope` contract failing tests 작성
- [x] Task 3 — M4 artifact generator/card/history restore envelope 적용
- [x] Task 4a — M5a current behavior baseline + ExecutionMode contract spec/failing tests 작성
- [x] Task 4b — M5b Cloud Run authoritative planner shadow mode + multi-agent escalation policy spec 및 failing tests 작성
- [x] Task 5 — M5 shadow plan metadata, executionMode, escalation reason, drift reason 구현
- [x] Task 6 — M6 `/api/ai/ask` wrapper-only facade spec 및 failing tests 작성
- [x] Task 7 — M6 `/api/ai/ask` wrapper 구현 및 최소 1개 frontend opt-in path 연결
- [x] Task 8 — M7 `MonitoringFactPack` spec 및 deterministic tests 작성
- [x] Task 9 — M7 fact pack, retrieval recall guard, provider freshness guard 구현
- [x] Task 10 — 전체 검증, planning/TODO 상태 갱신, 필요 시 release/QA 판단

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0~1 | `docs:` | 선택 | ❌ | ❌ |
| Task 2 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 3 | `feat:` | ✅ | ❌ | frontend 변경 시 |
| Task 4 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 5 | `feat:` | ✅ | ✅ | BFF 변경 시 |
| Task 6 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 7 | `feat:` | ✅ | 판단 필요 | ✅ |
| Task 8 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 9 | `feat:` | ✅ | ✅ | 판단 필요 |
| Task 10 | `chore:`/`docs:` | ✅ | 변경 없음 | 변경 없음 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| M3 완료 후 | 문서가 현재 구현과 future target을 혼동하지 않는지 |
| M4 test 완료 후 | `ArtifactEnvelope`가 legacy artifact를 깨지 않는 계약인지 |
| M4 구현 후 | artifact payload 중복, history restore, card rendering 회귀 |
| M5 test 완료 후 | shadow mode가 routing authority를 즉시 변경하지 않고, multi-agent escalation 조건이 과도하지 않은지 |
| M5 구현 후 | planner drift metadata가 public-safe인지, provider 실패 fallback이 deterministic인지, 단순 metric query가 multi-agent로 과잉 승격되지 않는지 |
| M5 rollout 전 | current behavior baseline corpus에서 frontend/BFF/Cloud Run decision drift가 허용 범위인지 |
| M6 test 완료 후 | `/api/ai/ask`가 기존 route 제거 없이 facade 역할만 하는지 |
| M6 구현 후 | `/api/ai/ask`가 별도 planner를 만들지 않고 기존 stream/job/artifact metadata를 보존하는지 |
| M7 구현 후 | fact pack 계산이 LLM/provider 결과에 의존하지 않는지, eval guard가 CI/무료 티어에 적합한지 |

## 진행 중 블로커 대응

| 상황 | 기준 |
|------|------|
| M4 envelope가 legacy artifact restore를 크게 깨는 경우 | wrapper 방식 우선, direct field migration 보류 |
| M5 shadow planner drift가 높게 나오는 경우 | authority 이전 보류, drift corpus 추가 |
| M5 multi-agent 선택률이 단순 조회에서 높게 나오는 경우 | multi-agent 기본값 전환 금지, escalation rule과 corpus를 먼저 축소 |
| M6 `/api/ai/ask`가 route surface를 더 복잡하게 만드는 경우 | 내부 wrapper만 유지하고 frontend opt-in rollout 보류 |
| M7 provider/retrieval eval이 외부 호출을 요구하는 경우 | deterministic fixture/mocked provider 기준으로 CI guard 작성, 실 smoke는 수동/운영 QA로 분리 |
| M7 fact pack이 새 데이터 계층으로 커지는 경우 | 기존 `sourceMode/queryAsOf/evidenceRefs` tool result bundling 범위로 축소 |
| 범위가 예상보다 2배 이상 확대 | milestone별 하위 plan으로 분리 |

## 완료 기준

- [x] M3 기준 문서가 실제 M2 contract와 future target을 분리해서 설명한다.
- [x] M3 기준 문서가 종합 점수 분모를 9개 기준 기준 `/45`로 표기한다.
- [x] M3 기준 문서가 M4~M7 gap table을 포함한다.
- [x] M3 기준 문서가 현재 구현을 Option A 개선 중간 단계로 판정하고 C/E를 완료 상태가 아닌 목표 원칙으로 분리한다.
- [x] M3 기준 문서가 AI SDK v6 structured output 목표를 `Output.object` 방향으로 설명하고 기존 `generateObjectWithFallback`을 compatibility path로 분리한다.
- [x] M3 기준 문서가 Vercel duration을 60초 hard limit로 단정하지 않고 route/runtime별 제약으로 표현한다.
- [x] Artifact artifactVersion/envelope contract가 legacy-safe하게 적용된다.
- [x] Cloud Run Planner shadow mode가 `AssistantPlan` candidate, `executionMode`, escalation reason, drift metadata를 노출한다.
- [x] 현재 stream/job/artifact/multi-agent 동작 baseline corpus가 M5 변경 전후를 비교한다.
- [x] 단순 metric query는 deterministic/single 경로로 유지되고, RCA/report/vision/advisory만 multi-agent candidate가 된다.
- [x] `/api/ai/ask` facade가 기존 route를 감싸며 최소 1개 frontend opt-in path에서 동작한다.
- [x] MonitoringFactPack이 deterministic threshold 판단을 고정한다.
- [x] retrieval recall/provider freshness guard가 deterministic test 또는 bounded smoke로 추적된다.
- [x] root `npm run type-check`, `npm run lint`, `npm run test:quick`, `npm run test:contract` 통과
- [x] AI Engine 변경 시 `cd cloud-run/ai-engine && npm run type-check && npm test` 통과
- [x] docs 변경 시 `npm run docs:budget`, `npm run docs:ai-consistency` 통과
- [ ] 배포 필요 시 GitLab CI 경유 또는 예외 사유 기록

## Notes

- 이 계획은 대체 설계를 구현하기 위한 rewrite 계획이 아니다.
- 대체 설계는 현재 구현의 개선 gap을 찾는 비교 렌즈로만 사용한다.
- `Option A`는 infrastructure baseline, `Option C`는 product target, `Option E`는 analysis reliability target으로 분리해서 다룬다.
- 2026-05-03 M3 완료: 기준 문서가 M2 actual read-only facade와 future authoritative target을 분리했고, 점수표 `/45` 및 M4~M7 gap table을 반영했다.
- 2026-05-03 M4 완료: 기존 artifact payload shape는 유지하면서 envelope-compatible metadata와 `ArtifactEnvelope` helper를 추가했다. M5~M7은 milestone별 contract 승인 후 진행한다.
- 2026-05-03 M3 추가 보강: 웹/공식 문서 기준으로 현재 상태를 Option A 개선 중간 단계로 명시하고, AI SDK v6 `Output.object` 방향, Vercel route/runtime duration 표현, tool guardrail/eval/OTel observability/token limit 관점을 반영했다.
- 2026-05-03 M5-A 계획 보강: multi-agent는 폐기하지 않고 RCA/report/vision/advisory/cross-domain evidence용 escalation path로 유지하며, 기본 실행 모델은 deterministic/single로 낮추는 방향을 M5 계약에 추가했다.
- 2026-05-03 M5-B 계획 보강: 현재 실제 동작 surface(frontend artifact, frontend stream/job, Cloud Run supervisor)를 기준으로 baseline corpus, shadow planner, drift 측정, escalation guard, rollout decision 작업을 M5 실행 계획에 추가했다.
- 2026-05-03 계획서 평가 결과 반영: M5를 M5a(contract+baseline)와 M5b(shadow+drift+escalation)로 분리해 범위를 관리 가능 수준으로 축소했다. M7을 M5와 병렬 진행 가능으로 표시했다. M5-B.5 rollout decision에 drift ≤10%, latency overhead ≤200ms p95, quota 영향 ≤5% 정량 기준을 추가했다. Streaming UI plan과의 S1→M6, S2→M5 교차 리스크를 명시했다. TODO.md Active Task에 M5a를 승격했다.
- 2026-05-03 M5a 완료: `AssistantPlan.executionMode`, public-safe escalation/planner shadow normalizer, frontend/Cloud Run current behavior baseline을 구현했다. TODO.md Active Task는 M5b shadow planner로 이동했다.
- 2026-05-03 M5b 완료: local route decision 전달, Cloud Run planner shadow metadata, drift/escalation reason, 50개 corpus threshold를 구현했다. 기존 실행 authority는 유지하며 TODO.md Active Task는 M6 `/api/ai/ask` facade로 이동했다.
- 2026-05-03 M5c 완료: thinking On/Off가 frontend job routing 및 Cloud Run single/multi mode selection에 주는 차이를 각각 6개 corpus로 고정했다. thinking은 provider-native hidden reasoning이 아니라 app-level routing intensity로 유지하며, M6 `/api/ai/ask` facade가 다음 구현 대상이다.
- 2026-05-03 코드 교차 감사 반영: M6는 wrapper-only facade로 제한하고, M7 `MonitoringFactPack`은 기존 `sourceMode/queryAsOf/evidenceRefs` tool result를 canonical bundle로 묶는 계약으로 축소했다. Artifact workspace/schema registry는 M6/M7 이후 제품성 강화 과제로 유지한다.
- 2026-05-03 M6 완료: `/api/ai/ask` wrapper-only facade를 추가해 stream/job/incident-report/monitoring-analysis 기존 route로 위임하고, `NEXT_PUBLIC_AI_ASK_FACADE_ENABLED=true` frontend opt-in을 연결했다. 기본 stream endpoint와 기존 route contract는 유지한다.
- 2026-05-03 M7 완료: `MonitoringFactPack` builder를 추가해 monitoring snapshot의 `sourceMode/queryAsOf/evidenceRefs`를 보존하면서 CPU/Memory/Disk/Network severity를 threshold 기반으로 재계산한다. Replay JSON snapshot은 `factPack`을 함께 반환한다. Retrieval Lite recall guard는 최소 evidence 미달을 `insufficient_evidence`로 노출하고, provider freshness guard는 `smokeEvidence` 날짜를 deterministic하게 검사한다. 신규 LLM/provider 호출과 route surface 증설은 없다.
- 2026-05-04 최신 설계 트렌드 검토 반영: LangGraph류 Durable Workflow는 checkpoint/replay/HITL이 필요한 장기 RCA/report workflow가 될 때, MCP-Native Tool Fabric은 외부 runbook/GitHub/incident system tool ecosystem이 커질 때, Managed Agent Platform은 provider lock-in과 무료 티어 원칙을 의식적으로 포기할 때만 재검토한다. 현재는 Option A 유지 + C/E 원칙 흡수 + F/G/H 원칙 일부 차용이 더 합리적이다.
- 2026-05-04 상태 보정: Streaming UI S1~S3는 v8.11.88로 배포/QA까지 완료됐다. 이 계획서의 남은 항목은 active implementation task가 아니라 facade authority 이전, artifact workspace/schema registry, provider reasoning capability policy, factPack consumer 확대 같은 차기 plan seed로만 취급한다.
