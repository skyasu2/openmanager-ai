> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-11
> Tags: refactor,line-guard,ai-assistant,ai-engine,hotspots

# Line Guard Current Hotspots Refactor Plan

- 상태: Approved
- 작성일: 2026-05-11
- TODO.md 연결: Backlog > Line guard current hotspots refactor
- 기준 게이트: `npm run line-guard`

## 목표

500줄 이상 파일은 경고 대상으로 추적하고, 800줄 이상 파일은 분리 진행 대상으로 처리한다.

2026-05-11 기준 `npm run line-guard`는 production TS/TSX에서 40개 warn, 5개 fail을 보고한다. 이번 작업의 목표는 기능 변경 없이 800줄 이상 fail 5건을 단계적으로 0건으로 줄이고, 500줄 이상 warn 파일은 즉시 분리 대상과 관찰 대상을 분리해 추적 기준을 복구하는 것이다.

## 현재 상태

```text
npm run line-guard
  warn threshold: 500+
  fail threshold: 800+
  result: FAIL
  warn files: 40
  fail files: 5
```

### 800줄 이상 분리 대상

| 파일 | 줄 수 | 판단 | 우선순위 |
|------|------:|------|----------|
| `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts` | 1494 | provider fallback, quota, tool result, stream event 책임 혼재 | P1 |
| `src/hooks/ai/useAIChatCore.ts` | 1287 | 채팅 상태, artifact intent/generation/metadata/error, QA/debug shortcut 책임 혼재 | P0 |
| `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts` | 1202 | supervisor stream과 유사한 fallback/quota/repair 흐름 중복 | P1 |
| `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts` | 1182 | forced routing, direct knowledge parsing, topology response, resource catalog 혼재 | P2 |
| `cloud-run/ai-engine/src/routes/jobs.ts` | 978 | job route validation, auth/context, dispatch, status/SSE 응답 혼재 | P2 |

### 500줄 이상 경고 관찰 대상

- 즉시 분리 후보: `supervisor-single-agent.ts`, `AIWorkspace.tsx`, `orchestrator-execution.ts`, `LogExplorerModal.tsx`, `retry-with-fallback.ts`, `AlertHistoryModal.tsx`, `src/app/api/ai/supervisor/stream/v2/route.ts`
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
- 신규 후보: `src/hooks/ai/core/debug-routing-messages.ts`
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

- [ ] `line-guard baseline`: 현재 `npm run line-guard`가 fail 5건을 보고하는 상태를 Task 0에 기록한다.
- [ ] `useAIChatCore artifact parity`: artifact intent/guidance/generation/follow-up edit 관련 기존 테스트가 refactor 후 동일하게 통과한다.
- [ ] `useAIChatCore public contract`: `UseAIChatCoreReturn` shape와 `convertThinkingStepsToUI` re-export가 유지된다.
- [ ] `supervisor stream parity`: supervisor stream fallback, tool summary, deterministic recovery 관련 테스트가 동일하게 통과한다.
- [ ] `agent stream parity`: orchestrator agent stream fallback, raw tool JSON suppression, deterministic repair 테스트가 동일하게 통과한다.
- [ ] `forced routing parity`: direct knowledge/topology/resource catalog 관련 routing 테스트가 동일하게 통과한다.
- [ ] `jobs route parity`: job create/status/stream route 테스트가 동일하게 통과한다.
- [ ] `line-guard final`: 800줄 이상 fail 0건, 새 파일 800줄 이상 0건.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다. 기존 `npm run line-guard`가 이미 failing gate이므로 Task 0은 새로운 인위적 failing test가 아니라 현재 failing gate와 관련 targeted tests를 기준선으로 고정한다.

- [ ] Task 0 — 기준선 고정
  - `npm run line-guard` fail 5건 기록
  - 대상 파일별 현재 public export/import 사용처 확인
  - 관련 targeted test 명령 목록 확정
- [ ] Task 1 — `useAIChatCore` 책임 분리
  - artifact generation/metadata/error summary를 `core` helper로 분리
  - QA/debug shortcut message builder를 별도 helper로 분리
  - 완료 기준: `useAIChatCore.ts < 800 lines`, root targeted tests 통과
- [ ] Task 2 — stream fallback/quota 공통부 분리
  - `supervisor-stream.ts`와 `orchestrator-agent-stream.ts`의 provider fallback/quota helper를 공통 모듈로 추출
  - 완료 기준: 두 파일 모두 800 lines 미만, AI Engine stream targeted tests 통과
- [ ] Task 3 — `orchestrator-routing` helper 분리
  - direct knowledge normalizer, topology response, resource catalog helper 추출
  - 완료 기준: `orchestrator-routing.ts < 800 lines`, routing targeted tests 통과
- [ ] Task 4 — `routes/jobs` helper 분리
  - request contract, dispatch, stream response helper 추출
  - 완료 기준: `routes/jobs.ts < 800 lines`, jobs route targeted tests 통과
- [ ] Task 5 — 최종 검증/QA 기록
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

- [ ] 800줄 이상 fail 파일 5건 모두 800줄 미만
- [ ] 새로 만든 파일 중 800줄 이상 0건
- [ ] `npm run line-guard` PASS
- [ ] root targeted tests PASS
- [ ] AI Engine targeted tests PASS
- [ ] `npm run type-check` PASS
- [ ] `npm run lint` PASS
- [ ] `npm run test:quick` PASS
- [ ] AI/API 계약 영향 범위 `npm run test:contract` PASS
- [ ] `cd cloud-run/ai-engine && npm run type-check` PASS
- [ ] `cd cloud-run/ai-engine && npm run test` PASS
- [ ] QA 기록 생성
