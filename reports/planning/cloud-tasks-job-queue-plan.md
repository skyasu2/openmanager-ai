> Owner: project
> Status: Completed
> Last reviewed: 2026-04-28

# Cloud Tasks Job Queue Plan

## 1. 목적

현재 Job Queue는 Vercel API가 Redis job을 만든 뒤 Cloud Run `/api/jobs/process`를 직접 호출한다.
이 호출은 처리 완료까지 기다릴 수 있어 Vercel 함수 시간과 Cloud Run request lifecycle에 긴 AI 작업이 묶인다.

Cloud Tasks를 선택형 dispatch 계층으로 추가해 Vercel은 짧은 dispatch 요청만 보내고, 실제 장시간 AI 처리는 Cloud Tasks가 Cloud Run worker endpoint로 전달하도록 분리한다.

## 2. 범위

- 포함:
  - Vercel `POST /api/ai/jobs` trigger mode에 `cloud-tasks` 추가
  - Cloud Run Hono `POST /api/jobs/dispatch` 추가
  - dispatch endpoint가 Cloud Tasks HTTP task를 생성해 `/api/jobs/process`를 호출
  - 기존 direct `/api/jobs/process` trigger는 fallback/default로 유지
  - retry route도 같은 trigger mode를 사용
  - 환경변수 문서와 `.env.example` 업데이트
- 제외:
  - GCP queue/ IAM 리소스 자동 생성
  - Cloud Run 비공개 ingress 전환
  - Redis job schema migration
  - UI polling/SSE 계약 변경

## 3. 공식 제약 기준

- Cloud Tasks HTTP target은 `CreateTask`로 task-level URL/body/header를 지정할 수 있다.
- Cloud Run 같은 Google Cloud handler 인증에는 ID token 사용이 권장된다.
- HTTP target handler timeout은 기본 10분, 최대 30분이다.
- 가격 기준은 32KB chunk billable operation이며 월 첫 100만 operations 무료다.

참조:
- https://cloud.google.com/tasks/docs/creating-http-target-tasks
- https://cloud.google.com/tasks/pricing

## 4. 계약

| 대상 | 계약 |
|------|------|
| Vercel trigger mode | `AI_JOB_TRIGGER_MODE=cloud-tasks`이면 `/api/jobs/dispatch`를 호출한다. 기본값은 기존 direct `/api/jobs/process` 유지. |
| Cloud Run dispatch | `CLOUD_TASKS_ENABLED=true`와 project/location/queue가 있을 때만 task를 생성한다. 미설정이면 503으로 실패한다. |
| Job payload | `jobId`, `messages`, `sessionId`, `type`, `analysisMode`, `enableRAG`, `enableWebSearch`를 Cloud Tasks body에 보존한다. |
| 인증 | Cloud Tasks task는 기존 `X-API-Key`를 포함한다. `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL`이 있으면 OIDC token도 함께 설정한다. |
| 비용 | payload는 작은 JSON body만 허용하고 대용량 data/result는 Redis에 둔다. |
| fallback | `AI_JOB_TRIGGER_MODE` 미설정 또는 `direct`는 현재 동작과 동일해야 한다. |

## 5. 테스트 시나리오

- [x] Vercel jobs route가 `AI_JOB_TRIGGER_MODE=cloud-tasks`에서 `/api/jobs/dispatch`를 호출한다.
- [x] Vercel jobs route가 direct mode에서 기존 `/api/jobs/process`를 유지한다.
- [x] Cloud Run `/api/jobs/dispatch`가 Cloud Tasks task를 만들고 202를 반환한다.
- [x] dispatch body가 source mode/thinking mode 옵션을 보존한다.
- [x] Cloud Tasks 설정이 없으면 dispatch가 503을 반환한다.
- [x] Cloud Run proxy 환경에서 worker target이 `https://*.run.app/api/jobs/process`로 생성되어 `302 -> GET 404` side effect를 피한다.
- [x] `X-Forwarded-Proto: http`가 non-local worker target을 HTTP로 downgrade하지 못한다.

## 6. Task 목록

- [x] Task 0 — failing contract tests 커밋
- [x] Task 1 — Vercel trigger mode 구현
- [x] Task 2 — Cloud Run dispatch endpoint + Cloud Tasks REST client 구현
- [x] Task 3 — env/docs 업데이트
- [x] Task 4 — local checks
- [x] Task 5 — commit/push/pipeline

## 7. 완료 기준

- [x] targeted route tests 통과
- [x] Cloud Run jobs tests 통과
- [x] root `npm run test:contract` 통과
- [x] root `npm run type-check` 통과
- [x] AI Engine `npm run type-check` 통과
- [x] 최종 `git status` clean

## 8. 완료 결과

- Vercel runtime:
  - `AI_JOB_TRIGGER_MODE=cloud-tasks`일 때 `/api/jobs/dispatch` 호출
  - 기본값/미설정은 기존 `/api/jobs/process` direct 호출 유지
  - retry route도 동일 trigger mode 사용 및 `analysisMode`, `enableRAG`, `enableWebSearch` 보존
- Cloud Run AI Engine:
  - `POST /api/jobs/dispatch` 추가
  - `CLOUD_TASKS_ENABLED=true`일 때 Cloud Tasks REST API `createTask` 호출
  - task body는 작은 JSON payload만 포함하고 결과/진행 상태는 기존 Redis 경로 유지
  - `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL` 설정 시 OIDC token 포함
- 운영 설정:
  - `.env.example`, `cloud-run/ai-engine/.env.example`, `docs/development/environment-variables.md`, `deploy.sh`, `sync-vercel.sh` 업데이트
  - GCP queue/IAM 생성 및 `AI_JOB_TRIGGER_MODE=cloud-tasks` production 활성화는 별도 운영 단계로 완료
  - 활성화 값: `openmanager-free-tier / asia-northeast1 / openmanager-ai-jobs`
  - Queue guard: `max-dispatches-per-second=1`, `max-concurrent-dispatches=2`, `max-attempts=3`
  - Durable env: GitLab CI `CLOUD_TASKS_ENABLED=true`, Vercel production `AI_JOB_TRIGGER_MODE=cloud-tasks`
- Side effect follow-up:
  - `v8.11.51` production smoke에서 `http://*.run.app/api/jobs/process` target이 Cloud Run `302` 후 `GET /api/jobs/process` 404로 바뀌는 문제를 확인
  - `v8.11.52`에서 non-local worker target을 HTTPS로 고정하고 local host에서만 HTTP를 허용하도록 보강
  - `QA-20260428-0358`에서 `/api/jobs/dispatch` 202, Cloud Tasks `POST /api/jobs/process` 200, Redis job result completed를 확인
- 검증:
  - `cd cloud-run/ai-engine && npm run test -- jobs.dispatch.test.ts`
  - `npx vitest run src/app/api/ai/jobs/route.trigger.test.ts src/app/api/ai/jobs/[id]/retry/route.test.ts`
  - `cd cloud-run/ai-engine && npx vitest run src/lib/cloud-tasks.test.ts src/routes/jobs.dispatch.test.ts src/routes/jobs.test.ts`
  - `npm run test:contract`
  - `npm run type-check`
  - `cd cloud-run/ai-engine && npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - `cd cloud-run/ai-engine && npm run test`
  - `npm run docs:lint:changed`
  - `npm run docs:budget`
