> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-26
> Tags: refactor,line-guard,ai-assistant,ai-engine,hotspots

# Line Guard Current Hotspots Refactor Plan

- 상태: Completed
- 작성일: 2026-05-11
- TODO.md 연결: Active Tasks > Line guard current hotspots refactor
- 기준 게이트: `npm run line-guard`

## 2026-05-26 재개 기준선

2026-05-26 코드 리뷰에서 `npm run line-guard`가 다시 fail 상태가 되었다. 기존 계획을 새 파일로 복제하지 않고 본 계획을 재개한다.

```text
npm run line-guard (regression baseline, 2026-05-26)
  result: FAIL
  fail files: 3
    - cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-provider.ts (1014)
    - src/components/dashboard/ServerDashboard.tsx (919)
    - cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-answers.ts (861)
```

### 2026-05-26 추가 계약

| 영역 | 유지 계약 |
|------|-----------|
| monitoring evidence | `monitoringMetricRankingEvidenceProvider`, `monitoringMetricCurrentEvidenceProvider`, `monitoringMetricTrendEvidenceProvider`, `monitoringServerHealthEvidenceProvider` export와 prompt/evidence output shape 유지 |
| parser | `parseCurrentMetricsEvidenceRequest()` export와 `ParsedCurrentMetricsEvidenceRequest`, `SupportedMetric` type import compatibility 유지 |
| dashboard | `ServerDashboard` props, search/sort/time-range/view-mode/host-map interaction 유지 |
| line guard | fail threshold 800 lines 완화 금지 |

### 2026-05-26 추가 Task

- [x] Task 6 — 재개 기준선 커밋
  - 현재 failing gate `npm run line-guard` 결과를 계획에 기록한다.
  - 커밋 메시지: `test(spec): line guard regression baseline`
- [x] Task 7 — monitoring evidence provider 분리
  - current metric parser/prompt/provider 책임을 분리한다.
  - 완료 기준: `current-metrics-evidence-provider.ts < 800 lines`
- [x] Task 8 — monitoring evidence answer builder 분리
  - metric current/trend/group-health/ranking answer builder를 helper로 분리한다.
  - 완료 기준: `current-metrics-evidence-answers.ts < 800 lines`
- [x] Task 9 — dashboard host map/controls 분리
  - `ServerDashboard.tsx` host-map/controls/list helper를 분리한다.
  - 완료 기준: `ServerDashboard.tsx < 800 lines`
- [x] Task 10 — 최종 검증
  - `npm run line-guard` PASS
  - 관련 targeted tests와 root/AI Engine 필수 smoke PASS

### 2026-05-26 완료 결과

재발 fail 3건을 모두 800줄 미만으로 축소했다.

```text
npm run line-guard (final, 2026-05-26)
  result: PASS
  fail files: 0
  warning files: 47
  touched hotspots:
    - cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-provider.ts (201)
    - cloud-run/ai-engine/src/domains/monitoring/current-metrics-evidence-answers.ts (794)
    - src/components/dashboard/ServerDashboard.tsx (793)
```

검증:
- `npm run line-guard` PASS
- `npm run type-check` PASS
- `npm run lint` PASS
- `npm run test:quick` PASS
- `npm run test:contract` PASS
- `cd cloud-run/ai-engine && npm run type-check` PASS
- `cd cloud-run/ai-engine && npm run test` PASS
- `node scripts/dev/vitest-main-wrapper.js run --config config/testing/vitest.config.dom.ts src/components/dashboard/ServerDashboard.test.tsx` PASS
- `npm run docs:components:verify` PASS
- `npm run docs:budget` PASS
- `npm run docs:ai-consistency` PASS
- `git diff --check` PASS

## 목표

500줄 이상 파일은 경고 대상으로 추적하고, 800줄 이상 파일은 분리 진행 대상으로 처리한다.

2026-05-11 기준 `npm run line-guard`는 production TS/TSX에서 40개 warn, 5개 fail을 보고한다. 이번 작업의 목표는 기능 변경 없이 800줄 이상 fail 5건을 단계적으로 0건으로 줄이고, 500줄 이상 warn 파일은 즉시 분리 대상과 관찰 대상을 분리해 추적 기준을 복구하는 것이다.

## 현재 상태

```text
npm run line-guard (initial baseline, 2026-05-11)
  warn threshold: 500+
  fail threshold: 800+
  result: FAIL
  warn files: 40
  fail files: 5

npm run line-guard (after Task 2, 2026-05-11)
  result: FAIL
  fail files: 2
  remaining fail:
    - cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts (1182)
    - cloud-run/ai-engine/src/routes/jobs.ts (978)
```

### 2026-05-11 진행 현황

- Task 0 기준선 고정 완료: 최초 `npm run line-guard` 기준 500줄 이상 warn 40건, 800줄 이상 fail 5건.
- Task 1 완료: `src/hooks/ai/useAIChatCore.ts` 1,287줄 → 720줄.
- 신규 helper: `chat-artifact-execution.ts` 302줄, `chat-artifact-metadata.ts` 347줄, `routing-debug-messages.ts` 130줄.
- 현재 `npm run line-guard` 기준 fail은 5건 → 4건으로 감소. 남은 fail은 `supervisor-stream.ts`, `orchestrator-agent-stream.ts`, `orchestrator-routing.ts`, `routes/jobs.ts`.
- 검증: `npm run test:dom -- src/hooks/ai/useAIChatCore.test.ts`, `npm run type-check`, `npm run lint` 통과.
- Task 2 완료: `supervisor-stream.ts` 1,494줄 → 260줄, `orchestrator-agent-stream.ts` 1,202줄 → 799줄.
- 신규 AI Engine helper: `stream-provider-fallback.ts`, `stream-quota.ts`, `supervisor-single-agent-stream.ts`, `supervisor-stream-helpers.ts`, `supervisor-direct-knowledge-stream.ts`, `supervisor-single-agent-events.ts`, `orchestrator-agent-stream-helpers.ts`.
- 현재 `npm run line-guard` 기준 fail은 5건 → 2건으로 감소. 남은 fail은 `orchestrator-routing.ts`, `routes/jobs.ts`.
- 검증: `cd cloud-run/ai-engine && npm run type-check`, AI Engine stream targeted tests, `cd cloud-run/ai-engine && npm run test` 통과. `npm run line-guard`는 남은 P2 대상 2건 때문에 fail 유지.
- Task 3 완료: `orchestrator-routing.ts` 1,182줄 → 691줄.
- 신규 routing helper: `orchestrator-routing-direct-knowledge.ts`, `orchestrator-routing-topology.ts`, `orchestrator-routing-telemetry.ts`.
- 현재 `npm run line-guard` 기준 fail은 5건 → 1건으로 감소. 남은 fail은 `routes/jobs.ts`.
- 검증: `cd cloud-run/ai-engine && npm run type-check`, `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-routing.test.ts --silent=passed-only` 통과.
- Task 4 완료: `routes/jobs.ts` 978줄 → 738줄.
- 신규 jobs helper: `jobs-request-contract.ts`, `jobs-result-metadata.ts`.
- 현재 `npm run line-guard` 기준 800줄 이상 fail 0건. 500줄 이상 warn 41건은 관찰 대상으로 유지.
- 검증: `cd cloud-run/ai-engine && npm run type-check`, `cd cloud-run/ai-engine && npx vitest run src/routes/jobs.test.ts src/routes/jobs.dispatch.test.ts --silent=passed-only`, `npm run line-guard` 통과.
- Task 5 검증 일부 완료: `cd cloud-run/ai-engine && npm run test` 108 files / 1086 tests 통과, `npm run lint` 통과(info: `reports/qa/qa-tracker.json` 1.9MiB), `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` 통과.
- Task 5 완료: root `npm run type-check`, `npm run test:quick`, `npm run test:contract` 통과. Local deterministic QA `QA-20260511-0469` 기록.
- 후속 buffer polish 완료: `orchestrator-agent-stream.ts` 799줄 → 786줄, `supervisor-single-agent-stream.ts` 798줄 → 791줄. `npm run line-guard`, AI Engine `type-check`, stream/routing targeted Vitest 3 files / 43 tests 통과. Local deterministic QA `QA-20260511-0470` 기록.

### 800줄 이상 분리 대상

| 파일 | 줄 수 | 판단 | 우선순위 |
|------|------:|------|----------|
| `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts` | 260 | Task 2 완료: orchestration 진입점으로 축소 | Done |
| `src/hooks/ai/useAIChatCore.ts` | 720 | Task 1 완료: artifact/debug helper 분리 | Done |
| `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts` | 786 | Task 2 + buffer polish 완료: fallback/quota/stream helper와 server-count helper 분리 | Done/Watch |
| `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts` | 691 | Task 3 완료: direct knowledge/topology/telemetry helper 분리 | Done |
| `cloud-run/ai-engine/src/routes/jobs.ts` | 738 | Task 4 완료: request contract/result metadata helper 분리 | Done |

### 500줄 이상 경고 관찰 대상

- 즉시 분리 후보: `supervisor-single-agent-stream.ts`, `supervisor-single-agent.ts`, `AIWorkspace.tsx`, `orchestrator-execution.ts`, `LogExplorerModal.tsx`, `retry-with-fallback.ts`, `AlertHistoryModal.tsx`, `src/app/api/ai/supervisor/stream/v2/route.ts`
- 관찰만: `ops-procedure-artifact.ts` 530줄. 800줄 미만이므로 이번 작업에서 분리하지 않는다. 다음 procedure type 또는 renderer 확장 시 markdown/json builder와 generator helper 분리를 검토한다.

## 범위

- 포함:
  - 800줄 이상 fail 파일 5개를 단계적으로 800줄 미만으로 분리
  - `useAIChatCore.ts` artifact 생성/metadata/error 책임 분리
  - `supervisor-stream.ts`와 `orchestrator-agent-stream.ts`의 provider fallback/quota 공통 helper 분리
  - `orchestrator-routing.ts` direct knowledge/topology/resource catalog helper 분리
  - `routes/jobs.ts` job request/response/dispatch helper 분리
  - 기존 공개 함수/API/metadata 계약 유지
  - 관련 회귀 테스트와 `npm run line-guard` 통과
- 제외:
  - AI 응답 품질 알고리즘 변경
  - provider order, rate limit 정책, quota 숫자 변경
  - artifact schema 변경
  - UI 디자인 변경
  - Next.js dependency audit 잔여 해소
  - 500줄 이상 warn 파일 전체를 이번 작업에서 모두 500줄 미만으로 축소

## 계약 (Contract)

### 변경 대상 파일

예상 변경 범위이며 Task 0에서 실제 import/use path를 다시 확인한다.

- `src/hooks/ai/useAIChatCore.ts`
- 신규 후보: `src/hooks/ai/core/chat-artifact-execution.ts`
- 신규 후보: `src/hooks/ai/core/chat-artifact-metadata.ts`
- 신규 후보: `src/hooks/ai/core/routing-debug-messages.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/stream-provider-fallback.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/stream-quota.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/agents/direct-knowledge-normalizers.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/agents/structured-topology-response.ts`
- 신규 후보: `cloud-run/ai-engine/src/services/ai-sdk/agents/resource-catalog.ts`
- `cloud-run/ai-engine/src/routes/jobs.ts`
- 신규 후보: `cloud-run/ai-engine/src/routes/jobs/request-contract.ts`
- 신규 후보: `cloud-run/ai-engine/src/routes/jobs/stream-response.ts`
- 신규 후보: `cloud-run/ai-engine/src/routes/jobs/dispatch.ts`

### 유지해야 할 공개 계약

| 영역 | 유지 계약 |
|------|-----------|
| `useAIChatCore` | `UseAIChatCoreOptions`, `UseAIChatCoreReturn`, `useAIChatCore()` public shape 변경 금지 |
| message compatibility | `EnhancedChatMessage`, `UIMessage`, `metadata.artifactEnvelopes`, `toolResultSummaries`, `routeDecision`, `assistantPlan`, `assistantResult` shape 유지 |
| artifact generation | incident-report, monitoring-analysis, server-snapshot, ops-procedure 생성 결과와 follow-up edit 동작 유지 |
| debug/QA shortcut | `/qa-thinking-visualizer`, `/debug-routing` 응답 동작 유지 |
| supervisor stream | `executeSupervisorStream()` export와 emitted stream event semantics 유지 |
| agent stream | `executeAgentStream()` export와 provider fallback/repair semantics 유지 |
| forced routing | `executeForcedRouting()`, `getOrchestratorModel()`, `getAgentConfig()` export 유지 |
| job route | `/api/ai/jobs`, `/api/ai/jobs/:id`, `/api/ai/jobs/:id/stream` 응답 계약 유지 |
| line guard | 기존 `npm run line-guard -- --warn 500 --fail 800` 기준을 완화하지 않음 |

### 테스트 시나리오

- [x] `line-guard baseline`: 현재 `npm run line-guard`가 fail 5건을 보고하는 상태를 Task 0에 기록한다.
- [x] `useAIChatCore artifact parity`: artifact intent/guidance/generation/follow-up edit 관련 기존 테스트가 refactor 후 동일하게 통과한다.
- [x] `useAIChatCore public contract`: `UseAIChatCoreReturn` shape와 `convertThinkingStepsToUI` re-export가 유지된다.
- [x] `supervisor stream parity`: supervisor stream fallback, tool summary, deterministic recovery 관련 테스트가 동일하게 통과한다.
- [x] `agent stream parity`: orchestrator agent stream fallback, raw tool JSON suppression, deterministic repair 테스트가 동일하게 통과한다.
- [x] `forced routing parity`: direct knowledge/topology/resource catalog 관련 routing 테스트가 동일하게 통과한다.
- [x] `jobs route parity`: job create/status/stream route 테스트가 동일하게 통과한다.
- [x] `line-guard final`: 800줄 이상 fail 0건, 새 파일 800줄 이상 0건.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다. 기존 `npm run line-guard`가 이미 failing gate이므로 Task 0은 새로운 인위적 failing test가 아니라 현재 failing gate와 관련 targeted tests를 기준선으로 고정한다.

- [x] Task 0 — 기준선 고정
  - `npm run line-guard` fail 5건 기록
  - 대상 파일별 현재 public export/import 사용처 확인
  - 관련 targeted test 명령 목록 확정
- [x] Task 1 — `useAIChatCore` 책임 분리
  - artifact generation/metadata/error summary를 `core` helper로 분리
  - QA/debug shortcut message builder를 별도 helper로 분리
  - 완료 기준: `useAIChatCore.ts < 800 lines`, root targeted tests 통과
- [x] Task 2 — stream fallback/quota 공통부 분리
  - `supervisor-stream.ts`와 `orchestrator-agent-stream.ts`의 provider fallback/quota helper를 공통 모듈로 추출
  - 완료 기준: 두 파일 모두 800 lines 미만, AI Engine stream targeted tests 통과
- [x] Task 3 — `orchestrator-routing` helper 분리
  - direct knowledge normalizer, topology response, resource catalog helper 추출
  - 완료 기준: `orchestrator-routing.ts < 800 lines`, `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-routing.test.ts --silent=passed-only` 통과
- [x] Task 4 — `routes/jobs` helper 분리
  - request contract, dispatch, stream response helper 추출
  - 완료 기준: `routes/jobs.ts < 800 lines`, jobs route targeted tests 통과
- [x] Task 5 — 최종 검증/QA 기록
  - `npm run line-guard` PASS
  - root/AI Engine 필수 smoke
  - local deterministic QA 기록
  - TODO/plan 완료 처리 및 archive 이동

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` 또는 `chore(refactor):` | 선택 | 아니오 | 아니오 |
| Task 1 | `refactor(ai):` | 예 | 아니오 | 변경 시 |
| Task 2 | `refactor(ai-engine):` | 예 | 예 | 아니오 |
| Task 3 | `refactor(ai-engine):` | 예 | 예 | 아니오 |
| Task 4 | `refactor(ai-engine):` | 예 | 예 | 아니오 |
| Task 5 | `chore(qa):` | 예 | 판단 필요 | 판단 필요 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 대상 파일과 테스트 범위가 실제 hotspot을 포착하는지 |
| Task 1 완료 후 | artifact metadata/routeDecision/assistantPlan shape 회귀 여부 |
| Task 2 완료 후 | provider fallback, quota reserve/reconcile/cooldown semantics 회귀 여부 |
| Task 3 완료 후 | forced routing/topology direct answer 회귀 여부 |
| Task 4 완료 후 | job/SSE contract, CSRF/auth/rate limit 경계 유지 여부 |
| 전체 완료 후 | `npm run line-guard` fail 0과 필수 smoke 통과 여부 |

## 위험 및 대응

| 위험 | 대응 |
|------|------|
| 리팩터링 중 동작 변경 | public contract 유지 + existing targeted tests 우선 |
| 공통 helper 추출로 single/multi stream 차이 손실 | 공통화는 fallback/quota처럼 동일한 불변조건에 한정 |
| 새 helper가 다시 800줄 초과 | Task 완료 기준에 새 파일 800줄 이상 금지 포함 |
| 500줄 warn 전체를 한 번에 처리하려다 범위 과대화 | 이번 계획의 완료 기준은 fail 5건 해소로 제한 |
| Cloud Run runtime 회귀 | AI Engine full test와 필요 시 targeted smoke로 검증 |

## 완료 기준

- [x] 800줄 이상 fail 파일 5건 모두 800줄 미만
- [x] 새로 만든 파일 중 800줄 이상 0건
- [x] `npm run line-guard` PASS
- [x] root targeted tests PASS
- [x] AI Engine targeted tests PASS
- [x] `npm run type-check` PASS
- [x] `npm run lint` PASS
- [x] `npm run test:quick` PASS
- [x] AI/API 계약 영향 범위 `npm run test:contract` PASS
- [x] `cd cloud-run/ai-engine && npm run type-check` PASS
- [x] `cd cloud-run/ai-engine && npm run test` PASS
- [x] QA 기록 생성: [QA-20260511-0469](../../qa/runs/2026/qa-run-QA-20260511-0469.json), buffer polish [QA-20260511-0470](../../qa/runs/2026/qa-run-QA-20260511-0470.json)
