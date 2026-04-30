/**
 * 이상감지/예측 페이지 v5.1
 *
 * 버튼 클릭으로 서버 상태 분석 및 예측
 * - Cloud Run /api/ai/analyze-server 호출
 * - 이상 탐지 + 트렌드 예측 + AI 인사이트 표시
 *
 * v5.1 변경사항 (2025-12-26):
 * - 전체 시스템 분석: 각 서버별 개별 분석 + 종합 요약
 * - 다중 서버 결과 표시 지원
 */

'use client';

import { BookOpen, Monitor, Play, RefreshCw, Server } from 'lucide-react';
import { useCallback, useState } from 'react';
import AnalysisResultsCard from '@/components/ai/AnalysisResultsCard';
import { useServerQuery } from '@/hooks/useServerQuery';
import { createQueryAsOf } from '@/lib/ai/query-as-of';
import { logger } from '@/lib/logging';
import type { JobDataSlot } from '@/types/ai-jobs';
import type {
  AnalysisResponse,
  CloudRunAnalysisResponse,
  MetricAnomalyResult,
  MonitoringBatchAnalysisResponse,
  MonitoringBatchRiskSignal,
  MonitoringBatchServer,
  MultiServerAnalysisResponse,
  ServerAnalysisResult,
  SystemAnalysisSummary,
} from '@/types/intelligent-monitoring.types';
import type { EnhancedServerMetrics } from '@/types/server';

interface IntelligentMonitoringPageProps {
  queryAsOfDataSlot?: JobDataSlot;
}

function batchStatusToOverallStatus(
  status: MonitoringBatchServer['status']
): ServerAnalysisResult['overallStatus'] {
  if (status === 'critical' || status === 'offline') {
    return 'critical';
  }
  if (status === 'warning') {
    return 'warning';
  }
  return 'online';
}

function riskSeverityToAnomalySeverity(
  severity: MonitoringBatchRiskSignal['severity']
): MetricAnomalyResult['severity'] {
  return severity === 'critical' ? 'high' : 'medium';
}

function buildSnapshotAnomalyResults(
  server: MonitoringBatchServer,
  riskSignals: MonitoringBatchRiskSignal[]
): Record<string, MetricAnomalyResult> {
  return Object.fromEntries(
    riskSignals
      .filter((signal) => signal.serverId === server.id)
      .map((signal) => [
        signal.metric,
        {
          isAnomaly: true,
          severity: riskSeverityToAnomalySeverity(signal.severity),
          confidence: 0.9,
          currentValue: signal.value,
          threshold: {
            upper: signal.threshold,
            lower: 0,
          },
        },
      ])
  );
}

function createBatchSystemSummary(
  batch: MonitoringBatchAnalysisResponse
): SystemAnalysisSummary {
  const healthyServers = batch.servers.filter(
    (server) => server.status === 'online'
  ).length;
  const warningServers = batch.servers.filter(
    (server) => server.status === 'warning'
  ).length;
  const criticalServers = batch.servers.filter(
    (server) => server.status === 'critical' || server.status === 'offline'
  ).length;

  return {
    totalServers: batch.servers.length,
    healthyServers,
    warningServers,
    criticalServers,
    overallStatus:
      criticalServers > 0
        ? 'critical'
        : warningServers > 0
          ? 'warning'
          : 'online',
    topIssues: batch.riskSignals.map((signal) => ({
      serverId: signal.serverId,
      serverName: signal.serverName,
      metric: signal.metric,
      severity: riskSeverityToAnomalySeverity(signal.severity),
      currentValue: signal.value,
      confidence: 0.9,
      threshold: {
        upper: signal.threshold,
        lower: 0,
      },
      reason: `${signal.metric} ${Math.round(signal.value)}% >= ${signal.threshold}%`,
      recommendation:
        signal.severity === 'critical'
          ? '즉시 원인 프로세스와 최근 배포/배치 작업을 확인하세요.'
          : '다음 10분 슬롯에서도 유지되는지 확인하고 여유 용량을 점검하세요.',
    })),
    predictions: [],
  };
}

function adaptMonitoringBatchResponse(
  batch: MonitoringBatchAnalysisResponse
): MultiServerAnalysisResponse {
  const timestamp = batch.queryAsOf || new Date().toISOString();
  const servers: ServerAnalysisResult[] = batch.servers.map((server) => {
    const anomalyResults = buildSnapshotAnomalyResults(
      server,
      batch.riskSignals
    );
    const anomalyCount = Object.keys(anomalyResults).length;

    return {
      success: true,
      serverId: server.id,
      serverName: server.name,
      analysisType: 'full',
      timestamp,
      anomalyDetection: {
        success: true,
        serverId: server.id,
        serverName: server.name,
        anomalyCount,
        hasAnomalies: anomalyCount > 0,
        results: anomalyResults,
        timestamp,
        _algorithm: 'monitoring-snapshot-risk-signal',
        _engine: batch._source ?? 'Monitoring Snapshot',
        _cached: false,
      },
      overallStatus: batchStatusToOverallStatus(server.status),
    };
  });

  return {
    success: true,
    isMultiServer: true,
    timestamp,
    servers,
    summary: createBatchSystemSummary(batch),
  };
}

export default function IntelligentMonitoringPage({
  queryAsOfDataSlot,
}: IntelligentMonitoringPageProps = {}) {
  // 서버 데이터 (React Query)
  const { data: servers = [] } = useServerQuery();

  // 상태
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ragEnabled, setRagEnabled] = useState(false);

  // 🔧 P3: useCallback으로 핸들러 메모이제이션
  const handleServerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedServer(e.target.value);
    },
    []
  );

  // 단일 서버 분석 함수
  const analyzeSingleServer = useCallback(
    async (
      serverId: string,
      serverName: string,
      serverData?: EnhancedServerMetrics
    ): Promise<ServerAnalysisResult | null> => {
      try {
        // Prepare current metrics for AI Engine
        const currentMetrics = serverData
          ? {
              cpu: serverData.cpu,
              memory: serverData.memory,
              disk: serverData.disk,
              network: serverData.network,
              load1: serverData.systemInfo?.loadAverage?.split(',')[0]
                ? parseFloat(serverData.systemInfo.loadAverage.split(',')[0]!)
                : undefined,
              load5: serverData.systemInfo?.loadAverage?.split(',')[1]
                ? parseFloat(serverData.systemInfo.loadAverage.split(',')[1]!)
                : undefined,
              cpuCores: serverData.specs?.cpu_cores,
            }
          : undefined;

        const response = await fetch('/api/ai/intelligent-monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze_server',
            serverId,
            analysisType: 'full',
            currentMetrics,
            enableRAG: ragEnabled,
            queryAsOf: createQueryAsOf(queryAsOfDataSlot),
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              '로그인이 필요합니다. 게스트 로그인 후 이용해주세요.'
            );
          }
          logger.error(`[${serverName}] API 요청 실패: ${response.status}`);
          return null;
        }

        const data = await response.json();

        if (!data.success) {
          logger.error(`[${serverName}] 분석 실패:`, data.error);
          return null;
        }

        const analysisData = data.data as CloudRunAnalysisResponse;

        // 전체 상태 판단
        let overallStatus: 'online' | 'warning' | 'critical' = 'online';
        if (analysisData.anomalyDetection?.hasAnomalies) {
          const anomalyResults = analysisData.anomalyDetection.results;
          const severities = Object.values(anomalyResults).map(
            (r) => r.severity
          );
          if (severities.includes('high')) {
            overallStatus = 'critical';
          } else if (severities.includes('medium')) {
            overallStatus = 'warning';
          }
        }

        return {
          ...analysisData,
          serverName,
          overallStatus,
        };
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.includes('로그인이 필요합니다')
        ) {
          throw err;
        }
        logger.error(`[${serverName}] 분석 오류:`, err);
        return null;
      }
    },
    [ragEnabled, queryAsOfDataSlot]
  );

  // 분석 실행
  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setProgress({ current: 0, total: 0 });

    try {
      if (selectedServer) {
        // 단일 서버 분석
        const serverInfo = servers.find((s) => s.id === selectedServer);
        const serverResult = await analyzeSingleServer(
          selectedServer,
          serverInfo?.name || selectedServer,
          serverInfo // Pass server info
        );

        if (!serverResult) {
          throw new Error('서버 분석에 실패했습니다.');
        }

        // 단일 서버도 CloudRunAnalysisResponse로 반환
        setResult(serverResult);
      } else {
        // 전체 시스템 분석은 Cloud Run batch endpoint 1회 호출로 처리한다.
        setProgress({ current: 0, total: 1 });
        const response = await fetch('/api/ai/intelligent-monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze_batch',
            serverId: 'all',
            analysisType: 'full',
            enableRAG: ragEnabled,
            queryAsOf: createQueryAsOf(queryAsOfDataSlot),
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              '로그인이 필요합니다. 게스트 로그인 후 이용해주세요.'
            );
          }
          throw new Error('전체 시스템 분석에 실패했습니다.');
        }

        const data = await response.json();
        if (!data.success || !data.data) {
          throw new Error('전체 시스템 분석에 실패했습니다.');
        }

        setProgress({ current: 1, total: 1 });
        setResult(
          adaptMonitoringBatchResponse(
            data.data as MonitoringBatchAnalysisResponse
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsAnalyzing(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [
    selectedServer,
    servers,
    analyzeSingleServer,
    ragEnabled,
    queryAsOfDataSlot,
  ]);

  // 초기화
  const resetAnalysis = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="flex h-full flex-col bg-linear-to-br from-slate-50 to-emerald-50">
      {/* 헤더 */}
      <header className="border-b border-gray-200 bg-white/80 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-3 text-lg font-bold text-gray-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-r from-emerald-500 to-teal-500">
              <Monitor className="h-5 w-5 text-white" />
            </div>
            이상감지/예측
          </h1>
        </div>
      </header>

      {/* 컨트롤 영역 */}
      <div className="border-b border-gray-100 bg-white p-4">
        <div className="flex items-center gap-4">
          {/* 서버 선택 */}
          <div className="flex-1">
            <label
              htmlFor="server-select"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              분석 대상
            </label>
            <select
              id="server-select"
              value={selectedServer}
              onChange={handleServerChange}
              disabled={isAnalyzing}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="">
                전체 시스템 ({servers.length || 4}개 서버)
              </option>
              {servers.length > 0
                ? servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))
                : [
                    { id: 'web-server-01', name: '웹 서버 01' },
                    { id: 'web-server-02', name: '웹 서버 02' },
                    { id: 'db-server-01', name: 'DB 서버 01' },
                    { id: 'api-server-01', name: 'API 서버 01' },
                  ].map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
            </select>
          </div>

          {/* 버튼 그룹 */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setRagEnabled((prev) => !prev)}
              aria-pressed={ragEnabled}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                ragEnabled
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={ragEnabled ? 'RAG 검색 끄기' : 'RAG 검색 켜기'}
            >
              <BookOpen className="mr-1.5 inline h-4 w-4" />
              RAG
            </button>
            <button
              type="button"
              onClick={resetAnalysis}
              disabled={isAnalyzing || (!result && !error)}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className="mr-1.5 inline h-4 w-4" />
              초기화
            </button>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 px-6 py-2 text-sm font-medium text-white shadow-md hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="mr-1.5 inline h-4 w-4 animate-spin" />
                  {progress.total > 0
                    ? `분석 중 (${progress.current}/${progress.total})`
                    : '분석 중...'}
                </>
              ) : (
                <>
                  <Play className="mr-1.5 inline h-4 w-4" />
                  {selectedServer ? '분석 시작' : '전체 분석'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* 진행률 표시 */}
        {isAnalyzing && progress.total > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                서버 분석 진행 중...
              </span>
              <span>
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnalysisResultsCard
          result={result}
          isLoading={isAnalyzing}
          error={error}
          onRetry={runAnalysis}
        />
      </div>
    </div>
  );
}
