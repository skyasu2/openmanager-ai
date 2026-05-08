'use client';

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  Cpu,
  FileText,
  Network,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useServerMetrics } from '@/hooks/useServerMetrics';
import type { Server } from '@/types/server';
import { LogsTab } from './EnhancedServerModal.LogsTab';
import { MetricsTab } from './EnhancedServerModal.MetricsTab';
import { NetworkTab } from './EnhancedServerModal.NetworkTab';
import { OverviewTab } from './EnhancedServerModal.OverviewTab';
import { ProcessesTab } from './EnhancedServerModal.ProcessesTab';
import type { RealtimeData, TabId, TabInfo } from './EnhancedServerModal.types';
import {
  getStatusTheme,
  normalizeServerData,
} from './EnhancedServerModal.utils';
import { ServerModalTabNav } from './ServerModalTabNav';

interface ServerDetailViewProps {
  server: Server | null;
  onAskAI?: (server: Server) => void;
}

const tabs: TabInfo[] = [
  { id: 'overview', label: '종합 상황', icon: Activity },
  { id: 'metrics', label: '성능 분석', icon: BarChart3 },
  { id: 'logs', label: '로그 & 네트워크', icon: FileText },
];

const SERVER_TYPE_LABELS: Record<string, string> = {
  web: 'Web',
  application: 'Application',
  database: 'Database',
  cache: 'Cache',
  storage: 'Storage',
  'load-balancer': 'Load Balancer',
  loadbalancer: 'Load Balancer',
  monitoring: 'Monitoring',
  security: 'Security',
  backup: 'Backup',
  queue: 'Queue',
  log: 'Log',
  app: 'App',
  unknown: '타입 미확인',
};

const SERVER_STATUS_BADGES: Record<
  string,
  { label: string; className: string; dotClassName: string }
> = {
  critical: {
    label: '위험',
    className: 'border-red-200 bg-red-50 text-red-700',
    dotClassName: 'bg-red-500',
  },
  warning: {
    label: '주의',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClassName: 'bg-amber-500',
  },
  online: {
    label: '정상',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },
  offline: {
    label: '오프라인',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    dotClassName: 'bg-slate-400',
  },
  maintenance: {
    label: '점검',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    dotClassName: 'bg-blue-500',
  },
};
const DEFAULT_STATUS_BADGE = {
  label: '정상',
  className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  dotClassName: 'bg-emerald-500',
};

function formatServerType(type: string): string {
  return SERVER_TYPE_LABELS[type.toLowerCase()] ?? type;
}

function withCurrentMetricPoint(
  values: number[],
  currentValue: number | undefined
): number[] {
  if (typeof currentValue !== 'number' || !Number.isFinite(currentValue)) {
    return values;
  }

  if (values.length === 0) {
    return [currentValue];
  }

  return [...values.slice(0, -1), currentValue];
}

export default function ServerDetailView({
  server,
  onAskAI,
}: ServerDetailViewProps) {
  const [selectedTab, setSelectedTab] = useState<TabId>('overview');
  const [isRealtime, setIsRealtime] = useState(true);
  const { metricsHistory, loadMetricsHistory } = useServerMetrics();

  useEffect(() => {
    if (server?.id) {
      loadMetricsHistory(server.id, '24h');
    }
  }, [loadMetricsHistory, server?.id]);

  const safeServer = useMemo(
    () => (server ? normalizeServerData(server) : null),
    [server]
  );
  const logTimestamp = useMemo(() => new Date().toISOString(), []);

  const realtimeData: RealtimeData = useMemo(() => {
    if (!safeServer) {
      return { cpu: [], memory: [], disk: [], network: [], logs: [] };
    }

    return {
      cpu: withCurrentMetricPoint(
        metricsHistory.map((h) => h.cpu),
        safeServer.cpu
      ),
      memory: withCurrentMetricPoint(
        metricsHistory.map((h) => h.memory),
        safeServer.memory
      ),
      disk: withCurrentMetricPoint(
        metricsHistory.map((h) => h.disk),
        safeServer.disk
      ),
      network: withCurrentMetricPoint(
        metricsHistory.map((h) =>
          typeof h.network === 'number' ? h.network : 0
        ),
        safeServer.network
      ),
      logs: (() => {
        const serverLogs = server?.logs;
        if (serverLogs && serverLogs.length > 0) {
          const alerts = serverLogs
            .filter((log) => log.level === 'WARN' || log.level === 'ERROR')
            .map((log) => ({
              timestamp: log.timestamp || logTimestamp,
              level: log.level.toLowerCase() as 'warn' | 'error',
              message: log.message,
              source: 'syslog',
            }));

          if (alerts.length > 0) return alerts;
        }

        return [
          {
            timestamp: logTimestamp,
            level: 'info' as const,
            message: '모든 시스템 지표가 정상 범위 내에 있습니다.',
            source: 'system',
          },
        ];
      })(),
    };
  }, [logTimestamp, metricsHistory, safeServer, server?.logs]);

  if (!safeServer) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          서버 정보를 찾을 수 없습니다.
        </p>
        <Link
          href="/dashboard/servers"
          className="mt-4 inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          서버 목록으로 이동
        </Link>
      </div>
    );
  }

  const lastUpdateTime = safeServer.lastUpdate.toLocaleTimeString('en-US', {
    hour12: false,
  });
  const statusBadge =
    SERVER_STATUS_BADGES[safeServer.status] ?? DEFAULT_STATUS_BADGE;
  const canAskAI =
    typeof onAskAI === 'function' &&
    (safeServer.status === 'warning' || safeServer.status === 'critical');

  return (
    <div className="min-h-0 min-w-0 space-y-4">
      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="mb-4">
          <Link
            href="/dashboard/servers"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            서버 목록
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase text-slate-400">
                서버 상세
              </p>
              <span
                className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold ${statusBadge.className}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${statusBadge.dotClassName}`}
                />
                {statusBadge.label}
              </span>
            </div>
            <h1 className="mt-1 truncate text-2xl font-bold text-slate-900">
              {safeServer.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {formatServerType(safeServer.type)} · {safeServer.location}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canAskAI && server && (
              <button
                type="button"
                onClick={() => onAskAI(server)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Bot className="h-4 w-4" aria-hidden="true" />
                AI에게 물어보기
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsRealtime((prev) => !prev)}
              className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${
                isRealtime
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {isRealtime ? 'Live' : 'Paused'}
              {isRealtime && (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <ServerModalTabNav
            tabs={tabs}
            selectedTab={selectedTab}
            onTabSelect={setSelectedTab}
          />
        </div>
      </section>

      <div
        key={selectedTab}
        id={`panel-${selectedTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${selectedTab}`}
        className="min-w-0 overflow-hidden"
      >
        {selectedTab === 'overview' && (
          <div className="min-w-0 space-y-5">
            <OverviewTab
              server={safeServer}
              statusTheme={getStatusTheme(safeServer.status)}
            />
          </div>
        )}

        {selectedTab === 'metrics' && (
          <div className="min-w-0 space-y-5">
            <MetricsTab
              server={safeServer}
              realtimeData={realtimeData}
              isRealtime={isRealtime}
              onToggleRealtime={() => setIsRealtime((prev) => !prev)}
            />
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Cpu className="h-5 w-5 text-emerald-600" />
                서비스 목록
              </h2>
              <ProcessesTab services={safeServer.services} />
            </div>
          </div>
        )}

        {selectedTab === 'logs' && (
          <div className="min-w-0 space-y-5">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <FileText className="h-5 w-5 text-blue-600" />
                시스템 로그
              </h2>
              <LogsTab
                key={safeServer.id}
                serverId={safeServer.id}
                serverMetrics={{
                  cpu: safeServer.cpu,
                  memory: safeServer.memory,
                  disk: safeServer.disk,
                  network: safeServer.network ?? 0,
                }}
                realtimeData={realtimeData}
                serverContext={{
                  hostname: safeServer.hostname || safeServer.id,
                  environment: safeServer.environment || 'production',
                  datacenter: safeServer.location || 'DC1-AZ1',
                  serverType: safeServer.type || 'web',
                }}
                serverLogs={server?.logs}
                structuredLogs={server?.structuredLogs}
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Network className="h-5 w-5 text-purple-600" />
                네트워크 상태
              </h2>
              <NetworkTab server={safeServer} realtimeData={realtimeData} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span className="font-medium capitalize text-slate-700">
            {safeServer.status}
          </span>
          <span className="font-mono">LAST UPDATE: {lastUpdateTime}</span>
        </div>
      </div>
    </div>
  );
}
