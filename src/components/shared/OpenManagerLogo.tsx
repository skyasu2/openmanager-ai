'use client';

import Link from 'next/link';
import type React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import {
  AI_ICON_GRADIENT_ANIMATED_STYLE,
  AI_TEXT_GRADIENT_ANIMATED_STYLE,
} from '@/styles/design-constants';

interface OpenManagerLogoProps {
  /**
   * 텍스트 색상 테마
   * - 'dark': 어두운 배경용 (흰색 텍스트) - 메인 페이지
   * - 'light': 밝은 배경용 (검은색 텍스트) - 대시보드
   */
  variant?: 'dark' | 'light';
  /** 서브타이틀 표시 여부 */
  showSubtitle?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 클릭 시 이동할 경로 (기본: /) */
  href?: string;
}

/**
 * 🎨 OpenManager 로고 컴포넌트
 *
 * 메인 페이지와 대시보드에서 공통으로 사용되는 로고입니다.
 * 시스템 상태(AI 모드, 시스템 시작 여부)에 따라 아이콘 배경 그라데이션이 동적으로 변경됩니다.
 * 아이콘 없이 그라데이션 사각형만 표시합니다.
 */
export const OpenManagerLogo: React.FC<OpenManagerLogoProps> = ({
  variant = 'dark',
  showSubtitle = true,
  className = '',
  href,
}) => {
  const { aiAgent, isSystemStarted } = useUnifiedAdminStore(
    useShallow((s) => ({
      aiAgent: s.aiAgent,
      isSystemStarted: s.isSystemStarted,
    }))
  );

  // 아이콘 배경 그라데이션 (상태 반응형)
  // AI_ICON_GRADIENT_ANIMATED_STYLE 사용 (backgroundClip:'text' 없는 버전)
  const iconStyle = aiAgent.isEnabled
    ? AI_ICON_GRADIENT_ANIMATED_STYLE
    : {
        background: isSystemStarted
          ? 'linear-gradient(135deg, #10b981, #059669)' // 시스템 시작: 에메랄드
          : 'linear-gradient(135deg, #6b7280, #4b5563)', // 정지: 회색
      };

  // 텍스트 색상 설정
  const titleColor = variant === 'dark' ? 'text-white' : 'text-gray-900';
  const subtitleColor = variant === 'dark' ? 'text-white/90' : 'text-gray-500';

  const content = (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      {/* 아이콘 영역 - 그라데이션 스퀘어 */}
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-lg"
        style={iconStyle}
      />

      {/* 텍스트 영역 - suppressHydrationWarning for dynamic subtitle */}
      <div className="min-w-0 text-left" suppressHydrationWarning>
        <h1 className={`truncate text-xl font-bold ${titleColor}`}>
          OpenManager <span style={AI_TEXT_GRADIENT_ANIMATED_STYLE}>AI</span>
        </h1>
        {(() => {
          const subtitleText =
            aiAgent.isEnabled && isSystemStarted
              ? null // AI 모드 텍스트 제거 요청 반영 (2025-12-13)
              : isSystemStarted
                ? '기본 모니터링'
                : '시스템 대기';

          if (!showSubtitle || !subtitleText) return null;

          return (
            <p className={`hidden text-xs sm:block ${subtitleColor}`}>
              {subtitleText}
            </p>
          );
        })()}
      </div>
    </div>
  );

  // href가 제공되면 Link로 래핑, 아니면 그대로 반환
  if (href) {
    return (
      <Link href={href} className="transition-opacity hover:opacity-80">
        {content}
      </Link>
    );
  }

  return content;
};
