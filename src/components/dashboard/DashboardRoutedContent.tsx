'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMonitoringReport } from '@/hooks/dashboard/useMonitoringReport';
import type {
  DashboardDataSourceInfo,
  DashboardTimeInfo,
} from '@/lib/dashboard/server-data';
import type { MonitoringAlert } from '@/schemas/api.monitoring-report.schema';
import type { Alert } from '@/services/monitoring/AlertManager';
import type { Server } from '@/types/server';
import { safeErrorMessage } from '@/utils/utils-functions';
import { ActiveAlertsPanel } from './ActiveAlertsModal';
import {
  type DashboardAlertContext,
  getHighestServerAlertMetric,
  toDashboardAlertContext,
} from './alert-ai-context';
import { AlertHistoryPanel } from './alert-history/AlertHistoryModal';
import { LogExplorerPanel } from './log-explorer/LogExplorerModal';
import ServerDashboard from './ServerDashboard';
import ServerDetailView from './ServerDetailView';
import { TopologyView } from './TopologyModal';
import type { DashboardStats } from './types/dashboard.types';
import type { DashboardView } from './types/dashboard-view.types';

const AIWorkspace = dynamic(() => import('@/components/ai/AIWorkspace'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500">
      AI 어시스턴트 로딩 중...
    </div>
  ),
});

interface DashboardRoutedContentProps {
  view: DashboardView;
  servers: Server[];
  allServers?: Server[];
  dataSlotInfo?: DashboardTimeInfo;
  dataSourceInfo?: DashboardDataSourceInfo | null;
  initialFocusServerId?: string | null;
  totalServers: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onStatsUpdate: (stats: DashboardStats) => void;
  statusFilter?: string | null;
  onStatusFilterChange?: (filter: string | null) => void;
  onAskAIAboutAlert?: (context: DashboardAlertContext) => void;
}

function PageFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="h-full w-full overflow-y-auto overscroll-contain px-4 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-none space-y-4 2xl:max-w-[1800px]">
        <div className="pt-1">
          <h1 className="text-2xl font-bold tracking-normal text-slate-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export default function DashboardRoutedContent({
  view,
  servers,
  allServers,
  dataSlotInfo: _dataSlotInfo,
  dataSourceInfo: _dataSourceInfo,
  initialFocusServerId,
  totalServers,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onStatsUpdate,
  statusFilter: _statusFilter,
  onStatusFilterChange: _onStatusFilterChange,
  onAskAIAboutAlert,
}: DashboardRoutedContentProps) {
  const searchParams = useSearchParams();
  const initialLogServerId =
    view === 'logs'
      ? (searchParams.get('server') ?? searchParams.get('serverId'))
      : null;
  const initialAlertServerId =
    view === 'alerts'
      ? (searchParams.get('server') ?? searchParams.get('serverId'))
      : null;

  const sourceServers = allServers?.length ? allServers : servers;
  const {
    data: monitoringReport,
    error: monitoringError,
    isLoading: isMonitoringLoading,
    isError: isMonitoringError,
  } = useMonitoringReport();
  const monitoringErrorMessage = isMonitoringError
    ? safeErrorMessage(
        monitoringError,
        '모니터링 리포트를 불러오지 못했습니다.'
      )
    : null;

  const askAIAboutMonitoringAlert = (alert: MonitoringAlert) => {
    if (!onAskAIAboutAlert) return;
    const context = toDashboardAlertContext(alert);
    if (context) onAskAIAboutAlert(context);
  };

  const askAIAboutAlertHistory = (alert: Alert) => {
    if (!onAskAIAboutAlert) return;
    const context = toDashboardAlertContext(alert);
    if (context) onAskAIAboutAlert(context);
  };

  const askAIAboutServer = (server: Server) => {
    if (!onAskAIAboutAlert) return;
    const { metricLabel, metricValue } = getHighestServerAlertMetric(server);
    onAskAIAboutAlert({
      serverId: server.id ?? server.name,
      serverName: server.name,
      metricLabel,
      metricValue: Math.round(metricValue),
    });
  };

  if (view === 'servers') {
    return (
      <PageFrame
        title="서버"
        description="18대 관측 서버 상태, 리소스 사용률, 더 보기 목록"
      >
        <ServerDashboard
          servers={servers}
          totalServers={totalServers}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onStatsUpdate={onStatsUpdate}
          onAskAI={onAskAIAboutAlert ? askAIAboutServer : undefined}
          initialVisibleRows={3}
        />
      </PageFrame>
    );
  }

  if (view === 'server-detail') {
    const server =
      sourceServers.find(
        (item) => (item.id ?? item.name) === initialFocusServerId
      ) ?? null;

    return (
      <PageFrame
        title="서버 상세"
        description="서버별 메트릭, 로그, 네트워크 상태를 직접 URL에서 확인"
      >
        <ServerDetailView server={server} />
      </PageFrame>
    );
  }

  if (view === 'alerts') {
    return (
      <PageFrame
        title="알림"
        description="현재 활성 알림과 firing/resolved 이력"
      >
        {monitoringErrorMessage && (
          <div className="rounded-lg border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-xs text-amber-800">
            모니터링 리포트 조회 실패: {monitoringErrorMessage}
          </div>
        )}
        <section className="grid min-h-[620px] grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,1fr)]">
          <div className="flex min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ActiveAlertsPanel
              alerts={monitoringReport?.firingAlerts ?? []}
              isLoading={isMonitoringLoading}
              isError={isMonitoringError}
              errorMessage={monitoringErrorMessage}
              onAskAIAboutAlert={
                onAskAIAboutAlert ? askAIAboutMonitoringAlert : undefined
              }
            />
          </div>
          <div className="flex min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <AlertHistoryPanel
              serverIds={sourceServers.map((server) => server.id)}
              onAskAIAboutAlert={
                onAskAIAboutAlert ? askAIAboutAlertHistory : undefined
              }
              initialServerId={initialAlertServerId}
            />
          </div>
        </section>
      </PageFrame>
    );
  }

  if (view === 'logs') {
    return (
      <PageFrame
        title="로그"
        description="24시간 OTel 로그 통합 검색과 레벨/소스/서버 필터"
      >
        <div className="flex min-h-[680px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <LogExplorerPanel initialServerId={initialLogServerId} />
        </div>
      </PageFrame>
    );
  }

  if (view === 'topology') {
    return (
      <PageFrame
        title="토폴로지"
        description="18대 관측 서버의 계층 구조와 의존성 흐름"
      >
        <TopologyView servers={sourceServers} />
      </PageFrame>
    );
  }

  if (view === 'ai-assistant') {
    return (
      <PageFrame
        title="AI 어시스턴트"
        description="질의, Reporter, Analyst 기능을 한 화면에서 실행"
      >
        <div className="min-h-[680px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <AIWorkspace embedded />
        </div>
      </PageFrame>
    );
  }

  return null;
}
