import { z } from 'zod';
import { createQueryAsOf } from '@/lib/ai/query-as-of';
import type { MonitoringBatchAnalysisResponse } from '@/types/intelligent-monitoring.types';
import type { ChatArtifactRequest, MonitoringAnalysisArtifact } from './types';

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

const MonitoringBatchEvidenceRefSchema = z
  .object({
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
  })
  .passthrough();

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
  .passthrough();

export function parseMonitoringBatchAnalysisResponse(
  value: unknown
): MonitoringBatchAnalysisResponse | null {
  const parsed = MonitoringBatchAnalysisResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function summarizeMonitoringAnalysis(
  analysis: MonitoringBatchAnalysisResponse
): Omit<
  MonitoringAnalysisArtifact,
  'kind' | 'generatedAt' | 'analysis' | 'source' | 'queryAsOfDataSlot'
> {
  const warningServers = analysis.servers.filter(
    (server) => server.status === 'warning'
  ).length;
  const criticalServers = analysis.servers.filter(
    (server) => server.status === 'critical' || server.status === 'offline'
  ).length;
  const serverCount = analysis.servers.length;
  const riskSignalCount = analysis.riskSignals.length;

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

  return {
    kind: 'monitoring-analysis',
    generatedAt: new Date().toISOString(),
    ...summary,
    analysis,
    source:
      analysis._source ||
      (typeof data._source === 'string' ? data._source : undefined),
    queryAsOfDataSlot,
  };
}
