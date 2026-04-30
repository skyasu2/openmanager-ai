import {
  getCurrentDataSourceInfo,
  getCurrentState,
  getStateBySlot,
  type PrecomputedSlot,
  type ServerAlert,
  type ServerSnapshot,
} from '../../data/precomputed-state';
import type { GeneratedLog } from '../../data/log-generator';
import type {
  MonitoringDataSource,
  MonitoringErrorCode,
  MonitoringEvidenceRef,
  MonitoringIncidentTimeline,
  MonitoringLogQueryInput,
  MonitoringLogResult,
  MonitoringMetricSeries,
  MonitoringMetricSeriesInput,
  MonitoringRiskInput,
  MonitoringRiskSignal,
  MonitoringSeverity,
  MonitoringSlotMetadata,
  MonitoringSnapshot,
  MonitoringSnapshotInput,
  MonitoringSourceMode,
  MonitoringTimelineInput,
  MonitoringTopologySummary,
} from './monitoring-types';

export * from './monitoring-types';

interface MonitoringDataSourceOptions {
  mode?: MonitoringSourceMode;
  liveEndpoint?: string;
}

export class MonitoringDataSourceError extends Error {
  readonly code: MonitoringErrorCode;
  readonly recoverable: boolean;
  readonly sourceMode: MonitoringSourceMode;

  constructor(
    code: MonitoringErrorCode,
    message: string,
    options: {
      sourceMode: MonitoringSourceMode;
      recoverable?: boolean;
    }
  ) {
    super(message);
    this.name = 'MonitoringDataSourceError';
    this.code = code;
    this.recoverable = options.recoverable ?? true;
    this.sourceMode = options.sourceMode;
  }
}

class LiveOtelMonitoringDataSource implements MonitoringDataSource {
  readonly mode = 'live-otel' as const;

  constructor(private readonly endpoint?: string) {}

  async getSnapshot(): Promise<MonitoringSnapshot> {
    this.assertEnabled();
  }

  async getMetricSeries(): Promise<MonitoringMetricSeries> {
    this.assertEnabled();
  }

  async getRelatedLogs(): Promise<MonitoringLogResult> {
    this.assertEnabled();
  }

  async rankRiskSignals(): Promise<MonitoringRiskSignal[]> {
    this.assertEnabled();
  }

  async buildIncidentTimeline(): Promise<MonitoringIncidentTimeline> {
    this.assertEnabled();
  }

  private assertEnabled(): never {
    if (!this.endpoint) {
      throw new MonitoringDataSourceError(
        'LIVE_SOURCE_DISABLED',
        'Live OTel monitoring source is disabled. Configure LIVE_OTEL_ENDPOINT to enable it.',
        { sourceMode: this.mode, recoverable: true }
      );
    }

    // endpoint가 있어도 adapter 미구현 — Task 7에서 실제 OTLP 연결 시 이 throw를 교체
    throw new MonitoringDataSourceError(
      'LIVE_SOURCE_DISABLED',
      'Live OTel monitoring source adapter is not implemented yet.',
      { sourceMode: this.mode, recoverable: true }
    );
  }
}

class JsonReplayMonitoringDataSource implements MonitoringDataSource {
  readonly mode = 'replay-json' as const;

  async getSnapshot(
    input: MonitoringSnapshotInput = {}
  ): Promise<MonitoringSnapshot> {
    const slot = resolveSlot(input, this.mode);
    const slotMeta = buildSlotMetadata(slot, input);
    const riskSignals = buildRiskSignals(slot);
    const metricEvidence = riskSignals.map((signal) =>
      riskSignalToEvidence(signal, slotMeta)
    );
    const logEvidence = buildLogEvidence(slot, slotMeta);
    const topologyEvidence = buildTopologyEvidence(slot, slotMeta);
    const dataSourceInfo = getCurrentDataSourceInfo();

    return {
      sourceMode: this.mode,
      queryAsOf: input.queryAsOf?.createdAt ?? new Date().toISOString(),
      slot: slotMeta,
      servers: slot.servers,
      topology: buildTopologySummary(slot.servers),
      riskSignals,
      evidenceRefs: [
        ...metricEvidence,
        ...logEvidence,
        topologyEvidence,
      ].slice(0, 40),
      dataFreshness: {
        generatedAt: dataSourceInfo?.catalogGeneratedAt ?? null,
        sourceUpdatedAt: dataSourceInfo?.catalogGeneratedAt ?? null,
        stale: false,
      },
    };
  }

  async getMetricSeries(
    input: MonitoringMetricSeriesInput
  ): Promise<MonitoringMetricSeries> {
    const points = buildMetricSeriesPoints(input, this.mode);

    if (points.length === 0) {
      throw new MonitoringDataSourceError(
        'SERVER_NOT_FOUND',
        `Server not found for metric series: ${input.serverId}`,
        { sourceMode: this.mode, recoverable: true }
      );
    }

    const lastPoint = points[points.length - 1];
    const evidenceRefs: MonitoringEvidenceRef[] = lastPoint
      ? [
          {
            id: `series-${input.serverId}-${input.metric}-${lastPoint.slotIndex}`,
            kind: 'metric',
            serverId: input.serverId,
            metric: input.metric,
            timeRange: buildTimeRange(lastPoint.timestamp),
            summary: `${input.serverId} ${input.metric} series contains ${points.length} points.`,
            value: lastPoint.value,
            severity: 'info',
          },
        ]
      : [];

    return {
      sourceMode: this.mode,
      serverId: input.serverId,
      metric: input.metric,
      points,
      evidenceRefs,
    };
  }

  async getRelatedLogs(
    input: MonitoringLogQueryInput = {}
  ): Promise<MonitoringLogResult> {
    const slot = resolveSlot(input, this.mode);
    const slotMeta = buildSlotMetadata(slot, input);
    const minSeverity = input.severity ?? 'info';
    const logs = collectLogs(slot, slotMeta)
      .filter((log) => !input.serverId || log.serverId === input.serverId)
      .filter((log) => severityRank(log.severity) >= severityRank(minSeverity))
      .filter((log) => isWithinOptionalRange(log.timestamp, input.from, input.to))
      .slice(0, input.limit ?? 20);

    return {
      sourceMode: this.mode,
      logs,
      evidenceRefs: logs.map((log, index) =>
        logToEvidence(log, slotMeta, `related-log-${index}`)
      ),
    };
  }

  async rankRiskSignals(
    input: MonitoringRiskInput = {}
  ): Promise<MonitoringRiskSignal[]> {
    const slot = resolveSlot(input, this.mode);
    const signals = buildRiskSignals(slot).filter((signal) => {
      if (!input.scope || input.scope === 'all') return true;
      return signal.severity === input.scope;
    });

    return signals.slice(0, input.limit ?? 10);
  }

  async buildIncidentTimeline(
    input: MonitoringTimelineInput = {}
  ): Promise<MonitoringIncidentTimeline> {
    const snapshot = await this.getSnapshot(input);
    const logs = await this.getRelatedLogs({
      ...input,
      limit: input.limit ?? 20,
    });

    const metricEvents = snapshot.riskSignals.map((signal) => ({
      timestamp: snapshot.slot.startTime,
      serverId: signal.serverId,
      severity: signal.severity,
      eventType: 'metric' as const,
      description: `${signal.serverName} ${signal.metric} ${signal.value}% >= ${signal.threshold}%`,
      evidenceRefId: signal.evidenceRefId,
    }));

    const logEvents = logs.evidenceRefs.map((evidence) => ({
      timestamp: evidence.timeRange.from,
      serverId: evidence.serverId,
      severity: evidence.severity,
      eventType: 'log' as const,
      description: evidence.summary,
      evidenceRefId: evidence.id,
    }));

    const events = [...metricEvents, ...logEvents]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(0, input.limit ?? 20);

    return {
      sourceMode: this.mode,
      events,
      evidenceRefs: [
        ...snapshot.evidenceRefs,
        ...logs.evidenceRefs,
      ].slice(0, 40),
    };
  }
}

export function createMonitoringDataSource(
  options: MonitoringDataSourceOptions = {}
): MonitoringDataSource {
  const mode = options.mode ?? readMonitoringSourceMode();
  if (mode === 'live-otel') {
    return new LiveOtelMonitoringDataSource(
      options.liveEndpoint ?? process.env.LIVE_OTEL_ENDPOINT
    );
  }

  return new JsonReplayMonitoringDataSource();
}

function readMonitoringSourceMode(): MonitoringSourceMode {
  return process.env.MONITORING_SOURCE_MODE === 'live-otel'
    ? 'live-otel'
    : 'replay-json';
}

function resolveSlot(
  input: MonitoringSnapshotInput,
  sourceMode: MonitoringSourceMode
): PrecomputedSlot {
  if (input.queryAsOf) {
    const slot = getStateBySlot(input.queryAsOf.dataSlot.slotIndex);
    if (!slot) {
      throw new MonitoringDataSourceError(
        'SLOT_NOT_FOUND',
        `Monitoring slot not found: ${input.queryAsOf.dataSlot.slotIndex}`,
        { sourceMode, recoverable: true }
      );
    }
    return slot;
  }

  return getCurrentState();
}

function buildSlotMetadata(
  slot: PrecomputedSlot,
  input: MonitoringSnapshotInput
): MonitoringSlotMetadata {
  const start = buildSlotStartDate(
    input.queryAsOf?.createdAt,
    slot.minuteOfDay
  );
  const end = new Date(start.getTime() + 10 * 60 * 1000);

  return {
    slotIndex: slot.slotIndex,
    hour: Math.floor(slot.minuteOfDay / 60),
    slotInHour: Math.floor((slot.minuteOfDay % 60) / 10),
    minuteOfDay: slot.minuteOfDay,
    timeLabel: slot.timeLabel,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function buildMetricSeriesPoints(
  input: MonitoringMetricSeriesInput,
  sourceMode: MonitoringSourceMode
): MonitoringMetricSeries['points'] {
  const pointCount = Math.max(1, Math.min(input.points ?? 24, 144));
  const referenceSlot = resolveSlot(input, sourceMode);
  const referenceStart = buildSlotStartDate(
    input.queryAsOf?.createdAt,
    referenceSlot.minuteOfDay
  );
  const points: MonitoringMetricSeries['points'] = [];

  for (let offset = pointCount - 1; offset >= 0; offset--) {
    const slotIndex = (referenceSlot.slotIndex - offset + 144) % 144;
    const slot = getStateBySlot(slotIndex);
    const server = slot?.servers.find((item) => item.id === input.serverId);
    if (!server) {
      continue;
    }

    points.push({
      timestamp: new Date(referenceStart.getTime() - offset * 10 * 60 * 1000)
        .toISOString(),
      value: server[input.metric],
      slotIndex,
    });
  }

  return points;
}

function buildSlotStartDate(
  createdAt: string | undefined,
  minuteOfDay: number
): Date {
  const reference = createdAt ? new Date(createdAt) : new Date();
  const safeReference = Number.isFinite(reference.getTime())
    ? reference
    : new Date();
  const kstReference = new Date(safeReference.getTime() + 9 * 60 * 60 * 1000);
  const utcKstMidnight = Date.UTC(
    kstReference.getUTCFullYear(),
    kstReference.getUTCMonth(),
    kstReference.getUTCDate(),
    0,
    0,
    0,
    0
  );

  return new Date(
    utcKstMidnight - 9 * 60 * 60 * 1000 + minuteOfDay * 60 * 1000
  );
}

function buildTopologySummary(
  servers: ServerSnapshot[]
): MonitoringTopologySummary {
  const statusCounts: MonitoringTopologySummary['statusCounts'] = {
    online: 0,
    warning: 0,
    critical: 0,
    offline: 0,
  };
  const roleCounts: Record<string, number> = {};

  for (const server of servers) {
    statusCounts[server.status]++;
    roleCounts[server.type] = (roleCounts[server.type] ?? 0) + 1;
  }

  return {
    totalServers: servers.length,
    statusCounts,
    roleCounts,
  };
}

function buildRiskSignals(slot: PrecomputedSlot): MonitoringRiskSignal[] {
  return slot.alerts
    .map((alert) => alertToRiskSignal(alert))
    .sort((a, b) => {
      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      return severityDelta === 0 ? b.value - a.value : severityDelta;
    });
}

function alertToRiskSignal(alert: ServerAlert): MonitoringRiskSignal {
  const id = `risk-${alert.serverId}-${alert.metric}`;
  return {
    id,
    serverId: alert.serverId,
    serverName: alert.serverName,
    serverType: alert.serverType,
    metric: alert.metric,
    value: alert.value,
    threshold: alert.threshold,
    trend: alert.trend,
    severity: alert.severity,
    evidenceRefId: `evidence-${id}`,
  };
}

function riskSignalToEvidence(
  signal: MonitoringRiskSignal,
  slot: MonitoringSlotMetadata
): MonitoringEvidenceRef {
  return {
    id: signal.evidenceRefId,
    kind: 'metric',
    serverId: signal.serverId,
    metric: signal.metric,
    timeRange: {
      from: slot.startTime,
      to: slot.endTime,
    },
    summary: `${signal.serverName} ${signal.metric} ${signal.value}% exceeded ${signal.threshold}% ${signal.severity} threshold.`,
    value: signal.value,
    threshold: signal.threshold,
    severity: signal.severity,
  };
}

function buildLogEvidence(
  slot: PrecomputedSlot,
  slotMeta: MonitoringSlotMetadata
): MonitoringEvidenceRef[] {
  return collectLogs(slot, slotMeta)
    .filter((log) => log.severity !== 'info')
    .slice(0, 10)
    .map((log, index) => logToEvidence(log, slotMeta, `log-${index}`));
}

function buildTopologyEvidence(
  slot: PrecomputedSlot,
  slotMeta: MonitoringSlotMetadata
): MonitoringEvidenceRef {
  return {
    id: `topology-${slot.slotIndex}`,
    kind: 'topology',
    timeRange: {
      from: slotMeta.startTime,
      to: slotMeta.endTime,
    },
    summary: `${slot.summary.total} servers: ${slot.summary.critical} critical, ${slot.summary.warning} warning, ${slot.summary.offline} offline.`,
    value: slot.summary.total,
    severity:
      slot.summary.critical > 0
        ? 'critical'
        : slot.summary.warning > 0
          ? 'warning'
          : 'info',
  };
}

function collectLogs(
  slot: PrecomputedSlot,
  slotMeta: MonitoringSlotMetadata
): MonitoringLogResult['logs'] {
  const logs: MonitoringLogResult['logs'] = [];
  for (const [serverId, serverLogs] of Object.entries(slot.serverLogs ?? {})) {
    for (const log of serverLogs) {
      logs.push({
        ...log,
        serverId,
        severity: logLevelToSeverity(log.level),
        timestamp: slotMeta.startTime,
      });
    }
  }
  return logs.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function logToEvidence(
  log: GeneratedLog & {
    serverId: string;
    severity: MonitoringSeverity;
    timestamp: string;
  },
  slot: MonitoringSlotMetadata,
  idSuffix: string
): MonitoringEvidenceRef {
  return {
    id: `evidence-${idSuffix}-${log.serverId}`,
    kind: 'log',
    serverId: log.serverId,
    timeRange: {
      from: slot.startTime,
      to: slot.endTime,
    },
    summary: `${log.serverId} ${log.source}: ${log.message}`,
    severity: log.severity,
  };
}

function isWithinOptionalRange(
  timestamp: string,
  from: string | undefined,
  to: string | undefined
): boolean {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) {
    return false;
  }

  const parsedFromTime = from ? Date.parse(from) : Number.NaN;
  const parsedToTime = to ? Date.parse(to) : Number.NaN;
  const fromTime = Number.isFinite(parsedFromTime)
    ? parsedFromTime
    : Number.NEGATIVE_INFINITY;
  const toTime = Number.isFinite(parsedToTime)
    ? parsedToTime
    : Number.POSITIVE_INFINITY;

  return time >= fromTime && time <= toTime;
}

function buildTimeRange(timestamp: string): { from: string; to: string } {
  const from = new Date(timestamp);
  const to = new Date(from.getTime() + 10 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function logLevelToSeverity(level: GeneratedLog['level']): MonitoringSeverity {
  if (level === 'error') return 'critical';
  if (level === 'warn') return 'warning';
  return 'info';
}

function severityRank(severity: MonitoringSeverity): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}
