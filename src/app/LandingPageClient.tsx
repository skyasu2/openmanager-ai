/**
 * 🏠 OpenManager 랜딩 페이지
 *
 * GitHub, Google, 이메일 OAuth + 게스트 로그인 지원
 * 웨이브 파티클 배경, 고급 애니메이션, 카운트다운 시스템
 *
 * @refactored 2024-12 - /main에서 /로 이동 (랜딩 페이지)
 */

'use client';

import dynamic from 'next/dynamic';
import { MainPageErrorBoundary } from '@/app/main/components';
import { useLandingPageState } from '@/app/main/hooks';
import AuthLoadingUI from '@/components/shared/AuthLoadingUI';
import { APP_VERSION } from '@/config/app-meta';
import {
  AI_TEXT_GRADIENT_ANIMATED_STYLE,
  PAGE_BACKGROUNDS,
} from '@/styles/design-constants';
import { envLabel } from '@/utils/vercel-env-utils';

const HeaderSkeleton = () => (
  <div className="flex min-h-10 min-w-[13rem] animate-pulse items-center gap-3">
    <div className="h-10 w-10 rounded-lg bg-white/10" />
    <div className="space-y-2">
      <div className="h-4 w-28 rounded bg-white/10" />
      <div className="h-3 w-20 rounded bg-white/5" />
    </div>
  </div>
);

const HeaderMenuSkeleton = () => (
  <div className="h-10 w-24 animate-pulse rounded-full bg-white/10" />
);

const SectionSkeleton = () => (
  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
    <div className="mx-auto h-28 max-w-3xl animate-pulse rounded-2xl bg-white/10" />
  </div>
);

const OpenManagerLogo = dynamic(
  () =>
    import('@/components/shared/OpenManagerLogo').then(
      (mod) => mod.OpenManagerLogo
    ),
  { ssr: false, loading: () => <HeaderSkeleton /> }
);

const UnifiedProfileHeader = dynamic(
  () => import('@/components/shared/UnifiedProfileHeader'),
  { ssr: false, loading: () => <HeaderMenuSkeleton /> }
);

const DashboardSection = dynamic(
  () =>
    import('@/app/main/components/DashboardSection').then(
      (mod) => mod.DashboardSection
    ),
  { ssr: false, loading: () => <SectionSkeleton /> }
);

const SystemStartSection = dynamic(
  () =>
    import('@/app/main/components/SystemStartSection').then(
      (mod) => mod.SystemStartSection
    ),
  { ssr: false, loading: () => <SectionSkeleton /> }
);

const GuestRestrictionModal = dynamic(
  () =>
    import('@/app/main/components/GuestRestrictionModal').then(
      (mod) => mod.GuestRestrictionModal
    ),
  { ssr: false, loading: () => null }
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
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
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

export default function LandingPageClient() {
  return (
    <MainPageErrorBoundary
      fallbackTitle="메인 페이지 오류"
      fallbackMessage="메인 페이지를 불러오는 중 문제가 발생했습니다."
    >
      <Home />
    </MainPageErrorBoundary>
  );
}
