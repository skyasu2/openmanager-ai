'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { DashboardAlertContext } from '@/components/dashboard/alert-ai-context';
import { DashboardNavigation } from '@/components/dashboard/shell/DashboardNavigation';
import type { DashboardView } from '@/components/dashboard/types/dashboard-view.types';
import { useAIEntryController } from '@/hooks/ai/useAIEntryController';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { useServerDashboard } from '@/hooks/useServerDashboard';
import { useSystemAutoShutdown } from '@/hooks/useSystemAutoShutdown';
import type {
  DashboardDataSourceInfo,
  DashboardTimeInfo,
} from '@/lib/dashboard/server-data';
import { systemInactivityService } from '@/services/system/SystemInactivityService';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { Server } from '@/types/server';
import { triggerAIWarmup } from '@/utils/ai-warmup';
import debug from '@/utils/debug';
import {
  AnimatedAISidebar,
  ContentLoadingSkeleton,
} from './dashboard-client-helpers';

const DASHBOARD_DEV_EFFECT_GUARD_KEY =
  '__openmanagerDashboardInteractiveShellDevEffects__';

type DashboardDevEffectKey =
  | 'dashboard-init-log'
  | 'dashboard-warmup'
  | 'dashboard-metrics-preload'
  | 'dashboard-auto-start';

function consumeDashboardDevEffect(key: DashboardDevEffectKey): boolean {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return true;
  }

  const guardStore = ((
    window as typeof window & {
      [DASHBOARD_DEV_EFFECT_GUARD_KEY]?: Partial<
        Record<DashboardDevEffectKey, boolean>
      >;
    }
  )[DASHBOARD_DEV_EFFECT_GUARD_KEY] ??= {});

  if (guardStore[key]) {
    return false;
  }

  guardStore[key] = true;
  return true;
}

function toJobDataSlot(
  timeInfo: DashboardTimeInfo | undefined
): JobDataSlot | undefined {
  if (!timeInfo) return undefined;

  const hours = String(Math.floor(timeInfo.minuteOfDay / 60)).padStart(2, '0');
  const minutes = String(timeInfo.minuteOfDay % 60).padStart(2, '0');

  return {
    slotIndex: timeInfo.globalSlotIndex,
    minuteOfDay: timeInfo.minuteOfDay,
    timeLabel: `${hours}:${minutes} KST`,
  };
}

const DashboardHeader = dynamic(
  () => import('@/components/dashboard/DashboardHeader'),
  {
    ssr: false,
    loading: () => (
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-xs">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            <div className="h-10 w-28 animate-pulse rounded-full bg-gray-200" />
          </div>
        </div>
      </header>
    ),
  }
);

const DashboardContent = dynamic(
  () => import('@/components/dashboard/DashboardContent'),
  { ssr: false, loading: () => <ContentLoadingSkeleton /> }
);

const DashboardRoutedContent = dynamic(
  () => import('@/components/dashboard/DashboardRoutedContent'),
  { ssr: false, loading: () => <ContentLoadingSkeleton /> }
);

const AutoLogoutWarning = dynamic(
  () =>
    import('@/components/auth/AutoLogoutWarning').then(
      (mod) => mod.AutoLogoutWarning
    ),
  { ssr: false, loading: () => null }
);

const NotificationToast = dynamic(
  () =>
    import('@/components/system/NotificationToast').then(
      (mod) => mod.NotificationToast
    ),
  { ssr: false, loading: () => null }
);

type DashboardInteractiveShellProps = {
  dashboardView?: DashboardView;
  initialServers?: Server[];
  initialTimeInfo?: DashboardTimeInfo;
  initialDataSourceInfo?: DashboardDataSourceInfo | null;
  initialFocusServerId?: string | null;
  isMounted: boolean;
  canToggleAI: boolean;
  userType: string;
  isGuestFullAccess: boolean;
};

export default function DashboardInteractiveShell({
  dashboardView = 'overview',
  initialServers,
  initialTimeInfo,
  initialDataSourceInfo,
  initialFocusServerId,
  isMounted,
  canToggleAI,
  userType,
  isGuestFullAccess,
}: DashboardInteractiveShellProps) {
  const router = useRouter();
  const hasLoggedDashboardInitRef = useRef(false);
  const hasTriggeredDashboardWarmupRef = useRef(false);
  const hasPreloadedMetricsRef = useRef(false);
  const hasAutoStartedSystemRef = useRef(false);
  const aiQueryAsOfDataSlot = useMemo(
    () => toJobDataSlot(initialTimeInfo),
    [initialTimeInfo]
  );
  const [deferDashboardContent, setDeferDashboardContent] = useState(
    process.env.NODE_ENV === 'development'
  );
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [, setServerStats] = useState({
    total: 0,
    online: 0,
    warning: 0,
    offline: 0,
  });

  const {
    isOpen: isAgentOpen,
    toggleSidebar,
    closeSidebar,
    openWithPrefill,
  } = useAIEntryController();

  const { isSystemStarted, startSystem } = useUnifiedAdminStore(
    useShallow((s) => ({
      isSystemStarted: s.isSystemStarted,
      startSystem: s.startSystem,
    }))
  );

  const { remainingTime, isWarning, resetTimer, forceLogout } = useAutoLogout({
    timeoutMinutes: 10,
    warningMinutes: 1,
    onWarning: () => {
      debug.log('⚠️ 자동 로그아웃 경고 표시 - 베르셀 사용량 최적화');
    },
    onLogout: () => {
      debug.log('🔒 자동 로그아웃 실행 - 베르셀 사용량 최적화');
      systemInactivityService.pauseSystem();
    },
  });

  useSystemAutoShutdown({
    warningMinutes: 5,
    onWarning: (remainingMinutes) => {
      debug.log(`⚠️ 시스템 자동 종료 경고: ${remainingMinutes}분 남음`);

      const event = new CustomEvent('system-event', {
        detail: {
          type: 'server_alert',
          level: remainingMinutes === 5 ? 'warning' : 'critical',
          message:
            remainingMinutes === 5
              ? '시스템이 5분 후 자동으로 종료됩니다. 계속 사용하시려면 시스템 중지를 해제해주세요.'
              : '시스템이 1분 후 자동으로 종료됩니다!',
        },
      });
      window.dispatchEvent(event);
    },
    onShutdown: () => {
      debug.log('🛑 시스템 자동 종료 완료');
      router.replace('/');
    },
  });

  const {
    paginatedServers: realServers,
    servers: allServers,
    filteredTotal,
    currentPage,
    totalPages,
    pageSize,
    setCurrentPage,
    changePageSize,
  } = useServerDashboard({
    initialServers,
    statusFilter,
  });

  useEffect(() => {
    if (!deferDashboardContent) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setDeferDashboardContent(false);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [deferDashboardContent]);

  useEffect(() => {
    if (
      hasLoggedDashboardInitRef.current ||
      !consumeDashboardDevEffect('dashboard-init-log')
    ) {
      return;
    }
    hasLoggedDashboardInitRef.current = true;
    debug.log('🎯 대시보드 초기화 - Supabase hourly_server_states 테이블 사용');
  }, []);

  useEffect(() => {
    if (
      hasTriggeredDashboardWarmupRef.current ||
      !consumeDashboardDevEffect('dashboard-warmup')
    ) {
      return;
    }
    hasTriggeredDashboardWarmupRef.current = true;
    void triggerAIWarmup('dashboard-mount');
  }, []);

  useEffect(() => {
    if (
      hasPreloadedMetricsRef.current ||
      !consumeDashboardDevEffect('dashboard-metrics-preload')
    ) {
      return;
    }
    hasPreloadedMetricsRef.current = true;

    const loadInitialMetrics = async () => {
      try {
        const { metricsProvider } = await import(
          '@/services/metrics/MetricsProvider'
        );
        await metricsProvider.ensureDataLoaded();
        debug.log('🚀 클라이언트 사이드 메트릭 데이터 로드 완료');
      } catch (err) {
        debug.error('❌ 클라이언트 사이드 메트릭 로드 실패:', err);
      }
    };

    void loadInitialMetrics();
  }, []);

  useEffect(() => {
    if (
      isSystemStarted ||
      hasAutoStartedSystemRef.current ||
      !consumeDashboardDevEffect('dashboard-auto-start')
    ) {
      return;
    }
    hasAutoStartedSystemRef.current = true;
    debug.log('🚀 시스템이 종료된 상태입니다. 자동으로 시작합니다.');
    startSystem();
  }, [isSystemStarted, startSystem]);

  const toggleAgent = useCallback(() => {
    if (!canToggleAI && !isGuestFullAccess) {
      return;
    }

    if (!isAgentOpen) {
      void triggerAIWarmup('ai-sidebar-open');
    }

    toggleSidebar();
  }, [canToggleAI, isAgentOpen, isGuestFullAccess, toggleSidebar]);

  const closeAgent = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  const handleExtendSession = useCallback(() => {
    resetTimer();
    systemInactivityService.resumeSystem();
    debug.log('🔄 사용자가 세션을 연장했습니다 - 베르셀 사용량 최적화');
  }, [resetTimer]);

  const handleLogoutNow = useCallback(() => {
    void forceLogout();
    debug.log('🔒 사용자가 즉시 로그아웃을 선택했습니다');
  }, [forceLogout]);

  const handleStatsUpdate = useCallback(
    (stats: {
      total: number;
      online: number;
      warning: number;
      offline: number;
    }) => {
      setServerStats(stats);
    },
    []
  );

  const handleAskAIAboutAlert = useCallback(
    (context: DashboardAlertContext) => {
      if (!canToggleAI && !isGuestFullAccess) {
        return;
      }

      const metricLabel =
        context.metricLabel === 'CPU'
          ? 'CPU'
          : context.metricLabel === 'MEM'
            ? '메모리'
            : '디스크';
      const prompt =
        context.promptOverride ??
        `${context.serverName} 서버의 ${metricLabel} 사용률이 ${context.metricValue}%입니다. 현재 원인과 우선 조치 방법을 분석해줘.`;

      void triggerAIWarmup('dashboard-alert-prefill');
      openWithPrefill(prompt);
    },
    [canToggleAI, isGuestFullAccess, openWithPrefill]
  );

  return (
    <>
      <DashboardNavigation />
      <div className="flex min-h-0 flex-1 flex-col">
        <DashboardHeader onToggleAgent={toggleAgent} />

        <div className="flex-1 overflow-hidden pt-6">
          {deferDashboardContent ? (
            <ContentLoadingSkeleton />
          ) : (
            <Suspense fallback={<ContentLoadingSkeleton />}>
              {dashboardView === 'overview' ? (
                <DashboardContent
                  showSequentialGeneration={false}
                  servers={realServers}
                  allServers={allServers}
                  dataSlotInfo={initialTimeInfo}
                  dataSourceInfo={initialDataSourceInfo}
                  initialFocusServerId={initialFocusServerId}
                  totalServers={filteredTotal}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={changePageSize}
                  status={{ type: 'idle' }}
                  onStatsUpdate={handleStatsUpdate}
                  onShowSequentialChange={() => {}}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  onAskAIAboutAlert={
                    canToggleAI || isGuestFullAccess
                      ? handleAskAIAboutAlert
                      : undefined
                  }
                />
              ) : (
                <DashboardRoutedContent
                  view={dashboardView}
                  servers={realServers}
                  allServers={allServers}
                  dataSlotInfo={initialTimeInfo}
                  dataSourceInfo={initialDataSourceInfo}
                  initialFocusServerId={initialFocusServerId}
                  totalServers={filteredTotal}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={changePageSize}
                  onStatsUpdate={handleStatsUpdate}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  onAskAIAboutAlert={
                    canToggleAI || isGuestFullAccess
                      ? handleAskAIAboutAlert
                      : undefined
                  }
                />
              )}
            </Suspense>
          )}
        </div>

        {isMounted && (canToggleAI || isGuestFullAccess) && (
          <AnimatedAISidebar
            isOpen={isAgentOpen}
            onClose={closeAgent}
            userType={userType}
            queryAsOfDataSlot={aiQueryAsOfDataSlot}
          />
        )}

        <AutoLogoutWarning
          remainingTime={remainingTime}
          isWarning={isWarning}
          onExtendSession={handleExtendSession}
          onLogoutNow={handleLogoutNow}
        />
      </div>

      <NotificationToast />
    </>
  );
}
