import {
  MONITORING_FACT_METRICS,
  type MonitoringEvidenceRef,
  type MonitoringFactMetric,
  type MonitoringFactPack,
  type MonitoringFactPackScope,
  type MonitoringFactSeverity,
  type MonitoringFactSignal,
  type MonitoringFactSummary,
  type MonitoringFactThreshold,
  type MonitoringFactThresholds,
  type MonitoringSnapshot,
} from './monitoring-types';

export const MONITORING_FACT_PACK_VERSION = '2026-05-03-v1';

type MonitoringFactPackSnapshot = Omit<MonitoringSnapshot, 'factPack'>;

export type BuildMonitoringFactPackInput = {
  snapshot: MonitoringFactPackSnapshot;
  thresholds: MonitoringFactThresholds;
  dataSlot?: string;
  scope?: MonitoringFactPackScope;
};

export function buildMonitoringFactPack(
  input: BuildMonitoringFactPackInput
): MonitoringFactPack {
  const { snapshot, scope } = input;
  const signals = buildFactSignals(snapshot, input.thresholds, scope);

  return {
    factPackVersion: MONITORING_FACT_PACK_VERSION,
    dataSlot: input.dataSlot ?? snapshot.slot.timeLabel,
    sourceMode: snapshot.sourceMode,
    queryAsOf: snapshot.queryAsOf,
    thresholds: cloneThresholds(input.thresholds),
    summary: buildFactSummary(snapshot),
    signals,
    evidenceRefs: snapshot.evidenceRefs.slice(),
  };
}

function buildFactSignals(
  snapshot: MonitoringFactPackSnapshot,
  thresholds: MonitoringFactThresholds,
  scope: MonitoringFactPackScope | undefined
): MonitoringFactSignal[] {
  const serverIds = scope?.serverIds ? new Set(scope.serverIds) : null;
  const metrics = scope?.metrics ?? MONITORING_FACT_METRICS;
  const severities = scope?.severities
    ? new Set(scope.severities)
    : new Set<MonitoringFactSeverity>(['warning', 'critical']);
  const signals: MonitoringFactSignal[] = [];

  for (const server of snapshot.servers) {
    if (serverIds && !serverIds.has(server.id)) {
      continue;
    }

    for (const metric of metrics) {
      const evaluated = evaluateMetricSeverity(server[metric], thresholds[metric]);
      if (!evaluated || !severities.has(evaluated.severity)) {
        continue;
      }

      signals.push({
        id: `fact-${snapshot.slot.slotIndex}-${server.id}-${metric}`,
        serverId: server.id,
        serverName: server.name,
        serverType: server.type,
        metric,
        value: server[metric],
        threshold: evaluated.threshold,
        thresholdLevel: evaluated.severity,
        severity: evaluated.severity,
        ...resolveEvidenceRefId(snapshot.evidenceRefs, server.id, metric),
      });
    }
  }

  return signals.sort(compareSignals).slice(0, normalizeLimit(scope?.limit));
}

function evaluateMetricSeverity(
  value: number,
  threshold: MonitoringFactThreshold
):
  | { severity: MonitoringFactSeverity; threshold: number }
  | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  if (value >= threshold.critical) {
    return { severity: 'critical', threshold: threshold.critical };
  }
  if (value >= threshold.warning) {
    return { severity: 'warning', threshold: threshold.warning };
  }
  return undefined;
}

function resolveEvidenceRefId(
  evidenceRefs: readonly MonitoringEvidenceRef[],
  serverId: string,
  metric: MonitoringFactMetric
): { evidenceRefId: string } | Record<string, never> {
  const evidenceRef = evidenceRefs.find(
    (ref) =>
      ref.kind === 'metric' && ref.serverId === serverId && ref.metric === metric
  );
  return evidenceRef ? { evidenceRefId: evidenceRef.id } : {};
}

function buildFactSummary(
  snapshot: MonitoringFactPackSnapshot
): MonitoringFactSummary {
  const counts = snapshot.topology.statusCounts;
  return {
    total: snapshot.topology.totalServers,
    online: counts.online,
    warning: counts.warning,
    critical: counts.critical,
    offline: counts.offline,
  };
}

function cloneThresholds(
  thresholds: MonitoringFactThresholds
): MonitoringFactThresholds {
  return {
    cpu: { ...thresholds.cpu },
    memory: { ...thresholds.memory },
    disk: { ...thresholds.disk },
    network: { ...thresholds.network },
  };
}

function compareSignals(
  left: MonitoringFactSignal,
  right: MonitoringFactSignal
): number {
  const severityDelta = severityRank(right.severity) - severityRank(left.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }

  const valueDelta = right.value - left.value;
  if (valueDelta !== 0) {
    return valueDelta;
  }

  const serverDelta = left.serverId.localeCompare(right.serverId);
  if (serverDelta !== 0) {
    return serverDelta;
  }

  return metricRank(left.metric) - metricRank(right.metric);
}

function severityRank(severity: MonitoringFactSeverity): number {
  return severity === 'critical' ? 2 : 1;
}

function metricRank(metric: MonitoringFactMetric): number {
  return MONITORING_FACT_METRICS.indexOf(metric);
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor(limit ?? Number.POSITIVE_INFINITY));
}
