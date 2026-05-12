import type {
  AnomalyData,
  MetricSnapshot,
} from './context-store-types';

export type AgentRecommendationSafety =
  | 'read_only'
  | 'requires_approval'
  | 'unsupported';

export interface AgentStructuredMetricFinding {
  name: string;
  value?: number;
  unit?: string;
  server?: string;
  timeWindow?: string;
}

export interface AgentStructuredAnomalyFinding {
  server?: string;
  metric?: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  value?: number;
  threshold?: number;
}

export interface AgentStructuredRecommendation {
  action: string;
  safety: AgentRecommendationSafety;
}

export interface AgentStructuredFindings {
  agentName: string;
  affectedServers?: string[];
  metrics?: AgentStructuredMetricFinding[];
  anomalies?: AgentStructuredAnomalyFinding[];
  recommendations?: AgentStructuredRecommendation[];
}

export interface NormalizedAgentStructuredFindings {
  affectedServers: string[];
  metrics: MetricSnapshot[];
  anomalies: AnomalyData[];
  recommendedCommands: string[];
}

export type ContextFindingsSource =
  | 'structured'
  | 'tool_result'
  | 'legacy_text_regex'
  | 'none';

export interface ContextFindingsDecision {
  findingsSource: ContextFindingsSource;
  reasonCodes: string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeServerId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function normalizeMetricName(
  value: string | undefined
): 'cpu' | 'memory' | 'disk' | 'network' | null {
  const normalized = (value ?? '').toLowerCase();
  if (/cpu|씨피유/.test(normalized)) return 'cpu';
  if (/memory|mem|메모리/.test(normalized)) return 'memory';
  if (/disk|storage|디스크|스토리지/.test(normalized)) return 'disk';
  if (/network|traffic|latency|네트워크|대역폭/.test(normalized)) {
    return 'network';
  }
  return null;
}

function statusFromValues(values: number[]): MetricSnapshot['status'] {
  const maxValue = Math.max(...values, 0);
  if (maxValue >= 90) return 'critical';
  if (maxValue >= 70) return 'warning';
  return 'normal';
}

function normalizeMetrics(
  findings: AgentStructuredFindings,
  timestamp: string
): MetricSnapshot[] {
  const snapshots = new Map<string, MetricSnapshot>();

  for (const metric of findings.metrics ?? []) {
    const metricName = normalizeMetricName(metric.name);
    if (!metricName || metricName === 'network') continue;
    if (!isFiniteNumber(metric.value)) continue;

    const serverId = normalizeServerId(metric.server) ?? 'unknown';
    const existing = snapshots.get(serverId) ?? {
      serverId,
      serverName: serverId,
      cpu: 0,
      memory: 0,
      disk: 0,
      status: 'normal' as const,
      timestamp,
    };

    const updated: MetricSnapshot = {
      ...existing,
      [metricName]: metric.value,
    };

    updated.status = statusFromValues([
      updated.cpu,
      updated.memory,
      updated.disk,
    ]);
    snapshots.set(serverId, updated);
  }

  return Array.from(snapshots.values());
}

function normalizeAnomalies(
  findings: AgentStructuredFindings,
  detectedAt: string
): AnomalyData[] {
  return (findings.anomalies ?? []).map((anomaly): AnomalyData => {
    const serverId = normalizeServerId(anomaly.server) ?? 'unknown';
    const metric = normalizeMetricName(anomaly.metric) ?? 'cpu';
    const severity = anomaly.severity === 'critical' ? 'critical' : 'warning';

    return {
      serverId,
      serverName: serverId,
      metric,
      value: isFiniteNumber(anomaly.value) ? anomaly.value : 0,
      threshold: isFiniteNumber(anomaly.threshold) ? anomaly.threshold : 0,
      severity,
      detectedAt,
      description: anomaly.summary,
    };
  });
}

function normalizeRecommendedCommands(
  findings: AgentStructuredFindings
): string[] {
  return (findings.recommendations ?? [])
    .filter((recommendation) => recommendation.safety !== 'unsupported')
    .map((recommendation) => recommendation.action.trim())
    .filter((action) => action.length > 0);
}

export function normalizeAgentStructuredFindings(
  findings: AgentStructuredFindings,
  now = new Date()
): NormalizedAgentStructuredFindings {
  const timestamp = now.toISOString();
  const affectedServers = Array.from(
    new Set(
      (findings.affectedServers ?? [])
        .map(normalizeServerId)
        .filter((serverId): serverId is string => serverId !== null)
    )
  );

  return {
    affectedServers,
    metrics: normalizeMetrics(findings, timestamp),
    anomalies: normalizeAnomalies(findings, timestamp),
    recommendedCommands: normalizeRecommendedCommands(findings),
  };
}

export function hasNormalizedStructuredFindings(
  findings: NormalizedAgentStructuredFindings
): boolean {
  return (
    findings.affectedServers.length > 0 ||
    findings.metrics.length > 0 ||
    findings.anomalies.length > 0 ||
    findings.recommendedCommands.length > 0
  );
}
