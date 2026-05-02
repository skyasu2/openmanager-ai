import { createQueryAsOf } from '@/lib/ai/query-as-of';
import type { MonitoringBatchAnalysisResponse } from '@/types/intelligent-monitoring.types';
import type { ChatArtifactRequest, MonitoringAnalysisArtifact } from './types';

function isMonitoringBatchAnalysisResponse(
  value: unknown
): value is MonitoringBatchAnalysisResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as MonitoringBatchAnalysisResponse).success === true &&
    Array.isArray((value as MonitoringBatchAnalysisResponse).servers) &&
    Array.isArray((value as MonitoringBatchAnalysisResponse).riskSignals)
  );
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
}: ChatArtifactRequest): Promise<MonitoringAnalysisArtifact> {
  const response = await fetch('/api/ai/intelligent-monitoring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const data = (await response.json()) as { success?: boolean; data?: unknown };
  if (!data.success || !isMonitoringBatchAnalysisResponse(data.data)) {
    throw new Error('이상감지/추세 분석 데이터를 받지 못했습니다.');
  }

  const summary = summarizeMonitoringAnalysis(data.data);

  return {
    kind: 'monitoring-analysis',
    generatedAt: new Date().toISOString(),
    ...summary,
    analysis: data.data,
    source: data.data._source,
    queryAsOfDataSlot,
  };
}
