import { STATUS_THRESHOLDS } from '../config/status-thresholds';
import type { normalizeQueryAsOf } from '../data/query-as-of-context';
import { getTrendPredictor } from '../lib/ai/monitoring/TrendPredictor';
import { MAX_PREDICTION_HORIZON } from '../lib/ai/monitoring/TrendPredictor.types';
import { logger } from '../lib/logger';
import type {
  MonitoringCapacityAlert,
  MonitoringDataSource,
  MonitoringEvidenceRef,
  MonitoringFactMetric,
  MonitoringSnapshot,
} from '../services/monitoring/monitoring-data-source';

const CAPACITY_ALERT_METRICS: MonitoringFactMetric[] = [
  'cpu',
  'memory',
  'disk',
  'network',
];
const CAPACITY_ALERT_LIMIT = 5;

function msToMinutes(value: number | null): number | null {
  return value === null ? null : Math.max(0, Math.round(value / 60000));
}

function sanitizeCapacityMessage(value: string): string {
  return value.replace(/[🚨⚠️✅]/gu, '').replace(/\s+/g, ' ').trim();
}

function rankCapacityAlert(alert: MonitoringCapacityAlert): number {
  const severityScore = alert.severity === 'critical' ? 0 : 1;
  const eta =
    alert.timeToCriticalMinutes ??
    alert.timeToWarningMinutes ??
    Number.MAX_SAFE_INTEGER;

  return severityScore * 1_000_000 + eta;
}

function buildCapacityEvidenceRef(
  alert: MonitoringCapacityAlert,
  snapshot: MonitoringSnapshot
): MonitoringEvidenceRef {
  return {
    id: alert.evidenceRefId,
    kind: 'prediction',
    serverId: alert.serverId,
    metric: alert.metric,
    timeRange: {
      from: snapshot.slot.startTime,
      to: snapshot.slot.endTime,
    },
    summary: `${alert.serverName} ${alert.metric} capacity forecast: ${alert.humanReadable}`,
    value: Math.round(alert.predictedValue * 10) / 10,
    threshold: alert.willBreachCritical
      ? alert.criticalThreshold
      : alert.warningThreshold,
    severity: alert.severity,
  };
}

export async function buildMonitoringCapacityAlerts({
  source,
  snapshot,
  queryAsOf,
}: {
  source: MonitoringDataSource;
  snapshot: MonitoringSnapshot;
  queryAsOf: ReturnType<typeof normalizeQueryAsOf>;
}): Promise<{
  alerts: MonitoringCapacityAlert[];
  evidenceRefs: MonitoringEvidenceRef[];
}> {
  const predictor = getTrendPredictor();
  const alerts: MonitoringCapacityAlert[] = [];

  for (const server of snapshot.servers) {
    for (const metric of CAPACITY_ALERT_METRICS) {
      try {
        const series = await source.getMetricSeries({
          serverId: server.id,
          metric,
          points: 12,
          queryAsOf,
        });
        const points = series.points
          .map((point) => ({
            timestamp: new Date(point.timestamp).getTime(),
            value: point.value,
          }))
          .filter((point) => Number.isFinite(point.timestamp));

        if (points.length < 2) {
          continue;
        }

        const prediction = predictor.predictEnhanced(
          points,
          metric,
          MAX_PREDICTION_HORIZON
        );
        const breach = prediction.thresholdBreach;
        if (!breach.willBreachWarning && !breach.willBreachCritical) {
          continue;
        }

        const thresholds = STATUS_THRESHOLDS[metric];
        const severity =
          prediction.currentStatus === 'critical' || breach.willBreachCritical
            ? 'critical'
            : 'warning';
        const id = `capacity-${server.id}-${metric}`;
        alerts.push({
          id,
          serverId: server.id,
          serverName: server.name,
          serverType: server.type,
          metric,
          currentValue: Math.round(prediction.details.currentValue * 10) / 10,
          predictedValue: Math.round(prediction.prediction * 10) / 10,
          warningThreshold: thresholds.warning,
          criticalThreshold: thresholds.critical,
          willBreachWarning: breach.willBreachWarning,
          timeToWarningMinutes: msToMinutes(breach.timeToWarning),
          willBreachCritical: breach.willBreachCritical,
          timeToCriticalMinutes: msToMinutes(breach.timeToCritical),
          severity,
          humanReadable: sanitizeCapacityMessage(breach.humanReadable),
          evidenceRefId: `evidence-${id}`,
        });
      } catch (error) {
        logger.warn(
          { err: error, serverId: server.id, metric },
          '[Monitoring Analyze Batch] Capacity alert series unavailable'
        );
      }
    }
  }

  const rankedAlerts = alerts
    .sort((left, right) => {
      const rankDelta = rankCapacityAlert(left) - rankCapacityAlert(right);
      return rankDelta !== 0
        ? rankDelta
        : right.currentValue - left.currentValue;
    })
    .slice(0, CAPACITY_ALERT_LIMIT);

  return {
    alerts: rankedAlerts,
    evidenceRefs: rankedAlerts.map((alert) =>
      buildCapacityEvidenceRef(alert, snapshot)
    ),
  };
}
