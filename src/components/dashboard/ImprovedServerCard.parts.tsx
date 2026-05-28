import type { ReactNode } from 'react';
import { getThreshold } from '@/config/rules';
import type { Server as ServerType, Service } from '@/types/server';
import { formatMetricValue } from '@/utils/metric-formatters';
import { SvgSparkline } from '../shared/SvgSparkline';

interface MetricItemProps {
  type: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  history?: number[];
}

const METRIC_TREND_SAMPLE_SIZE = 5;
const METRIC_TREND_FLAT_THRESHOLD = 0.5;

type MetricTrendDirection = 'up' | 'down' | 'flat';

interface MetricTrend {
  accessibleLabel: string;
  displayLabel: string;
  direction: MetricTrendDirection;
  title: string;
}

function getMetricTrendClass(
  type: MetricItemProps['type'],
  direction: MetricTrendDirection
): string {
  if (direction === 'flat') {
    return 'text-slate-400';
  }

  if (direction === 'down') {
    return 'text-emerald-600';
  }

  return type === 'network' ? 'text-slate-500' : 'text-rose-600';
}

function calculateMetricTrend(
  label: string,
  value: number,
  history?: number[]
): MetricTrend {
  const baseline = (history ?? [])
    .slice(0, -1)
    .filter((point) => Number.isFinite(point))
    .slice(-METRIC_TREND_SAMPLE_SIZE);

  if (!Number.isFinite(value) || baseline.length === 0) {
    return {
      accessibleLabel: `${label} 추세 변화 없음`,
      displayLabel: '—',
      direction: 'flat',
      title: '비교 가능한 히스토리 없음',
    };
  }

  const average =
    baseline.reduce((sum, point) => sum + point, 0) / baseline.length;
  const delta = value - average;

  if (Math.abs(delta) < METRIC_TREND_FLAT_THRESHOLD) {
    return {
      accessibleLabel: `${label} 추세 변화 없음`,
      displayLabel: '—',
      direction: 'flat',
      title: `최근 ${baseline.length}개 평균 대비 변화 없음`,
    };
  }

  const direction: MetricTrendDirection = delta > 0 ? 'up' : 'down';
  const directionText = direction === 'up' ? '상승' : '하락';
  const symbol = direction === 'up' ? '↑' : '↓';
  const signedDelta = `${delta > 0 ? '+' : '-'}${Math.abs(delta).toFixed(1)}%`;
  const displayDelta = `${delta > 0 ? '+' : '-'}${Math.round(Math.abs(delta))}%`;

  return {
    accessibleLabel: `${label} 추세 ${directionText} ${signedDelta}`,
    displayLabel: `${symbol} ${displayDelta}`,
    direction,
    title: `최근 ${baseline.length}개 평균 ${average.toFixed(1)}% 대비 ${signedDelta}`,
  };
}

export const MetricItem = ({ type, value, history }: MetricItemProps) => {
  const labels = {
    cpu: 'CPU',
    memory: 'MEM',
    disk: 'Disk',
    network: 'Network',
  };

  const getMetricSeverity = (val: number) => {
    const threshold = getThreshold(type);

    if (val >= threshold.critical) {
      return {
        chartColor: '#ef4444',
        textClass: 'text-red-700 font-semibold',
        strokeWidth: 2.2,
      };
    }
    if (val >= threshold.warning) {
      return {
        chartColor: '#f97316',
        textClass: 'text-amber-700 font-medium',
        strokeWidth: 1.8,
      };
    }
    return {
      chartColor: '#10b981',
      textClass: 'text-slate-600 font-medium',
      strokeWidth: 1.2,
    };
  };

  const metricSeverity = getMetricSeverity(value);
  const metricTrend = calculateMetricTrend(labels[type], value, history);
  const metricTrendClass = getMetricTrendClass(type, metricTrend.direction);

  return (
    <div className="flex flex-col">
      <div className="mb-1 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs-plus font-medium tracking-wide text-gray-500">
            {labels[type]}
          </span>
          <span
            className={`text-sm tracking-tight tabular-nums transition-all duration-700 ease-in-out ${metricSeverity.textClass}`}
          >
            {formatMetricValue(type, value)}
          </span>
        </div>
        <span
          aria-label={metricTrend.accessibleLabel}
          className={`block h-3 text-right text-[10px] font-semibold leading-none tabular-nums ${metricTrendClass}`}
          role="img"
          title={metricTrend.title}
        >
          {metricTrend.displayLabel}
        </span>
      </div>
      <div className="flex h-12 w-full items-center justify-center">
        <SvgSparkline
          data={history && history.length > 1 ? history : [value, value]}
          width={72}
          height={42}
          color={metricSeverity.chartColor}
          fill
          strokeWidth={metricSeverity.strokeWidth}
          disableAnimation={false}
        />
      </div>
    </div>
  );
};

export const CompactMetricChip = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <div className="rounded-md border border-gray-200/80 bg-white/70 px-2 py-1 text-center">
    <div className="text-2xs font-medium tracking-wide text-gray-500">
      {label}
    </div>
    <div className="text-xs font-medium tabular-nums text-gray-800">
      {Math.round(value)}%
    </div>
  </div>
);

interface DetailRowProps {
  icon: ReactNode;
  label: string;
  value: string | number;
}

export const DetailRow = ({ icon, label, value }: DetailRowProps) => (
  <div className="flex items-center gap-1.5 rounded-md border border-gray-200/50 bg-slate-50 px-2 py-1.5">
    <div className="text-gray-500">{icon}</div>
    <div className="min-w-0">
      <div className="text-2xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="truncate text-xs font-medium text-gray-700">{value}</div>
    </div>
  </div>
);

const UPTIME_WINDOW_SECONDS = 24 * 60 * 60;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function parseUptimeSeconds(uptime: ServerType['uptime']): number | null {
  if (typeof uptime === 'number') {
    return Number.isFinite(uptime) && uptime >= 0 ? uptime : null;
  }

  const normalized = uptime.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const numericValue = Number.parseFloat(normalized);
  if (/^\d+(\.\d+)?$/.test(normalized) && Number.isFinite(numericValue)) {
    return numericValue;
  }

  const days = Number.parseFloat(
    normalized.match(/(\d+(?:\.\d+)?)\s*(?:d|day|days|일)/)?.[1] ?? '0'
  );
  const hours = Number.parseFloat(
    normalized.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|시간)/)?.[1] ??
      '0'
  );
  const minutes = Number.parseFloat(
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes|분)/
    )?.[1] ?? '0'
  );

  const seconds = days * 86400 + hours * 3600 + minutes * 60;
  return seconds > 0 ? seconds : null;
}

function formatUptimePercent(server: ServerType): string {
  if (
    typeof server.uptimePercent === 'number' &&
    Number.isFinite(server.uptimePercent)
  ) {
    return `${clampPercent(server.uptimePercent).toFixed(1)}%`;
  }

  const uptimeSeconds = parseUptimeSeconds(server.uptime);
  if (uptimeSeconds === null) {
    return '—';
  }

  const uptimePercent = clampPercent(
    (uptimeSeconds / UPTIME_WINDOW_SECONDS) * 100
  );
  return `${uptimePercent.toFixed(1)}%`;
}

export const SecondaryMetrics = ({
  server,
  compact = false,
}: {
  server: ServerType;
  compact?: boolean;
}) => {
  const hasLoad = server.load1 !== undefined && server.cpuCores !== undefined;
  const hasResponse =
    server.responseTime !== undefined && server.responseTime > 0;
  const uptimePercentLabel = formatUptimePercent(server);

  if (!hasLoad && !hasResponse && compact) {
    return null;
  }

  const loadPercent =
    hasLoad && server.cpuCores ? (server.load1! / server.cpuCores) * 100 : 0;
  const loadColor = loadPercent >= 70 ? 'text-amber-600' : 'text-gray-500';

  const respMs = server.responseTime ?? 0;
  const respColor =
    respMs >= 5000
      ? 'text-red-500'
      : respMs >= 2000
        ? 'text-amber-600'
        : 'text-gray-500';

  return (
    <div
      className={`mt-2 items-center gap-3 border-t border-gray-200/50 pt-2 text-xs ${compact ? 'hidden sm:flex' : 'flex flex-wrap'}`}
    >
      {hasLoad && (
        <span
          className={loadColor}
          title={`Load Average (1분): ${server.load1?.toFixed(2)} / ${server.cpuCores} cores`}
        >
          Load: {server.load1?.toFixed(1)}/{server.cpuCores}
        </span>
      )}
      {hasResponse && (
        <span className={respColor} title={`응답 시간: ${respMs}ms`}>
          Resp:{' '}
          {respMs >= 1000 ? `${(respMs / 1000).toFixed(1)}s` : `${respMs}ms`}
        </span>
      )}
      {!compact && (
        <span
          className="inline-flex items-center gap-1 text-gray-500"
          title={`최근 24시간 가동률: ${uptimePercentLabel}`}
        >
          <span>가동률</span>
          <span className="font-medium tabular-nums text-gray-700">
            {uptimePercentLabel} / 24h
          </span>
        </span>
      )}
    </div>
  );
};

export const ServiceChip = ({ service }: { service: Service }) => {
  const statusColors =
    service.status === 'running'
      ? 'border-emerald-400/50 bg-emerald-100/80 text-emerald-700'
      : service.status === 'stopped'
        ? 'border-red-400/50 bg-red-100/80 text-red-700'
        : 'border-amber-400/50 bg-amber-100/80 text-amber-700';

  const dotColor =
    service.status === 'running'
      ? 'bg-emerald-500'
      : service.status === 'stopped'
        ? 'bg-red-500'
        : 'bg-amber-500';

  return (
    <div
      className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs-plus font-medium backdrop-blur-sm ${statusColors}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span>{service.name}</span>
    </div>
  );
};
