# Dead Code 정리 & Sentry Cleanup 계획

> Owner: project
> Status: Completed
> Doc type: How-to
> Last reviewed: 2026-05-07
> Canonical: reports/planning/dead-code-sentry-cleanup-plan.md
> Tags: cleanup,dead-code,sentry,monitoring

## 배경

AI 피드백 기능 제거 분석 과정에서 같은 패턴(구현됐지만 실질적으로 동작하지 않거나 읽히지 않는 기능)의 dead code를 추가로 발견했다.

Sentry는 production 에러 수집 활성화가 아니라 **프로젝트에서 완전 제거**하는 방향으로 확정했다. 이 문서는 Sentry cleanup 완료 evidence와 남은 dead code 제거 범위를 함께 추적한다.

## 세션 경계

- Sentry cleanup: 완료. 런타임 코드, dependency, env example, tunnel route 제거.
- 2026-05-07 follow-up: A-4 `/api/version`은 release/deploy verification surface로 유지 판정.
- 2026-05-07 follow-up: A-1 `/api/ai/ask` facade 및 opt-in 분기 제거 완료.
- 2026-05-07 follow-up: A-2/A-3 unused store actions 제거 완료.
- 2026-05-07 follow-up: A-6 unused shadcn/ui 컴포넌트와 전용 stories/tests 제거 완료.
- 2026-05-07 follow-up: A-7 toast 시스템을 `react-hot-toast`로 단일화하고 shadcn toast 파일/의존성 제거 완료.
- 2026-05-07 follow-up: A-5 `/api/servers/[id]/processes` 중복 mock route 제거 완료. 대체 경로는 `/api/servers-unified?action=processes` contract test로 고정.
- Part A/B 모두 완료. 후속 active item 없음.

---

## Part A: Dead Code 제거

### A-1. `/api/ai/ask` facade 및 분기 로직 제거

**현상**: `resolveHybridAIEndpoint()`가 `NEXT_PUBLIC_AI_ASK_FACADE_ENABLED=true`일 때만 `/api/ai/ask`를 사용. 이 환경변수는 Vercel production에 설정되지 않음 → **항상 `/api/ai/supervisor/stream/v2`로 고정**.

**상태**: 완료. `/api/ai/ask` 라우트와 전용 route test를 삭제했고, `useHybridAIQuery()` 기본 endpoint는 `/api/ai/supervisor/stream/v2`로 고정했다. legacy env flag가 남아 있어도 endpoint가 바뀌지 않는 contract test를 추가했다.

**제거 대상**:
- [x] `src/app/api/ai/ask/route.ts` — facade 라우트 파일
- [x] `src/app/api/ai/ask/route.test.ts` — facade 전용 route test
- [x] `src/hooks/ai/useHybridAIQuery.ts` — `resolveHybridAIEndpoint()` 함수 및 분기 제거 → `/api/ai/supervisor/stream/v2` 고정
- [x] `src/env.ts` / `src/types/environment.ts` — 현재 타입 선언 없음 확인

**확인 필요**:
- [x] `src/data/architecture-diagrams/ai-assistant.ts` — 다이어그램 설명에서 `/api/ai/ask` 언급 제거
- [x] API catalog와 현재 아키텍처 문서에서 `/api/ai/ask` 현재 경로 언급 제거

---

### A-2. `useUnifiedAdminStore.toggleAI()` 제거

**현상**: AI 토글 액션이 스토어에 정의됐지만 프로덕션 UI 어디서도 호출 없음. `aiAgent.isEnabled`는 읽히지만 항상 `true`로만 유지됨.

**상태**: 완료. `toggleAI()` action과 타입 계약을 제거했다. `aiAgent.isEnabled`는 `DashboardHeader`, `FeatureCardsGrid`, `FeatureCardModal`, `OpenManagerLogo` 및 테스트/스토리에서 disabled visual state를 검증하므로 이번 cleanup에서는 유지한다.

**제거 대상**:
- [x] `src/stores/useUnifiedAdminStore.ts` — `toggleAI()` 액션 제거
- [x] `aiAgent.isEnabled` 조건 분기 단순화 검토 — UI disabled variant 유지 필요로 보류

**확인 필요**:
- [x] `DashboardHeader.tsx`, `FeatureCardsGrid.tsx`, `FeatureCardModal.tsx`, `OpenManagerLogo.tsx` — `aiAgent.isEnabled` 사용 확인

---

### A-3. `useAISidebarStore` 미사용 액션 제거

**현상**:

| 액션 | 상태 |
|------|------|
| `resetRestoreBanner()` | 정의만 있고 프로덕션 코드에서 호출 없음 |
| `setSelectedContext()` | 테스트 코드에만 존재, 프로덕션 컴포넌트 호출 없음 |
| `setFunctionTab()` | 테스트 코드에만 존재 |

**상태**: 완료. 위 action과 관련 state, unused selector helper hook, store test만 남아 있던 expectations를 제거했다. `restoreBannerDismissed`와 `dismissRestoreBanner()`는 `EnhancedAIChat`에서 사용 중이라 유지한다.

**제거 대상**:
- [x] `src/stores/useAISidebarStore.ts` — 위 3개 action 및 `functionTab`/`selectedContext` state 제거
- [x] `useAISidebarUI`, `useAIContext` unused helper hook 제거
- [x] 관련 store test 정리

---

### A-4. `/api/version` 라우트 검토 — 유지 판정 완료

**판정**: 제거하지 않는다. 프론트엔드 UI fetch는 없지만 release propagation, deployment drift, local readiness 검증에서 쓰이는 운영 surface다.

**근거**:
- `scripts/test/vercel-post-deploy-smoke.mjs` — production post-deploy smoke가 `/api/version` version/commit을 검증
- `scripts/qa/check-vercel-deployment-drift.mjs` — expected version/commit/releaseTag drift 검증의 기준 route
- `scripts/release/check-release-consistency.js` — release consistency guard에서 version route 구현을 읽음
- `tests/api/version-route.test.ts`, `tests/unit/qa/vercel-post-deploy-smoke.test.ts`, `tests/unit/qa/vercel-deployment-drift.test.ts` — route/test script 계약 존재
- 최신 production QA `QA-20260507-0420`도 `/api/version`을 covered surface로 사용

---

### A-5. `/api/servers/[id]` 및 `/api/servers/[id]/processes` 라우트 검토 — 분할 판정

**판정**:
- `/api/servers/[id]`: 제거하지 않는다. UI 직접 fetch가 없어도 API contract, integration test, schema 문서가 살아 있는 server detail surface다.
- `/api/servers/[id]/processes`: 제거 완료. 코드 검색 기준 직접 consumer/test가 없고, random memory-based mock 데이터를 반환하는 중복 route였다. 지원 경로는 `/api/servers-unified?action=processes`로 통일했다.

**근거**:
- `tests/api/servers-detail-route.test.ts`, `tests/api/server-history-route.test.ts`, `tests/integration/servers-detail-route-integration.test.ts` — `/api/servers/[id]` 계약 검증 존재
- `src/schemas/server-schemas/server-details.schema.ts` — response schema 유지
- `src/app/api/servers-unified/route.ts` — `processes` action 유지
- `tests/api/servers-unified-route.test.ts` — GET/POST `action=processes` 대체 계약 추가
- `docs/reference/api/endpoints.md` — route 제거 후 29개 endpoint로 재생성

**확인 필요**:
- [x] `/api/servers/[id]/processes` 직접 호출 테스트 또는 production 로그 사용 여부 확인 — repo 기준 직접 consumer/test 없음
- [x] `servers-unified?action=processes`로 완전히 대체 가능하면 `/processes` route 제거 plan을 별도 소규모 cleanup으로 진행 — 기존 plan 안에서 삭제 완료

---

### A-6. shadcn/ui 미사용 컴포넌트 11개 삭제

**현상**: `src/components/ui/`에 41개 파일이 있지만 production 코드에서 실제 import 되는 것은 6개뿐. 나머지 11개는 stories·test 파일만 존재.

**상태**: 완료. 대상 컴포넌트와 전용 stories/tests를 삭제했고, `card.stories.tsx`/`dialog.stories.tsx`의 story-only `Input`/`Label` 참조는 native `<input>`/`<label>`로 교체했다. 삭제된 컴포넌트 전용 Radix direct dependency는 제거했고, `@radix-ui/react-tooltip`은 ReactFlow diagram에서 직접 사용 중이라 유지했다.

**사용 중인 컴포넌트 (유지)**:
`button`, `dialog`, `skeleton`, `card`, `ImagePreviewModal`, `BasicTyping`, `AutoResizeTextarea`

> A-6 당시에는 `toast`/`toaster`가 유지 대상이었지만, A-7에서 `react-hot-toast`로 통합해 제거했다.

**제거 대상 (import 0개)**:
- [x] `src/components/ui/alert.tsx` + `alert.stories.tsx`
- [x] `src/components/ui/badge.tsx` + `badge.stories.tsx`
- [x] `src/components/ui/input.tsx` + `input.stories.tsx` + `input.test.tsx`
- [x] `src/components/ui/label.tsx`
- [x] `src/components/ui/pagination.tsx` + `pagination.stories.tsx`
- [x] `src/components/ui/popover.tsx` + `popover.stories.tsx`
- [x] `src/components/ui/progress.tsx` + `progress.stories.tsx`
- [x] `src/components/ui/select.tsx` + `select.stories.tsx`
- [x] `src/components/ui/switch.tsx` + `switch.stories.tsx`
- [x] `src/components/ui/tabs.tsx` + `tabs.stories.tsx`
- [x] `src/components/ui/tooltip.tsx` + `tooltip.stories.tsx`

**확인 필요**:
- [x] `knip:ci`로 위 파일들이 실제 unused export인지 교차 확인 후 삭제

---

### A-7. Toast 중복 해소 — `react-hot-toast`로 통일

**현상**: 두 개의 toast 시스템이 공존.

| 시스템 | 사용처 |
|--------|--------|
| `react-hot-toast` | `src/components/ai-sidebar/AIDebugPanel.tsx` |
| shadcn `useToast` (hooks/use-toast) | `src/app/dashboard/DashboardClientRuntime.tsx`, `src/services/notifications/BrowserNotificationService.ts`, Storybook/test mocks |

**상태**: 완료. 루트 `Toaster`는 `react-hot-toast`로 교체했고, dashboard 권한 차단 toast와 browser notification toast 모두 같은 패키지를 사용한다. Storybook preview/story mock과 관련 unit test mock도 `react-hot-toast` 기준으로 정리했다.

**제거 대상**:
- [x] `src/components/ui/toast.tsx` — shadcn toast 컴포넌트
- [x] `src/components/ui/toaster.tsx` — shadcn Toaster 렌더러
- [x] `src/hooks/use-toast.ts` — shadcn useToast 훅
- [x] `src/hooks/use-toast.test.ts` — shadcn hook 전용 테스트
- [x] `src/app/RootClientRuntime.tsx` — shadcn Toaster → `react-hot-toast` Toaster
- [x] `src/app/dashboard/DashboardClientRuntime.tsx` — `useToast()` → `react-hot-toast`
- [x] `src/services/notifications/BrowserNotificationService.ts` — `useToast` helper → `react-hot-toast`
- [x] `.storybook/preview.ts`, `DashboardClient.stories.tsx`, 관련 tests — stale `use-toast` mock 제거

**유지**:
- `react-hot-toast` 패키지 (이미 설치됨, AIDebugPanel 사용 중)
- `@radix-ui/react-toast` 패키지 제거 완료

**확인 필요**:
- [x] `DashboardClientRuntime.tsx`의 `useToast()` 호출 패턴 확인 후 `react-hot-toast` 동등 호출로 교체
- [x] `Toaster` 컴포넌트가 레이아웃에 마운트된 곳(`src/app/RootClientRuntime.tsx`) 확인 → shadcn Toaster 제거, `react-hot-toast`의 `<Toaster />` 마운트로 교체
- [x] `rg`로 shadcn toast/use-toast 잔여 참조 0건 확인

---

## Part B: Sentry cleanup — 완전 제거

> **전략 변경**: 로컬 분석 opt-in도 효용 대비 복잡도가 높다고 판단해 Sentry를 프로젝트 실행 경로에서 완전히 제거한다.

### 정리 대상

| 항목 | 상태 |
|------|------|
| `@sentry/nextjs` dependency | 제거 |
| `instrumentation-client.ts` | 제거 |
| `instrumentation.ts` Sentry init / `onRequestError` | 제거 |
| `next.config.mjs` `withSentryConfig` / tunnel 설정 | 제거 |
| `/api/sentry-tunnel` route + test | 제거 |
| `src/lib/observability/local-sentry-*` helpers | 제거 |
| error boundary / AI supervisor capture 호출 | 제거 |
| `.env.example` Sentry 변수 | 제거 |

### Production 에러 수집 정책

현재 코드는 Vercel production에서 Sentry를 사용하지 않는다.

에러 모니터링이 필요할 경우 아래 대안을 사용한다:

- **Vercel 기본 로깅**: 런타임 에러는 Vercel Dashboard → Functions 탭에서 확인 가능
- **Pino 로거**: `src/lib/logging/` — 서버 로그는 Vercel log drain으로 수집 가능

---

## 작업 순서

1. **Part B Sentry cleanup** — 완료.
2. **A-4 `/api/version` 유지 판정** — 완료.
3. **A-5 `/api/servers/[id]` 유지 판정 및 `/processes` 제거** — 완료.
4. **A-1 `/api/ai/ask` facade 제거** — 완료.
5. **A-2/A-3 store unused action 제거** — 완료.
6. **A-6 unused shadcn/ui 컴포넌트 제거** — 완료.
7. **A-7 toast 시스템 단일화** — 완료.

## 완료 기준

- [x] Sentry cleanup 결과가 Part B에 evidence로 반영됨
- [x] production Sentry 수집 경로가 제거됐음이 문서와 코드에서 일치
- [x] Sentry 소스맵/tunnel 검토가 별도 TODO Backlog가 아니라 Part B 안에서 종결됨
- [x] `/api/version` route는 release/deploy verification surface라 유지 판정
- [x] `/api/servers/[id]` route는 API contract surface라 유지 판정
- [x] `/api/servers/[id]/processes` route는 직접 사용/대체 가능성 확인 후 유지 또는 삭제 판정
- [x] `/api/ai/ask` 분기 제거 후 AI 스트림 기본 endpoint 계약 유지
- [x] `useUnifiedAdminStore`, `useAISidebarStore` 미사용 액션 제거 후 store test 통과
- [x] shadcn/ui 미사용 컴포넌트 11개 삭제 후 `knip:ci` 잔재 없음
- [x] toast 시스템 `react-hot-toast` 단일화, shadcn toast 관련 파일 제거
- [x] `type-check`, `lint`, `test:quick`, `knip:ci` 전부 통과
