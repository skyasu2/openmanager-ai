import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { getThreshold } from '@/config/rules';
import { METRIC_SEVERITY_COLORS } from '@/styles/design-constants';
import type { Server } from '@/types/server';

interface SystemOverviewSectionProps {
  servers: Server[];
}

function getHighestResourceMetric(server: Server): {
  metricKey: 'cpu' | 'memory' | 'disk';
  metricLabel: 'CPU' | 'MEM' | 'DISK';
  metricValue: number;
} {
  const metrics = [
    {
      metricKey: 'cpu' as const,
      metricLabel: 'CPU' as const,
      metricValue: server.cpu ?? 0,
    },
    {
      metricKey: 'memory' as const,
      metricLabel: 'MEM' as const,
      metricValue: server.memory ?? 0,
    },
    {
      metricKey: 'disk' as const,
      metricLabel: 'DISK' as const,
      metricValue: server.disk ?? 0,
    },
  ];

  return metrics.reduce((highest, current) =>
    current.metricValue > highest.metricValue ? current : highest
  );
}

function getResourceSeverity(
  metricKey: 'cpu' | 'memory' | 'disk',
  metricValue: number
): 'normal' | 'warning' | 'critical' {
  const threshold = getThreshold(metricKey);
  if (metricValue >= threshold.critical) return 'critical';
  if (metricValue >= threshold.warning) return 'warning';
  return 'normal';
}

export function SystemOverviewSection({ servers }: SystemOverviewSectionProps) {
  const router = useRouter();

  const averages = useMemo(() => {
    if (!servers || servers.length === 0) {
      return { cpu: 0, memory: 0, disk: 0 };
    }
    const activeServers = servers.filter(
      (server) => server.status !== 'offline'
    );
    const averageSource = activeServers.length > 0 ? activeServers : servers;
    const sum = averageSource.reduce(
      (acc, s) => ({
        cpu: acc.cpu + (s.cpu ?? 0),
        memory: acc.memory + (s.memory ?? 0),
        disk: acc.disk + (s.disk ?? 0),
      }),
      { cpu: 0, memory: 0, disk: 0 }
    );
    const count = averageSource.length;
    return {
      cpu: Math.round(sum.cpu / count),
      memory: Math.round(sum.memory / count),
      disk: Math.round(sum.disk / count),
    };
  }, [servers]);

  const topAlerts = useMemo(() => {
    if (!servers || servers.length === 0) return [];
    return [...servers]
      .map((s) => {
        const top = getHighestResourceMetric(s);
        return {
          id: s.id ?? s.name,
          name: s.name,
          maxUsage: top.metricValue,
          maxMetricKey: top.metricKey,
          maxMetric: top.metricLabel,
          status: s.status,
        };
      })
      .sort((a, b) => b.maxUsage - a.maxUsage)
      .slice(0, 5);
  }, [servers]);

  const gauges: {
    key: 'cpu' | 'memory' | 'disk';
    label: string;
    value: number;
  }[] = [
    { key: 'cpu', label: 'CPU', value: averages.cpu },
    { key: 'memory', label: 'Memory', value: averages.memory },
    { key: 'disk', label: 'Disk', value: averages.disk },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 좌: 시스템 리소스 평균 게이지 */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            시스템 리소스
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-evenly sm:gap-2 px-2 sm:px-0">
            {gauges.map((g) => {
              const severity = getResourceSeverity(g.key, g.value);
              return (
                <MiniGauge
                  key={g.key}
                  value={g.value}
                  label={g.label}
                  color={METRIC_SEVERITY_COLORS[severity]}
                />
              );
            })}
          </div>
        </div>

        {/* 우: 주요 경고 Top 5 */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            리소스 경고 (Top 5)
          </p>
          <div className="space-y-0">
            {topAlerts.map((alert, idx) => {
              const severity = getResourceSeverity(
                alert.maxMetricKey,
                alert.maxUsage
              );
              const isWarning = severity === 'warning';
              const isCritical = severity === 'critical';
              return (
                <button
                  type="button"
                  key={alert.id}
                  onClick={() =>
                    router.push(
                      `/dashboard/servers/${encodeURIComponent(alert.id)}`
                    )
                  }
                  className={`flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-2 py-2 transition-colors hover:bg-slate-50 ${
                    idx < topAlerts.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <span
                    className="truncate text-sm text-slate-700"
                    title={alert.name}
                  >
                    {alert.name}
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      isCritical
                        ? 'bg-red-50 text-red-700'
                        : isWarning
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {alert.maxMetric} {alert.maxUsage}%
                  </span>
                </button>
              );
            })}
            {topAlerts.length === 0 && (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                경고 없음
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniGauge({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const size = 72;
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(100, value));
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90 transform"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-semibold tabular-nums text-gray-900">
            {value}%
          </span>
        </div>
      </div>
      <span className="mt-1.5 text-xs text-slate-500">{label}</span>
    </div>
  );
}
