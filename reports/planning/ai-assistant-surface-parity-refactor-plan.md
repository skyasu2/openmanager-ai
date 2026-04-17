> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-04-17
> Tags: ai-assistant,sidebar,fullscreen,analysis-mode,state-handoff,refactor

# AI Assistant Surface Parity Refactor Plan

- 상태: **In Progress** — Task 0~3·5 완료(`dc00e2487`). 잔여: Task 4(`AIWorkspace mode="sidebar"` 레거시 경로 제거)
- 작성일: 2026-04-17
- TODO.md 연결: Backlog > AI Assistant Surface Parity Refactor
- 목표: AI 사이드바와 AI 전체 페이지가 같은 채팅 상태와 같은 제어 가능성을 가지도록 surface wiring을 정리하고, 진입 경로별 상태 손실을 제거한다.

## 1. 배경

- OpenManager AI의 대화 엔진은 이미 `useAIChatCore`로 통합되어 있다.
  - [useAIChatCore.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/useAIChatCore.ts:223)
- 그러나 실제 사용자 경험은 `AISidebarV4`, `AIWorkspace`, `DashboardHeader`/`DashboardClient`가 각자 상태와 진입 정책을 다루며 갈라져 있다.
  - [AISidebarV4.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/AISidebarV4.tsx:50)
  - [AIWorkspace.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AIWorkspace.tsx:59)
  - [DashboardHeader.tsx](/mnt/d/dev/openmanager-ai/src/components/dashboard/DashboardHeader.tsx:86)
  - [DashboardClient.tsx](/mnt/d/dev/openmanager-ai/src/app/dashboard/DashboardClient.tsx:274)
- store는 이미 `analysisMode`, `pendingPrefillMessage`, `messages`, `sessionId`를 들고 있지만, 모든 entry surface가 이를 같은 방식으로 소비하지 않는다.
  - [useAISidebarStore.ts](/mnt/d/dev/openmanager-ai/src/stores/useAISidebarStore.ts:217)

## 2. 문제 정의

### 2.1 Hidden Global State

- `analysisMode`는 store와 transport를 통해 실제 AI 엔진에 전달된다.
  - [useAISidebarStore.ts](/mnt/d/dev/openmanager-ai/src/stores/useAISidebarStore.ts:230)
  - [useAIChatCore.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/useAIChatCore.ts:304)
- 하지만 fullscreen `AIWorkspace`는 현재 이 값을 표시하거나 변경하는 UI를 넘기지 않는다.
  - [AIWorkspace.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AIWorkspace.tsx:481)
- 결과적으로 사용자는 fullscreen에서 현재 분석 모드를 알 수 없고, sidebar에서 바꾼 모드가 숨은 상태로 계속 적용될 수 있다.

### 2.2 Draft / Prefill Handoff Loss

- 대시보드 alert prefill은 `openWithPrefill()`로 store에 적재되고 sidebar 열기로 연결된다.
  - [DashboardClient.tsx](/mnt/d/dev/openmanager-ai/src/app/dashboard/DashboardClient.tsx:318)
  - [useAISidebarStore.ts](/mnt/d/dev/openmanager-ai/src/stores/useAISidebarStore.ts:307)
- sidebar는 이를 열릴 때 소비하지만 fullscreen은 동일한 handoff 경로가 없다.
  - [AISidebarV4.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/AISidebarV4.tsx:194)
- maximize는 단순 `router.push('/dashboard/ai-assistant')`만 수행한다.
  - [AIAssistantIconPanel.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AIAssistantIconPanel.tsx:188)
- 결과적으로 입력 중 draft나 alert prefill이 surface 전환 시 유실될 수 있다.

### 2.3 Entry Controller Drift

- 헤더 토글은 인증 체크 후 store를 직접 토글한다.
  - [DashboardHeader.tsx](/mnt/d/dev/openmanager-ai/src/components/dashboard/DashboardHeader.tsx:86)
- 대시보드 페이지도 별도로 토글과 warmup 정책을 갖고 있다.
  - [DashboardClient.tsx](/mnt/d/dev/openmanager-ai/src/app/dashboard/DashboardClient.tsx:274)
- 권한, warmup, prefill 정책이 한 곳에 모여 있지 않아 이후 정책 변경 시 drift가 재발하기 쉽다.

### 2.4 Surface Wiring Duplication

- `AISidebarV4`와 `AIWorkspace`는 둘 다 `EnhancedAIChat`에 긴 prop 세트를 직접 연결한다.
  - [AISidebarV4.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/AISidebarV4.tsx:257)
  - [AIWorkspace.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AIWorkspace.tsx:478)
- `AIWorkspace mode="sidebar"` 분기까지 남아 있어 실제 sidebar 구현과 레거시 sidebar 구현이 동시에 존재한다.
  - [AIWorkspace.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AIWorkspace.tsx:156)

## 3. 목표

- sidebar와 fullscreen chat surface가 같은 제어 항목을 보여준다.
- `analysisMode`는 모든 chat surface에서 보이고 변경 가능하다.
- unsent text draft와 alert prefill은 sidebar <-> fullscreen 전환 시 보존된다.
- AI 열기/닫기/프리필/웜업 정책은 단일 entry controller에서 관리된다.
- `EnhancedAIChat` wiring은 surface별 중복 없이 공통 계층을 통해 공급된다.

## 4. 비목표

- Domain boundary 정책, disclaimer 문구, backend routing heuristic 자체를 다시 설계하지 않는다.
- Reporter/Analyst 내부 기능 로직은 리팩터링 대상에 포함하지 않는다.
- 첨부 파일 handoff까지 이번 단계에 강제하지 않는다. 우선 텍스트 draft와 prefill parity를 복구한다.
- fullscreen 우측 `SystemContextPanel` 정보 구조는 바꾸지 않는다.

## 5. 범위

### 포함

- sidebar/fullscreen chat surface parity
- analysis mode 가시성/제어 일치
- maximize/direct-entry/prefill handoff 정합성
- AI entry controller 정리
- 관련 단위/통합 테스트 보강

### 제외

- backend agent 로직 변경
- 새로운 AI 기능 추가
- visual redesign
- broad production QA 실행 자체

## 6. 설계 원칙

1. 코어 재작성보다 wiring 단일화를 우선한다.
2. entry state는 one-shot consume 가능한 구조여야 한다.
3. chat session/messages는 기존 `useAIChatCore` + store snapshot 흐름을 유지한다.
4. 직접 URL 진입(`/dashboard/ai-assistant`)도 정상 동작해야 하며 stale prefill이 반복 적용되면 안 된다.

## 7. 계약 (Contract)

> Status를 Approved로 유지하기 위한 구현 계약이다.

### 7.1 변경 대상 파일

- [useAISidebarStore.ts](/mnt/d/dev/openmanager-ai/src/stores/useAISidebarStore.ts)
- [AIWorkspace.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AIWorkspace.tsx)
- [AISidebarV4.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/AISidebarV4.tsx)
- [EnhancedAIChat.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/EnhancedAIChat.tsx)
- [ChatInputArea.tsx](/mnt/d/dev/openmanager-ai/src/components/ai-sidebar/ChatInputArea.tsx)
- [AIAssistantIconPanel.tsx](/mnt/d/dev/openmanager-ai/src/components/ai/AIAssistantIconPanel.tsx)
- [DashboardHeader.tsx](/mnt/d/dev/openmanager-ai/src/components/dashboard/DashboardHeader.tsx)
- [DashboardClient.tsx](/mnt/d/dev/openmanager-ai/src/app/dashboard/DashboardClient.tsx)
- 신규 후보:
  - `src/hooks/ai/useAIEntryController.ts`
  - `src/hooks/ai/useAIChatSurfaceProps.ts`
- 테스트:
  - `src/components/ai/AIWorkspace.test.tsx`
  - `src/components/ai-sidebar/AISidebarV4.test.tsx`
  - `src/stores/useAISidebarStore.test.ts`

### 7.2 상태 계약

| 상태 | SSOT | 생산자 | 소비자 | 비고 |
|------|------|--------|--------|------|
| `analysisMode` | Zustand store | `ChatInputArea` (sidebar/fullscreen 공통) | `useAIChatCore`, `ChatInputArea` | 전역 분석 모드 유지 |
| `pendingEntryState.draft` | Zustand store | alert prefill, maximize handoff | `AISidebarV4`, `AIWorkspace` | one-shot consume |
| `pendingEntryState.selectedFunction` | Zustand store | maximize/direct entry controller | `AISidebarV4`, `AIWorkspace` | 기본값 `chat` |
| `isOpen` | Zustand store | entry controller | dashboard/sidebar shell | sidebar 열림 상태만 담당 |
| `messages/sessionId` | `useAIChatCore` + snapshot sync | `useAIChatCore` | sidebar/fullscreen 공통 | 기존 흐름 유지 |

### 7.3 API / 훅 계약

| 함수/훅 | 입력 | 출력 | 에러/제약 |
|---------|------|------|-----------|
| `useAIEntryController()` | 없음 | `toggleSidebar`, `openWithPrefill`, `openFullscreen`, `closeSidebar` | router 사용, stale entry state 방지 |
| `openFullscreen(entry?: AIEntryState)` | `{ draft?: string; selectedFunction?: AIAssistantFunction; analysisMode?: AnalysisMode }` | route 이동 + pending entry state 저장 | `draft`는 텍스트만 지원 |
| `consumePendingEntryState()` | 없음 | `AIEntryState \| null` | 1회 소비 후 clear |
| `useAIChatSurfaceProps()` | chat core state + store state | `EnhancedAIChat` 공통 props | surface별 UI chrome는 제외 |

### 7.4 구현 제약

- `AIWorkspace mode="sidebar"`는 신규 로직 추가 대상이 아니다.
- 가능하면 제거 대상으로 격리하되, 즉시 제거가 어렵다면 deprecated path로 동결한다.
- `ChatInputArea` 내부 prop 이름은 유지하고, fullscreen이 동일 prop 세트를 받게 만든다.
- `pendingPrefillMessage` 단일 필드는 `pendingEntryState`로 확장하거나 동등한 구조로 치환한다.

## 8. 테스트 시나리오 (구현 전 확정)

- [ ] 시나리오 1: sidebar에서 입력 중인 텍스트가 있을 때 maximize하면 fullscreen composer에 동일 텍스트가 보인다.
- [ ] 시나리오 2: dashboard alert prefill로 열린 sidebar의 질문 초안이 fullscreen 전환 후에도 유지된다.
- [x] 시나리오 3: fullscreen chat에서 현재 `analysisMode`가 표시되고, 변경 시 store와 다음 query payload에 반영된다.
- [x] 시나리오 4: sidebar와 fullscreen 모두 동일한 `analysisMode`, `webSearch`, `rag` prop 세트를 `EnhancedAIChat`에 전달한다.
- [x] 시나리오 5: direct URL 진입 시 stale pending entry state가 반복 적용되지 않는다.
- [x] 시나리오 6: Reporter/Analyst 탭 상태는 기존처럼 surface 내부에서 유지되며 chat parity 수정 때문에 깨지지 않는다.

## 9. Task 목록

> 구현 착수 전 Status가 `Approved`인지 확인한다.

- [x] Task 0 — failing test 커밋 (`b53035c90`)
  - 완료 기준: 시나리오 1~4 중 최소 핵심 회귀 테스트가 먼저 red로 추가됨
- [x] Task 1 — entry state 모델 도입 (`dc00e2487`)
  - 완료 기준: `pendingEntryState` 구조 store 추가, `queuePendingEntryState`/`consumePendingEntryState` API 생성
- [x] Task 2 — entry controller 단일화 (`dc00e2487`)
  - 완료 기준: `useAIEntryController.ts` 신규 생성, `DashboardClient`/`AIAssistantIconPanel` 연결
- [x] Task 3 — fullscreen parity 복구 (`dc00e2487`)
  - 완료 기준: `AIWorkspace`에 `analysisMode`/`onSelectAnalysisMode` 연결, fullscreen entry state 소비
- [ ] Task 4 — legacy sidebar path 정리
  - 완료 기준: `AIWorkspace mode="sidebar"` 제거 또는 deprecated path로 고정, 신규 기능 연결 금지
  - 현재 상태: `mode="sidebar"` 분기가 deprecated 주석으로 격리됨 — 제거는 미착수
- [x] Task 5 — verification
  - 완료 기준: 관련 unit test 50개 통과 (3 파일), type-check 통과

## 10. 검증 계획

- `npx vitest run src/components/ai/AIWorkspace.test.tsx src/components/ai-sidebar/AISidebarV4.test.tsx src/stores/useAISidebarStore.test.ts`
- `npm run type-check`
- `npm run test:quick`
- 필요 시 UI smoke:
  - dashboard header toggle
  - alert prefill -> sidebar
  - sidebar maximize -> fullscreen
  - fullscreen analysis mode toggle

## 11. 완료 기준

- [x] sidebar/fullscreen 간 `analysisMode` UX가 일치한다.
- [x] unsent text draft와 alert prefill이 surface 전환에서 유실되지 않는다.
- [x] entry controller가 단일 경로로 정리된다.
- [x] parity 회귀 테스트가 추가된다. (50 tests pass)
- [x] `npm run type-check` 통과
- [ ] `AIWorkspace mode="sidebar"` 레거시 경로 제거 (Task 4, 잔여)
- [ ] 관련 테스트 통과

## 12. 리스크와 대응

- 리스크: persist store에 stale entry state가 남아 direct URL 진입에 섞일 수 있음
  - 대응: consume 후 즉시 clear, source timestamp 또는 nonce 사용 검토
- 리스크: draft를 store에 과하게 동기화하면 렌더 비용 증가
  - 대응: maximize/prefill 시점 handoff 중심으로 시작하고, 지속 draft sync는 최소화
- 리스크: sidebar/fullscreen 공통화 과정에서 Reporter/Analyst 탭 보존이 깨질 수 있음
  - 대응: existing fullscreen state preservation test 유지 + 추가 보강
