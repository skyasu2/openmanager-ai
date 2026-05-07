# Dead Code 정리 & Sentry Cleanup 계획

> Owner: project
> Status: In Progress
> Doc type: How-to
> Last reviewed: 2026-05-07
> Canonical: reports/planning/dead-code-sentry-cleanup-plan.md
> Tags: cleanup,dead-code,sentry,monitoring

## 배경

AI 피드백 기능 제거 분석 과정에서 같은 패턴(구현됐지만 실질적으로 동작하지 않거나 읽히지 않는 기능)의 dead code를 추가로 발견했다.

Sentry는 production 에러 수집 활성화가 아니라 **프로젝트에서 완전 제거**하는 방향으로 확정했다. 이 문서는 Sentry cleanup 완료 evidence와 남은 dead code 제거 범위를 함께 추적한다.

## 세션 경계

- Sentry cleanup: 완료. 런타임 코드, dependency, env example, tunnel route 제거.
- 후속 세션: Part A dead code 제거만 남음.

---

## Part A: Dead Code 제거

### A-1. `/api/ai/ask` facade 및 분기 로직 제거

**현상**: `resolveHybridAIEndpoint()`가 `NEXT_PUBLIC_AI_ASK_FACADE_ENABLED=true`일 때만 `/api/ai/ask`를 사용. 이 환경변수는 Vercel production에 설정되지 않음 → **항상 `/api/ai/supervisor/stream/v2`로 고정**.

**제거 대상**:
- `src/app/api/ai/ask/route.ts` — facade 라우트 파일
- `src/hooks/ai/useHybridAIQuery.ts` — `resolveHybridAIEndpoint()` 함수 및 분기 제거 → `/api/ai/supervisor/stream/v2` 하드코딩
- `src/env.ts` / `src/types/environment.ts` — `NEXT_PUBLIC_AI_ASK_FACADE_ENABLED` 타입 제거

**확인 필요**:
- [ ] `src/data/architecture-diagrams/ai-assistant.ts` — 다이어그램 설명에 `/api/ai/ask` 언급 있음, 수정 필요

---

### A-2. `useUnifiedAdminStore.toggleAI()` 제거

**현상**: AI 토글 액션이 스토어에 정의됐지만 프로덕션 UI 어디서도 호출 없음. `aiAgent.isEnabled`는 읽히지만 항상 `true`로만 유지됨.

**제거 대상**:
- `src/stores/useUnifiedAdminStore.ts` — `toggleAI()` 액션 제거
- `aiAgent.isEnabled` 상태값이 항상 `true`면 조건 분기 단순화 검토

**확인 필요**:
- [ ] `DashboardHeader.tsx`, `FeatureCardsGrid.tsx`, `FeatureCardModal.tsx`, `OpenManagerLogo.tsx` — `aiAgent.isEnabled` 읽는 곳이 항상 `true`이면 조건 제거 가능한지 확인

---

### A-3. `useAISidebarStore` 미사용 액션 제거

**현상**:

| 액션 | 상태 |
|------|------|
| `resetRestoreBanner()` | 정의만 있고 프로덕션 코드에서 호출 없음 |
| `setSelectedContext()` | 테스트 코드에만 존재, 프로덕션 컴포넌트 호출 없음 |
| `setFunctionTab()` | 테스트 코드에만 존재 |

**제거 대상**:
- `src/stores/useAISidebarStore.ts` — 위 3개 액션 및 관련 상태
- 관련 테스트 mock 정리

---

### A-4. `/api/version` 라우트 검토

**현상**: 프론트엔드 어디서도 fetch 호출 없음. CI smoke test에서도 미사용 확인됨.

**확인 필요**:
- [ ] `.gitlab-ci.yml` smoke 스테이지에서 `/api/version` 호출 여부 확인
- [ ] 외부 도구(Postman, curl 스크립트 등)에서 사용 여부 확인
- 미사용 확인 시 → 제거. CI smoke에서 쓰인다면 유지.

---

### A-5. `/api/servers/[id]` 및 `/api/servers/[id]/processes` 라우트 검토

**현상**: 프론트엔드 fetch 호출 없음. OTel 데이터 구조 전환 이후 deprecated된 것으로 추정.

**확인 필요**:
- [ ] `src/app/api/servers/[id]/route.ts` 내부에서 다른 라우트로 위임하는지 확인
- [ ] E2E 테스트나 Playwright spec에서 호출 여부 확인
- 완전 dead 확인 시 → 제거

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
2. **A-1~A-5 dead code 제거** — 남은 Active Task.

## 완료 기준

- [x] Sentry cleanup 결과가 Part B에 evidence로 반영됨
- [x] production Sentry 수집 경로가 제거됐음이 문서와 코드에서 일치
- [x] Sentry 소스맵/tunnel 검토가 별도 TODO Backlog가 아니라 Part B 안에서 종결됨
- [ ] `/api/ai/ask` 분기 제거 후 AI 스트림 정상 동작
- [ ] `type-check`, `lint`, `test:quick`, `knip:ci` 전부 통과
- [ ] `useUnifiedAdminStore`, `useAISidebarStore` 미사용 액션 제거 후 타입 오류 없음
