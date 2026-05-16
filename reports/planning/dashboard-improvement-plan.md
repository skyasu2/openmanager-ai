# Dashboard 핵심 컴포넌트 개선 계획서

> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: refactor,dashboard,accessibility,dead-code,duplication

---

## 배경 및 분석 범위

2026-05-16 대시보드 핵심 컴포넌트 5개 파일을 전문가 관점에서 분석한 결과, **실현 가능한 개선 7건**과 **제외 1건**을 확인했다. 모두 순수 코드 구조 변경이며 외부 인프라 변경 없음.

분석 대상:
- `src/components/dashboard/DashboardHeader.tsx` (209줄)
- `src/components/dashboard/DashboardSummary.tsx` (462줄)
- `src/components/dashboard/ImprovedServerCard.tsx` (518줄)
- `src/components/dashboard/ServerDashboard.tsx` (663줄)
- `src/components/dashboard/ServerDetailView.tsx` (406줄)
- `src/components/dashboard/EnhancedServerModal.OverviewTab.tsx` (232줄)

---

## 사전 검증 결과 요약

### 무료 티어 영향 분석

모든 작업은 **코드 구조 변경만**이며 외부 인프라 변경 없음.

| 플랫폼 | 이번 작업 영향 | 판정 |
|--------|--------------|------|
| Vercel Pro | 변경 없음 | ✅ 영향 없음 |
| Cloud Run | 변경 없음 | ✅ 영향 없음 |
| Upstash Redis | 변경 없음 | ✅ 영향 없음 |
| Supabase | 변경 없음 | ✅ 영향 없음 |

### 작업 분류

| 우선순위 | 건수 | 항목 |
|---------|------|------|
| P1 (버그/정확성) | 1건 | D2 |
| P2 (코드 품질) | 4건 | D1, D3, D4, D5 |
| P3 (보완/접근성) | 2건 | D6, D7 |

---

## D1: `withCurrentMetricPoint` 유틸리티 중복 제거 (P2)

### 현상 및 근거

동일 함수가 두 파일에 각각 정의되어 있고, 유사 helper가 modal 전용 파일에도 이미 존재한다:

```typescript
// src/components/dashboard/ImprovedServerCard.tsx:85
function withCurrentMetricPoint(
  values: number[],
  currentValue: number
): number[] { ... }

// src/components/dashboard/ServerDetailView.tsx:119
function withCurrentMetricPoint(
  values: number[],
  currentValue: number
): number[] { ... }

// src/components/dashboard/EnhancedServerModal.metrics.helpers.ts:21
export function withCurrentMetricPoint(
  data: number[],
  currentValue: number | undefined,
  options?: { clamp?: boolean }
): number[] { ... }
```

`EnhancedServerModal.metrics.helpers.ts`는 modal-specific type/import를 포함하므로 다른 카드/상세 컴포넌트가 직접 import하기에는 경계가 좋지 않다. helper만 별도 dashboard-local utility로 분리하는 방향이 안전하다.

### 작업 범위

- [ ] **D1-1**: `src/components/dashboard/dashboard-metric-points.ts` 신규 생성, `withCurrentMetricPoint(values, currentValue, options?)` export
- [ ] **D1-2**: `ImprovedServerCard.tsx` 내 로컬 정의 제거, shared helper import
- [ ] **D1-3**: `ServerDetailView.tsx` 내 로컬 정의 제거, shared helper import
- [ ] **D1-4**: `EnhancedServerModal.metrics.helpers.ts` 내 helper 정의 제거, shared helper import로 교체

**예상 영향 파일:**
- `src/components/dashboard/dashboard-metric-points.ts` (신규)
- `src/components/dashboard/ImprovedServerCard.tsx`
- `src/components/dashboard/ServerDetailView.tsx`
- `src/components/dashboard/EnhancedServerModal.metrics.helpers.ts`

---

## D2: 탭 레이블/콘텐츠 불일치 수정 (P1)

### 현상 및 근거

`TabId` 타입은 이미 5개 값을 지원하지만 실제 UI에는 탭이 3개만 표시된다:

```typescript
// src/components/dashboard/EnhancedServerModal.types.ts:27
type TabId = 'overview' | 'metrics' | 'processes' | 'logs' | 'network';

// ServerDetailView.tsx — 실제 tabs 배열 (3개만)
const tabs: TabInfo[] = [
  { id: 'overview', label: '개요' },
  { id: 'metrics', label: '성능 분석' },  // ProcessesTab도 여기에 묻혀 있음
  { id: 'logs', label: '로그' },           // NetworkTab도 여기에 묻혀 있음
];
```

`ServerModalTabNav`는 `tabs: TabInfo[]` 배열을 props로 받는 완전 data-driven 컴포넌트 — 탭 추가 시 배열에 항목만 추가하면 됨.

현재 'metrics' 탭 패널에 `MetricsTab`과 `ProcessesTab`이 혼재하며, 'logs' 탭 패널에 `LogsTab`과 `NetworkTab`이 혼재한다.

### 작업 범위

- [ ] **D2-1**: `ServerDetailView.tsx`의 `tabs` 배열에 `{ id: 'processes', label: '프로세스' }` 항목 추가
- [ ] **D2-2**: `renderTabContent`에서 `processes` 케이스 분기 — `ProcessesTab` 이동
- [ ] **D2-3**: 기존 `metrics` 탭 패널에서 `ProcessesTab` 제거 (이미 별도 탭으로 이동됨)

**범위 제한:**
- `network` 탭 분리는 이번 범위에서 제외 (로그와 네트워크는 연관성이 높아 현 UX 유지 판단)
- 탭 스타일/아이콘 추가 금지

**예상 영향 파일:**
- `src/components/dashboard/ServerDetailView.tsx`

---

## D3: `activeTab` 데드 상태 제거 (P2)

### 현상 및 근거

```typescript
// src/components/dashboard/ServerDashboard.tsx:156
const [activeTab] = useState<DashboardTab>('servers'); // setter 없음

// :423 — 유일한 사용처
{activeTab === 'servers' && (
  <ServerGrid ... />
)}
```

`setter`가 없어 항상 `'servers'`이므로 조건식은 항상 `true`. 불필요한 상태 선언.

### 작업 범위

- [ ] **D3-1**: `useState<DashboardTab>('servers')` → `const activeTab = 'servers'` (상수로 교체)
- [ ] **D3-2**: 또는 조건식 자체 제거 — `{activeTab === 'servers' && (...)}`를 `<>...</>` 또는 직접 렌더로 정리

**예상 영향 파일:**
- `src/components/dashboard/ServerDashboard.tsx`

---

## D4: `ImprovedServerCard` 이중 `memo()` 제거 (P2)

### 현상 및 근거

```typescript
// ImprovedServerCard.tsx:128
const ImprovedServerCardInner = memo(function ImprovedServerCardInner(...) {
  ...
});

// :510
const ImprovedServerCard = memo(function ImprovedServerCard({ serverId, ... }) {
  return (
    <ServerCardErrorBoundary serverId={serverId}>
      <ImprovedServerCardInner ... />
    </ServerCardErrorBoundary>
  );
});
```

`ServerCardErrorBoundary`는 클래스 컴포넌트이며 `Props = { children, fallback?, serverId? }`만 받는다. `ImprovedServerCardInner`에 이미 `memo()`가 적용되어 있으므로, 외부 `ImprovedServerCard`의 `memo()` 래핑은 `ErrorBoundary` 래퍼 함수에 불필요한 memoization을 추가한다.

사전 검증: `ServerCardErrorBoundary`가 memo를 전달하거나 참여하는 구조가 아님을 확인.

### 작업 범위

- [ ] **D4-1**: 외부 `ImprovedServerCard`의 `memo()` 래핑 제거 — 일반 함수 컴포넌트로 변경
- [ ] **D4-2**: `displayName` 설정이 있다면 유지

**예상 영향 파일:**
- `src/components/dashboard/ImprovedServerCard.tsx`

---

## D5: `DashboardHeader` deprecated `addListener` fallback 제거 (P2)

### 현상 및 근거

```typescript
// DashboardHeader.tsx:77-88
if (typeof mediaQuery.addEventListener === 'function') {
  mediaQuery.addEventListener('change', handleChange);
  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}

// ↓ 이 분기는 현대 브라우저에서 절대 실행되지 않음
mediaQuery.addListener(handleChange);   // deprecated
return () => {
  mediaQuery.removeListener(handleChange); // deprecated
};
```

`MediaQueryList.addEventListener`는 Chrome 45+, Firefox 55+, Safari 14+에서 지원된다. 현재 지원 브라우저 기준에서 `addListener` 분기는 dead code이며 TypeScript `deprecated` 경고 대상.

### 작업 범위

- [ ] **D5-1**: `if (typeof mediaQuery.addEventListener === 'function')` 조건 제거
- [ ] **D5-2**: `mediaQuery.addEventListener` / `removeEventListener` 직접 사용
- [ ] **D5-3**: deprecated `addListener` / `removeListener` 블록 삭제

**예상 영향 파일:**
- `src/components/dashboard/DashboardHeader.tsx`

---

## D6: `statusGradients` 중복 현황 기록 (P3)

### 현상 및 근거

동일 개념의 오브젝트가 두 파일에 각각 정의되어 있으나, 구조가 달라 단순 통합이 불가능하다:

```typescript
// DashboardSummary.tsx:51 — 5개 상태, gradient/border/bg/text/glow 5필드
const statusGradients = {
  critical: { gradient: 'from-red-500/20...', border: 'border-red-200', ... },
  ...
};

// ImprovedServerCard.tsx:52 — 6개 상태, gradient/shadow/glow 3필드
const statusGradients = {
  critical: { gradient: 'from-red-500/10...', shadow: 'shadow-red-500/20', ... },
  ...
};
```

**이번 작업 결정**: 통합 디자인 토큰 작업은 별도 UI 토큰 개선 계획으로 처리. 이번에는 각 파일에서 현재 구조를 유지하되, `// TODO: dashboard-status-tokens` 주석으로 마킹만 한다.

### 작업 범위

- [ ] **D6-1**: `DashboardSummary.tsx:51`과 `ImprovedServerCard.tsx:52`의 `statusGradients` 선언 바로 위에 `// TODO: dashboard-status-tokens — 향후 공유 디자인 토큰으로 통합 예정` 주석 추가

**예상 영향 파일:**
- `src/components/dashboard/DashboardSummary.tsx`
- `src/components/dashboard/ImprovedServerCard.tsx`

---

## D7: 이모지 상태 레이블 `aria-hidden` 추가 (P3)

### 현상 및 근거

```typescript
// EnhancedServerModal.OverviewTab.tsx — 이모지 포함 문자열
'✅ 실행중'
'🛑 중지됨'
'⏸️ 대기중'
```

스크린리더가 이모지를 "흰색 체크 표시 버튼" 등으로 읽어 불필요한 노이즈를 발생시킨다.

### 작업 범위

- [ ] **D7-1**: 이모지를 별도 `<span aria-hidden="true">` 요소로 분리
  ```tsx
  // Before
  '✅ 실행중'

  // After
  <><span aria-hidden="true">✅ </span>실행중</>
  ```
- [ ] **D7-2**: `key={idx}`, `key={index}` 패턴 중 안정적 고유 식별자로 대체 가능한 케이스 수정 (stable list에만 적용)

**예상 영향 파일:**
- `src/components/dashboard/EnhancedServerModal.OverviewTab.tsx`

---

## 제외: `performanceStats` 미사용 아님

### 재검토 결과

```typescript
// ServerDashboard.tsx:154
const performanceStats = usePerformanceTracking('ServerDashboard');
```

재확인 결과 `performanceStats`는 개발 환경 전용 성능 패널에서 `getRenderCount()`와 `getAverageRenderTime()` 표시 용도로 사용 중이다. 따라서 미사용 할당 정리 대상에서 제외한다.

---

## SDD 게이트

plan 파일의 Status가 `Approved`로 변경된 이후에 구현을 시작한다.

D1~D7은 "단일 버그 수정·소규모 리팩터링" 범주 — `test(spec):` 선행 커밋 없이 fix/refactor + test 동시 커밋 허용.

> 승인 상태: 2026-05-16 계획서 재검토 기준으로 중복 제거, 탭 정합성, dead state, 접근성 보완의 영향 파일과 제외 범위가 확정되어 구현 착수 가능.

---

## 검증 게이트 (전체 공통)

```bash
npm run type-check
npm run lint
npm run test:quick
npm run line-guard   # 800줄 초과 파일 확인
```

---

## 작업 순서 및 의존성

```
D1 (중복 제거) → D2 (탭 구조) → 독립
D3 (dead state) → D4 (double memo) → D5 (deprecated API) → 독립
D6 (주석 마킹) → D7 (aria-hidden) → 독립
```

P1 → P2 → P3 순서로 진행 권장. D1-D5는 병렬 처리 가능.
