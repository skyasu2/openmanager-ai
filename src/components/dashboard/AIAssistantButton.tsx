'use client';

import { Bot } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { AI_ICON_GRADIENT_ANIMATED_STYLE } from '@/styles/design-constants';

/**
 * AI 어시스턴트 버튼 Props
 */
interface AIAssistantButtonProps {
  /** 사이드바 열림 상태 */
  isOpen: boolean;
  /** AI 에이전트 활성화 상태 */
  isEnabled: boolean;
  /** 클릭 핸들러 */
  onClick: () => void;
}

/**
 * AI 어시스턴트 토글 버튼 컴포넌트
 *
 * @description
 * - AI 사이드바 토글 기능
 * - 활성화 상태에 따른 시각적 피드백
 * - Hydration 불일치 방지
 * - ✨ 그라데이션 애니메이션 (gradient-diagonal)
 *
 * @example
 * ```tsx
 * <AIAssistantButton
 *   isOpen={true}
 *   isEnabled={true}
 *   onClick={() => handleToggle()}
 * />
 * ```
 */
export const AIAssistantButton = memo(function AIAssistantButton({
  isOpen,
  isEnabled,
  onClick,
}: AIAssistantButtonProps) {
  // 🔒 Hydration 불일치 방지를 위한 클라이언트 전용 상태
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isActive = isMounted && (isOpen || isEnabled);

  return (
    <div
      className="relative flex shrink-0 flex-col items-center gap-0.5"
      suppressHydrationWarning
    >
      <button
        type="button"
        onClick={onClick}
        data-testid="ai-assistant"
        className={`group relative min-h-11 transform cursor-pointer touch-manipulation overflow-hidden rounded-xl px-4 py-2.5 transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:outline-hidden ${
          isActive
            ? 'scale-105 text-white shadow-lg shadow-purple-500/50'
            : 'bg-gray-800 text-white hover:bg-gray-700'
        }`}
        style={isActive ? AI_ICON_GRADIENT_ANIMATED_STYLE : undefined}
        title={
          isMounted && isOpen ? 'AI 어시스턴트 닫기' : 'AI 어시스턴트 열기'
        }
        aria-label={
          isMounted && isOpen ? 'AI 어시스턴트 닫기' : 'AI 어시스턴트 열기'
        }
        aria-pressed={isMounted ? isOpen : false}
        suppressHydrationWarning
      >
        {/* 호버 시 빛나는 효과 */}
        {isActive && (
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute inset-0 animate-pulse-glow bg-linear-to-r from-white/20 via-white/40 to-white/20" />
          </div>
        )}

        <div className="relative flex items-center gap-2">
          <Bot className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold tracking-wide text-white">
            AI 어시스턴트
          </span>
        </div>

        {/* 활성화 상태 표시 */}
        {isActive && (
          <div
            className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-green-400"
            aria-hidden="true"
          />
        )}
      </button>

      {/* 주의 유도 손가락 이모지 */}
      {!isOpen && (
        <span
          className="mt-1 hidden animate-bounce text-xs leading-none xl:inline"
          aria-hidden="true"
        >
          👆
        </span>
      )}
    </div>
  );
});

AIAssistantButton.displayName = 'AIAssistantButton';
