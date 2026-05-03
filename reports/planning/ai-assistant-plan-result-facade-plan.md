> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-03
> Tags: ai-assistant,assistant-plan,assistant-result,metadata,contract

# AI Assistant Plan Result Facade Plan

- 상태: Completed
- 작성일: 2026-05-03
- TODO.md 연결: Active Tasks > `AI Assistant AssistantPlan/AssistantResult facade M2`

## 목표

기존 라우팅 동작을 바꾸지 않고, M1에서 추가한 `routeDecision` metadata를 `AssistantPlan`과 `AssistantResult` read-only facade로 감싼다. 목적은 streaming path, job queue path, artifact path, Cloud Run supervisor path가 같은 계획/결과 언어를 보존하게 만드는 것이다.

## 범위

- 포함:
  - root app 공통 `AssistantPlan` / `AssistantResult` type, builder, normalizer 추가
  - frontend artifact/stream/job metadata에 read-only facade 보존
  - BFF job 생성 응답과 Redis job metadata에 `assistantPlan` 보존
  - Cloud Run supervisor stream done/job result metadata에 compatible facade 보존
  - message history, async SSE, stream done metadata에서 legacy-safe normalize/persist 보강
- 제외:
  - `/api/ask` 단일 endpoint 구현
  - routing 권한을 frontend에서 Cloud Run Planner로 이전
  - UI badge 또는 debug tab 노출
  - Artifact schema registry, `ArtifactEnvelope`, `MonitoringFactPack`
  - provider policy freshness 필드

## 계약 (Contract)

### 변경 대상 파일

- `src/lib/ai/assistant-contract.ts`
- `src/lib/ai/assistant-contract.test.ts`
- `src/types/ai-jobs.ts`
- `src/stores/useAISidebarStore.ts`
- `src/hooks/ai/useAIChatCore.ts`
- `src/hooks/ai/useHybridAIQuery.ts`
- `src/hooks/ai/useAsyncAIQuery.ts`
- `src/hooks/ai/core/asyncQuerySSE.ts`
- `src/hooks/ai/core/useChatHistory.ts`
- `src/hooks/ai/utils/message-helpers.ts`
- `src/hooks/ai/utils/message-transform-internals.ts`
- `src/hooks/ai/utils/chat-history-storage.ts`
- `src/hooks/ai/utils/stream-data-handler.ts`
- `src/app/api/ai/jobs/route.ts`
- `src/app/api/ai/jobs/job-metadata.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream-response.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-types.ts`
- `cloud-run/ai-engine/src/routes/jobs.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `buildAssistantPlanFromRouteDecision()` | `RouteDecision` + optional override | `AssistantPlan` | invalid routeDecision은 normalizer 단계에서 `undefined` |
| `buildAssistantResultFromRouteDecision()` | `RouteDecision` + optional override | `AssistantResult` | invalid result status/kind는 normalizer 단계에서 `undefined` |
| `normalizeAssistantPlan()` | `unknown` | `AssistantPlan | undefined` | legacy/invalid metadata는 throw 없이 `undefined` |
| `normalizeAssistantResult()` | `unknown` | `AssistantResult | undefined` | legacy/invalid metadata는 throw 없이 `undefined` |
| `POST /api/ai/jobs` | 기존 job request body | 기존 response + `routeDecision` + `assistantPlan` | facade 누락 시 기존 응답 유지 |
| Cloud Run stream done event | 기존 supervisor request | 기존 done metadata + `routeDecision` + `assistantPlan` + `assistantResult` | mode decision 실패 시 기존 fallback 유지 |
| chat/artifact message metadata | 기존 assistant metadata | 기존 metadata + optional `assistantPlan`/`assistantResult` | legacy restore는 facade 없이 통과 |

### `AssistantPlan` shape

```ts
type AssistantPlan = {
  kind: 'chat' | 'artifact' | 'clarification';
  planVersion: string;
  routeDecision: RouteDecision;
  executionPath: RouteDecision['executionPath'];
  stream: boolean;
  job: boolean;
  artifactKind?: RouteDecision['artifactKind'];
  reasonCodes: string[];
  dataSlot?: string;
  traceId?: string;
  decidedBy: RouteDecision['decidedBy'];
};
```

### `AssistantResult` shape

```ts
type AssistantResult = {
  kind: 'chat' | 'artifact' | 'error';
  resultVersion: string;
  routeDecision?: RouteDecision;
  status: 'completed' | 'failed' | 'partial';
  artifactKind?: RouteDecision['artifactKind'];
  traceId?: string;
  errorCode?: string;
};
```

### 테스트 시나리오 (구현 전 확정)

- [x] `assistant-contract`: valid `routeDecision`에서 stream/job/artifact plan과 result facade를 생성하고 invalid enum drift를 reject한다.
- [x] `useAIChatCore`: server snapshot/incident/monitoring artifact metadata에 `assistantPlan`과 `assistantResult`를 보존한다.
- [x] `message-helpers`/history restore: facade가 있는 metadata는 보존하고 없는 legacy metadata도 정상 복원한다.
- [x] `stream-data-handler`/async SSE: stream done 및 job result metadata의 facade를 assistant metadata까지 전달한다.
- [x] `POST /api/ai/jobs`: 생성 응답과 stored job metadata에 `assistantPlan`을 포함한다.
- [x] Cloud Run supervisor stream done metadata: `routeDecision`과 compatible `assistantPlan`/`assistantResult`를 함께 노출한다.

## Task 목록

- [x] Task 0 - failing contract tests 추가
- [x] Task 1 - root app 공통 facade type/helper 추가
- [x] Task 2 - frontend stream/job/artifact metadata 매핑
- [x] Task 3 - BFF job metadata 매핑
- [x] Task 4 - Cloud Run supervisor done/job metadata 매핑
- [x] Task 5 - targeted 검증 및 문서 상태 갱신

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~4 | `feat:` | 선택 | Cloud Run 변경 포함 시 필요 | frontend/BFF 변경 포함 시 필요 |
| Task 5 | `docs:` 또는 없음 | 선택 | ❌ | ❌ |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 테스트가 read-only facade 계약만 요구하는지 |
| Task 2~4 완료 후 | 기존 routing 동작 변경 여부, metadata sanitizer/legacy restore 영향 |
| 전체 완료 후 | targeted tests, type-check, docs budget |

## 완료 기준

- [x] 테스트 시나리오 전체 통과
- [x] root targeted facade/routeDecision suite 통과 (`144/144`)
- [x] AI Engine targeted supervisor facade suite 통과 (`1/1`)
- [x] `npm run type-check`
- [x] `cd cloud-run/ai-engine && npm run type-check`
- [x] `npm run lint`
- [x] `npm run test:quick`
- [x] `npm run test:contract`
- [x] `cd cloud-run/ai-engine && npm test` (`962/962`)
- [x] `npm run docs:budget`
- [x] `npm run docs:ai-consistency`
- [x] `git diff --check`

## 진행 로그

- 2026-05-03 Task 0: root targeted facade suite가 `10 failed / 1 failed suite`, AI Engine supervisor stream targeted suite가 `1 failed`로 실패함을 확인했다. 실패 지점은 모두 `assistantPlan`/`assistantResult` 생성 또는 metadata 보존 누락이며, 기존 routeDecision routing 동작 실패는 아니다.
- 2026-05-03 Task 1~4: `src/lib/ai/assistant-contract.ts` helper를 추가하고 frontend artifact/stream/job, BFF job, Cloud Run supervisor stream/job result, history/restore/SSE 경로에 facade metadata를 연결했다.

## Completion Notes

- `AssistantPlan`은 routeDecision의 `executionPath`, `reasonCodes`, `dataSlot`, `traceId`, `decidedBy`를 그대로 감싸며 read-only plan language로만 사용한다.
- `AssistantResult`는 stream/job/artifact 완료 결과를 같은 result language로 보존한다. 실패한 client artifact는 `status='failed'`와 public error code만 기록한다.
- `/api/ask` 단일 endpoint, routing authority 이전, UI debug badge, artifact schema registry는 범위 밖으로 유지했다.
