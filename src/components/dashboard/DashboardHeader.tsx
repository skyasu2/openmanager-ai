'use client';

// 사용자 정보 관련 import는 UnifiedProfileHeader에서 처리됨
import dynamic from 'next/dynamic';
import React, { memo, useState } from 'react';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import { useUserPermissions } from '@/hooks/auth/useUserPermissions';
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

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
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
        className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-md"
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-linear-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <div className="flex min-w-0 items-center justify-between gap-2 py-4 pr-3 pl-14 sm:gap-4 sm:pr-6 sm:pl-16 lg:px-6">
          <div className="flex min-w-0 flex-1 basis-0 items-center gap-2 overflow-hidden sm:gap-4">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-gray-200 sm:h-10 sm:w-10" />
            <div className="hidden h-5 w-36 animate-pulse rounded bg-gray-200 sm:block" />
            <div className="ml-auto h-6 w-16 shrink-0 animate-pulse rounded bg-gray-200 lg:hidden" />
          </div>
          <div className="hidden min-w-0 shrink items-center justify-center gap-3 overflow-hidden px-2 lg:flex xl:gap-4">
            <div className="hidden h-6 w-24 animate-pulse rounded bg-gray-200 xl:block" />
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="h-11 w-11 animate-pulse rounded-xl bg-gray-200 sm:w-28" />
            <div className="h-11 w-11 animate-pulse rounded-lg bg-gray-200 sm:w-32" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      suppressHydrationWarning
      className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-md"
    >
      {/* 브랜드 액센트 라인 */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-linear-to-r from-blue-500 via-indigo-500 to-violet-500" />
      <div
        data-testid="dashboard-header-primary-row"
        className="flex min-w-0 items-center justify-between gap-2 py-4 pr-3 pl-14 sm:gap-4 sm:pr-6 sm:pl-16 lg:px-6"
      >
        {/* 왼쪽: 브랜드 로고 */}
        <div className="flex min-w-0 flex-1 basis-0 items-center gap-2 overflow-hidden sm:gap-4">
          <OpenManagerLogo
            variant="light"
            compactOnMobile
            hideTitleOnMobile
            href="/"
            titleWeight="semibold"
            showSubtitle={false}
          />
          {!isDesktopLayout && (
            <div className="ml-auto flex shrink-0 lg:hidden">
              <RealTimeDisplay variant="compact" />
            </div>
          )}
        </div>

        {/* 중앙: 실시간 정보 + 세션 카운트다운 */}
        {isDesktopLayout && (
          <div className="hidden min-w-0 shrink items-center justify-center gap-3 overflow-hidden px-2 lg:flex xl:gap-4">
            <div className="hidden xl:block">
              <RealTimeDisplay />
            </div>
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
    </header>
  );
});

DashboardHeader.displayName = 'DashboardHeader';

export default DashboardHeader;
