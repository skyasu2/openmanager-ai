/**
 * 🏠 OpenManager 랜딩 페이지
 *
 * GitHub OAuth + 게스트 로그인 지원
 * 웨이브 파티클 배경, 고급 애니메이션, 카운트다운 시스템
 *
 * NOTE: 이 파일은 반드시 Client Component여야 합니다 (hooks 사용)
 *
 * @refactored 2024-12 - /main에서 /로 이동 (랜딩 페이지)
 */

'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DashboardSection,
  GuestRestrictionModal,
  LoginPrompt,
  MainPageErrorBoundary,
  SystemStartSection,
} from '@/app/main/components';
import { useSystemStart } from '@/app/main/hooks';
import AuthLoadingUI from '@/components/shared/AuthLoadingUI';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import UnifiedProfileHeader from '@/components/shared/UnifiedProfileHeader';
import { isGuestFullAccessEnabled } from '@/config/guestMode';
import { isVercel } from '@/env-client';
import { useInitialAuth } from '@/hooks/useInitialAuth';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import { PAGE_BACKGROUNDS } from '@/styles/design-constants';
import debug from '@/utils/debug';
import { renderAIGradientWithAnimation } from '@/utils/text-rendering';
import {
  authRetryDelay,
  debugWithEnv,
  envLabel,
  mountDelay,
  syncDebounce,
} from '@/utils/vercel-env-utils';
import {
  performanceTracker,
  preloadCriticalResources,
} from '@/utils/vercel-optimization';

// Phase 2: Lazy loading with skeleton (깜빡임 방지)
const FeatureCardsGridSkeleton = () => (
  <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5"
      />
    ))}
  </div>
);

const FeatureCardsGrid = dynamic(
  () => import('@/components/home/FeatureCardsGrid'),
  { ssr: false, loading: () => <FeatureCardsGridSkeleton /> }
);

function Home() {
  // 인증 상태
  const {
    isLoading: authLoading,
    isAuthenticated,
    user: _currentUser,
    isGitHubConnected: isGitHubUser,
    error: authError,
    isReady: authReady,
    getLoadingMessage,
    retry: retryAuth,
  } = useInitialAuth();

  // 마운트 상태
  const [isMounted, setIsMounted] = useState(false);

  // 시스템 시작 훅
  const {
    systemStartCountdown,
    isSystemStarting,
    isSystemStarted,
    multiUserStatus,
    showGuestRestriction,
    dismissGuestRestriction,
    statusInfo,
    buttonConfig,
    handleSystemToggle,
    navigateToDashboard,
  } = useSystemStart({
    isAuthenticated,
    isGitHubUser,
    authLoading,
    isMounted,
  });

  // 시스템 상태 동기화
  const { startSystem, stopSystem, getSystemRemainingTime } =
    useUnifiedAdminStore();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevRunningRef = useRef<boolean | null>(null);

  // 시스템 남은 시간 (UI 표시용)
  const [_systemTimeRemaining, setSystemTimeRemaining] = useState(0);

  // 클라이언트 마운트
  useEffect(() => {
    if (isVercel) performanceTracker.start('page-mount');

    const mountTimer = setTimeout(() => {
      setIsMounted(true);
      debug.log(debugWithEnv('✅ 클라이언트 마운트 완료'), { isVercel });
      if (isVercel) {
        void preloadCriticalResources();
        performanceTracker.end('page-mount');
      }
    }, mountDelay);
    return () => clearTimeout(mountTimer);
  }, []);

  // 다중 사용자 시스템 상태 동기화
  useEffect(() => {
    if (!authReady || !multiUserStatus) return;
    const currentRunning = multiUserStatus.isRunning;
    if (prevRunningRef.current !== currentRunning) {
      prevRunningRef.current = currentRunning;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        const needsStart = multiUserStatus.isRunning && !isSystemStarted;
        const needsStop = !multiUserStatus.isRunning && isSystemStarted;
        if (needsStart) {
          debug.log(debugWithEnv('🔄 시스템이 다른 사용자에 의해 시작됨'));
          startSystem();
        } else if (needsStop) {
          debug.log(debugWithEnv('🔄 시스템이 다른 사용자에 의해 정지됨'));
          stopSystem();
        }
      }, syncDebounce);
    }
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [authReady, multiUserStatus, isSystemStarted, startSystem, stopSystem]);

  // 인증 에러 재시도
  useEffect(() => {
    if (!authError || !authReady) return;
    debug.error(debugWithEnv('❌ 인증 에러 발생'), authError);
    const authRetryTimeout = setTimeout(() => {
      debug.log(
        debugWithEnv(`🔄 인증 재시도 시작 (${authRetryDelay / 1000}초 후)`)
      );
      retryAuth();
    }, authRetryDelay);
    return () => clearTimeout(authRetryTimeout);
  }, [authError, authReady, retryAuth]);

  // 시스템 남은 시간 업데이트 - 시스템 시작 시에만 인터벌 실행 (불필요한 리렌더 방지)
  useEffect(() => {
    if (!isSystemStarted) {
      setSystemTimeRemaining(0);
      return; // 시스템 미시작 시 인터벌 없음
    }

    const timerInterval = setInterval(() => {
      setSystemTimeRemaining(getSystemRemainingTime());
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [isSystemStarted, getSystemRemainingTime]);

  // 접근 권한 계산
  const canAccessSystem = useMemo(
    () => isGitHubUser || isAuthenticated || isGuestFullAccessEnabled(),
    [isGitHubUser, isAuthenticated]
  );

  const guestModeMessage = useMemo(
    () => '게스트 로그인은 테스트/체험 용도로만 제공됩니다.',
    []
  );

  // 로딩 상태 - authReady 단일 조건 (깜빡임 방지)
  // isMounted는 성능 추적용으로만 사용, 로딩 조건에서 제거
  const shouldShowLoading = !authReady;

  if (shouldShowLoading) {
    return (
      <AuthLoadingUI
        loadingMessage={getLoadingMessage()}
        envLabel={envLabel}
        authError={authError}
        onRetry={retryAuth}
      />
    );
  }

  // 비로그인 상태에서도 메인 페이지 표시 (LoginPrompt로 로그인 유도)
  // 게스트/GitHub 로그인 후 시스템 시작 가능

  return (
    <div
      className={`min-h-screen ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}
      data-system-active={isSystemStarted ? 'true' : 'false'}
    >
      <div className="wave-particles" />

      {/* 헤더 */}
      <header className="relative z-50 flex items-center justify-between p-4 sm:p-6">
        <OpenManagerLogo variant="dark" href="/" titleAs="p" />
        <nav aria-label="사용자 메뉴" className="flex items-center gap-3">
          <UnifiedProfileHeader />
        </nav>
      </header>

      {/* 메인 콘텐츠 */}
      <main
        aria-label="메인 콘텐츠"
        className="container relative z-10 mx-auto px-4 pt-8 sm:px-6"
      >
        {/* 타이틀 */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-2xl font-bold sm:text-3xl md:text-5xl">
            <span className="text-white">OpenManager</span>{' '}
            <span>{renderAIGradientWithAnimation('AI')}</span>
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-white/85 md:text-lg">
            <span className="block font-medium text-white/90">
              서버 관리자의 의사결정을 돕는 지능형 모니터링 AI 어시스턴트
            </span>
            <span className="mt-2 block text-sm text-white/60">
              멀티 에이전트 아키텍처 · 실시간 메트릭 RAG · 장애 자동 분석
            </span>
          </p>
        </div>

        {/* 시스템 시작/대시보드 섹션 */}
        <div className="mb-12">
          {!isSystemStarted ? (
            canAccessSystem ? (
              <SystemStartSection
                isMounted={isMounted}
                systemStartCountdown={systemStartCountdown}
                isSystemStarting={isSystemStarting}
                isSystemStarted={isSystemStarted}
                isSystemRunning={multiUserStatus?.isRunning || false}
                buttonConfig={buttonConfig}
                statusInfo={statusInfo}
                onSystemToggle={handleSystemToggle}
              />
            ) : (
              <div className="mx-auto max-w-2xl">
                <LoginPrompt
                  isMounted={isMounted}
                  guestModeMessage={guestModeMessage}
                />
              </div>
            )
          ) : (
            <DashboardSection
              canAccessDashboard={canAccessSystem}
              onNavigateDashboard={navigateToDashboard}
              onStopSystem={canAccessSystem ? stopSystem : undefined}
            />
          )}
        </div>

        {/* 기능 카드 그리드 */}
        <div className="mb-12">
          <FeatureCardsGrid />
        </div>

        {/* 푸터 */}
        <footer className="mt-8 border-t border-white/20 pt-6">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-sm text-white/60">
              &copy; 2025-2026 OpenManager AI. Licensed under GPL-3.0.
            </p>
            <div className="flex items-center gap-4 text-xs text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>v{process.env.NEXT_PUBLIC_APP_VERSION || '5.83.14'}</span>
              </span>
              <span>Next.js 16 + React 19</span>
              <span className="hidden sm:inline">Quad-Provider AI</span>
            </div>
          </div>
        </footer>
      </main>

      {/* 게스트 제한 모달 */}
      <GuestRestrictionModal
        open={showGuestRestriction}
        onClose={dismissGuestRestriction}
      />
    </div>
  );
}

// Phase 3: Error Boundary로 래핑된 페이지 export
export default function LandingPage() {
  return (
    <MainPageErrorBoundary
      fallbackTitle="메인 페이지 오류"
      fallbackMessage="메인 페이지를 불러오는 중 문제가 발생했습니다."
    >
      <Home />
    </MainPageErrorBoundary>
  );
}
