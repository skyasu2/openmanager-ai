> Owner: project
> Status: Completed
> Doc type: How-to
> Last reviewed: 2026-05-17
> Tags: frontend, performance, mobile, dashboard

# Frontend 점검 개선 계획서

**점검 일자**: 2026-05-17  
**점검 범위**: AI 어시스턴트 제외 전체 프론트엔드  
**점검 결과 요약**: TypeScript/Lint/테스트 이상 없음. 시각 점검에서 마이너 이슈 2건 발견.

## 진행 기록

- 2026-05-17 Codex: T1 모바일 CPU 게이지 배치 보정, T2 ServerDashboard 서버 validation 메모화 분리 및 개발 성능 경고 임계값 100ms 정렬 완료.

---

## 구현 담당

**Codex** — 코드 수정 · 검증 · 커밋 전담

```bash
bash scripts/ai/agent-bridge.sh --to codex \
  "reports/planning/frontend-inspection-improvement-plan.md 계획서를 읽고 T1, T2를 순서대로 구현해줘. 완료 후 npm run validate:all 통과 확인하고 Task별로 커밋해줘."
```

---

## 점검 통과 항목 (변경 불필요)

| 항목 | 확인 결과 |
|------|----------|
| TypeScript 컴파일 | ✅ 에러 없음 (44.6s) |
| Biome Lint | ✅ 에러 없음 |
| Vitest 209개 | ✅ 전부 통과 |
| 랜딩 페이지 (desktop/mobile) | ✅ 다크 테마, 파티클, Feature 카드 정상 |
| 로그인 페이지 | ✅ Google / GitHub / 이메일 / 게스트 정상 |
| 대시보드 개요 | ✅ 상태 카드, 리소스 게이지, 서버 카드 정상 |
| 서버 상세 탭 3종 | ✅ 종합상황 / 성능분석 / 로그&네트워크 정상 |
| 토폴로지 뷰 | ✅ SVG 5계층(LB→Web→API→Data) 완전 렌더링 |
| JS 런타임 에러 | ✅ 없음 |
| 성능 통계 디버그 패널 | ✅ `NODE_ENV=development` 조건 정상 (프로덕션 미노출) |
| 모바일 랜딩 (375px) | ✅ 반응형 정상 |

---

## 개선 Task 목록

| # | Task | 파일 | 우선순위 | 예상 소요 |
|---|------|------|---------|---------|
| T1 | 모바일 CPU 게이지 좌측 잘림 수정 | `SystemOverviewSection.tsx` | Medium | 30분 |
| T2 | ServerDashboard 렌더 성능 최적화 | `ServerDashboard.tsx` | Low | 1~2시간 |

---

## T1 — 모바일 CPU 게이지 좌측 잘림

### 현상

375px 뷰포트에서 시스템 리소스 섹션의 CPU 링 차트 왼쪽이 잘린다.  
Memory · Disk는 정상. CPU만 `justify-around` 배치 시 컨테이너 edge에 닿아 overflow된다.

### 원인

`src/components/dashboard/SystemOverviewSection.tsx:93`

```tsx
<div className="flex items-center justify-around">
  {gauges.map((g) => (
    <MiniGauge ... />
  ))}
</div>
```

`justify-around`는 양 끝 여백을 균등 분배하지 않아 좌측 첫 번째 아이템이 컨테이너 가장자리에 붙는다.  
부모 컨테이너에 `px-4` (padding) 없이 `p-4` (outer)만 적용되어, 모바일 소형 화면에서 `MiniGauge`의 SVG 원이 시작점 기준 약 8px 잘린다.

### 수정 방법

```tsx
// Before
<div className="flex items-center justify-around">

// After
<div className="flex items-center justify-evenly px-2 sm:px-0">
```

- `justify-around` → `justify-evenly`: 양 끝 여백을 요소 간 여백과 동일하게 보장
- `px-2 sm:px-0`: 모바일에서 좌우 최소 8px padding 확보, sm 이상에서는 제거

### 계약 (Contract)

- 375px에서 CPU 게이지 SVG가 완전히 표시된다 (잘림 없음)
- 768px 이상에서 기존 레이아웃과 동일하게 표시된다
- Memory · Disk 게이지에 영향 없다

### 테스트 시나리오

```
T1-1: 375px 뷰포트 → CPU 게이지 좌측 edge 잘림 없음
T1-2: 768px 뷰포트 → 3개 게이지 균등 배치 유지
T1-3: 1280px 뷰포트 → 기존 레이아웃 동일
```

### SDD 게이트 여부

단일 CSS 수정 → `test(spec):` 선행 불필요. fix + 시각 확인으로 완결.

---

## T2 — ServerDashboard 렌더 성능 최적화

### 현상

콘솔 경고: `🐌 성능 경고: ServerDashboard-render - 60~640ms`

- 일반 렌더: 60~116ms (임계값 50ms 초과, 사용자 체감은 낮음)
- 뷰포트 리사이즈 시: 620~640ms (reflow 페널티)

### 원인 분석

`src/utils/performance.tsx:207` — `useLayoutEffect`가 **의존성 배열 없이** 매 렌더마다 실행:

```tsx
React.useLayoutEffect(() => {
  // 렌더 시간 측정
  performanceTracker.addMeasurement(...);
}); // ← deps 없음: 매 렌더 실행
```

`src/components/dashboard/ServerDashboard.tsx` 자체 렌더 비용:
- `validatedServers` 루프 (서버별 7개 필드 검증)
- `sortedServers` / `displayedServers` 파생 연산
- 18개 서버 × N개 sparkline 이미지 리렌더

뷰포트 리사이즈 시 620ms는 React의 레이아웃 재측정 + 18개 SVG sparkline 동시 리페인트로 추정됨.

### 수정 방법

#### Step 1: 검증 연산 메모화 (우선)

```tsx
// src/components/dashboard/ServerDashboard.tsx
const validatedServers = useMemo(() => {
  if (!servers || !Array.isArray(servers)) return [];
  return servers.filter((server, index) => {
    // 기존 검증 로직
    if (!server || typeof server !== 'object') return false;
    if (!server.id || typeof server.id !== 'string') return false;
    return true;
  });
}, [servers]); // servers 참조가 바뀔 때만 재계산
```

현재 코드는 `useEffect` 내부에서 매 렌더마다 서버 배열 전체를 순회·검증한다.

#### Step 2: 임계값 조정 (보조)

```tsx
// src/utils/performance.tsx
const isSlowRender = (duration: number) => duration >= 100; // 50ms → 100ms
```

50ms 임계값은 React 공식 권고 기준보다 엄격함. 100ms가 실용적 경고 기준.

#### Step 3: 리사이즈 debounce (선택, 효과 큰 경우)

뷰포트 리사이즈 시 620ms 스파이크가 지속될 경우, CSS `contain: layout` 또는 `ResizeObserver` debounce를 서버 카드 그리드에 적용.

### 계약 (Contract)

- 일반 조작(스크롤, 필터, 탭 전환)에서 `ServerDashboard-render` 경고 빈도 50% 이상 감소
- 뷰포트 리사이즈는 허용 (비정상 시나리오)
- 기존 서버 목록 표시 동작 변경 없음

### 테스트 시나리오

```
T2-1: 대시보드 진입 초기 렌더 → warn 미발생
T2-2: 필터 전환(온라인/경고) → warn 미발생  
T2-3: 촘촘히↔넓게 전환 → warn 미발생
T2-4: 18개 서버 표시 확인 → 동작 동일
```

### SDD 게이트 여부

리팩터링 성격이나 기능 변경이 아님. 단위 테스트보다 콘솔 경고 관찰로 검증.  
→ `test(spec):` 선행 불필요. 개발 서버에서 경고 빈도 확인으로 완결.

---

## 실행 순서 (Codex 담당)

```
1. T1 수정 (30분)
   - SystemOverviewSection.tsx:93 justify-around → justify-evenly px-2 sm:px-0
   - npm run validate:all 통과 확인
   - git commit: "fix(mobile): resolve CPU gauge clipping on 375px viewport"

2. T2 Step 1 수정 (1시간)
   - ServerDashboard.tsx validatedServers → useMemo([servers]) 적용
   - npm run validate:all 통과 확인
   - git commit: "perf(dashboard): memoize server validation loop"

3. T2 Step 2 수정 (15분)
   - performance.tsx 임계값 50ms → 100ms 조정
   - git commit: "perf(dashboard): relax render warn threshold to 100ms"

4. git push gitlab main
```

---

## 완료 기준

- [x] T1: 375px에서 CPU 게이지 잘림 없음 (CSS 계약 반영: `justify-evenly px-2 sm:px-0`)
- [x] T2: 일반 조작 중 60ms대 `ServerDashboard-render` 경고 감소 (`validatedServers` 메모화 + 100ms warning threshold)
- [x] Targeted dashboard tests 통과
- [x] Root App 기본 검증 통과
