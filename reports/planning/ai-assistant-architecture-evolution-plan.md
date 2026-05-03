> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-03
> Tags: ai-assistant,architecture,assistant-plan,artifact,deterministic-analytics,vercel-ai-sdk

# AI Assistant Architecture Evolution Plan

- 상태: Approved (M3 completed; M4~M7 pending milestone approval)
- 작성일: 2026-05-03
- TODO.md 연결: Backlog > `AI Assistant Architecture Evolution (M4~M7)`
- 기준 문서: [ai-assistant-initial-design-comparison.md](../../docs/reference/architecture/ai/ai-assistant-initial-design-comparison.md)
- 선행 완료:
  - [AI Assistant Route Decision Metadata Plan](ai-assistant-route-decision-metadata-plan.md) — M1 완료
  - [AI Assistant Plan Result Facade Plan](ai-assistant-plan-result-facade-plan.md) — M2 완료
- 관련 분리 계획:
  - [AI Streaming UI Improvement Plan](ai-streaming-ui-improvement-plan.md) — streaming UX, cold start, agent-step UI는 별도 진행

## 목표

현재 `Vercel BFF + Cloud Run AI Engine` 기반 Option A 인프라는 유지한다. 대신 AI Assistant의 제품/분석 목표를 다음 방향으로 진화시킨다.

- 제품 목표: 채팅 텍스트보다 typed artifact를 우선하는 Option C 흡수
- 분석 목표: LLM이 메트릭을 판단하지 않고 deterministic monitoring core가 fact를 계산하는 Option E 흡수
- 런타임 기준: Vercel AI SDK는 streaming, structured output, tool orchestration 계층으로 사용하고 metric decision engine으로 사용하지 않음
- 개선 방식: big-bang rewrite 없이 M1/M2 read-only contract 위에 단계적으로 authority와 schema를 수렴

최종 목표 구조:

```text
User query
  -> BFF facade
  -> Cloud Run Planner creates authoritative AssistantPlan
  -> Deterministic monitoring core creates MonitoringFactPack
  -> LLM formats/explains facts through Vercel AI SDK
  -> AssistantResult returns typed ArtifactEnvelope or chat result
  -> Frontend renders by result kind, not by duplicated routing logic
```

## 현재 기준선

- M1: `RouteDecision` metadata가 frontend stream/job/artifact, BFF job, Cloud Run supervisor result 경로에 read-only로 보존됨
- M2: `AssistantPlan`/`AssistantResult` read-only facade가 `RouteDecision` 위에 추가됨
- 아직 routing authority는 frontend/BFF/Cloud Run에 분산되어 있음
- artifact 타입은 `IncidentReportArtifact`, `MonitoringAnalysisArtifact`, `ServerSnapshotArtifact`로 분리되어 있으나 공통 envelope/version contract는 없음
- precomputed OTel 데이터와 AI Engine tool layer는 이미 deterministic fact source에 가깝지만, `MonitoringFactPack` 같은 명시적 경계는 없음
- BM25 기반 Knowledge Retrieval Lite와 provider fallback은 운영 중이나 recall/freshness eval guard가 충분히 표준화되지 않음

## 범위

### 포함

- M3: 기준 문서와 실제 M2 contract 정합성 보정
- M4: `ArtifactEnvelope` 및 artifact versioning contract 정의
- M5: Cloud Run Planner가 생성하는 authoritative `AssistantPlan` shadow mode 도입
- M6: `/api/ask` BFF facade 설계 및 기존 stream/job/artifact route wrapping
- M7: deterministic `MonitoringFactPack`와 provider/retrieval eval guard 도입

### 제외

- Vercel BFF + Cloud Run AI Engine 분리 구조 제거
- 기존 `/api/ai/supervisor/stream/v2`, `/api/ai/jobs`, artifact route 즉시 삭제
- WebSocket 전환
- 실시간 ingestion 전환
- vector/GraphRAG 재도입
- Supabase에 개인 chat/artifact history를 기본 저장하는 정책 변경
- Cloud Run/Vercel 스펙 증설
- streaming UI 구현 세부사항: `ai-streaming-ui-improvement-plan.md`에서 추적

## 아키텍처 결정

| 항목 | 결정 |
|------|------|
| 기반 인프라 | Option A 유지: Vercel BFF + Cloud Run AI Engine + Redis/Cloud Tasks |
| 제품 방향 | Option C 흡수: chat-first가 아니라 artifact-first 결과물 강화 |
| 분석 방향 | Option E 흡수: deterministic core가 fact 계산, LLM은 설명/요약/포맷팅 |
| Vercel AI SDK 역할 | provider/runtime abstraction, stream, structured output, tool orchestration |
| migration 방식 | read-only metadata → shadow authoritative plan → facade endpoint → route 축소 |

## 계약 (Contract)

> Approved 범위는 M3 문서/contract 정합성으로 제한한다. M4~M7은 변경 대상 파일과 계약 초안은 기록되어 있으나, 구현 착수 전 milestone별 failing test 시나리오를 다시 확정한다. 이 계획서는 전체 로드맵이며, 구현은 milestone 단위로 진행한다.

### 공통 불변조건

- 기존 production route는 deprecation 전까지 backward compatible 해야 한다.
- `RouteDecision`, `AssistantPlan`, `AssistantResult` legacy metadata 복원은 throw 없이 동작해야 한다.
- 신규 contract는 secret, provider raw error, internal owner metadata를 client로 노출하지 않는다.
- 신규 LLM/provider 호출은 기본값으로 추가하지 않는다. 필요한 경우 deterministic guard와 rate-limit 기준을 먼저 둔다.
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
- [ ] legacy artifact payload는 envelope 없이도 렌더링된다.
- [ ] 신규 artifact는 `artifactVersion`, `kind`, `generatedAt`, `sourceMode`를 항상 가진다.
- [ ] history restore는 envelope metadata를 보존한다.
- [ ] provider raw error나 internal metadata는 `providerSummary`에 들어가지 않는다.

### M5 — Authoritative Cloud Run Planner shadow mode

변경 후보 파일:
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream-response.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-types.ts`
- `src/app/api/ai/supervisor/stream/v2/route.ts`
- `src/app/api/ai/jobs/route.ts`
- `src/lib/ai/assistant-contract.ts`
- `src/lib/ai/route-decision.ts`

계약 초안:
- Cloud Run은 request를 받아 authoritative candidate `AssistantPlan`을 생성한다.
- 첫 단계는 shadow mode로만 노출한다. BFF/frontend의 기존 routing 동작은 즉시 변경하지 않는다.
- shadow plan과 local routeDecision이 다르면 drift metadata를 기록한다.
- drift가 일정 기준 이하로 안정화되기 전에는 frontend routing authority를 제거하지 않는다.

테스트 시나리오:
- [ ] Cloud Run planner가 chat/artifact/job/clarification plan을 생성한다.
- [ ] BFF는 Cloud Run shadow plan을 metadata로 보존하되 기존 실행 경로를 바꾸지 않는다.
- [ ] local decision과 shadow plan mismatch가 public-safe reason code로 기록된다.
- [ ] provider/LLM 실패 시 deterministic fallback plan이 생성된다.

### M6 — `/api/ask` BFF facade

변경 후보 파일:
- `src/app/api/ask/route.ts` 또는 `src/app/api/ai/ask/route.ts`
- `src/app/api/ai/supervisor/stream/v2/route.ts`
- `src/app/api/ai/jobs/route.ts`
- `src/app/api/ai/incident-report/route.ts`
- `src/app/api/ai/intelligent-monitoring/route.ts`
- `src/hooks/ai/useHybridAIQuery.ts`
- `src/hooks/ai/useAIChatCore.ts`
- `src/types/ai-jobs.ts`

계약 초안:
- `/api/ask`는 단일 public BFF facade로 request를 받는다.
- 초기 구현은 기존 stream/job/artifact route를 내부적으로 감싼다.
- 응답은 `AssistantPlan`/`AssistantResult` metadata를 포함한다.
- 기존 route는 즉시 삭제하지 않고 compatibility surface로 유지한다.

테스트 시나리오:
- [ ] simple chat request는 streaming-compatible response로 위임된다.
- [ ] long-running request는 job response로 위임된다.
- [ ] artifact-shaped request는 artifact result metadata를 보존한다.
- [ ] 기존 route contract test는 계속 통과한다.

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
  thresholds: Record<string, { warning: number; critical: number }>;
  summary: {
    total: number;
    online: number;
    warning: number;
    critical: number;
    offline: number;
  };
  signals: MonitoringSignal[];
  evidenceRefs: string[];
};
```

테스트 시나리오:
- [ ] 같은 dataSlot과 query scope는 같은 `MonitoringFactPack`을 생성한다.
- [ ] CPU/Memory/Disk/Network severity는 threshold rule로 결정되며 LLM output에 의존하지 않는다.
- [ ] retrieval lite recall fixture가 최소 기준을 만족하지 못하면 fallback reason을 노출한다.
- [ ] provider model policy freshness smoke가 stale provider metadata를 탐지한다.

## Task 목록

- [x] Task 0 — M3 문서 정합성 failing/docs check 기준 확정
- [x] Task 1 — M3 기준 문서 보정: 점수표 `/45`, M2 actual contract, M4~M7 gap table, AI SDK/Vercel/best-practice 정합성
- [ ] Task 2 — M4 `ArtifactEnvelope` contract failing tests 작성
- [ ] Task 3 — M4 artifact generator/card/history restore envelope 적용
- [ ] Task 4 — M5 Cloud Run authoritative planner shadow mode spec 및 failing tests 작성
- [ ] Task 5 — M5 shadow plan metadata, drift reason, fallback plan 구현
- [ ] Task 6 — M6 `/api/ask` facade spec 및 failing tests 작성
- [ ] Task 7 — M6 `/api/ask` wrapper 구현 및 frontend opt-in path 연결
- [ ] Task 8 — M7 `MonitoringFactPack` spec 및 deterministic tests 작성
- [ ] Task 9 — M7 fact pack, retrieval recall guard, provider freshness guard 구현
- [ ] Task 10 — 전체 검증, planning/TODO 상태 갱신, 필요 시 release/QA 판단

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
| M5 test 완료 후 | shadow mode가 routing authority를 즉시 변경하지 않는지 |
| M5 구현 후 | planner drift metadata가 public-safe인지, provider 실패 fallback이 deterministic인지 |
| M6 test 완료 후 | `/api/ask`가 기존 route 제거 없이 facade 역할만 하는지 |
| M7 구현 후 | fact pack 계산이 LLM/provider 결과에 의존하지 않는지, eval guard가 CI/무료 티어에 적합한지 |

## 진행 중 블로커 대응

| 상황 | 기준 |
|------|------|
| M4 envelope가 legacy artifact restore를 크게 깨는 경우 | wrapper 방식 우선, direct field migration 보류 |
| M5 shadow planner drift가 높게 나오는 경우 | authority 이전 보류, drift corpus 추가 |
| M6 `/api/ask`가 route surface를 더 복잡하게 만드는 경우 | 내부 wrapper만 유지하고 frontend opt-in rollout 보류 |
| M7 provider/retrieval eval이 외부 호출을 요구하는 경우 | deterministic fixture/mocked provider 기준으로 CI guard 작성, 실 smoke는 수동/운영 QA로 분리 |
| 범위가 예상보다 2배 이상 확대 | milestone별 하위 plan으로 분리 |

## 완료 기준

- [x] M3 기준 문서가 실제 M2 contract와 future target을 분리해서 설명한다.
- [x] M3 기준 문서가 종합 점수 분모를 9개 기준 기준 `/45`로 표기한다.
- [x] M3 기준 문서가 M4~M7 gap table을 포함한다.
- [x] M3 기준 문서가 현재 구현을 Option A 개선 중간 단계로 판정하고 C/E를 완료 상태가 아닌 목표 원칙으로 분리한다.
- [x] M3 기준 문서가 AI SDK v6 structured output 목표를 `Output.object` 방향으로 설명하고 기존 `generateObjectWithFallback`을 compatibility path로 분리한다.
- [x] M3 기준 문서가 Vercel duration을 60초 hard limit로 단정하지 않고 route/runtime별 제약으로 표현한다.
- [ ] Artifact artifactVersion/envelope contract가 legacy-safe하게 적용된다.
- [ ] Cloud Run Planner shadow mode가 `AssistantPlan` candidate와 drift metadata를 노출한다.
- [ ] `/api/ask` facade가 기존 route를 감싸며 최소 1개 frontend opt-in path에서 동작한다.
- [ ] MonitoringFactPack이 deterministic threshold 판단을 고정한다.
- [ ] retrieval recall/provider freshness guard가 deterministic test 또는 bounded smoke로 추적된다.
- [ ] root `npm run type-check`, `npm run lint`, `npm run test:quick`, `npm run test:contract` 통과
- [ ] AI Engine 변경 시 `cd cloud-run/ai-engine && npm run type-check && npm test` 통과
- [x] docs 변경 시 `npm run docs:budget`, `npm run docs:ai-consistency` 통과
- [ ] 배포 필요 시 GitLab CI 경유 또는 예외 사유 기록

## Notes

- 이 계획은 대체 설계를 구현하기 위한 rewrite 계획이 아니다.
- 대체 설계는 현재 구현의 개선 gap을 찾는 비교 렌즈로만 사용한다.
- `Option A`는 infrastructure baseline, `Option C`는 product target, `Option E`는 analysis reliability target으로 분리해서 다룬다.
- 2026-05-03 M3 완료: 기준 문서가 M2 actual read-only facade와 future authoritative target을 분리했고, 점수표 `/45` 및 M4~M7 gap table을 반영했다.
- 2026-05-03 M3 추가 보강: 웹/공식 문서 기준으로 현재 상태를 Option A 개선 중간 단계로 명시하고, AI SDK v6 `Output.object` 방향, Vercel route/runtime duration 표현, tool guardrail/eval/OTel observability/token limit 관점을 반영했다.
