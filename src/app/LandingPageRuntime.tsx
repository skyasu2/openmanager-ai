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
import { MouseSpotlight } from '@/components/landing/MouseSpotlight';
import AuthLoadingUI from '@/components/shared/AuthLoadingUI';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import {
  AI_PROVIDER_DISPLAY,
  APP_VERSION,
  TECH_STACK_DISPLAY,
} from '@/config/app-meta';
import { AI_TEXT_GRADIENT_ANIMATED_STYLE } from '@/styles/design-constants';
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
  <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="min-h-[13rem] animate-pulse rounded-lg border border-white/10 bg-white/5 sm:min-h-[14.5rem] md:min-h-[17rem] lg:min-h-[15.5rem]"
      />
    ))}
  </div>
);

const FeatureCardsGrid = dynamic(
  () => import('@/components/home/FeatureCardsGrid'),
  { ssr: false, loading: () => <FeatureCardsGridSkeleton /> }
);

const FOOTER_TECH_STACK = [TECH_STACK_DISPLAY, AI_PROVIDER_DISPLAY] as const;

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
      className="min-h-screen bg-black"
      data-system-active={isSystemStarted ? 'true' : 'false'}
    >
      <MouseSpotlight />
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
          <h1 className="mb-3 text-3xl font-extrabold sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="text-white">OpenManager</span>{' '}
            <span style={AI_TEXT_GRADIENT_ANIMATED_STYLE}>AI</span>
          </h1>
          <p className="mb-2 text-lg font-light text-white/90 sm:text-xl md:text-2xl">
            서버 운영을 AI에게 묻다
          </p>
          <p className="text-xs text-white/45 sm:text-sm">
            18대 서버 · OTel 데이터 기반 포트폴리오 프로젝트
          </p>
        </div>

        <div className="mb-12 min-h-[30rem] sm:min-h-[26rem]">
          {shouldShowSystemStart ? (
            <SystemStartSection
              isMounted={isMounted}
              systemStartCountdown={systemStartCountdown}
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

        <section
          className="mb-12 rounded-[2rem] border border-white/10 bg-white/[0.03] px-4 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:px-6"
          aria-label="주요 기능 소개"
        >
          <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white/30">
            주요 기능
          </p>
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
              {FOOTER_TECH_STACK.map((item, index) => (
                <span
                  key={item}
                  className={index === 1 ? 'hidden sm:inline' : undefined}
                >
                  {item}
                </span>
              ))}
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
