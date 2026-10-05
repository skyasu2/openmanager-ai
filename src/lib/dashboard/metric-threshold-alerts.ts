import { getStatus, getThreshold } from '@/config/rules';

export const METRIC_THRESHOLD_ALERT_KEYS = [
  'cpu',
  'memory',
  'disk',
  'network',
] as const;

export type MetricAlertKey = (typeof METRIC_THRESHOLD_ALERT_KEYS)[number];

export type ServerMetricSnapshot = {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
};

export type MetricThresholdAlert = {
  metric: MetricAlertKey;
  label: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
};

export type DetailAlertLog = {
  timestamp: string;
  level: 'warn' | 'error';
  message: string;
  source: 'threshold' | 'syslog';
};

export type WarningServerLog = {
  timestamp?: string;
  level: string;
  message: string;
};

const METRIC_THRESHOLD_ALERT_LABELS: Record<MetricAlertKey, string> = {
  cpu: 'CPU',
  memory: '메모리',
  disk: '디스크',
  network: '네트워크',
};

export function listMetricThresholdAlerts(
  metrics: ServerMetricSnapshot
): MetricThresholdAlert[] {
  const alerts: MetricThresholdAlert[] = [];

  for (const key of METRIC_THRESHOLD_ALERT_KEYS) {
    const value = metrics[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;

    const status = getStatus(key, value);
    if (status === 'normal') continue;

    const thresholds = getThreshold(key);
    const threshold =
      status === 'critical' ? thresholds.critical : thresholds.warning;
    const label = METRIC_THRESHOLD_ALERT_LABELS[key];
    const severityLabel = status === 'critical' ? '위험' : '경고';

    alerts.push({
      metric: key,
      label,
      value,
      threshold,
      severity: status,
      message: `${label} ${Math.round(value)}% (${severityLabel} 임계값 ${threshold}%)`,
    });
  }

  return alerts;
}

export function countMetricThresholdAlerts(
  metrics: ServerMetricSnapshot
): number {
  return listMetricThresholdAlerts(metrics).length;
}

export function buildDetailAlertLogs({
  metrics,
  serverLogs,
  timestamp,
}: {
  metrics: ServerMetricSnapshot;
  serverLogs?: WarningServerLog[];
  timestamp: string;
}): DetailAlertLog[] {
  const thresholdLogs: DetailAlertLog[] = listMetricThresholdAlerts(
    metrics
  ).map((alert) => ({
    timestamp,
    level: alert.severity === 'critical' ? 'error' : 'warn',
    message: alert.message,
    source: 'threshold',
  }));

  const warningLogs: DetailAlertLog[] = (serverLogs ?? [])
    .filter((log) => log.level === 'WARN' || log.level === 'ERROR')
    .map((log) => ({
      timestamp: log.timestamp || timestamp,
      level: log.level === 'ERROR' ? 'error' : 'warn',
      message: log.message,
      source: 'syslog',
    }));

  return [...thresholdLogs, ...warningLogs];
}
