import type { GeneratedLog } from '../../data/log-generator';
import type {
  ServerSnapshot,
  ServerStatus,
} from '../../data/precomputed-state';
import type { QueryAsOf } from '../../data/query-as-of-context';

export type MonitoringSourceMode = 'replay-json' | 'live-otel';

export type MonitoringSeverity = 'info' | 'warning' | 'critical';

export const MONITORING_FACT_METRICS = [
  'cpu',
  'memory',
  'disk',
  'network',
] as const;

export type MonitoringFactMetric = (typeof MONITORING_FACT_METRICS)[number];

export type MonitoringErrorCode =
  | 'DATA_SOURCE_UNAVAILABLE'
  | 'SLOT_NOT_FOUND'
  | 'SERVER_NOT_FOUND'
  | 'METRIC_NOT_FOUND'
  | 'LIVE_SOURCE_DISABLED'
  | 'SNAPSHOT_STALE';

export interface MonitoringSnapshotInput {
  queryAsOf?: QueryAsOf;
}

export interface MonitoringMetricSeriesInput extends MonitoringSnapshotInput {
  serverId: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  points?: number;
}

export interface MonitoringLogQueryInput extends MonitoringSnapshotInput {
  serverId?: string;
  from?: string;
  to?: string;
  severity?: MonitoringSeverity;
  limit?: number;
}

export interface MonitoringRiskInput extends MonitoringSnapshotInput {
  scope?: 'all' | 'warning' | 'critical';
  limit?: number;
}

export interface MonitoringTimelineInput extends MonitoringSnapshotInput {
  serverId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface MonitoringSlotMetadata {
  slotIndex: number;
  hour: number;
  slotInHour: number;
  minuteOfDay: number;
  timeLabel: string;
  startTime: string;
  endTime: string;
}

export interface MonitoringTopologySummary {
  totalServers: number;
  statusCounts: Record<ServerStatus, number>;
  roleCounts: Record<string, number>;
}

export interface MonitoringEvidenceRef {
  id: string;
  kind: 'metric' | 'log' | 'topology' | 'rule' | 'prediction';
  serverId?: string;
  metric?: string;
  timeRange: { from: string; to: string };
  summary: string;
  value?: number | string;
  threshold?: number;
  severity: MonitoringSeverity;
}

export type MonitoringFactSeverity = Exclude<MonitoringSeverity, 'info'>;

export type MonitoringFactThreshold = {
  warning: number;
  critical: number;
};

export type MonitoringFactThresholds = Record<
  MonitoringFactMetric,
  MonitoringFactThreshold
>;

export type MonitoringFactSummary = {
  total: number;
  online: number;
  warning: number;
  critical: number;
  offline: number;
};

export type MonitoringFactSignal = {
  id: string;
  serverId: string;
  serverName: string;
  serverType: string;
  metric: MonitoringFactMetric;
  value: number;
  threshold: number;
  thresholdLevel: MonitoringFactSeverity;
  severity: MonitoringFactSeverity;
  evidenceRefId?: string;
};

export type MonitoringFactPackScope = {
  serverIds?: readonly string[];
  metrics?: readonly MonitoringFactMetric[];
  severities?: readonly MonitoringFactSeverity[];
  limit?: number;
};

export type MonitoringFactPack = {
  factPackVersion: string;
  dataSlot: string;
  sourceMode: MonitoringSourceMode;
  queryAsOf: string;
  thresholds: MonitoringFactThresholds;
  summary: MonitoringFactSummary;
  signals: MonitoringFactSignal[];
  evidenceRefs: MonitoringEvidenceRef[];
};

export interface MonitoringRiskSignal {
  id: string;
  serverId: string;
  serverName: string;
  serverType: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  threshold: number;
  trend: 'up' | 'down' | 'stable';
  severity: Exclude<MonitoringSeverity, 'info'>;
  evidenceRefId: string;
}

export interface MonitoringSnapshot {
  sourceMode: MonitoringSourceMode;
  queryAsOf: string;
  slot: MonitoringSlotMetadata;
  servers: ServerSnapshot[];
  topology: MonitoringTopologySummary;
  riskSignals: MonitoringRiskSignal[];
  evidenceRefs: MonitoringEvidenceRef[];
  factPack?: MonitoringFactPack;
  dataFreshness: {
    generatedAt: string | null;
    sourceUpdatedAt: string | null;
    stale: boolean;
  };
}

export interface MonitoringMetricSeries {
  sourceMode: MonitoringSourceMode;
  serverId: string;
  metric: MonitoringMetricSeriesInput['metric'];
  points: Array<{
    timestamp: string;
    value: number;
    slotIndex: number;
  }>;
  evidenceRefs: MonitoringEvidenceRef[];
}

export interface MonitoringLogResult {
  sourceMode: MonitoringSourceMode;
  logs: Array<
    GeneratedLog & {
      serverId: string;
      severity: MonitoringSeverity;
      timestamp: string;
    }
  >;
  evidenceRefs: MonitoringEvidenceRef[];
}

export interface MonitoringIncidentTimeline {
  sourceMode: MonitoringSourceMode;
  events: Array<{
    timestamp: string;
    serverId?: string;
    severity: MonitoringSeverity;
    eventType: 'metric' | 'log' | 'topology';
    description: string;
    evidenceRefId: string;
  }>;
  evidenceRefs: MonitoringEvidenceRef[];
}

export interface MonitoringDataSource {
  readonly mode: MonitoringSourceMode;
  getSnapshot(input: MonitoringSnapshotInput): Promise<MonitoringSnapshot>;
  getMetricSeries(
    input: MonitoringMetricSeriesInput
  ): Promise<MonitoringMetricSeries>;
  getRelatedLogs(input: MonitoringLogQueryInput): Promise<MonitoringLogResult>;
  rankRiskSignals(input: MonitoringRiskInput): Promise<MonitoringRiskSignal[]>;
  buildIncidentTimeline(
    input: MonitoringTimelineInput
  ): Promise<MonitoringIncidentTimeline>;
}
