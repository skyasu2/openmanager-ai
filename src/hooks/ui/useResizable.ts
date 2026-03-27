/**
 * useResizable Hook
 *
 * AI 사이드바 드래그 리사이즈를 위한 커스텀 훅
 * - 마우스 드래그로 너비 조절
 * - 최소/최대 너비 제한
 * - 리사이징 상태 관리
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseResizableOptions {
  /** 초기 너비 (px) */
  initialWidth: number;
  /** 최소 너비 (px) */
  minWidth?: number;
  /** 최대 너비 (px) */
  maxWidth?: number;
  /** 너비 변경 시 콜백 */
  onWidthChange?: (width: number) => void;
  /** 리사이징 완료 시 콜백 */
  onResizeEnd?: (width: number) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

export interface UseResizableReturn {
  /** 현재 너비 */
  width: number;
  /** 리사이징 중 여부 */
  isResizing: boolean;
  /** 리사이즈 핸들에 적용할 마우스 다운 핸들러 */
  handleMouseDown: (e: React.MouseEvent) => void;
  /** 리사이즈 핸들에 적용할 터치 시작 핸들러 */
  handleTouchStart: (e: React.TouchEvent) => void;
  /** 너비 직접 설정 */
  setWidth: (width: number) => void;
}

/**
 * 드래그 리사이즈 기능을 제공하는 훅
 *
 * @example
 * ```tsx
 * const { width, isResizing, handleMouseDown } = useResizable({
 *   initialWidth: 600,
 *   minWidth: 400,
 *   maxWidth: 900,
 *   onWidthChange: (w) => store.setSidebarWidth(w),
 * });
 * ```
 */
export function useResizable({
  initialWidth,
  minWidth = 400,
  maxWidth = 900,
  onWidthChange,
  onResizeEnd,
  disabled = false,
}: UseResizableOptions): UseResizableReturn {
  const [width, setWidthState] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  // 드래그 시작 위치 및 초기 너비 저장
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const latestWidthRef = useRef(initialWidth);

  // 너비 클램핑 헬퍼
  const clampWidth = useCallback(
    (newWidth: number) => Math.min(maxWidth, Math.max(minWidth, newWidth)),
    [minWidth, maxWidth]
  );

  // 외부에서 너비 설정
  const setWidth = useCallback(
    (newWidth: number) => {
      const clamped = clampWidth(newWidth);
      latestWidthRef.current = clamped;
      setWidthState(clamped);
      onWidthChange?.(clamped);
    },
    [clampWidth, onWidthChange]
  );

  // initialWidth 변경 시 동기화
  useEffect(() => {
    latestWidthRef.current = initialWidth;
    setWidthState(initialWidth);
  }, [initialWidth]);

  // 마우스 드래그 시작
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;

      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [disabled, width]
  );

  // 터치 드래그 시작
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      setIsResizing(true);
      startXRef.current = touch.clientX;
      startWidthRef.current = width;
    },
    [disabled, width]
  );

  // 드래그 중 너비 계산 및 업데이트
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 오른쪽 사이드바이므로 왼쪽으로 드래그 = 너비 증가
      const delta = startXRef.current - e.clientX;
      const newWidth = clampWidth(startWidthRef.current + delta);
      latestWidthRef.current = newWidth;
      setWidthState(newWidth);
      onWidthChange?.(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      const delta = startXRef.current - touch.clientX;
      const newWidth = clampWidth(startWidthRef.current + delta);
      latestWidthRef.current = newWidth;
      setWidthState(newWidth);
      onWidthChange?.(newWidth);
    };

    const handleEnd = () => {
      setIsResizing(false);
      onResizeEnd?.(latestWidthRef.current);
    };

    // 이벤트 리스너 등록
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    // 드래그 중 텍스트 선택 방지
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);

      // 스타일 복원
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, clampWidth, onWidthChange, onResizeEnd]);

  return {
    width,
    isResizing,
    handleMouseDown,
    handleTouchStart,
    setWidth,
  };
}
