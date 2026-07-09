import {
  getRegisteredServerAliases,
  resolveRegisteredServerId,
} from '@/config/server-registry';
import type {
  MonitoringAnalysisArtifact,
  ServerMonitoringAnalysisArtifact,
  ServerMonitoringArtifactRequest,
} from '@/lib/ai/domains/monitoring/artifact-types';
import { createQueryAsOf } from '@/lib/ai/query-as-of';
import type {
  CloudRunAnalysisResponse,
  MetricAnomalyResult,
  MonitoringBatchAnalysisResponse,
  MonitoringBatchEvidenceRef,
  MonitoringBatchQueryFocusServer,
  MonitoringBatchRiskSignal,
  MonitoringBatchServer,
  ServerAnalysisResult,
} from '@/types/intelligent-monitoring.types';
import { buildMonitoringRoleGroupSummary } from './monitoring-analysis-role-groups';
import {
  parseMonitoringBatchAnalysisResponse,
  parseServerMonitoringAnalysisResponse,
} from './monitoring-analysis-schemas';
import {
  type ArtifactEvidence,
  attachArtifactEnvelopeMetadata,
  type ChatArtifactRequest,
} from './types';

export { buildMonitoringRoleGroupSummary } from './monitoring-analysis-role-groups';
export {
  parseMonitoringBatchAnalysisResponse,
  parseServerMonitoringAnalysisResponse,
} from './monitoring-analysis-schemas';

export function summarizeMonitoringAnalysis(
  analysis: MonitoringBatchAnalysisResponse
): Omit<
  MonitoringAnalysisArtifact,
  | 'kind'
  | 'generatedAt'
  | 'analysis'
  | 'capacityAlerts'
  | 'roleGroupSummary'
  | 'source'
  | 'queryAsOfDataSlot'
> {
  const warningServers =
    analysis.factPack?.summary.warning ??
    analysis.servers.filter((server) => server.status === 'warning').length;
  const criticalServers =
    analysis.factPack !== undefined
      ? analysis.factPack.summary.critical + analysis.factPack.summary.offline
      : analysis.servers.filter(
          (server) =>
            server.status === 'critical' || server.status === 'offline'
        ).length;
  const serverCount =
    analysis.factPack?.summary.total ?? analysis.servers.length;
  const riskSignalCount =
    analysis.factPack?.signals.length ?? analysis.riskSignals.length;

  return {
    title: '전체 서버 이상감지/추세 분석',
    summary:
      analysis.summary ||
      `${serverCount}개 서버 분석 완료, 위험 신호 ${riskSignalCount}건`,
    serverCount,
    riskSignalCount,
    warningServers,
    criticalServers,
  };
}

function mapMonitoringFactPackEvidence(
  evidenceRefs: MonitoringBatchEvidenceRef[] | undefined
) {
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
    return undefined;
  }

  return evidenceRefs.map((evidence) => ({
    id: evidence.id,
    kind: evidence.kind,
    summary: evidence.summary,
    ...(evidence.serverId ? { serverId: evidence.serverId } : {}),
    ...(evidence.metric ? { metric: evidence.metric } : {}),
    severity: evidence.severity,
  }));
}

function readFallbackServers(value: unknown): MonitoringBatchServer[] {
  return readRecordArray(value)
    .map((server): MonitoringBatchServer | undefined => {
      const id = readString(server.id);
      if (!id) return undefined;
      const name = readString(server.name) ?? id;

      return {
        id,
        name,
        type: readString(server.type) ?? 'unknown',
        status: normalizeBatchStatus(server.status),
        cpu: readNumber(server.cpu) ?? 0,
        memory: readNumber(server.memory) ?? 0,
        disk: readNumber(server.disk) ?? 0,
        network: readNumber(server.network) ?? 0,
      };
    })
    .filter((server): server is MonitoringBatchServer => server !== undefined);
}

function readFallbackRiskSignals(value: unknown): MonitoringBatchRiskSignal[] {
  return readRecordArray(value)
    .map((signal, index): MonitoringBatchRiskSignal | undefined => {
      const serverId = readString(signal.serverId);
      const metric = normalizeBatchMetric(signal.metric);
      const severity = normalizeBatchRiskSeverity(signal.severity);
      if (!serverId || !metric || !severity) return undefined;

      return {
        id: readString(signal.id) ?? `degraded-risk-${index + 1}`,
        serverId,
        serverName: readString(signal.serverName) ?? serverId,
        serverType: readString(signal.serverType) ?? 'unknown',
        metric,
        value: readNumber(signal.value) ?? 0,
        threshold: readNumber(signal.threshold) ?? 0,
        trend: normalizeBatchTrend(signal.trend),
        severity,
        evidenceRefId:
          readString(signal.evidenceRefId) ?? `degraded-evidence-${index + 1}`,
      };
    })
    .filter(
      (signal): signal is MonitoringBatchRiskSignal => signal !== undefined
    );
}

function readFallbackEvidenceRefs(
  value: unknown
): MonitoringBatchEvidenceRef[] {
  return readRecordArray(value)
    .map((evidence, index): MonitoringBatchEvidenceRef | undefined => {
      const summary = readString(evidence.summary);
      if (!summary) return undefined;
      const timeRange = isRecord(evidence.timeRange) ? evidence.timeRange : {};
      const serverId = readString(evidence.serverId);
      const metric = readString(evidence.metric);
      const numericValue = readNumber(evidence.value);
      const stringValue = readString(evidence.value);
      const threshold = readNumber(evidence.threshold);

      return {
        id: readString(evidence.id) ?? `degraded-evidence-${index + 1}`,
        kind: normalizeEvidenceKind(evidence.kind),
        ...(serverId && { serverId }),
        ...(metric && { metric }),
        timeRange: {
          from: readString(timeRange.from) ?? '',
          to: readString(timeRange.to) ?? '',
        },
        summary,
        ...(numericValue !== undefined
          ? { value: numericValue }
          : stringValue
            ? { value: stringValue }
            : {}),
        ...(threshold !== undefined && { threshold }),
        severity: normalizeEvidenceSeverity(evidence.severity),
      };
    })
    .filter(
      (evidence): evidence is MonitoringBatchEvidenceRef =>
        evidence !== undefined
    );
}

function buildFallbackSlot(
  value: unknown,
  queryAsOfDataSlot: ChatArtifactRequest['queryAsOfDataSlot']
): MonitoringBatchAnalysisResponse['slot'] {
  const slot = isRecord(value) ? value : {};
  const timeLabel =
    readString(slot.timeLabel) ?? queryAsOfDataSlot?.timeLabel ?? '현재';

  return {
    slotIndex: readNumber(slot.slotIndex) ?? queryAsOfDataSlot?.slotIndex ?? 0,
    hour: readNumber(slot.hour) ?? 0,
    slotInHour: readNumber(slot.slotInHour) ?? 0,
    minuteOfDay:
      readNumber(slot.minuteOfDay) ?? queryAsOfDataSlot?.minuteOfDay ?? 0,
    timeLabel,
    startTime: readString(slot.startTime) ?? '',
    endTime: readString(slot.endTime) ?? '',
  };
}

function buildDegradedMonitoringBatchAnalysisResponse(
  value: unknown,
  queryAsOfDataSlot: ChatArtifactRequest['queryAsOfDataSlot']
): MonitoringBatchAnalysisResponse | null {
  if (!isRecord(value) || value.success !== true) return null;

  const servers = readFallbackServers(value.servers);
  const riskSignals = readFallbackRiskSignals(value.riskSignals);
  const evidenceRefs = readFallbackEvidenceRefs(value.evidenceRefs);
  const dataFreshness = isRecord(value.dataFreshness)
    ? value.dataFreshness
    : {};

  return {
    success: true,
    sourceMode: value.sourceMode === 'live-otel' ? 'live-otel' : 'replay-json',
    queryAsOf: readString(value.queryAsOf) ?? '',
    slot: buildFallbackSlot(value.slot, queryAsOfDataSlot),
    summary:
      readString(value.summary) ??
      '원격 분석 응답 스키마가 일부 변경되어 수신 가능한 필드만 표시합니다.',
    servers,
    riskSignals,
    evidenceRefs,
    dataFreshness: {
      generatedAt: readString(dataFreshness.generatedAt) ?? null,
      sourceUpdatedAt: readString(dataFreshness.sourceUpdatedAt) ?? null,
      stale: readBoolean(dataFreshness.stale) ?? true,
    },
    ...(readString(value._source) && { _source: readString(value._source) }),
  };
}

function buildDegradedServerMonitoringResponse(
  value: unknown,
  serverId: string
): (CloudRunAnalysisResponse & { _source?: string }) | null {
  if (!isRecord(value) || value.success !== true) return null;

  // Single-server responses are passthrough by contract, so preserve every
  // received field and only repair the required envelope keys.
  return {
    ...value,
    success: true,
    serverId: readString(value.serverId) ?? serverId,
    analysisType: normalizeServerAnalysisType(value.analysisType),
    timestamp: readString(value.timestamp) ?? new Date().toISOString(),
  } as CloudRunAnalysisResponse & { _source?: string };
}

function normalizeServerAnalysisType(
  value: unknown
): CloudRunAnalysisResponse['analysisType'] {
  return value === 'full' ||
    value === 'anomaly' ||
    value === 'trend' ||
    value === 'pattern'
    ? value
    : 'full';
}

function createSchemaDriftEvidence(): ArtifactEvidence[] {
  return [
    {
      id: 'monitoring-schema-drift',
      kind: 'rule',
      summary:
        'Cloud Run 분석 응답 스키마가 일부 변경되어 수신 가능한 필드만 표시했습니다.',
      severity: 'warning',
    },
  ];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function queryContainsServerReference(
  query: string,
  reference: string | undefined
): boolean {
  const normalizedReference = reference?.trim().toLowerCase();
  if (!normalizedReference) return false;

  return new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedReference)}([^a-z0-9]|$)`,
    'i'
  ).test(query);
}

function buildServerReferenceCandidates(serverId: string, serverName: string) {
  const candidates = new Set<string>([serverId, serverName]);

  for (const alias of getRegisteredServerAliases()) {
    if (resolveRegisteredServerId(alias) === serverId) {
      candidates.add(alias);
    }
  }

  return Array.from(candidates);
}

function resolveQueryFocusServer({
  analysis,
  query,
}: {
  analysis: MonitoringBatchAnalysisResponse;
  query: string;
}): MonitoringBatchQueryFocusServer | undefined {
  if (analysis.queryFocusServer) {
    return analysis.queryFocusServer;
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return undefined;

  const focusedServer = analysis.servers.find((server) =>
    buildServerReferenceCandidates(server.id, server.name).some((reference) =>
      queryContainsServerReference(normalizedQuery, reference)
    )
  );
  if (!focusedServer) return undefined;

  return {
    serverId: focusedServer.id,
    serverName: focusedServer.name || focusedServer.id,
    serverType: focusedServer.type,
    status: focusedServer.status,
    cpu: focusedServer.cpu,
    memory: focusedServer.memory,
    disk: focusedServer.disk,
    network: focusedServer.network,
    matchedBy: 'query',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizeBatchStatus(value: unknown): MonitoringBatchServer['status'] {
  return value === 'warning' ||
    value === 'critical' ||
    value === 'offline' ||
    value === 'online'
    ? value
    : 'online';
}

function normalizeBatchMetric(
  value: unknown
): MonitoringBatchRiskSignal['metric'] | undefined {
  return value === 'cpu' ||
    value === 'memory' ||
    value === 'disk' ||
    value === 'network'
    ? value
    : undefined;
}

function normalizeBatchTrend(
  value: unknown
): MonitoringBatchRiskSignal['trend'] {
  return value === 'up' || value === 'down' || value === 'stable'
    ? value
    : 'stable';
}

function normalizeBatchRiskSeverity(
  value: unknown
): MonitoringBatchRiskSignal['severity'] | undefined {
  return value === 'warning' || value === 'critical' ? value : undefined;
}

function normalizeEvidenceKind(
  value: unknown
): MonitoringBatchEvidenceRef['kind'] {
  return value === 'metric' ||
    value === 'log' ||
    value === 'topology' ||
    value === 'rule' ||
    value === 'prediction'
    ? value
    : 'rule';
}

function normalizeEvidenceSeverity(
  value: unknown
): MonitoringBatchEvidenceRef['severity'] {
  return value === 'warning' || value === 'critical' || value === 'info'
    ? value
    : 'warning';
}

function normalizePublicSeverity(
  severity: unknown
): ArtifactEvidence['severity'] {
  if (severity === 'high' || severity === 'critical') return 'critical';
  if (severity === 'medium' || severity === 'warning') return 'warning';
  return 'info';
}

function normalizeAnomalyStatusSeverity(
  severity: unknown
): MetricAnomalyResult['severity'] | 'critical' | 'warning' | undefined {
  if (
    severity === 'low' ||
    severity === 'medium' ||
    severity === 'high' ||
    severity === 'critical' ||
    severity === 'warning'
  ) {
    return severity;
  }
  return undefined;
}

function readServerAnomalyResults(
  analysis: CloudRunAnalysisResponse
): Record<string, unknown> {
  return isRecord(analysis.anomalyDetection?.results)
    ? analysis.anomalyDetection.results
    : {};
}

function deriveServerOverallStatus(
  analysis: CloudRunAnalysisResponse
): ServerAnalysisResult['overallStatus'] {
  if (!analysis.anomalyDetection?.hasAnomalies) {
    return 'online';
  }

  const severities = Object.values(readServerAnomalyResults(analysis))
    .map((result) =>
      isRecord(result)
        ? normalizeAnomalyStatusSeverity(result.severity)
        : undefined
    )
    .filter((severity): severity is NonNullable<typeof severity> => !!severity);

  if (
    severities.includes('high') ||
    severities.includes('critical') ||
    analysis.anomalyDetection.anomalyCount > 1
  ) {
    return 'critical';
  }
  if (
    severities.includes('medium') ||
    severities.includes('warning') ||
    analysis.anomalyDetection.anomalyCount > 0
  ) {
    return 'warning';
  }

  return 'online';
}

function summarizeServerMonitoringAnalysis(
  server: ServerAnalysisResult
): Pick<ServerMonitoringAnalysisArtifact, 'title' | 'summary'> {
  const anomalyCount = server.anomalyDetection?.anomalyCount ?? 0;
  const risingMetrics =
    server.trendPrediction?.summary?.increasingMetrics ?? [];

  return {
    title: `${server.serverName} 이상감지/추세 분석`,
    summary:
      anomalyCount > 0
        ? `${server.serverName}에서 이상 신호 ${anomalyCount}건 감지`
        : risingMetrics.length > 0
          ? `${server.serverName}에서 상승 추세 ${risingMetrics.length}건 감지`
          : `${server.serverName} 상태 정상`,
  };
}

function mapServerMonitoringEvidence(
  server: ServerAnalysisResult
): ArtifactEvidence[] | undefined {
  const evidence = Object.entries(readServerAnomalyResults(server))
    .map(([metric, rawResult]): ArtifactEvidence | undefined => {
      if (!isRecord(rawResult)) return undefined;
      const isAnomaly = rawResult.isAnomaly === true;
      if (!isAnomaly) return undefined;

      const severity = normalizePublicSeverity(rawResult.severity);
      return {
        id: `${server.serverId}-${metric}-anomaly`,
        kind: 'metric',
        serverId: server.serverId,
        metric,
        severity,
        summary: `${server.serverName} ${metric} 이상 신호 ${severity}`,
      };
    })
    .filter((entry): entry is ArtifactEvidence => entry !== undefined);

  return evidence.length > 0 ? evidence : undefined;
}

export async function generateMonitoringAnalysisArtifact({
  query,
  sessionId,
  queryAsOfDataSlot,
  signal,
}: ChatArtifactRequest): Promise<MonitoringAnalysisArtifact> {
  const response = await fetch('/api/ai/intelligent-monitoring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      action: 'analyze_batch',
      serverId: 'all',
      analysisType: 'full',
      query,
      sessionId,
      queryAsOf: createQueryAsOf(queryAsOfDataSlot),
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다. 게스트 로그인 후 이용해주세요.');
    }
    throw new Error(`이상감지/추세 분석 요청 실패: ${response.status}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    data?: unknown;
    _source?: unknown;
  };
  if (!data.success) {
    throw new Error('이상감지/추세 분석 데이터를 받지 못했습니다.');
  }

  const parsedAnalysis = parseMonitoringBatchAnalysisResponse(data.data);
  const analysis =
    parsedAnalysis ??
    buildDegradedMonitoringBatchAnalysisResponse(data.data, queryAsOfDataSlot);
  if (!analysis) {
    throw new Error('이상감지/추세 분석 데이터를 받지 못했습니다.');
  }
  const degraded = parsedAnalysis === null;

  const summary = summarizeMonitoringAnalysis(analysis);
  const roleGroupSummary = buildMonitoringRoleGroupSummary(analysis);
  const capacityAlerts = analysis.capacityAlerts ?? [];
  const queryFocusServer = resolveQueryFocusServer({ analysis, query });
  const evidence =
    mapMonitoringFactPackEvidence(analysis.factPack?.evidenceRefs) ??
    (degraded ? createSchemaDriftEvidence() : undefined);

  return attachArtifactEnvelopeMetadata<MonitoringAnalysisArtifact>(
    {
      kind: 'monitoring-analysis',
      generatedAt: new Date().toISOString(),
      ...summary,
      analysis,
      ...(queryFocusServer ? { queryFocusServer } : {}),
      ...(capacityAlerts.length > 0 ? { capacityAlerts } : {}),
      ...(roleGroupSummary.length > 0 ? { roleGroupSummary } : {}),
      source:
        analysis._source ||
        (typeof data._source === 'string' ? data._source : undefined),
      queryAsOfDataSlot,
    },
    {
      sourceMode: 'tool-result',
      dataSlot: analysis.slot.timeLabel,
      evidence,
      ...(degraded && {
        degradation: {
          degraded: true,
          reasonCode: 'provider_schema_drift',
          fallbackSource: 'tool-based',
        },
      }),
    }
  );
}

export async function generateServerMonitoringArtifact({
  query,
  sessionId,
  serverId,
  serverName,
  currentMetrics,
  queryAsOfDataSlot,
  signal,
}: ServerMonitoringArtifactRequest): Promise<ServerMonitoringAnalysisArtifact> {
  const response = await fetch('/api/ai/intelligent-monitoring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      action: 'analyze_server',
      serverId,
      analysisType: 'full',
      query,
      sessionId,
      currentMetrics,
      queryAsOf: createQueryAsOf(queryAsOfDataSlot),
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다. 게스트 로그인 후 이용해주세요.');
    }
    throw new Error(`이상감지/추세 분석 요청 실패: ${response.status}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    data?: unknown;
    _source?: unknown;
  };
  if (!data.success) {
    throw new Error('단일 서버 이상감지/추세 분석 데이터를 받지 못했습니다.');
  }

  const parsedAnalysis = parseServerMonitoringAnalysisResponse(data.data);
  const analysis =
    parsedAnalysis ??
    buildDegradedServerMonitoringResponse(data.data, serverId);
  if (!analysis) {
    throw new Error('단일 서버 이상감지/추세 분석 데이터를 받지 못했습니다.');
  }
  const degraded = parsedAnalysis === null;

  const server: ServerAnalysisResult = {
    ...analysis,
    serverName,
    overallStatus: deriveServerOverallStatus(analysis),
  };
  const summary = summarizeServerMonitoringAnalysis(server);
  const source =
    analysis._source ||
    (typeof data._source === 'string' ? data._source : undefined);
  const evidence =
    mapServerMonitoringEvidence(server) ??
    (degraded ? createSchemaDriftEvidence() : undefined);

  return attachArtifactEnvelopeMetadata<ServerMonitoringAnalysisArtifact>(
    {
      kind: 'server-monitoring-analysis',
      generatedAt: new Date().toISOString(),
      ...summary,
      serverId,
      serverName,
      overallStatus: server.overallStatus,
      analysis,
      server,
      source,
      queryAsOfDataSlot,
    },
    {
      sourceMode: 'tool-result',
      dataSlot: queryAsOfDataSlot?.timeLabel,
      evidence,
      ...(degraded && {
        degradation: {
          degraded: true,
          reasonCode: 'provider_schema_drift',
          fallbackSource: 'tool-based',
        },
      }),
    }
  );
}
