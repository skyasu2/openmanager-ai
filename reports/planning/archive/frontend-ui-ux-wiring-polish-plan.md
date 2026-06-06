> Owner: project
> Status: Completed
> Doc type: planning
> Last reviewed: 2026-06-05

# Frontend UI/UX Wiring Polish Plan

- 상태: Completed
- 작성일: 2026-06-05
- 완료일: 2026-06-05
- TODO.md 연결: 완료됨

## 목표

코드상 UI/UX 정적 분석에서 확인된 "표시 의도와 실제 클릭/상태 동작의 불일치"를 우선순위대로 개선한다. 새 기능 추가가 아니라 이미 구현된 프론트엔드 표면의 실제 동작, 접근성, 사용자 기대치를 정렬하는 작업이다.

## 범위

- 포함:
  - AI 채팅 입력 중 대기열 UX 불일치 수정
  - 브라우저 기본 `alert()` / `confirm()` 제거 또는 커스텀 UI로 대체
  - 닫힌 AI 사이드바의 포커스/보조기술 접근 차단 보강
  - 랜딩 예시 질문과 부팅 화면 문구의 상호작용 기대치 정리
  - 관련 단위 테스트/스모크 검증 갱신
- 제외:
  - Vercel/Cloud Run 배포
  - Playwright MCP 실환경 QA
  - AI/API 응답 계약 변경
  - 신규 대시보드 기능 추가

## 우선순위

| Priority | 항목 | 문제 | 완료 기준 |
|----------|------|------|-----------|
| P1 | AI 대기열 UX | core는 생성 중 추가 질문 queue를 지원하지만 입력 훅과 전송 버튼이 생성 중 전송을 막음 | 생성 중에도 후속 질문 전송 버튼/Enter가 queue 경로로 진입하고 UI 라벨이 `대기열에 추가`로 정렬 |
| P2 | 원시 confirm/alert 제거 | 시스템 종료/로그아웃/오류 처리에 브라우저 기본 UI가 남음 | 주요 프로필/랜딩 시스템 종료 확인이 커스텀 Dialog 또는 toast로 대체 |
| P3 | 닫힌 AI 사이드바 접근성 | offscreen slide-out + `aria-hidden`만으로 focusable child 차단이 부족 | 닫힌 상태에 `inert`/pointer 차단 적용, 테스트로 확인 |
| P4 | 랜딩 예시 질문 | 예시 카드가 클릭 가능한 프롬프트처럼 보일 수 있음 | 표시 전용임을 시각/접근성 문구로 명확화 |
| P5 | 부팅 화면 문구 | 타이머 기반 전환을 실제 연결 검증처럼 읽을 수 있음 | "연결 완료"보다 "준비/웜업" 중심 문구로 정리 |

## 계약 (Contract)

### 변경 대상 파일

- `src/components/ai-sidebar/useChatActions.ts`
- `src/components/ai-sidebar/ChatInputArea.tsx`
- `src/components/ai-sidebar/ChatInputArea.test.tsx`
- `src/components/ai-sidebar/useChatActions.test.tsx`
- `src/components/ai-sidebar/AISidebarV4.tsx`
- `src/components/ai-sidebar/AISidebarV4.test.tsx`
- `src/components/shared/UnifiedProfileHeader.tsx`
- `src/components/shared/UnifiedProfileHeader.test.tsx`
- `src/components/unified-profile/hooks/useProfileAuth.ts`
- `src/app/main/components/DashboardSection.tsx`
- `src/app/main/components/DashboardSection.test.tsx`
- `src/app/main/components/SystemStartSection.tsx`
- `src/app/system-boot/SystemBootClient.tsx`

### 입출력 계약

| 함수/API | 입력 | 출력/상태 | 에러/예외 |
|----------|------|-----------|-----------|
| `useChatActions().handleSendWithAttachments` | 현재 입력/첨부, `isGenerating`, `isLimitReached` | session limit이 아니면 `handleSendInput()` 호출. 생성 중이면 상위 `useAIChatCore`가 queue로 처리 | session limit이면 전송 안 함 |
| `ChatInputArea` submit button | `isGenerating`, `inputValue`, `attachments` | 생성 중 입력이 있으면 버튼 활성 + `대기열에 추가` label | 빈 입력/첨부 없음 또는 session limit이면 disabled |
| `UnifiedProfileHeader` confirm dialog | `system-stop` 또는 `logout` pending action | 사용자가 확인하면 해당 async action 실행 | remote 실패는 toast error로 표시 |
| `DashboardSection` stop dialog | `onStopSystem` 존재 | 확인 버튼 클릭 시 `onStopSystem()` | 취소 시 아무 동작 없음 |
| `AISidebarV4` closed state | `isOpen=false` | `aria-hidden=true`, `inert`, `pointer-events-none` | 권한 없음이면 기존대로 `null` |

### 테스트 시나리오

- [x] 생성 중 입력이 있을 때 전송 버튼은 disabled가 아니고 `대기열에 추가` 라벨을 가진다.
- [x] 생성 중 form submit은 `onSendWithAttachments`를 호출한다.
- [x] `useChatActions`는 생성 중에도 session limit이 아니면 `handleSendInput`을 호출한다.
- [x] `DashboardSection`은 커스텀 Dialog 확인 전에는 `onStopSystem`을 호출하지 않는다.
- [x] `UnifiedProfileHeader` 시스템 종료는 Dialog 확인 후 remote stop/local stop을 호출한다.
- [x] `UnifiedProfileHeader` 로그아웃은 Dialog 확인 후 로그아웃 핸들러를 호출한다.
- [x] `AISidebarV4` 닫힌 상태는 `aria-hidden`, `inert`, `pointer-events-none`를 가진다.

## Task 목록

- [x] Task 1 — P1 AI 대기열 UX 불일치 수정 및 테스트 갱신
- [x] Task 2 — P2 시스템 종료/로그아웃 확인 UI를 커스텀 Dialog/toast로 정리
- [x] Task 3 — P3 닫힌 AI 사이드바 접근성 보강
- [x] Task 4 — P4/P5 랜딩 예시/부팅 문구 정리
- [x] Task 5 — `test:quick`, `type-check`, `lint` 기반 검증

## 검증 계획

- 우선 targeted test:
  - `npx vitest run --config config/testing/vitest.config.dom.ts src/components/ai-sidebar/ChatInputArea.test.tsx src/components/ai-sidebar/useChatActions.test.tsx src/components/ai-sidebar/AISidebarV4.test.tsx src/app/main/components/DashboardSection.test.tsx src/app/main/components/SystemStartSection.test.tsx src/components/shared/UnifiedProfileHeader.test.tsx` — 통과
- 최종 smoke:
  - `npm run test:quick` — 통과
  - `npm run type-check` — 통과
  - `npm run lint` — 통과
- AI/API 계약 변경 없음: `test:contract`는 기본적으로 생략한다.

## 완료 기준

- [x] 계획서 Task 목록 완료
- [x] 관련 targeted test 통과
- [x] Root app smoke 검증 통과 또는 실패 원인/후속 조치 명시
- [x] 브라우저 기본 `alert()` / `confirm()`이 주요 사용자 경로에서 제거됨
- [x] 구현 후 final 답변에 남은 리스크와 Playwright MCP 후속 QA 필요 여부 보고
