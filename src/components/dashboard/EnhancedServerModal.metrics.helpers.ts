import type { AnomalyDataPoint } from '@/hooks/useTimeSeriesMetrics';
import type {
  ChartData,
  RealtimeData,
  ServerData,
} from './EnhancedServerModal.types';
import { getMetricColorByStatus } from './EnhancedServerModal.utils';

interface MetricDescriptor {
  value: number;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  label: string;
  icon: string;
  data: number[];
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function toChartData(
  status: ServerData['status'],
  descriptor: MetricDescriptor
): ChartData {
  const color = getMetricColorByStatus(
    descriptor.value,
    descriptor.metric,
    status
  );
  return {
    data: descriptor.data,
    color: color.color,
    label: descriptor.label,
    icon: descriptor.icon,
    gradient: color.gradient,
  };
}

export function buildMetricsChartConfigs(
  server: ServerData,
  realtimeData: RealtimeData
): ChartData[] {
  const descriptors: MetricDescriptor[] = [
    {
      value: server.cpu,
      metric: 'cpu',
      label: 'CPU 사용률',
      icon: '🔥',
      data: realtimeData.cpu,
    },
    {
      value: server.memory,
      metric: 'memory',
      label: '메모리 사용률',
      icon: '💾',
      data: realtimeData.memory,
    },
    {
      value: server.disk,
      metric: 'disk',
      label: '디스크 사용률',
      icon: '💿',
      data: realtimeData.disk,
    },
    {
      value: server.network ?? 0,
      metric: 'network',
      label: '네트워크 사용률',
      icon: '🌐',
      data: realtimeData.network.map(clampPercentage),
    },
  ];

  return descriptors.map((descriptor) =>
    toChartData(server.status, descriptor)
  );
}

export function getMetricSummary(data: number[]): {
  currentValue: number;
  avgValue: number;
} {
  const currentValue = data[data.length - 1] ?? 0;
  const avgValue =
    data.length > 0
      ? data.reduce((sum, value) => sum + value, 0) / data.length
      : 0;
  return { currentValue, avgValue };
}

export function getAnomalySeverityBadgeClass(
  severity: AnomalyDataPoint['severity']
): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-700';
    case 'high':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-yellow-100 text-yellow-700';
  }
}
