import type { ReactNode } from 'react';
import type { Server as ServerType, Service } from '@/types/server';
import { formatMetricValue } from '@/utils/metric-formatters';
import { MiniLineChart } from '../shared/MiniLineChart';

interface MetricItemProps {
  type: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  history?: number[];
}

export const MetricItem = ({ type, value, history }: MetricItemProps) => {
  const labels = {
    cpu: 'CPU',
    memory: 'Memory',
    disk: 'Disk',
    network: 'Network',
  };

  const getSeverityColor = (val: number) => {
    if (type === 'network') {
      if (val >= 85) return '#ef4444';
      if (val >= 70) return '#f97316';
      return '#10b981';
    }

    if (val >= 90) return '#ef4444';
    if (val >= 80) return '#f97316';
    return '#10b981';
  };

  const metricColor = getSeverityColor(value);

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs-plus font-medium tracking-wide text-gray-500">
          {labels[type]}
        </span>
        <span
          className="text-sm font-bold tracking-tight tabular-nums transition-all duration-700 ease-in-out"
          style={{ color: metricColor }}
        >
          {formatMetricValue(type, value)}
        </span>
      </div>
      <div className="flex h-12 w-full items-center justify-center">
        <MiniLineChart
          data={history && history.length > 1 ? history : [value, value]}
          width={72}
          height={40}
          color={metricColor}
          fill
          strokeWidth={1.5}
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
    <div className="text-2xs font-semibold tracking-wide text-gray-500">
      {label}
    </div>
    <div className="text-xs font-bold tabular-nums text-gray-800">
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
  <div className="flex items-center gap-1.5 rounded-md border border-gray-200/50 bg-black/5 px-2 py-1.5">
    <div className="text-gray-500">{icon}</div>
    <div className="min-w-0">
      <div className="text-2xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="truncate text-xs font-medium text-gray-700">{value}</div>
    </div>
  </div>
);

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

  if (!hasLoad && !hasResponse) {
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
      className={`mt-2 items-center gap-3 border-t border-gray-200/50 pt-2 text-xs ${compact ? 'hidden sm:flex' : 'flex'}`}
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
