import type { MonitoringAlert } from '@/schemas/api.monitoring-report.schema';
import type { Alert } from '@/services/monitoring/AlertManager';
import type { Server } from '@/types/server';

export type DashboardAlertMetricLabel = 'CPU' | 'MEM' | 'DISK';

export interface DashboardAlertContext {
  serverId: string;
  serverName: string;
  metricLabel: DashboardAlertMetricLabel;
  metricValue: number;
  promptOverride?: string;
}

export function getDashboardAlertMetricLabel(
  metric: string
): DashboardAlertMetricLabel | null {
  const normalized = metric.toLowerCase();

  if (normalized.includes('cpu')) return 'CPU';
  if (normalized.includes('memory')) return 'MEM';
  if (normalized.includes('disk') || normalized.includes('filesystem')) {
    return 'DISK';
  }

  return null;
}

export function supportsDashboardAlertAIPrefill(metric: string): boolean {
  return getDashboardAlertMetricLabel(metric) !== null;
}

export function getHighestServerAlertMetric(
  server: Pick<Server, 'cpu' | 'memory' | 'disk'>
): {
  metricLabel: DashboardAlertMetricLabel;
  metricValue: number;
} {
  const metrics: Array<{
    metricLabel: DashboardAlertMetricLabel;
    metricValue: number;
  }> = [
    { metricLabel: 'CPU', metricValue: Number(server.cpu ?? 0) },
    { metricLabel: 'MEM', metricValue: Number(server.memory ?? 0) },
    { metricLabel: 'DISK', metricValue: Number(server.disk ?? 0) },
  ];

  return metrics.reduce((best, current) =>
    current.metricValue > best.metricValue ? current : best
  );
}

export function toDashboardAlertContext(
  alert: Pick<MonitoringAlert, 'serverId' | 'instance' | 'metric' | 'value'> &
    Partial<Pick<Alert, 'state'>>
): DashboardAlertContext | null {
  const metricLabel = getDashboardAlertMetricLabel(alert.metric);
  if (!metricLabel) {
    return null;
  }

  const context: DashboardAlertContext = {
    serverId: alert.serverId,
    serverName: alert.instance,
    metricLabel,
    metricValue: Math.round(alert.value),
  };

  if (alert.state === 'resolved') {
    const metricKoreanLabel =
      metricLabel === 'CPU'
        ? 'CPU'
        : metricLabel === 'MEM'
          ? '메모리'
          : '디스크';
    context.promptOverride = `${alert.instance} 서버에서 ${metricKoreanLabel} 사용률이 ${Math.round(alert.value)}%까지 상승했다가 해소된 알림 이력이 있습니다. 발생 원인과 재발 방지 조치를 분석해줘.`;
  }

  return context;
}
