# TODO - OpenManager AI v8

**Last Updated**: 2026-04-18 KST (QA evidence top-run manual triage 기록)

> **이력 아카이브**: `#1~#89` 완료 항목 → [archive/todo-history-to-2026-04-13.md](archive/todo-history-to-2026-04-13.md)

## Active Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| — | — | none | 현재 active task 없음 |

---

## On Hold

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| P2: QA evidence 저장소 용량 정리 | Medium | tracking-only | 2026-04-18 재검증 기준 `reports/qa=61.12MiB`, `reports/qa/evidence=56.45MiB / 233파일`. `npm run qa:evidence:audit` 결과 orphan/missing/archive candidate `0`, size warning만 남음. top-run triage 결과 `QA-20260330-0197/0198`는 unique footprint가 각 `1MiB` 미만인 low-yield shared bundle, `QA-20260404-0228`은 `3.35MiB`의 고유 modal/detail proof로 확인되어 explicit override batch는 열지 않음. 새 evidence 누적 시점에만 재평가. |

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| ~~AI Assistant Surface Parity Refactor~~ | — | **완료** — archive 이동. |
| ~~AI Response Visibility & Rate Limit (Phase 1~5)~~ | — | **완료** — write bucket 재평가 결과 `supervisor 10/min`, `jobs/process 5/min`, `daily 100` 유지 결정. 계획서는 구현/결정 로그로 유지. |
| ~~AI Stream Route Contract - residual cleanup~~ | — | **완료** — archive 이동. |
| ~~OTel 토폴로지 개선~~ | — | **완료** — archive 이동: [archive/otel-topology-improvement-plan.md](archive/otel-topology-improvement-plan.md). |

---

## Recent Completed

### Completed (2026-04-18 #141)
- [x] QA evidence top-run manual triage 기록
  - `QA-20260330-0197` / `0198` run pair는 shared legacy bundle은 크지만 unique footprint가 각각 `890.36KiB`, `870.54KiB`로 낮아 ref 정리만으로는 저장소 절감 효과가 작다고 판단
  - `QA-20260404-0228`은 `3.35MiB` unique footprint이지만 active alerts, topology, server detail tabs, log explorer, analyst/reporter, full-screen AI, 404, console까지 모두 고유 surface proof라 duplicate landing cleanup 규칙에 해당하지 않음
  - 결과적으로 현재 top offenders 중 explicit override batch를 바로 열 안전한 후보는 없다고 판단하고 backlog를 tracking-only로 유지
  - 검증:
    - `sed -n '1,180p' reports/qa/runs/2026/qa-run-QA-20260330-0197.json`
    - `sed -n '1,180p' reports/qa/runs/2026/qa-run-QA-20260330-0198.json`
    - `sed -n '1,220p' reports/qa/runs/2026/qa-run-QA-20260404-0228.json`
    - `du -h reports/qa/evidence/legacy/2026/qa-20260330-0197-* reports/qa/evidence/legacy/2026/qa-20260330-0198-*`

### Completed (2026-04-18 #140)
- [x] QA evidence audit unique-footprint 가시성 개선
  - `qa:evidence:audit`에 `Top unique legacy run footprints` 섹션을 추가해 각 run이 혼자 보유하는 legacy artifact의 실제 디스크 footprint를 바로 확인할 수 있게 정리
  - `shared bundle`로 커 보여도 실제 절감 가능 용량은 작은 run을 구분할 수 있도록 README 해석 규칙을 보강
  - 검증:
    - `npx vitest run tests/unit/qa/qa-evidence-audit.test.ts`
    - `npm run qa:evidence:audit`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #139)
- [x] QA evidence audit shared-legacy bundle 가시성 개선
  - `qa:evidence:audit`에 `Top shared legacy run bundles` 섹션을 추가해 여러 run이 같은 legacy artifact를 공동 참조하는 개선 묶음을 바로 확인할 수 있게 정리
  - `QA-20260330-0197` / `0198`처럼 같은 proof를 재사용하는 run 관계를 manual override triage 대상으로 더 쉽게 식별하도록 README 해석 규칙을 보강
  - 검증:
    - `npx vitest run tests/unit/qa/qa-evidence-audit.test.ts`
    - `npm run qa:evidence:audit`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #138)
- [x] QA evidence audit legacy-run triage 가시성 개선
  - `qa:evidence:audit`에 `Top referenced legacy runs` 섹션을 추가해 어떤 QA run 묶음이 가장 많은 tracker-referenced legacy proof를 보유하는지 바로 확인할 수 있게 정리
  - 이 목록은 explicit override 검토용 수동 triage 출력이며, 자동 archive 후보가 아니라는 해석 규칙을 README에 명시
  - 검증:
    - `npx vitest run tests/unit/qa/qa-evidence-audit.test.ts`
    - `npm run qa:evidence:audit`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #137)
- [x] QA evidence audit legacy-reference 가시성 개선
  - `qa:evidence:audit` 출력에 `referenced legacy evidence` 개수/용량을 추가해 size warning 중 실제 tracker-referenced legacy proof 비중을 바로 확인할 수 있게 정리
  - helper를 분리해 unit test로 고정하고, README에 새 출력의 해석 규칙을 추가
  - 검증:
    - `npx vitest run tests/unit/qa/qa-evidence-audit.test.ts`
    - `npm run qa:evidence:audit`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #136)
- [x] QA evidence 저장소 용량 tracking 갱신
  - `npm run qa:evidence:audit` 기준 `reports/qa=61.12MiB`, `reports/qa/evidence=56.45MiB / 233파일`로 증가 상태를 재확인
  - orphan durable evidence, missing artifact path, archive candidate가 모두 `0`이라 cleanup 대상은 없다고 판단
  - `qa-evidence-size` 경고만 남아 있어 `reports/qa/README.md` 정책에 따라 policy-protected evidence backlog로 유지
  - 검증:
    - `npm run qa:evidence:audit`

### Completed (2026-04-18 #135)
- [x] AI Response Visibility - write bucket 재평가 종료
  - frontend와 Cloud Run write 경로는 이미 `supervisor 10/min`, `jobs/process 5/min`, `daily 100`으로 정렬돼 있음을 재확인
  - provider 비용을 직접 태우지 않는 read-only 경로는 이미 `120/min`으로 분리됐고, write bucket 추가 완화 근거는 없다고 판단
  - `supervisor` write minute bucket을 `10/min`으로 고정하는 회귀 테스트 추가
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #134)
- [x] Storybook circular chunk warning backlog 정리
  - `npm run storybook:build:ci` 재검증 결과 Storybook static build 성공
  - circular chunk warning은 재현되지 않았고, `.storybook/main.ts`의 warning suppression/manual chunk 정리가 현재 상태와 일치함을 확인
  - backlog 항목은 stale로 판단해 제거
  - 검증:
    - `npm run storybook:build:ci`

### Completed (2026-04-18 #133)
- [x] AI Response Visibility - Cloud Run read-only window alignment 완료
  - `GET /api/ai/supervisor/health`와 `GET /api/jobs/:id*` read-only bucket을 `60/min`에서 `120/min`으로 완화
  - `supervisor` write `10/min`, `jobs/process` write `5/min`, daily `100` semantics는 유지
  - read-only fallback/direct polling에서 minute window 경계 false 429를 줄이도록 `X-RateLimit-Limit` 계약을 상향 고정
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #132)
- [x] AI Response Visibility - Cloud Run supervisor health limiter split 완료
  - `GET /api/ai/supervisor/health`를 별도 health/read bucket으로 분리해 smoke/health 확인이 strict `supervisor 10/min` write bucket을 잠식하지 않게 조정
  - `POST /api/ai/supervisor*` write semantics와 Cloud Run daily semantics는 그대로 유지
  - Redis unavailable 시에도 in-memory fallback key가 `keyPrefix`를 포함하도록 보강해 health/read bucket과 write bucket이 충돌하지 않게 수정
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #131)
- [x] AI Response Visibility - Cloud Run daily semantics alignment 완료
  - Cloud Run `supervisor`와 `jobs/process` write bucket에 `daily=100` semantics 추가
  - `X-RateLimit-Daily-*` 헤더와 `limitScope=daily`, `dailyLimitExceeded=true` payload를 Cloud Run 429에도 일관되게 제공
  - `jobs` polling read bucket은 daily 제외로 유지
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #130)
- [x] AI Response Visibility - Cloud Run jobs read/write limiter split 완료
  - Cloud Run `/api/jobs/process`는 기존 strict `5/min` write bucket을 유지
  - Cloud Run `GET /api/jobs/:id`, `GET /api/jobs/:id/progress`는 별도 read bucket으로 분리
  - job progress polling이 write bucket을 잠식하던 정책 drift를 제거
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #129)
- [x] OTel topology improvement - precomputed-state sync 완료 및 계획서 archive 이동
  - AI Engine bundled `precomputed-states.json`을 18대 inventory 기준으로 재생성해 root OTel SSOT와 drift를 해소
  - `tests/unit/otel-topology-precomputed-state-sync.contract.test.ts`로 AI Engine precomputed-state / bundled inventory 계약을 고정
  - 18대 inventory 증가로 깨진 topology RAG governance chunk 예산을 짧은 운영 메모로 재조정
  - 계획서 archive 이동: `reports/planning/archive/otel-topology-improvement-plan.md`
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-precomputed-state-sync.contract.test.ts`
    - root gate: `npm run docs:lint:changed && npm run type-check && npm run lint && npm run test:quick`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`75 files`, `783 tests`)

### Completed (2026-04-18 #128)
- [x] OTel topology improvement - Phase 3-C AZ2 NFS standby 완료
  - `storage-nfs-dc1-02`를 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 추가
  - `server.purpose=hot-standby`, `server.notes=nfs failover target` 메타데이터 추가
  - `otel-fix.ts`에 AZ2 NFS standby datapoint/timeseries 보정 helper 추가
  - `otel-verify.ts`에 Phase 3-C inventory 검증 항목 추가
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-phase3-storage-standby.contract.test.ts tests/unit/otel-topology-phase3-cache-az3.contract.test.ts tests/unit/otel-topology-phase3-lb-az2.contract.test.ts tests/unit/otel-topology-baseline-debt.contract.test.ts tests/unit/otel-topology-backup.contract.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `node_modules/.bin/jiti scripts/data/otel-verify.ts` (`45 passed, 0 failed`)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #127)
- [x] OTel topology improvement - Phase 3-B AZ3 Redis 완료
  - `cache-redis-dc1-03`를 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 추가
  - `otel-fix.ts`에 AZ3 Redis datapoint/timeseries 보정 helper 추가
  - `otel-verify.ts`에 Phase 3-B inventory 검증 항목 추가
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-phase3-cache-az3.contract.test.ts tests/unit/otel-topology-phase3-lb-az2.contract.test.ts tests/unit/otel-topology-baseline-debt.contract.test.ts tests/unit/otel-topology-backup.contract.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `npm run data:verify` (`39 passed, 0 failed`)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #126)
- [x] OTel topology improvement - Phase 3-A AZ2 LB 완료
  - `lb-haproxy-dc1-03`를 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 추가
  - `otel-fix.ts`에 AZ2 LB datapoint/timeseries 보정 helper 추가
  - `otel-verify.ts`에 Phase 3-A inventory 검증 항목 추가
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-phase3-lb-az2.contract.test.ts tests/unit/otel-topology-baseline-debt.contract.test.ts tests/unit/otel-topology-backup.contract.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `npm run data:verify` (`34 passed, 0 failed`)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #125)
- [x] OTel topology improvement - baseline debt cleanup 완료
  - `hour-23 storage-s3gw-dc1-01` network drift를 storage baseline 범위 안으로 조정
  - anomaly-heavy 시간대에 deterministic extra error 로그를 추가해 `ERROR > 3%` severity baseline 복구
  - `otel-fix.ts` generator와 baseline debt contract test를 위 기준에 맞게 동기화
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-baseline-debt.contract.test.ts tests/unit/otel-topology-backup.contract.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `npm run data:verify` (`29 passed, 0 failed`)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #124)
- [x] OTel topology improvement - NFS SPOF 완료
  - `hour-02~04`에 `storage-nfs-dc1-01` disk/cpu saturation과 `api-was-*` response duration cascade 추가
  - `storage-nfs-dc1-01`, `api-was-*` 로그에 NFS 병목 원인 문구 추가
  - `timeseries.json`의 같은 구간 WAS response duration 동기화
  - `otel-fix.ts`, `otel-verify.ts`에 S7 계약 반영
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `npm run data:verify` (신규 S7 항목 통과, 기존 baseline 실패 2건은 유지: storage network range, ERROR 비율)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #123)
- [x] OTel topology improvement - Redis cross-AZ latency 완료
  - `hour-13~15`에 `api-was-dc1-03` response duration spike 추가
  - `api-was-dc1-03`, `cache-redis-dc1-01` 로그에 `remote AZ cache` 원인 문구 추가
  - `timeseries.json`의 같은 구간 response duration 동기화
  - `otel-fix.ts`, `otel-verify.ts`에 S6 계약 반영
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-redis-cross-az.contract.test.ts`
    - targeted: `npm run data:verify` (신규 S6 항목 통과, 기존 baseline 실패 2건은 유지: storage network range, ERROR 비율)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #122)
- [x] OTel topology improvement - backup realism 완료
  - `db-mysql-dc1-backup`을 `8c / 32GB / 1TB` backup 노드로 현실화
  - `server.purpose=cold-standby`, `server.notes=daily snapshot target` 메타데이터 추가
  - `hour-23` backup 메트릭을 `disk-heavy / low-cpu / low-memory` 패턴으로 조정하고 `timeseries.json`에도 동기화
  - `otel-fix.ts` 시나리오와 `otel-verify.ts` backup realism 검증 항목 추가
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-backup.contract.test.ts`
    - targeted: `npm run data:verify` (backup realism 항목 통과, 기존 baseline 실패 2건은 유지: storage network range, ERROR 비율)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #121)
- [x] AI Response Visibility - retry limiter alignment 완료
  - `/api/ai/jobs/[id]/retry`를 `aiJobCreation(5/min)` limiter에 정렬
  - queue 생성과 retry가 동일한 Cloud Run `jobs/process` workload를 호출할 때 같은 edge fail-fast semantics를 사용하도록 계약 고정
  - `withRateLimit()`가 dynamic route `params` 시그니처를 보존하도록 generic tuple typing 보강
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/jobs/[id]/retry/route.rate-limit-contract.test.ts src/app/api/ai/jobs/[id]/retry/route.test.ts src/app/api/ai/jobs/route.rate-limit-contract.test.ts src/lib/security/rate-limiter.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-18 #120)
- [x] AI Response Visibility - Cloud Run forwarded identity 완료
  - frontend AI proxy가 session-aware limiter identity를 `X-Rate-Limit-Identity` 헤더로 Cloud Run에 전달하도록 정리
  - 적용 경로: primary `stream/v2`, `jobs/process`, `jobs retry`, legacy supervisor proxy
  - Cloud Run limiter가 shared `X-API-Key`보다 forwarded end-user identity를 우선 사용하도록 계약 고정
  - 이로써 service secret 하나로 모든 사용자가 같은 Cloud Run limiter bucket을 공유하던 문제를 해소
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/supervisor/stream/v2/route.test.ts src/app/api/ai/jobs/route.trigger.test.ts src/app/api/ai/supervisor/cloud-run-handler.test.ts`
    - ai-engine targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts`
    - root/ai-engine gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract && cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #119)
- [x] AI Response Visibility - daily-limit semantics 완료
  - `buildRateLimitErrorDetails()`가 `X-RateLimit-Daily-Remaining`, `X-RateLimit-Daily-Reset` 헤더만으로도 `daily` 초과를 복원하도록 보강
  - body가 generic해도 `scope=daily`, `dailyLimitExceeded=true`, `resetAt=daily reset`을 표준 에러 모델로 유지
  - 검증:
    - targeted: `npx vitest run src/lib/ai/error-details.test.ts src/components/ai-sidebar/chat/ColdStartErrorBanner.test.tsx`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-18 #118)
- [x] AI Response Visibility - session-aware limiter identity 완료
  - frontend AI gateway limiter identifier를 IP-only에서 session-aware identity로 보강
  - 우선순위: `auth context user/key` → `guest session cookie` → `supabase auth cookie` → `API key/test secret` → `IP+UA fingerprint`
  - In-Memory fallback과 Redis limiter가 같은 identity semantics를 사용하도록 공통 helper로 정리
  - same-IP 환경에서도 guest session cookie가 다르면 서로 다른 limiter bucket을 사용한다는 계약 고정
  - 검증:
    - targeted: `npx vitest run src/lib/security/rate-limiter.runtime.test.ts src/lib/security/rate-limiter.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-18 #117)
- [x] AI Response Visibility - limiter alignment (`/api/ai/jobs` POST) 완료
  - 프론트 gateway에 `aiJobCreation` limiter 추가 (`5/min`, daily `100`)
  - `/api/ai/jobs` POST가 기존 `aiAnalysis(10/min)` 대신 `aiJobCreation(5/min)`을 사용하도록 정렬
  - Cloud Run `/api/jobs*`의 stricter minute window와 edge fail-fast 정책을 맞춰 중첩 limiter 체감 drift를 축소
  - TDD 커밋:
    - failing test: `/api/ai/jobs` POST가 `5/min` limiter를 바인딩해야 한다는 route contract 고정
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/jobs/route.rate-limit-contract.test.ts src/lib/security/rate-limiter.test.ts src/app/api/ai/jobs/route.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-17 #115)
- [x] AI Response Visibility - 429 UX source-hardening 완료
  - provider 이름이 포함된 plain 429 메시지(`Groq`, `Mistral`, `Cerebras`, `Gemini`, `OpenRouter`)를 `upstream-provider`로 안정 분류
  - `ColdStartErrorBanner`가 plain error만 받아도 upstream-provider title(`AI 제공자 요청 제한이 발생했습니다`)을 올바르게 렌더링하는 계약 고정
  - TDD 커밋:
    - `f2a040e3c` → implementation commit
  - 검증:
    - targeted: `npx vitest run src/lib/ai/error-details.test.ts src/components/ai-sidebar/chat/ColdStartErrorBanner.test.tsx`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-17 #116)
- [x] AI Response Visibility - Job Queue agent-path slice 정리 완료
  - Cloud Run jobs route가 `agent_status`/`handoff`/`done.metadata.handoffs`에서 `executionPath`, `handoffFrom`, `handoffTo`, `handoffCount`, `stageDetail`을 이미 수집·저장하고 있음을 재검증
  - Next `/api/ai/jobs/[id]/stream` route가 위 metadata를 progress SSE로 보존하는 계약을 재확인
  - `asyncQuerySSE` progress callback이 agent-path metadata를 그대로 전달하는 regression test 추가
  - 검증:
    - targeted: `npx vitest run src/hooks/ai/core/asyncQuerySSE.test.ts src/app/api/ai/jobs/[id]/stream/route.test.ts src/components/ai-sidebar/JobProgressIndicator.test.tsx`

### Completed (2026-04-17 #114)
- [x] AI Stream Route Contract - observability/caching 설명 정리 완료 및 계획서 archive 이동
  - primary request flow 문서를 `/api/ai/supervisor/stream/v2` 기준으로 정렬
  - `/api/ai/supervisor`는 legacy JSON/text proxy + cache/plain callers 경로로만 설명되도록 정리
  - legacy response cache와 v2 resumable stream state를 별도 caching semantics로 분리 설명
  - observability 문서에서 `W3C Trace Context propagation`과 `full OTLP distributed tracing`을 구분
  - stale timeout 설명(`Orchestrator 45s`)을 current config 기준으로 교정
  - 계획서 archive: `reports/planning/archive/ai-stream-route-contract-plan.md`
  - 검증:
    - `npm run docs:lint:changed`
    - `git diff --check`

### Completed (2026-04-17 #113)
- [x] AI Stream Route Contract - legacy role-tagging 완료
  - `/api/ai/supervisor`를 삭제하지 않고 legacy contract route로 명시
  - 응답 헤더 추가:
    - `X-AI-Route-Contract=legacy-supervisor`
    - `X-AI-Primary-Route=/api/ai/supervisor/stream/v2`
    - `X-AI-Transport=json|text`
  - local dev fallback 주석과 architecture/API docs를 current reality 기준으로 정리
  - TDD 커밋:
    - `5843a8e4a` → `6e667682c`
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/supervisor/cloud-run-handler.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-17 #112)
- [x] AI Stream Route Contract - warning semantics alignment 완료
  - multi-agent `SLOW_PROCESSING` warning payload를 single-agent와 같은 shape로 정렬 (`threshold` 포함)
  - warning message를 stale `25초`에서 실제 orchestrator threshold 기반 문자열로 수정
  - frontend warning 타입 주석을 path-local threshold semantics 기준으로 일반화
  - TDD 커밋:
    - `7fb0ad86a` → `7fc5c740a`
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `782 tests`)

### Completed (2026-04-17 #111)
- [x] AI Stream Route Contract - multi-agent provider fallback visibility 완료
  - AI SDK best practice 기준으로 transient retry state는 final metadata가 아니라 stream `agent_status`로 즉시 노출하도록 정렬
  - `executeAgentStream()`에서 다음 provider 재시도 직전에 상태 이벤트 추가:
    - `No output generated`
    - empty response
    - generic provider error
  - 기존 `done.metadata` / `usage.totalTokens` 계약은 유지
  - TDD 커밋:
    - `ca3944e3b` → `d06ef316e`
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `781 tests`)

### Completed (2026-04-17 #110)
- [x] AI Response Visibility - handoff persistence contract 완료
  - `handoffHistory: []`를 stream `data-done`, job queue result metadata, assistant message hydration, chat history save/restore 전반에서 보존
  - `handoff 있음` / `handoff 없음` / `legacy/미기록` semantics를 계약 수준으로 고정
  - TDD 커밋:
    - `2e00d4e42` → `d41bc0ee7`
  - 검증:
    - root targeted: `66/66` pass
    - AI Engine targeted: `14/14` pass
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - ai-engine gate: `npm run type-check && npm run test` (`74 files`, `779 tests`)

### Completed (2026-04-17 #109)
- [x] AI Chat Improvement Sprint 4 완료 및 계획서 archive 이동
  - non-stream routing timeout 시 `suggestedAgent` fallback 유지
  - structured-output provider fallback / invalid JSON fallback recovery 보강
  - decomposition stream `usage.totalTokens`, `failedCount`, `failedAgents` 계약 고정
  - sequential stream subtask timeout contract 완료: timeout된 subtask는 `null` 처리하고 partial success 유지, 전부 timeout 시 `ALL_SUBTASKS_FAILED`
  - TDD 커밋:
    - `94c62acfd` → `71b6b90d4`
    - `f5df3bd3a` → `721b84bce`
    - `083a23257` → `b442aac7c`
    - `68250484f` → `b724c3412`
    - `a7eb7c416` → `4c9cdb00c`
    - `5cf4b1d80` → `9ccc20d38`
    - `6f7e9156e` → `e25ba794e`
  - 검증: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `778 tests`)
  - archive: `reports/planning/archive/ai-chat-improvement-plan.md`

### Completed (2026-04-17 #108)
- [x] AI Assistant Surface Parity Refactor 완료 (Task 0~5 전체)
  - `useAIEntryController.ts` 신규: sidebar/fullscreen 진입 경로 단일화
  - `pendingEntryState` store 추가: draft/prefill/analysisMode one-shot handoff
  - `AIWorkspace` fullscreen parity: `analysisMode` 표시·변경, shared props
  - `mode="sidebar"` 레거시 분기 완전 제거 (`ce0d3a659`, -131줄)
  - 테스트 50개 통과 (AIWorkspace, AISidebarV4, useAISidebarStore)
  - 계획서 archive 이동: `reports/planning/archive/ai-assistant-surface-parity-refactor-plan.md`

### Completed (2026-04-17 #107)
- [x] active-alert `:9100` 포트 오염 근본 원인 수정 + targeted production QA 완료 (`v8.11.19`)
  - **근본 원인**: `AlertManager.ts`, `MetricsAggregator.ts`, `otel-log-views.ts` 3곳에서 `:9100` suffix 하드코딩 생성 → `instance: server.serverId` (포트 없음)로 전체 수정
  - **AIDebugPanel** 293줄 → 75줄 단순화 (Start+Check 2버튼 → 단일 "상태 확인", Log Level 섹션 제거)
  - `server-data-transformer.ts` dead code (`_targetToRawServerData`) 제거
  - 회귀 테스트 갱신: `MetricsAggregator.test.ts`, `otel-log-views.test.ts`, `monitoring-pipeline.test.ts`
  - production `v8.11.19` 배포 확인 + `QA-20260417-0302` 기록 (`4/4` pass)
  - detectAnomalies 직접 성공 확인: 실제 데이터(평균 64.9%→82% 급증) 기반 응답, 신뢰도 95%

### Completed (2026-04-17 #106)
- [x] root layout font preload warning cleanup broad production QA 완료
  - release `v8.11.17` / production deployment `dpl_sRuuaBX32ZL4rGggN552bJqcL2th` live 확인
  - `QA-20260417-0300` 기록 (`18/18` pass): landing/login/privacy/404/system-boot/dashboard/AI/fullscreen/API/console 전부 green
  - `/dashboard` + `/dashboard/ai-assistant` 경로의 `next/font preload unused` warning 재현 종료, broad reference를 `QA-20260417-0300`으로 갱신
  - Vercel usage check 정상: effective `9.7924 USD`, billed `0.0000 USD`, chargeCount `9135`

### Completed (2026-04-17 #105)
- [x] AI Domain Boundary Phase 2 production targeted QA + copy trim verification
  - production deployment `dpl_8RCgJKU4HmRuGrJUaDBUgEQYFhom` / commit `b1469ce44` (`v8.11.16`) live 확인
  - `QA-20260417-0298` 기록 (`10/10` pass): landing copy, system start → dashboard, AI sidebar welcome/placeholder, starter prompt 응답, analysis basis, `/api/version`, `/api/health`, console `0 error / 0 warning`
  - 범위 밖 surface (`fullscreen`, `Reporter/Analyst`, `observability/security`)는 targeted run 특성상 의도적으로 제외

### Completed (2026-04-16 #104)
- [x] 계획서 평가 및 개선 사이클
  - **Stream Route Contract Phase 1**: `useHybridAIQuery.ts` JSDoc 교정 (threshold 45→실제값 19 맥락 명시), `frontend-backend-comparison.md` 복잡도 라우팅 표 수정
  - **AI Domain Boundary Phase 1 완료**: `query-classifier.ts` `off-domain` intent + `isOffDomain` 플래그, `useQueryExecution.ts` 오프도메인 disclaimer warning 주입, `ChatInputArea.tsx` placeholder 도메인 안내 추가
  - **NLP/아키텍처 문서 반영**: `ai-engine-architecture.md` "NLP 엔진: 자체 구현 없음" 사실 오류 수정, `frontend-backend-comparison.md §2.3-A` NLP 전처리 파이프라인 상세 추가
  - **knowledge-base corpus drafts**: archive 이동 (실행 계획 없는 초안 모음)
  - **Backlog 재정렬**: Domain Boundary Phase 2, Sprint 4 순서 명확화

### Completed (2026-04-16 #100)
- [x] P1 `ai-workspace-analysis-basis-hydration-drift` 완전 종료
  - `stream-data-handler.ts` `data-done` 핸들러에 `toolsCalled` → deferred metadata 저장 누락 수정. `ac18ca2f9`.
  - 회귀 테스트 2케이스 추가 (deferred 경로 + pending 경로).
  - preview QA pass (sidebar→fullscreen parity 유지 확인).
  - v8.11.13 release + production QA-20260416-0294 pass (7/7, Reporter/Analyst/feedback).

### Completed (2026-04-16 #103)
- [x] Vibe Coding 공개 카피 정리
  - `feature-cards.data.ts`, `vibe-coding.ts` 수정: 모델 SKU(`claude-sonnet-4-6`) 제거, `99% 주도` → 중립 문구, Google Antigravity implementation 사용 맥락 분리, Cursor stage label 완화.
  - `docs/status.md`: Claude Code 모델 버전 `Opus 4.6` → `Sonnet 4.6` 수정.
  - 타입 체크 ✅ / 정적 검증 ✅ (Playwright WSL2 네트워크 격리로 로컬 UI 직접 검증 불가 — 다음 배포 후 production 확인).
  - 커밋: `8f9babff8`, `7ef048999`.

### Completed (2026-04-16 #102)
- [x] 계획서 archive 정리 (2차)
  - `completion-review.md`, `wbs.md`, `knowledge-base-corpus-expansion-plan.md`, `supabase-migration-ledger-repair-plan.md` → archive 이동.
  - `ai-response-visibility-rate-limit-plan-2026-04-08.md`: 메타데이터 헤더 추가 + Backlog 등록.
  - `knowledge-base-corpus-candidate-drafts.md`: Owner `platform-data` → `project` 수정.
  - 잔여 활성 plan 파일: `vibe-coding-public-copy-plan.md`, `ai-chat-improvement-plan.md`, `ai-response-visibility-rate-limit-plan-2026-04-08.md`, `knowledge-base-corpus-candidate-drafts.md`.

### Completed (2026-04-16 #101)
- [x] 계획서 디렉토리 정리 (이번 세션)
  - `approval-history-restore-plan.md`, `orphan-function-cleanup-plan.md`, `ai-user-feedback-cleanup-plan.md` → archive 이동.
  - `next-tasks-plan.md` Task 5·6 완료 처리 후 archive 이동.
  - `TODO.md` 슬림화: #1~#89 완료 이력 → `archive/todo-history-to-2026-04-13.md` 분리.
  - 잔여 Active plan (`vibe-coding-public-copy-plan.md`) Active Tasks에 등록.

### Completed (2026-04-15 #99)
- [x] AI SDK 버전 재조사 완료 — root + ai-engine 모두 `ai ^6.0.156`, `@ai-sdk/react ^3.0.140` 확인. `ai@latest` 호환성 blocker 재분류 → stale 정리로 닫음.

### Completed (2026-04-15 #98)
- [x] production release-gate QA refresh — Vercel production landing→AI sidebar 흐름 `8/8` green. `QA-20260415-0287`.

### Completed (2026-04-15 #97)
- [x] zero-backlog planning 정합성 반영 — TODO.md Active Tasks / Backlog 문구 실제 상태 반영.

### Completed (2026-04-15 #96)
- [x] QA trend metadata sync — `QA_TRENDS.md`, `QA_STATUS.md` `QA-20260415-0286` 기준으로 갱신.

### Completed (2026-04-15 #95)
- [x] mixed advisory residual follow-up — OOM/CPU+memory 혼합 3건 재검증. `no-tool` drift 미재현. non-blocking latency watch 유지.

### Completed (2026-04-15 #94)
- [x] `src/types/README.md` 필요성 재평가 → 신규 문서 불필요 판단. 기존 canonical reference로 커버 충분.

### Completed (2026-04-15 #93)
- [x] Graph traversal production 재평가 → `KEEP` 결정. topology `vector 3 + graph 1`, incident `graph 3 + vector 0` 확인. `QA-20260415-0285`.

### Completed (2026-04-15 #92)
- [x] Storybook `experimentalComponentsManifest` flag 유지 판단 고정. stable 승격 전 변경 없음.

### Completed (2026-04-15 #91)
- [x] topology duplicate invocation dedupe — `supervisor-routing.ts` step 0 이후 강제 도구 재노출 차단. revision `ai-engine-00317-sss`. `QA-20260415-0284`.

### Completed (2026-04-15 #90)
- [x] Advisor Agent P1 수정 완료 (Task 1~4) — latency 임계값 보정, 프롬프트 포맷 강화, quality-retry 트리거 추가, Cloud Run 재배포. revision `ai-engine-00316-l67`. `QA-20260415-0283`.

### Completed (2026-04-13 #89)
- [x] variant direct path 안정화 패치 — `orchestrator-web-search.ts`, `supervisor-routing.ts`, `supervisor-quality-retry.ts` 보강. revision `ai-engine-00308-6qw`. `QA-20260413-0280`.
