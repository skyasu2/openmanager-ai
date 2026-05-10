> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-11
> Tags: ai-assistant, guardrail, coding-boundary, qa

# AI Assistant General Coding Boundary Plan

- 상태: Completed
- 작성일: 2026-05-10
- TODO.md 연결: Backlog 완료 이력 > AI Assistant general coding boundary hardening
- 근거 QA: `QA-20260510-0463` off-domain Python coding WARN

## 목표

AI Assistant가 서버 운영·모니터링 제품 경계를 유지하면서 일반 코딩 질문을 일관되게 처리하도록 한다.

현재 `파이썬 피보나치 코드 짜줘` 같은 일반 코딩 요청은 `off-domain-guard`에 걸리지 않고 Cloud Run 일반 질문 best-effort 경로로 넘어간다. 이로 인해 OpenManager AI가 범용 코딩 챗봇처럼 보이고, 기존 off-domain guard 정책과 QA 판정 기준이 흔들린다.

## 범위

- 포함:
  - 일반 코딩/알고리즘/학습성 코드 작성 요청을 deterministic guard 대상으로 분류
  - 서버 운영·모니터링 문맥이 있는 코드 요청은 계속 허용
  - frontend guard와 query classifier 테스트 보강
  - Cloud Run 일반 질문 프롬프트가 frontend guard 정책과 충돌하지 않도록 문구 정렬
  - QA 기록에서 WARN이 묻히지 않도록 후속 QA 입력/notes 작성 기준 확인
- 제외:
  - 범용 코딩 assistant 기능 신규 구현
  - Python 실행기, 코드 인터프리터, 외부 sandbox 기능 변경
  - OpenManager 운영 스크립트/로그 파싱/PromQL/장애 대응 코드 요청 차단
  - 실시간 웹 검색, 캘린더, 메일, 예약 tool 신규 연결

## 계약 (Contract)

### 변경 대상 파일

- `src/lib/ai/off-domain-guard.ts`
- `src/lib/ai/off-domain-guard.test.ts`
- `src/lib/ai/query-classifier.ts`
- `src/lib/ai/query-classifier.test.ts`
- `src/hooks/ai/core/useQueryExecution.test.ts`
- `cloud-run/ai-engine/src/domains/monitoring/supervisor-prompt.ts`
- 필요 시 `reports/qa/templates/qa-run-input.example.json` 또는 QA 기록 문서

### 입력 경계

| 입력 | 분류 | 기대 동작 |
|------|------|-----------|
| `파이썬 피보나치 코드 짜줘` | `general_coding` | LLM/Cloud Run 호출 없이 deterministic 범위 안내 응답 |
| `leetcode two sum 풀어줘` | `general_coding` | 범용 알고리즘 풀이 대신 OpenManager 지원 범위 안내 |
| `Python으로 nginx access log 에러율 집계 스크립트 만들어줘` | 운영 코드 요청 | guard 미적용, 기존 AI 경로 유지 |
| `CPU 사용률 점검 bash 스크립트 알려줘` | 운영 코드 요청 | guard 미적용, Advisor/command guidance 경로 유지 |
| `PromQL로 CPU 80% 이상 서버 찾는 쿼리 알려줘` | 운영 코드 요청 | guard 미적용, 운영 지식/명령어 경로 유지 |

### 출력 계약

`general_coding` guard hit 시:

- `sendMessage` 호출 금지
- `asyncQuery.sendQuery` 호출 금지
- `/api/ai/supervisor/stream/v2` 및 job route 호출 금지
- UI에는 사용자 메시지와 assistant guard 응답을 남김
- `warning`에는 서버 운영·모니터링 범위 제한 메시지를 남김
- 응답은 한국어 deterministic 템플릿
- 템플릿은 다음 의미를 포함:
  - OpenManager는 서버 운영·모니터링 중심 AI임
  - 일반 알고리즘/학습성 코드 완성은 지원 범위 밖임
  - 로그 파싱, 모니터링 자동화, 운영 점검 스크립트, PromQL 같은 운영 관련 코드는 도울 수 있음

### 예외 계약

아래 운영 문맥이 있으면 `general_coding` guard를 적용하지 않는다.

- 등록 서버 ID 또는 서버명 패턴
- `서버`, `인프라`, `모니터링`, `장애`, `로그`, `CPU`, `메모리`, `디스크`, `네트워크`
- `nginx`, `mysql`, `redis`, `haproxy`, `promql`, `otel`, `krl`, `rag`
- `runbook`, `점검`, `명령어`, `운영`, `알림`, `토폴로지`
- 파일 첨부가 있는 Vision 분석 요청

### 테스트 시나리오

- [x] `off-domain-guard`: `파이썬 피보나치 코드 짜줘`가 `general_coding`으로 short-circuit된다.
- [x] `off-domain-guard`: `leetcode two sum 풀어줘`가 `general_coding`으로 short-circuit된다.
- [x] `off-domain-guard`: `Python으로 nginx access log 에러율 집계 스크립트 만들어줘`는 guard되지 않는다.
- [x] `query-classifier`: 일반 코딩 질문은 `off-domain` intent와 `general_coding` category를 가진다.
- [x] `useQueryExecution`: 일반 코딩 guard hit 시 `sendMessage`/`asyncQuery.sendQuery`/entity extraction이 호출되지 않는다.
- [x] Cloud Run prompt: 일반 질문 best-effort 문구가 일반 코딩 guard 정책과 충돌하지 않는다.

## Task 목록

> SDD 순서대로 failing test를 먼저 커밋한 뒤 구현/검증/QA 기록을 완료했다.

- [x] Task 0 — failing regression tests 추가
  - `off-domain-guard`, `query-classifier`, `useQueryExecution`에 일반 코딩 guard 기대값을 먼저 고정
- [x] Task 1 — `general_coding` category 구현
  - 코딩/알고리즘 패턴 추가
  - 운영 문맥 예외 적용
  - deterministic response template 추가
- [x] Task 2 — Cloud Run prompt 정책 정렬
  - 일반 질문 best-effort 문구에 “일반 코딩/알고리즘 생성은 frontend guard에서 제한” 의미 반영
  - 서버 운영 코드 요청은 허용된다는 경계 유지
- [x] Task 3 — 검증
  - targeted Vitest
  - `npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - AI/API 계약 표면 영향 판단 후 `npm run test:contract`
- [x] Task 4 — QA 기록
  - local targeted QA 기록
  - 배포 후 Vercel production에서 `파이썬 피보나치 코드 짜줘` 재검증은 `QA-20260511-0467`의 `skippedSurfaces`/expert `nextAction` 후속으로 기록
  - WARN이 발생하면 QA JSON `notes` 또는 `pendingImprovements`에 명시

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| Task 1 | `fix(ai):` | 예 | 아니오 | 예 |
| Task 2 | `fix(ai):` 또는 Task 1에 포함 | 예 | 예 | 아니오 |
| Task 3~4 | `test:` / `chore(qa):` | 예 | 변경 범위에 따름 | 변경 범위에 따름 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing test가 제품 경계를 과도하게 막지 않는지 |
| Task 1 완료 후 | 운영 코드 요청 예외가 충분한지, regex가 서버 문맥을 오탐하지 않는지 |
| Task 2 완료 후 | frontend guard와 Cloud Run prompt가 서로 다른 정책을 말하지 않는지 |
| 전체 완료 후 | QA-0463 WARN 재현 방지와 기존 off-domain/live fact guard 회귀 여부 |

## 위험 및 대응

| 위험 | 대응 |
|------|------|
| 운영 스크립트 요청까지 차단 | 운영 문맥 예외 테스트를 먼저 고정 |
| 한국어/영어 혼합 코딩 요청 누락 | `python`, `파이썬`, `code`, `코드`, `algorithm`, `알고리즘`, `leetcode` 대표 패턴만 우선 적용 |
| Cloud Run best-effort와 frontend hard guard 충돌 | prompt 문구를 “일반 질문 허용”에서 “운영 범위 밖은 제한적 안내”로 좁힘 |
| QA WARN이 tracker summary에서 묻힘 | QA run notes/pendingImprovements에 WARN 세부를 명시 |

## 완료 기준

- [x] 일반 코딩 질문이 deterministic guard 응답으로 처리된다.
- [x] 운영 관련 코드/스크립트 요청은 기존 AI 경로를 유지한다.
- [x] targeted 테스트 전체 통과
- [x] `type-check`, `lint`, `test:quick` 통과
- [x] 계약 변경 영향이 있으면 `test:contract` 통과
- [x] QA 기록 생성: `QA-20260511-0467`
- [x] 배포 후 production QA 재검증 후속 기록: `QA-20260511-0467` skipped surface / expert nextAction

## Validation

- Failing spec commit: `aa26aac0d test(spec): general coding boundary add failing tests before implementation`
- Implementation commit: `9d06193e6 fix(ai): enforce general coding guard boundary`
- Targeted Root App Vitest: `src/lib/ai/off-domain-guard.test.ts`, `src/lib/ai/query-classifier.test.ts`, `src/hooks/ai/core/useQueryExecution.test.ts` 88/88 PASS
- Targeted Cloud Run prompt Vitest: `src/domains/monitoring/supervisor-prompt.test.ts` 1/1 PASS
- `npm run type-check` PASS
- `npm run lint` PASS (기존 `qa-tracker.json` max-size info only)
- `npm run test:quick` PASS
- `npm run test:contract` PASS (24/24)
- `cd cloud-run/ai-engine && npm run type-check` PASS
- `cd cloud-run/ai-engine && npm run test` PASS (1085/1085)
- `git diff --check` PASS
- QA 기록: `QA-20260511-0467`
- 후속: 다음 release/tag 배포 후 Vercel production에서 `파이썬 피보나치 코드 짜줘` 재검증
