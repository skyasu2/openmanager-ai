import { z } from 'zod';
import { createQueryAsOf } from '@/lib/ai/query-as-of';
import type {
  CloudRunAnalysisResponse,
  MetricAnomalyResult,
  MonitoringBatchAnalysisResponse,
  MonitoringBatchEvidenceRef,
  ServerAnalysisResult,
} from '@/types/intelligent-monitoring.types';
import {
  type ArtifactEvidence,
  attachArtifactEnvelopeMetadata,
  type ChatArtifactRequest,
  type MonitoringAnalysisArtifact,
  type ServerMonitoringAnalysisArtifact,
  type ServerMonitoringArtifactRequest,
} from './types';

const MonitoringBatchServerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    status: z.enum(['online', 'warning', 'critical', 'offline']),
    cpu: z.number(),
    memory: z.number(),
    disk: z.number(),
    network: z.number(),
  })
  .passthrough();

const MonitoringBatchRiskSignalSchema = z
  .object({
    id: z.string(),
    serverId: z.string(),
    serverName: z.string(),
    serverType: z.string(),
    metric: z.enum(['cpu', 'memory', 'disk', 'network']),
    value: z.number(),
    threshold: z.number(),
    trend: z.enum(['up', 'down', 'stable']),
    severity: z.enum(['warning', 'critical']),
    evidenceRefId: z.string(),
  })
  .passthrough();

const MonitoringBatchEvidenceRefBaseSchema = z.object({
  id: z.string(),
  kind: z.enum(['metric', 'log', 'topology', 'rule', 'prediction']),
  serverId: z.string().optional(),
  metric: z.string().optional(),
  timeRange: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .passthrough(),
  summary: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  threshold: z.number().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
});

const MonitoringBatchEvidenceRefSchema =
  MonitoringBatchEvidenceRefBaseSchema.passthrough();

const MonitoringBatchFactEvidenceRefSchema = z.object({
  id: z.string(),
  kind: z.enum(['metric', 'log', 'topology', 'rule', 'prediction']),
  serverId: z.string().optional(),
  metric: z.string().optional(),
  timeRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  summary: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  threshold: z.number().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
});

const MonitoringBatchFactSeveritySchema = z.enum(['warning', 'critical']);

const MonitoringBatchFactThresholdSchema = z.object({
  warning: z.number(),
  critical: z.number(),
});

const MonitoringBatchFactThresholdsSchema = z.object({
  cpu: MonitoringBatchFactThresholdSchema,
  memory: MonitoringBatchFactThresholdSchema,
  disk: MonitoringBatchFactThresholdSchema,
  network: MonitoringBatchFactThresholdSchema,
});

const MonitoringBatchFactSummarySchema = z.object({
  total: z.number(),
  online: z.number(),
  warning: z.number(),
  critical: z.number(),
  offline: z.number(),
});

const MonitoringBatchFactSignalSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  serverName: z.string(),
  serverType: z.string(),
  metric: z.enum(['cpu', 'memory', 'disk', 'network']),
  value: z.number(),
  threshold: z.number(),
  thresholdLevel: MonitoringBatchFactSeveritySchema,
  severity: MonitoringBatchFactSeveritySchema,
  evidenceRefId: z.string().optional(),
});

const MonitoringBatchFactPackSchema = z.object({
  factPackVersion: z.string(),
  dataSlot: z.string(),
  sourceMode: z.enum(['replay-json', 'live-otel']),
  queryAsOf: z.string(),
  thresholds: MonitoringBatchFactThresholdsSchema,
  summary: MonitoringBatchFactSummarySchema,
  signals: z.array(MonitoringBatchFactSignalSchema),
  evidenceRefs: z.array(MonitoringBatchFactEvidenceRefSchema),
});

const MonitoringBatchAnalysisResponseSchema = z
  .object({
    success: z.literal(true),
    sourceMode: z.enum(['replay-json', 'live-otel']),
    queryAsOf: z.string(),
    slot: z
      .object({
        slotIndex: z.number(),
        hour: z.number(),
        slotInHour: z.number(),
        minuteOfDay: z.number(),
        timeLabel: z.string(),
        startTime: z.string(),
        endTime: z.string(),
      })
      .passthrough(),
    summary: z.string(),
    servers: z.array(MonitoringBatchServerSchema),
    riskSignals: z.array(MonitoringBatchRiskSignalSchema),
    evidenceRefs: z.array(MonitoringBatchEvidenceRefSchema),
    dataFreshness: z
      .object({
        generatedAt: z.string().nullable(),
        sourceUpdatedAt: z.string().nullable(),
        stale: z.boolean(),
      })
      .passthrough(),
    _source: z.string().optional(),
  })
  .passthrough()
  .transform((analysis): MonitoringBatchAnalysisResponse => {
    const { factPack: rawFactPack, ...rest } = analysis as typeof analysis & {
      factPack?: unknown;
    };
    const parsedFactPack = MonitoringBatchFactPackSchema.safeParse(rawFactPack);

    return {
      ...rest,
      ...(parsedFactPack.success ? { factPack: parsedFactPack.data } : {}),
    } as MonitoringBatchAnalysisResponse;
  });

const ServerMonitoringAnalysisResponseSchema = z
  .object({
    success: z.literal(true),
    serverId: z.string(),
    analysisType: z.enum(['full', 'anomaly', 'trend', 'pattern']),
    timestamp: z.string(),
    _source: z.string().optional(),
  })
  .passthrough()
  .transform(
    (
      analysis
    ): CloudRunAnalysisResponse & {
      _source?: string;
    } => analysis as CloudRunAnalysisResponse & { _source?: string }
  );

export function parseMonitoringBatchAnalysisResponse(
  value: unknown
): MonitoringBatchAnalysisResponse | null {
  const parsed = MonitoringBatchAnalysisResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseServerMonitoringAnalysisResponse(
  value: unknown
): (CloudRunAnalysisResponse & { _source?: string }) | null {
  const parsed = ServerMonitoringAnalysisResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function summarizeMonitoringAnalysis(
  analysis: MonitoringBatchAnalysisResponse
): Omit<
  MonitoringAnalysisArtifact,
  'kind' | 'generatedAt' | 'analysis' | 'source' | 'queryAsOfDataSlot'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const analysis = parseMonitoringBatchAnalysisResponse(data.data);
  if (!data.success || !analysis) {
    throw new Error('이상감지/추세 분석 데이터를 받지 못했습니다.');
  }

  const summary = summarizeMonitoringAnalysis(analysis);
  const evidence = mapMonitoringFactPackEvidence(
    analysis.factPack?.evidenceRefs
  );

  return attachArtifactEnvelopeMetadata(
    {
      kind: 'monitoring-analysis',
      generatedAt: new Date().toISOString(),
      ...summary,
      analysis,
      source:
        analysis._source ||
        (typeof data._source === 'string' ? data._source : undefined),
      queryAsOfDataSlot,
    },
    {
      sourceMode: 'tool-result',
      dataSlot: analysis.slot.timeLabel,
      evidence,
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
  const analysis = parseServerMonitoringAnalysisResponse(data.data);
  if (!data.success || !analysis) {
    throw new Error('단일 서버 이상감지/추세 분석 데이터를 받지 못했습니다.');
  }

  const server: ServerAnalysisResult = {
    ...analysis,
    serverName,
    overallStatus: deriveServerOverallStatus(analysis),
  };
  const summary = summarizeServerMonitoringAnalysis(server);
  const source =
    analysis._source ||
    (typeof data._source === 'string' ? data._source : undefined);

  return attachArtifactEnvelopeMetadata(
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
      evidence: mapServerMonitoringEvidence(server),
    }
  );
}
