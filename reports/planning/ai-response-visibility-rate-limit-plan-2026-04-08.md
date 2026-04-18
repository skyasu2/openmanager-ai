> Owner: project
> Status: Backlog — `handoff persistence contract`, `429 UX source-hardening`, `Job Queue agent-path`, `/api/ai/jobs` POST gateway limiter alignment, frontend AI gateway session-aware limiter identity, daily-limit semantics, Cloud Run forwarded identity, retry limiter alignment, Cloud Run jobs read/write limiter split, Cloud Run daily semantics alignment, Cloud Run supervisor health limiter split slice는 완료. Cloud Run window 수치 재평가 잔여는 backlog 유지.
> Doc type: Plan
> Last reviewed: 2026-04-17
> Tags: ai,ux,rate-limit,visibility

# AI Response Visibility & Rate Limit Plan (2026-04-08)

- 상태: **Backlog (partial complete)** — AnalysisBasisBadge 중심 visibility 개선과 `handoff persistence contract`, `429 UX source-hardening`, `Job Queue agent-path`, `/api/ai/jobs` POST gateway limiter alignment, frontend AI gateway session-aware limiter identity, daily-limit semantics, Cloud Run forwarded identity, retry limiter alignment, Cloud Run jobs read/write limiter split, Cloud Run daily semantics alignment, Cloud Run supervisor health limiter split slice는 완료됐다. 남은 범위는 Cloud Run window 수치 재평가다.
- 작성일: 2026-04-08 | 상태 갱신: 2026-04-18
- TODO.md 연결: Backlog > AI Response Visibility & Rate Limit
- 목표: AI 질의 과정의 가시성을 실제 실행 흐름과 맞추고, rate limit을 사용자에게 설명 가능한 제약으로 바꾼다.

## 2026-04-17 상태 스냅샷

### 이미 반영된 범위 (별도 구현 완료)

- `AnalysisBasisBadge` collapsed summary가 `실행 경로` 중심으로 재구성됐다.
  - handoff가 있으면 `경로: ... · handoff N회 · 도구 M개 · 기간: T`
  - handoff가 없으면 `도구` 또는 `데이터/모드` 중심 fallback
- expanded 패널은 `실행 경로`, `전달 이력`, `추적 가능 ID`, `도구 결과 요약`, `구조화된 실패 사유 코드`, `디버그 번들 복사`를 지원한다.
- 관련 구현/테스트 이력:
  - `c37333231` `test(spec): analysis basis badge show handoff count in collapsed summary`
  - `2d8acf8f7` `feat: analysis basis badge implement to pass specs`
  - `89575812c` `feat(ai): strengthen analysis basis debug view`
  - `2e00d4e42` `test(spec): ai response visibility add failing handoff persistence tests`

### 이번 slice 완료 범위 (`handoff persistence contract`)

- stream `data-done`는 handoff 이벤트가 하나도 없어도 assistant metadata에 `handoffHistory: []`를 남긴다.
- job queue result metadata는 `handoffs: []`를 생략하지 않고 보존한다.
- job queue 결과를 assistant message로 합칠 때 `handoffHistory: []`를 유지한다.
- chat history save/restore round-trip 후에도 `handoffHistory: []`가 유지된다.

### 아직 남은 범위

- Cloud Run limiter 정책을 사용자 체감 기준으로 다시 맞추는 작업

### 이번 승인 slice (`2026-04-18`, 4차)

- 목표: Cloud Run limiter가 shared `X-API-Key` 대신 forwarded end-user identity를 우선 사용하도록 바꿔, 모든 사용자가 하나의 service-secret bucket을 공유하는 문제를 해소한다.
- 범위:
  - frontend AI proxy가 `X-Rate-Limit-Identity`를 Cloud Run으로 전달
  - Cloud Run rate limiter는 해당 header를 `X-API-Key`보다 우선 사용
  - 적용 경로: primary `stream/v2`, `jobs/process`, legacy supervisor proxy
  - rate-limit 수치 변경, daily limit 변경, Cloud Run jobs/supervisor 분당 정책 변경은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, 4차)

- frontend AI proxy는 이제 session-aware limiter identity를 `X-Rate-Limit-Identity` 헤더로 Cloud Run에 전달한다.
- 적용 경로는 primary `stream/v2`, `jobs/process`, `jobs retry`, legacy supervisor proxy다.
- Cloud Run limiter는 shared `X-API-Key`보다 forwarded end-user identity를 우선 사용한다.
- 이로써 서비스 공용 secret 하나로 모든 사용자가 같은 Cloud Run limiter bucket을 공유하던 false sharing을 줄였다.
- 이번 slice는 identity forwarding semantics만 다루며, Cloud Run jobs/supervisor 분당 수치 및 daily 정책 조정은 후속 backlog로 남긴다.

### 이번 승인 slice (`2026-04-18`, 5차)

- 목표: `/api/ai/jobs/[id]/retry`도 queue 생성과 동일한 Cloud Run `jobs/process` workload를 다시 트리거하므로, edge limiter를 `aiJobCreation(5/min)`에 정렬한다.
- 범위:
  - retry POST를 `aiJobCreation` limiter에 바인딩
  - dynamic route에서도 `withRateLimit()`가 `params` 시그니처를 유지하도록 typing 보강
  - Cloud Run 분당/일일 수치 자체 변경은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, 5차)

- `/api/ai/jobs/[id]/retry`는 이제 `aiJobCreation(5/min)` limiter를 사용한다.
- queue 생성과 retry는 같은 upstream workload에 대해 같은 edge fail-fast semantics를 사용한다.
- `withRateLimit()`는 dynamic route `params` 시그니처를 보존하도록 generic tuple typing이 보강됐다.
- 이번 slice는 retry path drift만 닫았고, Cloud Run jobs/supervisor 정책 수치 재조정은 후속 backlog로 남긴다.

### 이번 승인 slice (`2026-04-18`, Cloud Run jobs read/write limiter split)

- 목표: Cloud Run `/api/jobs/process` write workload와 `GET /api/jobs/:id`, `GET /api/jobs/:id/progress` polling/read workload를 서로 다른 limiter bucket으로 분리해, 진행률 조회가 job creation/process minute limit을 잠식하지 않게 한다.
- 범위:
  - Cloud Run rate limiter가 path뿐 아니라 HTTP method를 함께 고려하도록 조정
  - `/api/jobs/process` `POST`는 기존 `5/min` write 정책 유지
  - `/api/jobs/:id`, `/api/jobs/:id/progress` `GET`는 별도 read bucket으로 분리
  - frontend limiter 수치, Cloud Run daily limit, `/api/supervisor*` 정책 변경은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Cloud Run jobs read/write limiter split)

- Cloud Run rate limiter는 이제 path뿐 아니라 HTTP method를 함께 고려한다.
- `POST /api/jobs/process`는 기존 strict `5/min` write bucket을 유지한다.
- `GET /api/jobs/:id`, `GET /api/jobs/:id/progress`는 별도 read bucket으로 분리됐다.
- 이로써 job status/progress polling이 queue creation/process minute limit을 잠식하던 정책 drift를 제거했다.
- 이번 slice는 Cloud Run jobs read/write 분리만 다루며, Cloud Run daily/window 수치 재평가는 후속 backlog로 남긴다.

### 이번 승인 slice (`2026-04-18`, Cloud Run daily semantics alignment)

- 목표: Cloud Run `supervisor`와 `jobs/process` 경로도 frontend와 같은 `daily` semantics를 제공해, `source=cloud-run-ai` 429에서도 `limitScope=daily`와 `X-RateLimit-Daily-*`를 일관되게 노출한다.
- 범위:
  - Cloud Run rate limiter에 optional `dailyLimit`과 `daily` result support 추가
  - `supervisor`, `jobs/process` write bucket에 `daily=100` 적용
  - `jobs` polling read bucket은 daily 미적용 유지
  - 429 payload에서 `limitScope=daily`, `dailyLimitExceeded=true`, daily headers 반환
  - frontend limiter 수치, Cloud Run minute window 수치, `/api/jobs` read bucket 수치 변경은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Cloud Run daily semantics alignment)

- Cloud Run rate limiter는 이제 optional `dailyLimit`과 `daily` result를 지원한다.
- `supervisor`, `jobs/process` write bucket은 frontend와 같은 `daily=100` semantics를 가진다.
- Cloud Run 429 payload도 `limitScope=daily`, `dailyLimitExceeded=true`, `X-RateLimit-Daily-*`를 일관되게 반환한다.
- `jobs` polling read bucket은 daily 미적용으로 유지됐다.
- 이번 slice는 daily semantics 정렬만 다루며, Cloud Run minute/window 수치 재평가는 후속 backlog로 남긴다.

### 이번 승인 slice (`2026-04-18`, Cloud Run supervisor health limiter split)

- 목표: `GET /api/ai/supervisor/health`가 실제 분석 요청과 같은 `supervisor 10/min` bucket을 소모하지 않게 분리해, smoke/health 확인이 user-facing write capacity를 잠식하지 않도록 한다.
- 범위:
  - Cloud Run rate limiter가 `GET /api/ai/supervisor/health`를 별도 read/health bucket으로 분리
  - health bucket은 분석 write bucket보다 느슨한 window를 사용
- `POST /api/ai/supervisor*` write semantics는 유지
- `jobs` 경로 수치, frontend limiter 수치, Cloud Run daily 수치 변경은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, Cloud Run supervisor health limiter split)

- `GET /api/ai/supervisor/health`는 이제 실제 분석 요청과 분리된 health/read bucket을 사용한다.
- smoke/health 확인이 strict `supervisor 10/min` write bucket을 잠식하지 않는다.
- Redis unavailable 시에도 in-memory fallback key가 `keyPrefix`를 포함해 health/read bucket과 write bucket이 충돌하지 않도록 보강됐다.
- 이번 slice는 Cloud Run supervisor health 경로만 분리했으며, 남은 backlog는 Cloud Run minute/window 수치 재평가다.

### 이번 승인 slice (`2026-04-18`, 3차)

- 목표: frontend 429 처리에서 response body가 비어 있거나 generic해도 `X-RateLimit-Daily-*` 헤더만으로 `daily` 초과를 정확히 복원한다.
- 범위:
  - `buildRateLimitErrorDetails()`의 daily header 해석 보강
  - `daily` scope / `dailyLimitExceeded` / `resetAt` / `remaining` 복원 계약 테스트 추가
  - 정책 수치 변경, Cloud Run limiter 변경, countdown UX 구조 변경은 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, 3차)

- `buildRateLimitErrorDetails()`는 이제 `X-RateLimit-Daily-*` 헤더만으로도 `daily` 초과를 복원한다.
- body가 generic하거나 빈 경우에도 `scope=daily`, `dailyLimitExceeded=true`, `resetAt=daily reset`이 유지된다.
- 이번 slice는 frontend 표준 에러 모델 semantics만 다루며, Cloud Run 정책 변경은 후속 backlog로 남긴다.

### 이번 승인 slice (`2026-04-18`, 2차)

- 목표: frontend AI gateway limiter key를 IP-only에서 session-aware identity로 보강해, 같은 NAT/IP 아래 서로 다른 사용자 요청이 같은 버킷을 공유하는 false sharing을 줄인다.
- 범위:
  - frontend Next AI limiter의 식별자만 조정
  - guest/session/API key/cookie 기반 identity 우선, IP fallback 유지
  - Cloud Run limiter 정책, minute/daily 수치, user-key 전면 재설계는 이번 slice 제외

### 이번 slice 완료 결과 (`2026-04-18`, 2차)

- frontend AI gateway limiter는 이제 IP-only 대신 session-aware identity를 사용한다.
- In-Memory fallback과 Redis limiter 모두 동일한 identity helper를 사용한다.
- same-IP 환경에서도 guest session cookie가 다르면 서로 다른 limiter bucket을 사용한다.
- 이번 slice는 frontend identity semantics만 다루며, daily semantics와 Cloud Run 정책 변경은 후속 backlog로 남긴다.

### 이번 승인 slice (`2026-04-18`)

- 목표: `/api/ai/jobs` POST 경로의 프론트 gateway minute limit을 Cloud Run `/api/jobs*` minute limit과 맞춰, 중첩 limiter로 인한 체감 한도 drift를 줄인다.
- 범위:
  - 프론트 전용 limiter를 `job creation` 경로에 분리
  - `/api/ai/jobs` POST는 해당 limiter를 사용
  - `/api/ai/supervisor/stream/v2` 및 기타 경로 정책은 이번 slice에서 변경하지 않음
  - daily limit / 사용자 key 재설계 / Cloud Run 정책 변경은 backlog 유지

### 이번 slice 완료 결과 (`2026-04-18`)

- 프론트 gateway에 `aiJobCreation` limiter를 분리했다.
- `/api/ai/jobs` POST는 기존 `aiAnalysis(10/min)` 대신 `aiJobCreation(5/min)`을 사용한다.
- 이로써 job creation 경로는 Cloud Run `/api/jobs*` minute limit과 같은 수치에서 edge fail-fast 한다.
- 이번 slice는 minute window 정렬만 다루며, daily limit / 사용자 key / Cloud Run 정책 변경은 후속 backlog로 남긴다.

## 배경

- 최근 QA에서 두 가지 문제가 반복 확인됐다.
  - 응답 후 `분석 근거` 패널이 실제 멀티에이전트 handoff 경로를 충분히 드러내지 못한다.
  - 복잡 질의의 Cloud Run 경로에서 `Rate limit exceeded`가 간헐적으로 사용자에게 노출된다.
- 관련 근거:
  - [qa-run-QA-20260405-0240.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260405-0240.json)
  - [qa-run-QA-20260407-0249.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260407-0249.json)

## 현재 구현 요약

### 1. 스트리밍 경로

- 스트림 계약은 이미 `handoff`, `tool_result`, `agent_status`, `done` 이벤트를 지원한다.
  - [ai-supervisor-stream.contract.test.ts](/mnt/d/dev/openmanager-ai/tests/api/ai-supervisor-stream.contract.test.ts:21)
- 클라이언트는 `data-handoff`를 수신하면 `handoffHistory`를 누적 저장한다.
  - [stream-data-handler.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/utils/stream-data-handler.ts:191)
- 하지만 assistant 메시지의 `thinkingSteps`는 실제 handoff/agent status가 아니라 tool part 위주로만 구성된다.
  - [message-helpers.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/utils/message-helpers.ts:491)

### 2. 응답 후 분석 근거 패널

- `AnalysisBasisBadge`는 현재 `handoffHistory`, `toolResultSummaries`, `traceId`, `thinkingSteps`를 조합해 실행 경로를 우선 노출한다.
  - collapsed summary는 handoff/path 기반 요약을 우선 사용한다.
  - expanded 패널은 `handoff 협업 경로`, `fallback 보정 경로`, `추적 가능 ID`, `도구 결과 요약`, `디버그 번들 복사`를 제공한다.
  - [AnalysisBasisBadge.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AnalysisBasisBadge.tsx:515)
  - [AnalysisBasisBadge.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AnalysisBasisBadge.tsx:581)
  - [AnalysisBasisBadge.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AnalysisBasisBadge.tsx:659)
- 남은 갭은 `handoff 없음`과 `handoff 수집 실패`를 계약 수준으로 확정하지 못했다는 점이다.

### 3. Job Queue 진행률 표시

- 비동기 복잡 질의는 고정 임계치 기반 4단계 UI를 사용하지만, 실제 agent path metadata도 함께 노출한다.
  - [JobProgressIndicator.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/JobProgressIndicator.tsx:236)
  - [JobProgressIndicator.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/JobProgressIndicator.tsx:279)
- Cloud Run jobs route는 `agent_status`/`handoff`/`done.metadata.handoffs`를 기반으로 `executionPath`, `handoffFrom`, `handoffTo`, `handoffCount`, `stageDetail`을 기록한다.
  - [jobs.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/jobs.ts:247)
- Next job stream route는 위 metadata를 progress SSE에 그대로 실어 보낸다.
  - [stream-helpers.ts](/mnt/d/dev/openmanager-ai/src/app/api/ai/jobs/[id]/stream/stream-helpers.ts:219)
- `JobProgressIndicator`는 `경로`, `전달`, `handoff N회`, `stageDetail`을 렌더링한다.
  - [JobProgressIndicator.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/JobProgressIndicator.tsx:272)

### 4. Rate Limit 구조

- 프론트 Next API는 `aiAnalysis` limiter를 사용한다.
  - [rate-limiter.ts](/mnt/d/dev/openmanager-ai/src/lib/security/rate-limiter.ts:393)
  - [jobs/route.ts](/mnt/d/dev/openmanager-ai/src/app/api/ai/jobs/route.ts:192)
  - [supervisor/stream/v2/route.ts](/mnt/d/dev/openmanager-ai/src/app/api/ai/supervisor/stream/v2/route.ts:173)
- Cloud Run AI Engine도 별도 limiter를 갖고 있으며 `supervisor=10/min`, `jobs=5/min`으로 더 엄격하다.
  - [cloud-run rate-limiter.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/middleware/rate-limiter.ts:126)
- 클라이언트는 Job Queue 429를 문구로 처리하지만, 어느 레이어에서 막혔는지 구분은 약하다.
  - [useAsyncAIQuery.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/useAsyncAIQuery.ts:248)

## 공식 베스트 프랙티스 기준

### A. Vercel AI SDK

- `data parts`는 동적 상태, 출처, 진행 이벤트 같은 스트림 중간 정보를 보내는 용도다.
- `message metadata`는 trace id, model, token, timing 같은 메시지 단위 메타데이터에 적합하다.
- transient data parts는 `onData`에서만 소비되며 message history에 남지 않는다.
- 정리:
  - handoff/agent progress는 `data parts`
  - trace/timing/final summary는 `message metadata`
  - UI에서 둘을 섞어 보여주되 저장 용도를 분리해야 한다.
- 참고:
  - https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
  - https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata

### B. Langfuse

- 좋은 trace는 보통 `한 번의 챗 턴` 또는 `한 번의 agent run` 단위여야 한다.
- multi-step/agentic workflow는 trace 내부 observation/span으로 세분화하고, multi-turn은 session으로 묶는 것이 권장된다.
- trace attributes와 child observation propagation을 통해 `session_id`, `user_id`, `metadata`, `tags`를 일관되게 유지하는 것이 중요하다.
- 정리:
  - handoff는 별도 trace를 늘리는 대신 trace 내부 observation/span으로 남기는 편이 맞다.
  - 프론트는 raw reasoning이 아니라 trace id + handoff path + tool summary를 요약 노출하는 수준이 적절하다.
- 참고:
  - https://langfuse.com/faq/all/what-does-a-good-trace-look-like
  - https://langfuse.com/docs/observability/overview
  - https://langfuse.com/docs/observability/sdk/overview

### C. Upstash Ratelimit

- blocked identifier는 `ephemeralCache`로 짧게 메모리 차단해 Redis 호출을 줄일 수 있다.
- timeout이 발생하면 허용 통과시키는 방식도 지원해 네트워크 이슈가 곧바로 사용자 거절로 이어지지 않게 할 수 있다.
- multiple limits, dynamic limits, analytics를 통해 경로/등급별 정책을 분리할 수 있다.
- `remaining`, `reset`, `getRemaining()` 같은 메타데이터를 적극 노출하는 것이 운영 UX에 유리하다.
- 정리:
  - 모든 AI 경로에 동일한 정적 제한을 거는 것보다, 경로별/사용자별/복잡도별 정책 분리가 더 적절하다.
  - 사용자에게는 `왜 막혔는지`, `언제 다시 가능한지`, `다음 행동이 무엇인지`를 같이 보여줘야 한다.
- 참고:
  - https://upstash.com/docs/redis/sdks/ratelimit-ts/features
  - https://upstash.com/docs/redis/sdks/ratelimit-ts/methods
  - https://upstash.com/docs/redis/sdks/ratelimit-ts/overview

## 핵심 갭

1. 스트림 계약은 handoff를 갖고 있는데, 응답 후 UI 요약은 여전히 tool-step 중심이다.
2. Job Queue 진행률은 실제 agent path가 아니라 고정 4단계 텍스트에 가깝다.
3. rate limit은 이미 헤더/JSON 메타를 주지만, 사용자에게 레이어별 원인과 reset 정보를 명확히 설명하지 못한다.
4. 프론트와 Cloud Run에 limiter가 중첩되어 있어, QA나 연속 질의에서 실제 허용량 체감이 예측보다 낮아질 수 있다.

## 2026-04-17 완료 slice: handoff persistence contract

### 목표

- `handoff 있음` / `handoff 없음` / `미기록`을 구분할 수 있도록 `handoffHistory` semantics를 고정했다.
- 이번 slice는 UI copy나 limiter 정책을 건드리지 않고 metadata persistence contract만 다뤘다.

### 이번 slice 범위

- 완료:
  - streaming `data-done` 경로에서 `handoffHistory: []` 보존
  - job queue result metadata에서 `handoffs: []` 보존
  - 프론트 assistant message metadata에서 `handoffHistory: []` 보존
  - chat history save/restore에서 `handoffHistory: []` round-trip 보존
- 후속 backlog:
  - `AnalysisBasisBadge` 문구/배지 추가 변경
  - Job Queue progress event 확장
  - 429 UX 및 limiter 정책

## 원칙

- raw chain-of-thought는 노출하지 않는다.
- 사용자에게는 `실행 경로`, `handoff`, `도구 요약`, `trace id`, `retry 가능 시점`만 노출한다.
- 현 구조를 최대한 재사용하고, 프로토콜 변경은 필요한 곳에만 최소 적용한다.
- limit 완화보다 먼저 `설명 가능성`과 `레이어 구분`을 해결한다.

## 범위

### 포함

- 스트리밍 assistant 응답의 `분석 근거` 패널 구조 개선
- Job Queue 진행률의 실제 agent path 반영 계획
- AI rate limit UX와 운영 정책 재정의
- 계약 테스트 / UI 테스트 / QA 기준선 강화

### 제외

- 새 observability 벤더 도입
- raw reasoning 전문 노출
- 무료 티어를 무시한 limit 상향
- 이번 문서 단계에서의 실제 코드 구현

## 단계

### Phase 1. 계약/가시성 진단 보강

- [x] 스트리밍 경로와 Job Queue 경로 각각에 대해 `handoffHistory`가 최종 assistant metadata에 남는지 계약 테스트를 보강한다.
- [ ] `AnalysisBasisBadge` expanded 상태에서 `handoffHistory`가 비어 있는 경우를 “handoff 없음”과 “handoff 수집 실패”로 구분할 수 있게 진단 포인트를 정의한다.
- [ ] QA 템플릿에 아래 항목을 추가한다.
  - 첫 응답 collapsed summary에 handoff 개수 노출 여부
  - expanded panel에 trace id / handoff path / tool summary 분리 노출 여부
  - Job Queue 경로에서 실제 agent path가 progress에 반영되는지 여부

### Phase 2. 현재 방식에서 바로 가능한 프론트 개선

- [x] `AnalysisBasisBadge` collapsed summary를 `도구` 중심 문구에서 `실행 경로` 중심 문구로 바꾼다.
  - 예: `경로: 분석 조율 → 심층 분석 · 도구 2개 · 기간: 최근 1시간`
- [x] `응답 과정` 헤더 배지에 `handoff N회`를 우선 노출하고, `thinkingSteps`는 보조 지표로 내린다.
- [x] `thinkingSteps`가 비어도 `handoffHistory`와 `toolResultSummaries`만으로 의미 있는 타임라인/요약을 구성하도록 UI 조합 로직을 바꾼다.
- [x] trace id는 현재처럼 유지하되, `Langfuse` 설명보다 `추적 가능 ID` 의미를 우선 보여준다.

### Phase 3. Job Queue 경로 가시성 개선

- [x] Job Queue `progress` 이벤트에 실제 agent/handoff stage를 반영하는 서버 필드를 정의한다.
  - 예: `agent`, `handoffFrom`, `handoffTo`, `stageLabel`, `stageDetail`
- [x] `JobProgressIndicator`의 4단계 인디케이터는 유지하되, 하단 서브라인은 실제 agent path를 반영하도록 바꾼다.
  - 예: `분석 조율 → 심층 분석 → 보고서 생성`
- [x] 현재의 퍼센트 기반 fixed threshold와 실제 event-based 상태를 함께 보여주는 혼합 모델로 정리한다.

### Phase 3 완료 확인 (2026-04-17)

- Cloud Run jobs route는 progress metadata에 `executionPath`, `handoffFrom`, `handoffTo`, `handoffCount`, `stageDetail`을 기록한다.
- Next `/api/ai/jobs/[id]/stream` route는 위 metadata를 progress SSE event에 그대로 보존한다.
- `JobProgressIndicator`는 해당 metadata를 `경로`, `전달`, `handoff N회`, `stageDetail`로 렌더링한다.
- `asyncQuerySSE` regression test를 추가해 client progress callback passthrough를 고정했다.

### Phase 4. Rate Limit UX 개선

- [ ] 프론트에서 429를 받을 때 `retryAfter`, `remaining`, `dailyLimitExceeded`를 표준 에러 모델로 통합한다.
- [ ] 사용자 메시지를 아래처럼 분기한다.
  - minute window 초과: `잠시 후 다시 시도`
  - daily limit 초과: `오늘 한도 소진`
  - upstream Cloud Run limit 초과: `AI 엔진 혼잡`
- [ ] 재시도 버튼은 무조건 즉시 노출하지 않고, `retryAfter` 동안 countdown/disabled 처리한다.
- [ ] `어디서 막혔는지`를 표시한다.
  - `frontend gateway`
  - `Cloud Run AI`
  - `upstream provider`

### Phase 5. Rate Limit 정책 재정비

- [ ] 프론트와 Cloud Run의 중첩 limit을 표로 정리하고, 실제 사용자 체감 기준으로 재설계한다.
- [x] `/api/ai/jobs` POST gateway minute limit을 Cloud Run `/api/jobs*`와 정렬한다.
- [x] frontend AI gateway limiter identity를 session-aware로 보강한다.
- [x] frontend daily-limit error semantics를 daily headers 기준으로 복원한다.
- [ ] 최소 검토 항목:
  - `/api/ai/supervisor/stream/v2`
  - `/api/ai/jobs`
  - Cloud Run `/api/supervisor*`
  - Cloud Run `/api/jobs*`
- [ ] 경로별 분리 외에 사용자 구분 키도 재검토한다.
  - 인증 사용자는 `session/user` 우선
  - 익명 사용자는 IP fallback
- [ ] Upstash dynamic limits는 현재 구현이 직접 활용하지 않으므로, 2차 후보로만 검토한다.

## 현재 방식에서 바로 가능한 우선 적용안

1. 프론트 `AnalysisBasisBadge` 요약/expanded 구조 개선
2. `handoffHistory` 누락 진단 테스트 추가
3. 429 UX에 `retryAfter` countdown과 원인 레이블 추가
4. QA 시나리오에 `handoff path visible`과 `rate-limit explanation visible` 추가

## 서버 변경이 필요한 후속 적용안

1. Cloud Run limiter와 Next limiter의 정책 일원화
2. 사용자/session 기준 limit 키 재설계

## 완료 기준

- [ ] 스트리밍 응답 후 `분석 근거` 패널에 handoff 개수와 실제 경로가 보인다.
- [ ] handoff가 없을 때와 수집 실패일 때를 QA/테스트에서 구분할 수 있다.
- [x] Job Queue 진행률이 단순 퍼센트가 아니라 실제 agent path를 일부라도 보여준다.
- [ ] 429 발생 시 사용자에게 `원인`, `재시도 가능 시점`, `다음 행동`이 함께 보인다.
- [ ] 관련 계약 테스트와 UI 테스트가 추가되어 회귀를 막는다.

## 권장 실행 순서

1. `AnalysisBasisBadge` 가시성 개선
2. handoff persistence 계약 테스트 보강
3. 429 UX 통합
4. limiter 정책 재조정
5. limiter 정책 재조정

## 재착수 조건 (SDD Gate)

> `handoff persistence contract` slice는 완료됐다. 이번 승인 slice는 `429 UX source-hardening`이며, 후속 backlog는 `Job Queue agent path`와 `limiter 정책 재정비`다.

- [x] **남은 범위 재확정**
  - 이번 승인 slice: `handoff persistence` 진단/계약 테스트
  - 후속 backlog: Phase 3 Job Queue 실제 agent path, Phase 4 429 UX, Phase 5 limiter 정책
- [x] **변경 대상 파일 확정**
  - 스트림 경로: `src/hooks/ai/utils/stream-data-handler.ts`
  - job queue 경로: `cloud-run/ai-engine/src/routes/jobs.ts`, `src/hooks/ai/core/asyncQuerySSE.ts`, `src/hooks/ai/useHybridAIQuery.ts`
  - history round-trip: `src/hooks/ai/core/useChatHistory.ts`, `src/hooks/ai/utils/chat-history-storage.ts`
  - 테스트: `stream-data-handler.test.ts`, `useHybridAIQuery.test.ts`, `chat-history-storage.test.ts`, 필요 시 `useChatHistory.test.ts`
- [x] **입출력 계약 확정**
  - `handoffHistory.length > 0` → handoff 있음
  - `handoffHistory = []` → handoff 없음
  - `handoffHistory = undefined` → legacy message 또는 수집/전달 누락 가능성
  - stream / job queue / history storage는 `[]`를 의미 있는 값으로 유지한다.
- [x] **테스트 시나리오 확정**
  - stream `data-done`가 handoff 이벤트 없이 종료돼도 assistant metadata에 `handoffHistory: []`가 남는다.
  - job queue result `metadata.handoffs: []`가 assistant message metadata에 `handoffHistory: []`로 유지된다.
  - local history 저장/복원 후에도 `handoffHistory: []`가 round-trip 된다.
- [x] `test(spec): ai response visibility add failing handoff persistence tests`
- [x] `feat|fix: ai response visibility implement handoff persistence contract`

## 2026-04-17 승인 slice: 429 UX source-hardening

### 목표

- provider 이름이 포함된 429/쿼터 메시지를 `upstream-provider`로 안정 분류한다.
- `ColdStartErrorBanner`가 `frontend-gateway` / `cloud-run-ai` / `upstream-provider` source를 user-facing title로 일관되게 반영하도록 계약을 고정한다.
- countdown/retry UX는 기존 구조를 유지하고, source 판별/문구 drift만 해결한다.

### 이번 slice 범위

- 포함:
  - `src/lib/ai/error-details.ts`
  - `src/lib/ai/error-details.test.ts`
  - `src/components/ai-sidebar/chat/ColdStartErrorBanner.test.tsx`
- 제외:
  - limiter 수치 변경
  - retryAfter countdown 구조 변경
  - Job Queue progress event 확장
  - Cloud Run/Next rate limiter 정책 재설계

### 입출력 계약

- `Groq`, `Mistral`, `Cerebras`, `Gemini`, `OpenRouter` 등의 provider 이름이 포함된 rate-limit 메시지는 `upstream-provider`로 분류된다.
- `ColdStartErrorBanner`는:
  - `frontend-gateway` → `요청이 잠시 몰렸습니다`
  - `cloud-run-ai` → `AI 엔진 요청이 잠시 몰렸습니다`
  - `upstream-provider` → `AI 제공자 요청 제한이 발생했습니다`
  를 title로 사용한다.

### 테스트 시나리오

1. provider 이름이 들어간 plain message가 `upstream-provider`로 추론된다.
2. upstream-provider rate-limit details를 전달하면 배너 title이 `AI 제공자 요청 제한이 발생했습니다`로 렌더링된다.
3. 기존 frontend-gateway countdown disable/enable 계약은 유지된다.

### 완료 결과

- `inferRateLimitSourceFromMessage()`가 실제 운영 provider 이름(`Groq`, `Mistral`, `Cerebras`, `Gemini`, `OpenRouter`)을 upstream provider로 분류한다.
- `ColdStartErrorBanner`는 structured `errorDetails` 없이 plain error만 받아도 upstream-provider title을 올바르게 렌더링한다.
- countdown/retry UX 구조 변경 없이 source/title drift만 해결했다.

## 메모

- 현재 구조상 스트리밍 경로의 handoff 이벤트는 이미 존재하므로, 첫 구현은 “새 프로토콜 도입”보다 “기존 데이터의 우선 노출”에 집중하는 편이 비용 대비 효과가 크다.
- rate limit은 무조건 상향하면 무료 티어 방어가 약해질 수 있으므로, 우선은 설명 가능성과 경로 분리를 먼저 해결한다.
