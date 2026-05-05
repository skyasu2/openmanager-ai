<!-- Owner: project -->
<!-- Status: Completed -->
<!-- Doc type: How-to -->
<!-- Last reviewed: 2026-05-01 -->

# Dashboard 스크롤 IntersectionObserver 전환 계획

- TODO.md 연결: Active > IntersectionObserver 전환

> 현재 scroll event + `scrollHeight - scrollTop` 계산 방식을
> IntersectionObserver + sentinel element 패턴으로 교체.
> LogExplorerPanel과 AlertHistoryPanel 두 곳 동시 적용.

---

## 0. 현황 분석

### 현재 구현 (scroll event 방식)

**LogExplorerModal.tsx**
```tsx
const scrollThrottleRef = useRef(false);
const handleLogScroll = useCallback(
  (event: UIEvent<HTMLDivElement>) => {
    if (scrollThrottleRef.current) return;
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight > 120) return;
    scrollThrottleRef.current = true;
    loadMoreLogs();
    setTimeout(() => { scrollThrottleRef.current = false; }, 200);
  },
  [loadMoreLogs]
);
// 사용: <div onScroll={handleLogScroll}>
```

**AlertHistoryModal.tsx**
```tsx
const scrollThrottleRef = useRef(false);
const handleAlertScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
  if (scrollThrottleRef.current) return;
  const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
  if (scrollHeight - scrollTop - clientHeight > 120) return;
  scrollThrottleRef.current = true;
  setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
  setTimeout(() => { scrollThrottleRef.current = false; }, 200);
}, []);
// 사용: <div onScroll={handleAlertScroll}>
```

### 문제점

| 항목 | 현재 scroll event | IntersectionObserver |
|------|------------------|---------------------|
| 트리거 정확도 | scrollTop 계산 오차 발생 가능 | sentinel 가시성 기준 정확 |
| 브라우저 부하 | 스크롤마다 JS 실행 | 가시성 변화 시만 콜백 |
| 스로틀 코드 | 수동 setTimeout 필요 | 브라우저가 내부 처리 |
| 중복 트리거 방지 | scrollThrottleRef 수동 관리 | `disconnect()` 한 번으로 해결 |
| MDN 권장 여부 | ❌ (레거시 패턴) | ✅ (공식 권장 패턴) |

---

## 1. 계약 (Contract)

- `onScroll` prop 제거 → `useIntersectionObserver` 커스텀 훅 사용
- `scrollThrottleRef` 삭제
- `hasMore` 조건부 sentinel element 렌더 유지
- 로드 중(`isFetchingNextPage`, `isPending`) 동안 observer 비활성화
- 기존 `INITIAL_DISPLAY`, `LOAD_MORE_COUNT` 상수 유지
- `useGlobalLogs.fetchNextPage` API 계약 변경 없음

### 테스트 계약

```
B1: sentinel이 뷰포트에 진입하면 loadMoreLogs/setDisplayCount 호출
B2: 로딩 중일 때 sentinel 진입해도 중복 호출 없음
B3: hasMore=false일 때 sentinel 렌더되지 않음
B4: 컴포넌트 언마운트 시 observer disconnect 호출
```

---

## 2. 설계

### 2-1. useScrollSentinel 커스텀 훅

```ts
// src/hooks/dashboard/useScrollSentinel.ts
import { useCallback, useEffect, useRef } from 'react';

export function useScrollSentinel(
  onIntersect: () => void,
  enabled: boolean
) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const observe = useCallback(() => {
    const el = sentinelRef.current;
    if (!el || !enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          onIntersect();
        }
      },
      { rootMargin: '120px' }  // 120px 여유 (기존 동일)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, enabled]);

  useEffect(() => {
    return observe();
  }, [observe]);

  return sentinelRef;
}
```

### 2-2. LogExplorerModal 적용

```tsx
// 변경 전
const scrollThrottleRef = useRef(false);
const handleLogScroll = useCallback(...);

// 변경 후
const sentinelRef = useScrollSentinel(
  loadMoreLogs,
  !!hasMore && !isFetchingNextPage
);

// JSX 변경 전
<div onScroll={handleLogScroll}>
  {/* 로그 목록 */}
</div>

// JSX 변경 후
<div>
  {/* 로그 목록 */}
  {hasMore && <div ref={sentinelRef} className="h-px" />}
</div>
```

### 2-3. AlertHistoryModal 적용

```tsx
// 변경 전
const scrollThrottleRef = useRef(false);
const handleAlertScroll = useCallback(...);

// 변경 후
const loadMore = useCallback(() => {
  setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
}, []);
const sentinelRef = useScrollSentinel(loadMore, hasMore && !isPending);

// JSX 변경 전
<div onScroll={handleAlertScroll}>

// JSX 변경 후
<div>
  {/* 알림 목록 */}
  {hasMore && (
    <>
      <div ref={sentinelRef} className="h-px" />
      <div className="py-3 text-center text-[11px] text-gray-400">
        아래로 스크롤하면 더 보기 ({alerts.length - displayCount}건 남음)
      </div>
    </>
  )}
</div>
```

---

## 3. Task 목록

### Phase 1 — 훅 구현 (P0, ~0.5일)

- [x] **B1**: `src/hooks/dashboard/useScrollSentinel.ts` 신규 생성
- [x] **B2**: `useScrollSentinel` 단위 테스트 작성 (4개 계약)

### Phase 2 — 적용 (P0, ~0.5일)

- [x] **B3**: LogExplorerModal — `onScroll` + `scrollThrottleRef` 제거, sentinel 적용
- [x] **B4**: AlertHistoryModal — `onScroll` + `scrollThrottleRef` 제거, sentinel 적용
- [x] **B5**: LogExplorerModal.test.tsx 스크롤 테스트 → sentinel 기반으로 갱신
- [x] **B6**: 브라우저 검증 (로그 페이지 + 알림 페이지 스크롤 동작 확인)

---

## 4. 변경 금지 범위

- `src/hooks/dashboard/useGlobalLogs.ts` — API 계약 변경 없음
- `src/hooks/dashboard/useAlertHistory.ts` — 데이터 계약 변경 없음
- `INITIAL_DISPLAY`, `LOAD_MORE_COUNT` 상수 값 변경 없음

---

## 5. 참조

- MDN IntersectionObserver: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- 현재 LogExplorer: `src/components/dashboard/log-explorer/LogExplorerModal.tsx`
- 현재 AlertHistory: `src/components/dashboard/alert-history/AlertHistoryModal.tsx`
- 대상 훅 위치: `src/hooks/dashboard/useScrollSentinel.ts` (신규)
