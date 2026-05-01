'use client';

import {
  Activity,
  ArrowLeft,
  BarChart3,
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

function formatServerType(type: string): string {
  return SERVER_TYPE_LABELS[type.toLowerCase()] ?? type;
}

export default function ServerDetailView({ server }: ServerDetailViewProps) {
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
  const currentMetrics = useMemo(
    () =>
      metricsHistory.length > 0
        ? metricsHistory[metricsHistory.length - 1]
        : undefined,
    [metricsHistory]
  );

  const realtimeData: RealtimeData = useMemo(() => {
    if (!safeServer) {
      return { cpu: [], memory: [], disk: [], network: [], logs: [] };
    }

    return {
      cpu: metricsHistory.map((h) => h.cpu),
      memory: metricsHistory.map((h) => h.memory),
      disk: metricsHistory.map((h) => h.disk),
      network: metricsHistory.map((h) =>
        typeof h.network === 'number' ? h.network : 0
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

  return (
    <div className="min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-linear-to-r from-slate-50 to-gray-100 p-4 sm:p-6">
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
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-400">
              서버 상세
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold text-slate-900">
              {safeServer.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {formatServerType(safeServer.type)} · {safeServer.location}
            </p>
          </div>

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

        <ServerModalTabNav
          tabs={tabs}
          selectedTab={selectedTab}
          onTabSelect={setSelectedTab}
        />
      </div>

      <div
        key={selectedTab}
        id={`panel-${selectedTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${selectedTab}`}
        className="bg-linear-to-br from-gray-50 to-white p-4 sm:p-6"
      >
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            <OverviewTab
              server={safeServer}
              statusTheme={getStatusTheme(safeServer.status)}
            />
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                핵심 성능 지표
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['CPU', safeServer.cpu],
                  ['Memory', safeServer.memory],
                  ['Disk', safeServer.disk],
                  ['Services', safeServer.services?.length || 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center"
                  >
                    <div className="text-2xl font-bold text-slate-900">
                      {label === 'Services'
                        ? value
                        : `${Math.round(Number(value))}%`}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-gray-500">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'metrics' && (
          <div className="space-y-6">
            <MetricsTab
              server={safeServer}
              realtimeData={realtimeData}
              isRealtime={isRealtime}
              onToggleRealtime={() => setIsRealtime((prev) => !prev)}
            />
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Cpu className="h-5 w-5 text-emerald-600" />
                서비스 목록
              </h2>
              <ProcessesTab services={safeServer.services} />
            </div>
          </div>
        )}

        {selectedTab === 'logs' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <FileText className="h-5 w-5 text-blue-600" />
                시스템 로그
              </h2>
              <LogsTab
                key={safeServer.id}
                serverId={safeServer.id}
                serverMetrics={{
                  cpu: currentMetrics?.cpu ?? safeServer.cpu,
                  memory: currentMetrics?.memory ?? safeServer.memory,
                  disk: currentMetrics?.disk ?? safeServer.disk,
                  network:
                    (typeof currentMetrics?.network === 'number'
                      ? currentMetrics.network
                      : null) ??
                    safeServer.network ??
                    0,
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

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Network className="h-5 w-5 text-purple-600" />
                네트워크 상태
              </h2>
              <NetworkTab server={safeServer} realtimeData={realtimeData} />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
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
