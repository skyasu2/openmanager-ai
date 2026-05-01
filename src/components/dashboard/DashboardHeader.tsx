'use client';

// 사용자 정보 관련 import는 UnifiedProfileHeader에서 처리됨
import dynamic from 'next/dynamic';
import React, { memo, useState } from 'react';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAISidebarStore } from '@/stores/useAISidebarStore';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import debug from '@/utils/debug';
import { AIAssistantButton } from './AIAssistantButton';
import { RealTimeDisplay } from './RealTimeDisplay';
import { SessionCountdown } from './SessionCountdown';

const UnifiedProfileHeader = dynamic(
  () => import('@/components/shared/UnifiedProfileHeader'),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 sm:w-28" />
    ),
  }
);

const AILoginRequiredModal = dynamic(
  () =>
    import('./AILoginRequiredModal').then((mod) => mod.AILoginRequiredModal),
  { ssr: false, loading: () => null }
);

/**
 * 대시보드 헤더 컴포넌트 Props
 */
interface DashboardHeaderProps {
  /** AI 에이전트 토글 핸들러 - 기존 호환성을 위해 유지 */
  onToggleAgent?: () => void;
  /** 전체 화면 AI 워크스페이스 route에서는 사이드바 토글을 숨긴다 */
  hideAIAssistantButton?: boolean;
}

/**
 * 대시보드 메인 헤더 컴포넌트
 *
 * @description
 * - 브랜드 로고 및 네비게이션
 * - AI 어시스턴트 토글 버튼
 * - 실시간 시간 표시
 * - 프로필 컴포넌트
 *
 * @example
 * ```tsx
 * <DashboardHeader />
 * ```
 */
const DashboardHeader = memo(function DashboardHeader({
  onToggleAgent,
  hideAIAssistantButton = false,
}: DashboardHeaderProps) {
  // 🔒 Hydration 불일치 방지를 위한 클라이언트 전용 상태
  const [isMounted, setIsMounted] = React.useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncLayout = (matches: boolean) => {
      setIsDesktopLayout(matches);
    };

    syncLayout(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncLayout(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  // 🔧 P2: 세분화된 Selector - aiAgent.isEnabled만 구독하여 불필요한 리렌더 방지
  const isAIAgentEnabled = useUnifiedAdminStore(
    (state) => state.aiAgent.isEnabled
  );
  // 🔐 사용자 권한 확인
  const permissions = useUserPermissions();
  // 🔧 새로운 AI 사이드바 상태 (선택적 구독)
  const isSidebarOpen = useAISidebarStore((state) => state.isOpen);
  const setSidebarOpen = useAISidebarStore((state) => state.setOpen);

  // 🔐 AI 로그인 필요 모달 상태
  const [showLoginModal, setShowLoginModal] = useState(false);

  // AI 에이전트 토글 핸들러 (새로운 사이드바 연동)
  const handleAIAgentToggle = () => {
    debug.log('🤖 AI 어시스턴트 토글');

    // 🔐 비로그인 사용자는 로그인 모달 표시 (GitHub OAuth 또는 게스트 PIN 인증 시 허용)
    if (!permissions.isGitHubAuthenticated && !permissions.isPinAuthenticated) {
      debug.log('🔒 로그인 필요 - 모달 표시');
      setShowLoginModal(true);
      return;
    }

    if (onToggleAgent) {
      onToggleAgent();
      return;
    }

    // fallback: 기존 직접 토글 경로 유지
    setSidebarOpen(!isSidebarOpen);
  };

  // 사용자 정보는 UnifiedProfileHeader에서 처리됨

  if (!isMounted) {
    return (
      <header
        suppressHydrationWarning
        className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-xs"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
          <div className="hidden items-center gap-6 md:flex">
            <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      suppressHydrationWarning
      className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-xs"
    >
      <div className="flex items-center justify-between py-4 pr-4 pl-16 sm:pr-6 lg:px-6">
        {/* 왼쪽: 브랜드 로고 */}
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden pr-3">
          <OpenManagerLogo variant="light" compactOnMobile href="/" />
        </div>

        {/* 중앙: 실시간 정보 + 세션 카운트다운 */}
        {isDesktopLayout && (
          <div className="hidden items-center gap-4 lg:flex">
            <RealTimeDisplay />
            <SessionCountdown />
          </div>
        )}

        {/* 오른쪽: AI 어시스턴트 & 프로필 */}
        <div className="relative z-10 flex shrink-0 items-center gap-2 sm:gap-4">
          {/* 🔐 AI 어시스턴트 토글 버튼 - 항상 표시, 클릭 시 인증 체크 */}
          {!hideAIAssistantButton && (
            <AIAssistantButton
              isOpen={isSidebarOpen}
              isEnabled={isAIAgentEnabled}
              onClick={handleAIAgentToggle}
            />
          )}

          {/* 🎯 UnifiedProfileHeader 사용 - Zustand 스토어로 Props Drilling 제거 */}
          <UnifiedProfileHeader />
        </div>
      </div>

      {/* 🔐 AI 로그인 필요 모달 */}
      <AILoginRequiredModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* 모바일용 실시간 정보 + 세션 카운트다운 */}
      {!isDesktopLayout && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 lg:hidden">
          <div className="flex flex-nowrap items-center justify-center gap-2 text-xs">
            <RealTimeDisplay />
            <SessionCountdown />
          </div>
        </div>
      )}
    </header>
  );
});

DashboardHeader.displayName = 'DashboardHeader';

export default DashboardHeader;
