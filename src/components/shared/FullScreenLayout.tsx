/**
 * FullScreenLayout - 전체 화면 중앙 정렬 레이아웃 컴포넌트
 *
 * AuthLoadingUI와 UnauthorizedAccessUI에서 공통으로 사용하는
 * 배경 그라디언트와 중앙 정렬 레이아웃을 담당
 *
 * 추출 위치:
 * - src/components/shared/AuthLoadingUI.tsx (lines 46-48, 70-71)
 * - src/components/shared/UnauthorizedAccessUI.tsx (lines 60-61, 98-99)
 */

'use client';

import type { ReactNode } from 'react';

interface FullScreenLayoutProps {
  /**
   * 레이아웃 내부에 렌더링할 컨텐츠
   */
  children: ReactNode;

  /**
   * 추가 CSS 클래스 (선택사항)
   */
  className?: string;
}

export default function FullScreenLayout({
  children,
  className = '',
}: FullScreenLayoutProps) {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      <div
        className={`flex min-h-screen items-center justify-center ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
