> Owner: project
> Status: Completed
> Last reviewed: 2026-04-24

# AI Starter Summary Parity Guard Plan

- 상태: Completed
- 작성일: 2026-04-24
- TODO.md 연결: Recent Completed > AI starter summary parity guard

## 목표

Vercel QA에서 관찰된 AI sidebar starter/복원 메시지와 현재 dashboard data-slot 간 불일치 가능성을 자동화 테스트에서 조기에 감지한다.

## 범위

- 포함: Playwright E2E에서 dashboard status count를 읽고, 방금 생성된 AI Chat 응답이 같은 total/online/warning/critical/offline 수치를 포함하는지 검증한다.
- 포함: dashboard status parser의 deterministic unit test를 추가한다.
- 제외: production AI 응답 생성 로직, Cloud Run AI Engine schema, OTel 데이터 생성 로직 변경.
- 제외: Reporter/Analyst advanced surface 검증.

## 계약 (Contract)

### 변경 대상 파일

- `tests/e2e/helpers/dashboard-ai-parity.ts`
- `tests/e2e/dashboard-ai-chat.spec.ts`
- `tests/unit/playwright/dashboard-ai-parity.test.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|-------------|
| `parseDashboardStatusSnapshot` | `string` | `DashboardStatusSnapshot | null` | 필수 count를 찾지 못하면 `null` |
| `doesAiTextMatchDashboardStatus` | `string`, `DashboardStatusSnapshot` | `boolean` | AI 응답에 dashboard count가 누락되면 `false` |
| `readDashboardStatusSnapshot` | `Page` | `Promise<DashboardStatusSnapshot>` | dashboard text에서 count를 찾지 못하면 throw |

### 테스트 시나리오

- [x] Parser: dashboard text에서 total/online/warning/critical/offline count를 추출한다.
- [x] Matcher: AI 응답의 `정상` 또는 `온라인` 표현을 dashboard online count와 매칭한다.
- [x] Matcher: 이전 슬롯의 warning/critical count가 섞인 응답은 실패한다.
- [x] E2E: starter prompt 및 직접 AI 질문 전 dashboard snapshot을 저장하고, 새 AI 응답이 snapshot count와 일치하는지 검증한다.

## Task 목록

- [x] Task 1 — TODO.md Active Task 등록
- [x] Task 2 — dashboard/AI parity helper 및 unit test 추가
- [x] Task 3 — `dashboard-ai-chat.spec.ts` starter prompt 및 직접 질의 플로우에 parity assertion 연결
- [x] Task 4 — targeted test/lint 검증
- [x] Task 5 — 작업 결과 정리

## 완료 기준

- [x] `npx vitest run tests/unit/playwright/dashboard-ai-parity.test.ts` 통과
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run docs:lint:changed` 통과
- [x] `npm run docs:budget` 통과
- [x] `npm run docs:ai-consistency` 통과
- [x] `PLAYWRIGHT_SKIP_SERVER=1 PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app PLAYWRIGHT_GUEST_PIN=4231 PLAYWRIGHT_HEADLESS=true PLAYWRIGHT_HTML_REPORT=0 PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/dashboard-ai-chat.spec.ts --config playwright.config.ts` 통과
- [x] `npm run qa:record -- --input /tmp/qa-run-input-20260424-ai-parity-guard.json` → `QA-20260424-0344`
- [x] `npm run qa:record -- --input /tmp/qa-run-input-20260424-ai-parity-guard-final.json` → `QA-20260424-0345`
- [x] `npm run qa:evidence:audit` 통과
- [x] 변경 범위가 QA/test automation에 한정됨
