# Frontend UI 개선 계획서

> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: frontend,ui,bug-fix,modal,landing,accessibility

---

## 배경 및 분석 범위

2026-05-15 프론트엔드 UI 전반을 코드 수준에서 분석한 결과, **즉시 수정이 필요한 버그 2건**, **구조 개선 2건**, **낮은 우선순위 정비 2건**을 확인했다. 모두 코드 변경만으로 처리되며 외부 인프라 비용 변동은 없다.

---

## 사전 검증 결과 요약

### ✅ 수정 대상으로 확인된 항목

| # | 항목 | 파일 | 근거 | 우선순위 |
|---|------|------|------|---------|
| P1-1 | `BootProgressBar` 포인터 overflow | `system-boot/components/BootProgressBar.tsx` | `left: '${progress}%'`는 100%일 때 포인터 왼쪽 기준점이 바 끝에 위치 → 포인터가 바 오른쪽으로 삐져나옴 | P1 |
| P1-2 | `AILoginRequiredModal` Github 아이콘 불일치 | `src/components/dashboard/AILoginRequiredModal.tsx` | CTA 버튼에 `<Github>` 아이콘만 사용하나 `AUTH_PROVIDER_COPY.listInline = "GitHub, Google, 이메일"` 3개 제공자 지원 | P1 |
| P2-1 | `FeatureCardModal` try-catch 무의미 | `src/components/shared/FeatureCardModal.tsx` | `mainContent` JSX가 `renderModalSafely()` 호출 전 이미 평가됨 → catch 블록이 렌더 에러를 포착할 수 없음. `DiagramErrorBoundary`가 이미 존재함 | P2 |
| P2-2 | `SystemBootClient` wave-particles 인라인 CSS 고립 | `src/app/system-boot/SystemBootClient.tsx` | `<style jsx>`로 `.wave-particles` + `wave-float` 애니메이션이 인라인 정의됨. `system-boot/page.tsx`가 `landing-effects.css`를 import하지 않아 필요하나, 유지보수성 저하 | P2 |
| P3-1 | `TopologyModal` 닫기 버튼 위치 | `src/components/dashboard/TopologyModal.tsx` | 닫기 버튼이 wrapper div에 `absolute right-6 top-6`으로 배치 → `TopologyView` 외부에 위치하여 필터/뷰 컨텍스트와 단절 | P3 |
| P3-2 | `LandingPageRuntime` footer 하드코딩 기술 스택 | `src/app/LandingPageRuntime.tsx` | `"Next.js 16 + React 19"`, `"Quad-Provider AI"` 문자열이 인라인. 2026-05-16 provider mesh 반영 후에는 `Provider Mesh AI`로 교체 필요 | P3 |

### ❌ 분석 후 수정 불필요로 판정된 항목

| 항목 | 판정 근거 |
|------|----------|
| 모달 테마 불일치 (dark/light) | `GuestRestrictionModal`은 랜딩 페이지(dark context), `AILoginRequiredModal`은 대시보드(light context) — 의도적 분리로 통합 불필요 |
| `FeatureCardModal` → Radix Dialog 마이그레이션 | 커스텀 focus trap(~60줄), `createPortal`, 외부 클릭 닫기 로직이 모두 정상 동작. 재작성 리스크 > 이득 |
| `SystemBootClient` `wave-float` vs `wave-drift` 애니메이션 통일 | 부트 화면(활발한 20s rotate)과 랜딩(잔잔한 40s translate)이 의도적으로 다름. 통일 금지 |
| `DiagramZoomToolbar` ReactFlow provider 위치 | `<ReactFlow>` 내부에 위치함이 코드 확인으로 안전 검증됨 |
| `SmoothLoadingSpinner` 중복 아이콘 | 시각적 의도 (상단 스피너 + 하단 기기 아이콘 그리드) — 기능 중복 아님 |

---

## 무료 티어 영향 분석

모든 작업은 **UI/코드 변경만**이며 인프라 변경 없음.

| 플랫폼 | 이번 작업 영향 | 판정 |
|--------|------------|------|
| Vercel Pro | 변경 없음 (Standard build) | ✅ 영향 없음 |
| Cloud Run | 변경 없음 | ✅ 영향 없음 |
| Upstash Redis | 변경 없음 | ✅ 영향 없음 |
| Supabase | 변경 없음 | ✅ 영향 없음 |

---

## SDD 게이트 판정

P1-1, P1-2, P2-1, P2-2는 모두 **단일 버그 수정 또는 소규모 리팩터링**에 해당하므로 `test(spec):` 선행 커밋 없이 `fix/refactor + test 동시 커밋` 허용.

P3-1, P3-2는 레이아웃 및 문자열 정비로 테스트 작성 대상 없음.

> 승인 상태: 2026-05-16 계획서 재검토 기준으로 범위/검증/제외 항목이 충분히 구체적이므로 구현 착수 가능. 단, P2-2는 시각 확인이 필요하므로 코드 게이트 통과 후 local UI 확인을 별도로 기록한다.

---

## P1-1: BootProgressBar 포인터 overflow 수정

### 현상

```tsx
// src/app/system-boot/components/BootProgressBar.tsx
<div
  style={{ left: `${progress}%` }}
  className="absolute top-0 h-full w-1.5 ..."
/>
```

`progress = 100`일 때 포인터의 **왼쪽 기준점**이 바 끝(100%)에 오므로 1.5px 너비의 포인터 전체가 바 오른쪽으로 삐져나온다.

### 수정

```tsx
style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
```

### 작업 범위

- [ ] **P1-1**: `BootProgressBar.tsx` 포인터 `style`에 `transform: 'translateX(-50%)'` 추가

**영향 파일:**
- `src/app/system-boot/components/BootProgressBar.tsx`

---

## P1-2: AILoginRequiredModal Github 아이콘 교체

### 현상

```tsx
// src/components/dashboard/AILoginRequiredModal.tsx
<Github className="mr-2 h-4 w-4" />
로그인하고 AI 사용하기
```

`AUTH_PROVIDER_COPY.listInline = "GitHub, Google, 이메일"`로 3개 제공자를 지원하는데 GitHub 단독 아이콘만 표시되어 UI가 오해를 준다.

### 수정

```tsx
import { LogIn } from 'lucide-react';
<LogIn className="mr-2 h-4 w-4" />
```

### 작업 범위

- [ ] **P1-2-a**: `Github` import → `LogIn` import 교체
- [ ] **P1-2-b**: JSX `<Github>` → `<LogIn>` 교체

**영향 파일:**
- `src/components/dashboard/AILoginRequiredModal.tsx`

---

## P2-1: FeatureCardModal DiagramErrorBoundary 적용

### 현상

```tsx
// src/components/shared/FeatureCardModal.tsx (비기능 패턴)
const mainContent = ( // ← JSX 이미 여기서 평가됨
  <div>...</div>
);
const renderModalSafely = () => {
  try {
    if (!cardData.id && isVisible) { return errorUI; }
    return mainContent; // mainContent가 이미 평가됐으므로 렌더 에러 포착 불가
  } catch (error) {
    // ← React 렌더 에러는 여기 도달 안 함
  }
};
```

`DiagramErrorBoundary`는 `src/components/shared/react-flow-diagram/components/DiagramErrorBoundary.tsx`에 이미 존재하며 `ReactFlowDiagram` 내부에서 사용 중이다.

### 수정 방향

`renderModalSafely` wrapper를 제거하고 `ReactFlowDiagram`을 `DiagramErrorBoundary`로 직접 감싼다.

```tsx
// 수정 전
const renderModalSafely = () => { try { ... return mainContent; } catch {} };
return <div>{renderModalSafely()}</div>;

// 수정 후
return (
  <div>
    ...
    <DiagramErrorBoundary>
      <ReactFlowDiagram ... />
    </DiagramErrorBoundary>
    ...
  </div>
);
```

### 작업 범위

- [ ] **P2-1-a**: `DiagramErrorBoundary` import 추가
- [ ] **P2-1-b**: `renderModalSafely` 함수 제거, `mainContent` 변수 제거
- [ ] **P2-1-c**: `ReactFlowDiagram`을 `<DiagramErrorBoundary>`로 직접 감싸기
- [ ] **P2-1-d**: `FeatureCardModal`이 다이어그램 모드일 때 에러 표시 확인

**영향 파일:**
- `src/components/shared/FeatureCardModal.tsx`

---

## P2-2: SystemBootClient wave-particles CSS 추출

### 현상

`SystemBootClient.tsx`의 `<style jsx>` 블록에 `.wave-particles` + `@keyframes wave-float`(20s, `rotate`) 애니메이션이 인라인 정의되어 있다. `system-boot/page.tsx`는 `landing-effects.css`를 import하지 않으므로 이 인라인 정의가 현재 부트 화면에 wave 효과를 제공하는 **유일한 경로**다.

`global-effects.css`(`src/app/layout.tsx` global import)에는 `.wave-particles`의 opacity/filter override만 있고 full definition이 없다.

### 수정 방향 선택

| 선택지 | 장점 | 단점 |
|--------|------|------|
| **(A) `global-effects.css`에 wave 정의 이동** | 모든 페이지에서 참조 가능, 인라인 제거 | `wave-float` keyframe이 global로 올라가 필요 없는 페이지에도 로드 |
| **(B) `system-boot/page.tsx`에 `landing-effects.css` import 추가** | 기존 CSS 파일 재사용, 인라인 제거 | `wave-drift`(랜딩용 잔잔한)와 `wave-float`(부트용 활발한)가 공존 — 애니메이션은 의도적으로 **다름**이므로 불일치 |
| **(C) `system-boot/` 전용 CSS 파일 생성** | 인라인 제거, 분리 명확 | 파일 1개 추가 |

**결정: (A) 채택**

`global-effects.css`가 이미 `.wave-particles` override를 가지고 있어 해당 섹션 안에서 `@keyframes wave-float` 정의를 추가하는 것이 자연스럽다. Turbopack/Webpack 모두 global CSS 최적화(tree-shaking 없음)이므로 크기 부담 없음.

### 작업 범위

- [ ] **P2-2-a**: `global-effects.css`의 `.wave-particles` 섹션에 `@keyframes wave-float` 정의 추가 (20s, `rotate`)
- [ ] **P2-2-b**: `SystemBootClient.tsx`의 `<style jsx>` 블록 제거 (또는 `wave-float` 부분만 제거)
- [ ] **P2-2-c**: 부트 페이지 wave 효과 시각 확인

**범위 제한:**
- `wave-drift` vs `wave-float` 통일 금지 (의도적으로 다른 효과)
- `global-effects.css`의 기존 `.wave-particles` override 유지

**영향 파일:**
- `src/app/global-effects.css`
- `src/app/system-boot/SystemBootClient.tsx`

---

## P3-1: TopologyModal 닫기 버튼 TopologyView 내부 이동

### 현상

```tsx
// src/components/dashboard/TopologyModal.tsx
<div className="relative flex h-full flex-col">
  <button className="absolute right-6 top-6 ...">✕</button>
  <TopologyView ... />   {/* 닫기 버튼이 TopologyView 밖에 위치 */}
</div>
```

필터 탭(`all/lb/web/api/db/cache/storage`)과 뷰 모드 토글이 `TopologyView` 안에 있는데 닫기 버튼만 외부에 절대 위치. 시각적으로 컨텐츠와 단절되어 있으며 스크롤 시 겹침 가능성.

### 수정 방향

`TopologyView`는 `DashboardRoutedContent`에서도 직접 사용되므로 prop을 추가한다면 반드시 optional로 유지한다. `TopologyModal`에서만 `onClose`를 전달하고, routed content 호출부는 변경하지 않는다.

### 작업 범위

- [ ] **P3-1-a**: `TopologyModal` 레이아웃 재배치: 닫기 버튼을 `TopologyView` 헤더 라인에 통합
- [ ] **P3-1-b**: absolute 위치 제거, flex 정렬로 교체

**영향 파일:**
- `src/components/dashboard/TopologyModal.tsx`

---

## P3-2: LandingPageRuntime footer 기술 스택 상수화

### 현상

```tsx
// src/app/LandingPageRuntime.tsx
<span>Next.js 16 + React 19</span>
<span>Quad-Provider AI</span>
```

버전 업그레이드 시 footer를 수동으로 찾아 변경해야 하는 유지보수 부담.

### 수정 방향

`src/lib/app-constants.ts` (또는 기존 상수 파일)에 `TECH_STACK_DISPLAY`와 `AI_PROVIDER_DISPLAY` 상수 추가.

```typescript
export const TECH_STACK_DISPLAY = 'Next.js 16 + React 19';
export const AI_PROVIDER_DISPLAY = 'Provider Mesh AI';
```

### 작업 범위

- [ ] **P3-2-a**: 상수 정의 (기존 상수 파일 확인 후 적절한 위치에 추가)
- [ ] **P3-2-b**: `LandingPageRuntime.tsx` 하드코딩 교체

**영향 파일:**
- `src/app/LandingPageRuntime.tsx`
- 상수 파일 1개 (기존 파일 확인 후 결정)

---

## 검증 게이트 (전체 공통)

```bash
npm run type-check
npm run lint
npm run test:quick
npm run line-guard
```

P2-2 완료 후 추가:
```bash
# system-boot 페이지에서 wave 효과 시각 확인
npm run dev:network
# http://localhost:3000/system-boot 접속 → wave 배경 표시 여부 확인
```

---

## 작업 순서 및 의존성

```
P1-1 → 독립 (1줄 수정)
P1-2 → 독립 (1줄 수정)
P2-1 → 독립 (FeatureCardModal만)
P2-2 → 독립 (CSS만)
P3-1 → P2 완료 후 진행 권장
P3-2 → 독립
```

P1-1 + P1-2를 하나의 커밋으로 묶어 처리 가능 (`fix(ui): correct progress bar pointer and login modal icon`).

---

## 이번 작업에서 의도적으로 제외한 항목

| 항목 | 제외 이유 |
|------|----------|
| 모달 테마 통일 (dark/light) | `GuestRestrictionModal` = 랜딩(dark), `AILoginRequiredModal` = 대시보드(light) — 컨텍스트 적절 |
| `FeatureCardModal` → Radix Dialog 전환 | 커스텀 focus trap + createPortal 모두 정상 동작. 재작성 리스크 > 이득. 별도 작업으로만 고려 |
| `wave-drift` vs `wave-float` 통일 | 의도적으로 다른 UX 효과 (랜딩=잔잔, 부트=활발) |
| `SmoothLoadingSpinner` 아이콘 중복 | 상단 스피너 + 하단 기기 아이콘 그리드는 디자인 의도 |
| 2-level dynamic import waterfall 제거 | Next.js SSR 최적화 구조 변경 — 별도 성능 작업으로 분리 |
