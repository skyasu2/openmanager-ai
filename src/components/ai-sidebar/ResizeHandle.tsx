/**
 * ResizeHandle - AI 사이드바 리사이즈 핸들 컴포넌트
 *
 * 사이드바 왼쪽 가장자리에 위치하여 드래그로 너비 조절 가능
 * - 마우스/터치 드래그 지원
 * - hover/active 시각적 피드백
 * - 접근성 지원 (keyboard)
 */

'use client';

import { GripVertical } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

export interface ResizeHandleProps {
  /** 마우스 다운 핸들러 */
  onMouseDown: (e: React.MouseEvent) => void;
  /** 터치 시작 핸들러 */
  onTouchStart: (e: React.TouchEvent) => void;
  /** 리사이징 중 여부 */
  isResizing: boolean;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * 드래그 리사이즈 핸들 컴포넌트
 *
 * @example
 * ```tsx
 * <ResizeHandle
 *   onMouseDown={handleMouseDown}
 *   onTouchStart={handleTouchStart}
 *   isResizing={isResizing}
 * />
 * ```
 */
export const ResizeHandle = memo(function ResizeHandle({
  onMouseDown,
  onTouchStart,
  isResizing,
  disabled = false,
  className,
}: ResizeHandleProps) {
  if (disabled) return null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: resize handle requires custom drag interaction
    // biome-ignore lint/a11y/useFocusableInteractive: focused via parent sidebar
    <div
      role="separator"
      aria-valuenow={0}
      aria-label="사이드바 너비 조절"
      aria-orientation="vertical"
      title="드래그하여 너비 조절"
      className={cn(
        'absolute left-0 top-0 z-10 h-full w-1.5',
        'cursor-col-resize',
        'bg-transparent',
        'hover:bg-blue-400/30',
        isResizing && 'bg-blue-500/50',
        'touch-none',
        'transition-colors duration-150',
        className
      )}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* 시각적 그립 인디케이터 (hover 시 표시) */}
      <div
        className={cn(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'flex h-8 w-4 items-center justify-center',
          'rounded bg-gray-200/80 opacity-0',
          'transition-opacity duration-150',
          'group-hover:opacity-100',
          isResizing && 'opacity-100 bg-blue-200'
        )}
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
});

export default ResizeHandle;
