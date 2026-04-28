/**
 * 🏠 OpenManager 랜딩 페이지 런타임
 *
 * 무거운 auth/store 그래프를 엔트리에서 분리해 dev route compile을 늦춘다.
 */

'use client';

import dynamic from 'next/dynamic';
import {
  DashboardSection,
  GuestRestrictionModal,
  MainPageErrorBoundary,
  SystemStartSection,
} from '@/app/main/components';
import { useLandingPageState } from '@/app/main/hooks';
import AuthLoadingUI from '@/components/shared/AuthLoadingUI';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import { APP_VERSION } from '@/config/app-meta';
import {
  AI_TEXT_GRADIENT_ANIMATED_STYLE,
  PAGE_BACKGROUNDS,
} from '@/styles/design-constants';
import { envLabel } from '@/utils/vercel-env-utils';

const UnifiedProfileHeader = dynamic(
  () => import('@/components/shared/UnifiedProfileHeader'),
  {
    ssr: false,
    loading: () => (
      <div className="h-12 w-32 animate-pulse rounded-full bg-white/10" />
    ),
  }
);

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
  const {
    authError,
    canAccessDashboard,
    buttonConfig,
    dismissGuestRestriction,
    getLoadingMessage,
    guestRestrictionReason,
    handleSystemToggle,
    isMounted,
    isSystemStarted,
    systemStartCountdown,
    isSystemStarting,
    multiUserStatus,
    navigateToDashboard,
    retryAuth,
    shouldShowLoading,
    shouldShowSystemStart,
    showGuestRestriction,
    statusInfo,
    stopSystem,
  } = useLandingPageState();

  if (shouldShowLoading) {
    return (
      <AuthLoadingUI
        loadingMessage={getLoadingMessage()}
        envLabel={envLabel}
        authError={authError}
        onRetry={retryAuth}
        showCopy={false}
      />
    );
  }

  return (
    <div
      className={`min-h-screen ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}
      data-system-active={isSystemStarted ? 'true' : 'false'}
    >
      <div className="wave-particles" />

      <header className="relative z-50 flex min-h-[72px] items-center justify-between p-4 sm:min-h-[88px] sm:p-6">
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

      <main
        aria-label="메인 콘텐츠"
        className="container relative z-10 mx-auto px-4 pt-8 sm:px-6"
      >
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-2xl font-bold sm:text-3xl md:text-5xl">
            <span className="text-white">OpenManager</span>{' '}
            <span style={AI_TEXT_GRADIENT_ANIMATED_STYLE}>AI</span>
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-white/85 md:text-lg">
            <span className="block font-medium text-white/90">
              운영 데이터를 질문, 분석, 조치안으로 바로 연결하는 모니터링
              워크플로
            </span>
            <span className="mt-2 block text-sm text-white/60">
              그래프를 해석하는 대신 지금 무슨 일이 벌어지는지 바로 묻고 답을
              받을 수 있습니다
            </span>
          </p>
        </div>

        <div className="mb-12 min-h-[30rem] sm:min-h-[26rem]">
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

        <section className="mb-12 rounded-[2rem] border border-white/10 bg-black/15 px-4 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur-sm sm:px-6">
          <FeatureCardsGrid />
        </section>

        <footer className="mt-8 border-t border-white/20 pt-6">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-sm text-white/60">
              &copy; 2025-2026 OpenManager AI. Licensed under GPL-3.0.
            </p>
            <div className="flex items-center gap-4 text-xs text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span>v{APP_VERSION}</span>
              </span>
              <span>Next.js 16 + React 19</span>
              <span className="hidden sm:inline">Quad-Provider AI</span>
            </div>
          </div>
        </footer>
      </main>

      <GuestRestrictionModal
        open={showGuestRestriction}
        onClose={dismissGuestRestriction}
        reason={guestRestrictionReason}
      />
    </div>
  );
}

export default function LandingPageRuntime() {
  return (
    <MainPageErrorBoundary
      fallbackTitle="메인 페이지 오류"
      fallbackMessage="메인 페이지를 불러오는 중 문제가 발생했습니다."
    >
      <Home />
    </MainPageErrorBoundary>
  );
}
