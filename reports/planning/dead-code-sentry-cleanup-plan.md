# Dead Code 정리 & Sentry 모니터링 활성화 계획

> Owner: project
> Status: Approved
> Doc type: How-to
> Last reviewed: 2026-05-07
> Canonical: reports/planning/dead-code-sentry-cleanup-plan.md
> Tags: cleanup,dead-code,sentry,monitoring

## 배경

AI 피드백 기능 제거 분석 과정에서 같은 패턴(구현됐지만 실질적으로 동작하지 않거나 읽히지 않는 기능)의 dead code를 추가로 발견. 동시에 **Sentry가 코드상으로는 완벽히 설정됐지만 production DSN이 없어서 에러 수집이 전혀 안 되고 있음** 확인.

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

## Part B: Sentry 모니터링 활성화

### 현재 상태 진단

| 항목 | 상태 |
|------|------|
| 코드 설정 (`instrumentation.ts`, `instrumentation-client.ts`) | ✅ 완벽히 구현됨 |
| `withSentryConfig` (`next.config.mjs`) | ✅ 적용됨 |
| `/api/sentry-tunnel` 라우트 | ✅ 구현됨 |
| **`NEXT_PUBLIC_SENTRY_DSN` (Vercel production)** | ❌ **미설정 → 수집 완전 비활성** |
| Sentry 프로젝트 (`org: om-4g`, `project: javascript-nextjs`) | 존재 확인 필요 |

**결론**: 코드는 완벽하나 DSN 환경변수 누락으로 production에서 에러가 단 하나도 Sentry로 전송되지 않고 있음.

---

### 현재 코드 설정 요약 (무료 티어 최적화 상태)

```
Client (instrumentation-client.ts):
  tracesSampleRate: 0.05       ← 트랜잭션 5%만 샘플링
  replaysSessionSampleRate: 0  ← Session Replay 비활성 (비용 큰 기능)
  replaysOnErrorSampleRate: 0  ← 에러 시 Replay도 비활성
  tunnel: '/api/sentry-tunnel' ← CSP 우회 터널 사용

Server (instrumentation.ts):
  tracesSampleRate: 0.01       ← 서버 트랜잭션 1%만 샘플링

Build (next.config.mjs):
  sourcemaps.disable: true     ← 소스맵 업로드 비활성 (저장소 용량 절약)
  automaticVercelMonitors: false ← Vercel Cron 모니터링 비활성
  disableLogger: true          ← Sentry logger 제거 (번들 크기 절약)
```

---

### B-1. 활성화 작업

**Step 1**: Sentry 대시보드에서 DSN 확인
- `https://sentry.io` → 프로젝트 `javascript-nextjs` (org: `om-4g`) → Settings → DSN 복사

**Step 2**: Vercel production 환경변수 추가
```bash
# NEXT_PUBLIC_SENTRY_DSN: 클라이언트·서버 공통 사용
echo "https://xxxxx@sentry.io/xxxxxx" | vercel env add NEXT_PUBLIC_SENTRY_DSN production --force
```

**Step 3**: 재배포 후 검증
```bash
# 의도적 에러를 유발하거나 Sentry test 이벤트 전송
# Sentry 대시보드에서 Issues 탭에 이벤트 수신 확인
curl https://openmanager-ai.vercel.app/api/health
```

---

### B-2. 확인 필요 사항 (작업 전 판단)

- [ ] **Sentry 무료 플랜 이벤트 한도**: 월 5,000 errors / 10,000 transactions. `tracesSampleRate 0.05`면 트랜잭션은 제한 없이 통과할 가능성 낮음. 실제 트래픽 규모 감안하여 충분한지 확인
- [ ] **`SENTRY_DSN` vs `NEXT_PUBLIC_SENTRY_DSN` 이중 설정**: 서버 전용(`SENTRY_DSN`)과 클라이언트 공개(`NEXT_PUBLIC_SENTRY_DSN`)를 같은 값으로 둘다 설정할지 하나만 설정할지 결정. 현재 코드는 `NEXT_PUBLIC_SENTRY_DSN` 하나로 서버·클라이언트 모두 커버 가능
- [ ] **소스맵 없이 에러 추적 가능성**: `sourcemaps.disable: true`이므로 에러 스택트레이스가 minified 코드 기준으로 나옴. 로컬 개발 도구로 쓰는 상황에서 이 수준이 충분한지 판단. 불충분하면 개발 빌드에서만 소스맵 업로드 허용
- [ ] **Sentry 프로젝트 실제 존재 여부**: `org: om-4g`, `project: javascript-nextjs` 가 Sentry 대시보드에 실제로 있는지 확인 (없으면 프로젝트 생성 필요)
- [ ] **tunnel route 필요성**: CSP 정책상 sentry.io 직접 호출이 차단되는지 확인. 불필요하면 tunnel 제거로 Vercel function 호출 절약

---

## 작업 순서

1. **B-2 확인 사항** 먼저 체크 (Sentry 대시보드 접속해서 프로젝트/DSN 확인)
2. **B-1** Sentry DSN 환경변수 등록 + 재배포 → 에러 수신 확인
3. **A-1~A-5** dead code 제거 (Codex 위임 가능)

## 완료 기준

- [ ] Sentry production에서 이벤트 수신 확인 (Issues 또는 Performance 탭)
- [ ] `/api/ai/ask` 분기 제거 후 AI 스트림 정상 동작
- [ ] `type-check`, `lint`, `test:quick`, `knip:ci` 전부 통과
- [ ] `useUnifiedAdminStore`, `useAISidebarStore` 미사용 액션 제거 후 타입 오류 없음
