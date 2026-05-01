import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 🎯 useResponsivePageSize Hook
 *
 * 화면 크기에 따른 동적 페이지 크기 관리 (debounce 적용)
 * - Mobile (< 640px): 3개
 * - Tablet (< 1024px): 6개
 * - Desktop (>= 1024px): 9개
 *
 * @param initialSize - 초기 페이지 크기 (기본값: 3)
 * @param debounceMs - debounce 지연 시간 (기본값: 150ms)
 */
export function useResponsivePageSize(
  initialSize: number = 3,
  debounceMs: number = 150
) {
  const [pageSize, setPageSize] = useState(initialSize);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePageSize = useCallback((width: number): number => {
    if (width < 640) return 3;
    if (width < 1024) return 6;
    return 9;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      // 기존 타이머 취소
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // debounce 적용
      timeoutRef.current = setTimeout(() => {
        const newPageSize = calculatePageSize(window.innerWidth);
        setPageSize((prev) => {
          if (newPageSize !== prev && prev <= 15) {
            return newPageSize;
          }
          return prev;
        });
      }, debounceMs);
    };

    // 초기 실행 (debounce 없이)
    const initialPageSize = calculatePageSize(window.innerWidth);
    setPageSize((prev) => (prev <= 15 ? initialPageSize : prev));

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [calculatePageSize, debounceMs]);

  return { pageSize, setPageSize };
}
