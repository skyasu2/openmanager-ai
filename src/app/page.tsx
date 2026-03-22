/**
 * 🏠 OpenManager 랜딩 페이지
 *
 * GitHub, Google, 이메일 OAuth + 게스트 로그인 지원
 * 웨이브 파티클 배경, 고급 애니메이션, 카운트다운 시스템
 *
 * NOTE: 이 파일은 반드시 Client Component여야 합니다 (hooks 사용)
 *
 * @refactored 2024-12 - /main에서 /로 이동 (랜딩 페이지)
 */

'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DashboardSection,
  GuestRestrictionModal,
  MainPageErrorBoundary,
  SystemStartSection,
} from '@/app/main/components';
import { useSystemStart } from '@/app/main/hooks';
import AuthLoadingUI from '@/components/shared/AuthLoadingUI';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import UnifiedProfileHeader from '@/components/shared/UnifiedProfileHeader';
import { APP_VERSION } from '@/config/app-meta';
import { isGuestSystemStartEnabled } from '@/config/guestMode';
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
    user: currentUser,
    isGitHubConnected: isGitHubUser,
    error: authError,
    isReady: authReady,
    getLoadingMessage,
    retry: retryAuth,
  } = useInitialAuth();

  // 마운트 상태
  const [isMounted, setIsMounted] = useState(false);

  // 시스템 시작 훅
  const isGuestUser = useMemo(
    () => currentUser?.provider === 'guest',
    [currentUser]
  );
  const isGuestSystemStartEnabledValue = useMemo(
    () => isGuestSystemStartEnabled(),
    []
  );

  const canAccessDashboard = useMemo(
    () => isAuthenticated && (!isGuestUser || isGuestSystemStartEnabledValue),
    [isAuthenticated, isGuestUser, isGuestSystemStartEnabledValue]
  );

  const {
    systemStartCountdown,
    isSystemStarting,
    isSystemStarted,
    multiUserStatus,
    guestRestrictionReason,
    showGuestRestriction,
    dismissGuestRestriction,
    statusInfo,
    buttonConfig,
    handleSystemToggle,
    navigateToDashboard,
  } = useSystemStart({
    isAuthenticated,
    isGitHubUser,
    isGuestUser,
    isGuestSystemStartEnabled: isGuestSystemStartEnabledValue,
    authLoading,
    isMounted,
  });
  const shouldShowSystemStart = !isSystemStarted || !isAuthenticated;

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

  return (
    <div
      className={`min-h-screen ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}
      data-system-active={isSystemStarted ? 'true' : 'false'}
    >
      <div className="wave-particles" />

      {/* 헤더 */}
      <header className="relative z-50 flex items-center justify-between p-4 sm:p-6">
        <OpenManagerLogo
          variant="dark"
          href="/"
          titleAs="p"
          showSubtitle={false}
        />
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
              운영 데이터를 질문, 분석, 조치안으로 바꾸는 서버 모니터링 AI
            </span>
            <span className="mt-2 block text-sm text-white/60">
              그래프를 직접 읽는 대신 현재 메트릭을 바탕으로 바로 질문하고 답을
              받습니다
            </span>
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              Validated on Production · 2026-03-22
            </span>
            <Link
              href="/reports/qa/QA_STATUS.md"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              QA Status
            </Link>
            <Link
              href="/reports/qa/runs/2026/qa-run-QA-20260322-0160.json"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              Latest Proof Run
            </Link>
            <a
              href="https://github.com/skyasu2/openmanager-ai/actions/runs/23398040200"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sky-200 transition-colors hover:border-sky-300/40 hover:bg-sky-500/15"
            >
              CI Artifact Evidence
            </a>
          </div>
        </div>

        {/* 시스템 시작/대시보드 섹션 */}
        <div className="mb-12">
          {shouldShowSystemStart ? (
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
            <DashboardSection
              canAccessDashboard={canAccessDashboard}
              onNavigateDashboard={navigateToDashboard}
              onStopSystem={canAccessDashboard ? stopSystem : undefined}
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
                <span>v{APP_VERSION}</span>
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
        reason={guestRestrictionReason}
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
