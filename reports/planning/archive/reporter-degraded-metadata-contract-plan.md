> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-18
> Tags: reporter,artifact,api-contract,degradation,security

# Reporter Degraded Metadata Contract Plan

- 상태: Completed
- 작성일: 2026-05-18
- TODO.md 연결: Active Tasks > Reporter degraded metadata contract hardening

## 목표

Reporter Agent가 degraded-success로 tool-based fallback을 반환할 때, 공개 계약을 구조화된 `degraded`, `fallbackReasonCode`, `fallbackSource`, artifact `degradation.reasonCode` 중심으로 고정한다. Provider raw error message와 legacy `_fallbackReason`은 클라이언트/API/artifact 공개 응답에서 제거한다.

## 배경

v8.11.170~172에서 Reporter degraded metadata가 Cloud Run → Next API → Artifact → UI로 노출되기 시작했다. 후속 리뷰에서 아래 리스크가 확인됐다.

- `_fallbackReason` legacy 필드가 public JSON에 남을 수 있음
- `fallbackReasonCode`가 API header/body 경계에서 allowlist 없이 신뢰될 수 있음
- raw provider fallback reason이 artifact metadata로 노출될 수 있음
- Cloud Run과 root artifact 경계가 같은 reason/source 계약을 독립적으로 검증하지 않음

## 범위

- 포함:
  - Cloud Run Reporter fallback 응답에서 public raw reason 제거
  - Next API route에서 legacy/raw reason 필드 삭제
  - Next API header/body reason/source allowlist 정규화
  - Root artifact envelope/degradation 정규화
  - Reporter degradation reason pure helper 테스트
  - API/artifact regression 테스트
- 제외:
  - 일반 AI stream/job/orchestrator `fallbackReason` 전체 제거
  - UI badge 문구 변경
  - Cloud Run/root 패키지 간 shared package 신설
  - Vercel/Cloud Run production 배포

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/routes/analytics.ts`
- `cloud-run/ai-engine/src/routes/analytics-report-utils.ts`
- `src/app/api/ai/incident-report/post-handler.ts`
- `src/app/api/ai/incident-report/route-helpers.ts`
- `src/lib/ai/degradation-metadata.ts`
- `src/lib/ai/chat-artifacts/types.ts`
- `src/lib/ai/chat-artifacts/incident-report-artifact.ts`

### 입출력 계약

| 경계 | 입력 | 출력 | 에러/비정상 케이스 |
|------|------|------|--------------------|
| Cloud Run Reporter fallback | provider error message | `degraded: true`, `fallbackSource: "tool-based"`, `fallbackReasonCode` | raw `fallbackReason`/`_fallbackReason` 미노출 |
| Next API incident-report success | Cloud Run report payload | normalized `report.fallbackReasonCode`, `report.fallbackSource`, degradation headers | unknown code/source는 `reporter_degraded`/`tool-based`로 fallback |
| Artifact generator | API `report` | `artifact.degradation.reasonCode`, `artifact.degradation.fallbackSource` | raw `fallbackReason` 무시 |
| Artifact envelope sanitizer | restored/legacy artifact metadata | normalized `degradation` | invalid reason/source 정규화 |

### 허용 reason code

- `reporter_degraded`
- `reporter_unavailable`
- `provider_schema_drift`
- `provider_parse_drift`
- `provider_rate_limit`
- `provider_timeout`
- `provider_unavailable`

### 테스트 시나리오

- [x] Reporter unavailable/schema drift/parse/rate-limit/timeout/unavailable reason 분류가 고정 literal을 반환한다.
- [x] Cloud Run Reporter fallback 응답에 `_fallbackReason`과 public `fallbackReason`이 없다.
- [x] Next API degraded-success 응답은 `_fallbackReason`과 `fallbackReason`을 제거한다.
- [x] Next API degraded-success header/body는 invalid reason/source를 allowlist 기본값으로 정규화한다.
- [x] Artifact generator는 invalid API reason/source를 정규화하고 raw reason을 노출하지 않는다.
- [x] Artifact envelope sanitizer는 restored/legacy degradation metadata를 정규화한다.

## Task 목록

- [x] Task 0 — 계약/회귀 테스트 보강
- [x] Task 1 — Cloud Run Reporter fallback reason code helper 분리 및 raw reason 제거
- [x] Task 2 — Next API header/body degradation metadata 정규화
- [x] Task 3 — Root artifact degradation metadata 정규화
- [x] Task 4 — root `lint`/`test:contract` 추가 검증
- [x] Task 5 — 최종 diff 리뷰, commit, GitLab push/pipeline 확인

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0~3 | `fix(ai):` | ✅ | 필요 | 필요 |
| Task 4~5 | `test(qa):` 또는 같은 커밋 내 검증 기록 | ✅ | 변경 없음 | 변경 없음 |

## 완료 기준

- [x] `npm run lint` 통과
- [x] `npm run lint:changed` 통과
- [x] `npm run type-check` 통과
- [x] `cd cloud-run/ai-engine && npm run type-check` 통과
- [x] targeted reporter/API/artifact tests 통과
- [x] `cd cloud-run/ai-engine && npm run test` 통과
- [x] `npm run test:quick` 단독 재실행 통과
- [x] `npm run test:contract` 통과
- [x] GitLab pipeline 결과 확인

## 완료 기록

- 커밋: `4621dfc94 fix(ai): harden reporter degraded metadata contract`
- GitLab pipeline: `2533242669` success
- Pipeline URL: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2533242669

## 잔여 리스크

- Cloud Run과 root allowlist가 서로 다른 패키지 경계에 있어 중복된다. 새 reason code 추가 시 양쪽을 함께 갱신해야 한다.
- 일반 AI stream/job/orchestrator metadata의 `fallbackReason`은 이번 범위 밖이다.
- `test:quick`은 AI Engine full test와 동시에 실행하면 WSL I/O 부하로 `vercel-font-source-guard` timeout이 재현될 수 있다. 단독 실행은 통과했다.
