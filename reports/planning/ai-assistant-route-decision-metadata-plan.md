> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-03
> Tags: ai-assistant,route-decision,metadata,contract

# AI Assistant Route Decision Metadata Plan

- 상태: Completed
- 작성일: 2026-05-03
- TODO.md 연결: Active Tasks > `AI Assistant routeDecision metadata M1`

## 목표

AI Assistant의 기존 routing 동작은 바꾸지 않고, frontend streaming path, async job path, artifact path, Cloud Run supervisor path가 같은 read-only `routeDecision` metadata 언어를 쓰게 한다.

## 범위

- 포함:
  - `routeDecision` read-only metadata contract 추가
  - 기존 streaming/job/artifact/supervisor 판단 결과를 contract에 매핑
  - assistant message metadata, stream done metadata, job result metadata에서 shape 보존
  - legacy metadata가 없어도 기존 복원 동작 유지
- 제외:
  - `/api/ask` 실제 endpoint 구현
  - routing 권한을 Cloud Run Planner로 이전
  - UI debug badge 노출
  - artifact schema registry, `ArtifactEnvelope`, `MonitoringFactPack`

## 계약 (Contract)

### 변경 대상 파일

- `src/lib/ai/route-decision.ts`
- `src/hooks/ai/core/useQueryExecution.ts`
- `src/hooks/ai/useAIChatCore.ts`
- `src/hooks/ai/utils/message-helpers.ts`
- `src/hooks/ai/utils/chat-history-storage.ts`
- `src/hooks/ai/core/useChatHistory.ts`
- `src/app/api/ai/jobs/route.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream-response.ts`
- 필요 시 관련 test 파일

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `buildRouteDecision()` | existing local routing facts | `RouteDecision` | invalid enum은 compile-time union으로 차단 |
| `POST /api/ai/jobs` | 기존 job request body | 기존 response + `metadata.routeDecision` | metadata 누락 시 기존 응답 유지 |
| `POST /api/ai/supervisor/stream/v2` Cloud Run done event | 기존 supervisor request | 기존 done metadata + `routeDecision` | mode decision 실패 시 기존 fallback 유지 |
| chat/artifact message metadata | 기존 assistant metadata | 기존 metadata + optional `routeDecision` | legacy restore는 `routeDecision` 없이 통과 |

### `RouteDecision` shape

```ts
type RouteDecision = {
  intent: 'chat' | 'artifact' | 'job' | 'clarification';
  executionPath: 'stream' | 'job' | 'client-artifact';
  mode?: 'single' | 'multi';
  artifactKind?: 'server-snapshot' | 'incident-report' | 'monitoring-analysis';
  complexity?: 'simple' | 'moderate' | 'complex' | 'very_complex';
  reasonCodes: string[];
  ruleVersion: string;
  dataSlot?: string;
  traceId?: string;
  decidedBy: 'frontend' | 'bff' | 'cloud-run';
};
```

### 테스트 시나리오 (구현 전 확정)

- [x] `useQueryExecution`: simple query는 `executionPath='stream'`, complex query는 `executionPath='job'` routeDecision을 callback으로 노출한다.
- [x] `useAIChatCore`: server snapshot/incident/monitoring artifact message metadata에 `intent='artifact'` routeDecision을 보존한다.
- [x] `message-helpers`/history restore: `routeDecision`이 있는 metadata는 보존하고 없는 legacy metadata도 정상 복원한다.
- [x] `POST /api/ai/jobs`: 생성 응답과 stored job metadata에 `intent='job'`, `executionPath='job'` routeDecision을 포함한다.
- [x] Cloud Run supervisor done metadata: `resolveSupervisorModeDecision()` 결과를 `routeDecision.mode`/`reasonCodes`로 노출한다.

## Task 목록

- [x] Task 0 — failing contract tests 추가
- [x] Task 1 — 공통 routeDecision type/helper 추가
- [x] Task 2 — frontend stream/job/artifact metadata 매핑
- [x] Task 3 — BFF job metadata 매핑
- [x] Task 4 — Cloud Run supervisor done metadata 매핑
- [x] Task 5 — targeted 검증 및 문서 상태 갱신

## 완료 검증

- root targeted routeDecision/artifact/health tests 통과
- `npm run type-check`
- `npm run lint`
- `npm run test:quick`
- `npm run test:contract`
- `cloud-run/ai-engine` `npm run type-check`
- `cloud-run/ai-engine` `npm run test`
- `npm run docs:components:verify`
- local Playwright MCP targeted QA 기록: `QA-20260503-0396`

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~4 | `feat:` | 선택 | Cloud Run 변경 포함 시 필요 | frontend/BFF 변경 포함 시 필요 |
| Task 5 | — | 선택 | ❌ | ❌ |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 테스트가 read-only metadata 계약만 요구하는지 |
| Task 2~4 완료 후 | 기존 routing 동작 변경 여부, metadata sanitizer/legacy restore 영향 |
| 전체 완료 후 | targeted tests, type-check, docs budget |
