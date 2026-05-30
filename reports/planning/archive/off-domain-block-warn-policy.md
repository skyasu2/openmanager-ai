> Owner: project
> Status: Completed
> Last reviewed: 2026-05-30

# Off-domain Block/Warn Policy Plan

- 상태: Completed
- 작성일: 2026-05-30
- TODO.md 연결: Active Tasks > Off-domain 응답 정책 2트랙화 — block/warn

## 목표

Vercel production QA에서 확인된 `오늘 서울 날씨 알려줘` 120초 timeout을 제거한다.

Off-domain 질의를 두 경로로 분기한다.

```text
off-domain query
  ├─ block: 실시간 외부 사실/개인·지역 추천/비운영 개인 질문
  │    → LLM 호출 없이 deterministic "답변 불가" 응답 후 종료
  └─ warn: 운영자가 참고할 수 있는 일반 기술·외부 실행 초안성 질문
       → LLM 응답 허용 + 정확성/범위 경고 추가
```

## 범위

- 포함:
  - Root App off-domain guard 결과에 `action: block | warn` 추가
  - Cloud Run AI Engine off-domain guard 결과에 `action: block | warn` 추가
  - Cloud Run streaming/non-streaming supervisor fast block 처리
  - Root App 입력 경계에서 `block`만 deterministic 종료, `warn`은 AI 경로로 위임
  - deterministic contract tests
- 제외:
  - 실제 외부 웹/날씨/뉴스 검색 도구 연결
  - 가정형 장애 예측 라우팅 개선
  - 새 UI 배너 컴포넌트

## 계약 (Contract)

### 변경 대상 파일

- `src/lib/ai/off-domain-guard.ts`
- `src/hooks/ai/core/useQueryExecution.ts`
- `src/lib/ai/off-domain-guard.test.ts`
- `src/hooks/ai/core/useQueryExecution.test.ts`
- `cloud-run/ai-engine/src/lib/off-domain-guard.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts`
- `cloud-run/ai-engine/src/lib/off-domain-guard.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/*off-domain*.test.ts`

### 입출력 계약

| 함수/API | 입력 | 출력 | 무시/예외 |
|----------|------|------|-----------|
| `getOffDomainGuardrail(query)` | 사용자 query | `null` 또는 `{ category, action, warning, response? }` | 빈 query, 운영 컨텍스트 포함 query는 `null` |
| Root `useQueryExecution.executeQuery()` | query + attachments | `block`이면 local assistant response, `warn`이면 기존 AI 경로 계속 | attachment가 있으면 off-domain guard 미적용 |
| Cloud Run `executeSupervisorStream()` | `SupervisorRequest` | `block`이면 `text_delta(response)` 후 `done(success=true)` | `warn`이면 기존 LLM 실행 + warning suffix |
| Cloud Run `executeSupervisorSingleAgent()` | `SupervisorRequest` | `block`이면 deterministic `SupervisorResponse` | `warn`이면 기존 LLM 실행 + warning suffix |

### 카테고리 정책

| category | action | 이유 |
|----------|--------|------|
| `live_fact` | `block` | 날씨/주가/뉴스/환율/crypto는 현재값을 보장할 도구가 없어 timeout과 hallucination 위험이 큼 |
| `local_recommendation` | `block` | 위치/영업/리뷰 최신성 검증 불가 |
| `personal_general` | `block` | 서버 운영·모니터링 범위 밖이며 운영 가치가 낮음 |
| `external_action` | `warn` | 직접 실행은 불가하지만 초안/절차 안내는 가능 |
| `general_coding` | `warn` | 운영과 무관하면 정확성 경고를 붙이고 best-effort로 답변 가능 |

### 테스트 시나리오

- [x] Root guard: `오늘 서울 날씨 알려줘` → `action=block`, response 포함
- [x] Root guard: `파이썬 피보나치 코드 짜줘` → `action=warn`, warning 포함, response 없음
- [x] Root `useQueryExecution`: weather block은 `asyncQuery.sendQuery`/`sendMessage`를 호출하지 않는다
- [x] Root `useQueryExecution`: general coding warn은 deterministic block 없이 기존 AI 경로로 진행한다
- [x] Cloud Run guard: weather/live fact는 `action=block`, general coding은 `action=warn`
- [x] Cloud Run stream: weather block은 multi/single LLM stream을 호출하지 않고 `text_delta` + `done`으로 종료한다
- [x] Cloud Run stream: general coding warn은 기존 LLM path를 유지하고 warning suffix를 붙인다
- [x] Cloud Run non-stream: weather block은 LLM 호출 없이 deterministic response를 반환한다

## Task 목록

- [x] Task 0 — failing test 커밋 (`ab14ea5f9`)
- [x] Task 1 — Root App guard/action 계약 구현
- [x] Task 2 — Cloud Run guard/action 계약 구현
- [x] Task 3 — Cloud Run stream/non-stream fast block 구현
- [x] Task 4 — targeted tests, root checks, AI Engine checks

## 완료 기준

- [x] 테스트 시나리오 전체 통과
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run test:quick` 통과
- [x] `npm run test:contract` 통과
- [x] `cd cloud-run/ai-engine && npm run type-check` 통과
- [x] `cd cloud-run/ai-engine && npm run test` 통과
