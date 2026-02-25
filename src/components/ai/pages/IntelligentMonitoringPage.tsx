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

import { Monitor, Play, RefreshCw, Server } from 'lucide-react';
import { useCallback, useState } from 'react';
import AnalysisResultsCard from '@/components/ai/AnalysisResultsCard';
import { useServerQuery } from '@/hooks/useServerQuery';
import { logger } from '@/lib/logging';
import type {
  AnalysisResponse,
  CloudRunAnalysisResponse,
  MultiServerAnalysisResponse,
  ServerAnalysisResult,
  SystemAnalysisSummary,
} from '@/types/intelligent-monitoring.types';
import type { EnhancedServerMetrics } from '@/types/server';

export default function IntelligentMonitoringPage() {
  // 서버 데이터 (React Query)
  const { data: servers = [] } = useServerQuery();

  // 상태
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            currentMetrics, // Pass real-time metrics
          }),
        });

        if (!response.ok) {
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
        logger.error(`[${serverName}] 분석 오류:`, err);
        return null;
      }
    },
    []
  );

  // 종합 요약 생성 함수
  const createSummary = useCallback(
    (serverResults: ServerAnalysisResult[]): SystemAnalysisSummary => {
      const healthyServers = serverResults.filter(
        (s) => s.overallStatus === 'online'
      ).length;
      const warningServers = serverResults.filter(
        (s) => s.overallStatus === 'warning'
      ).length;
      const criticalServers = serverResults.filter(
        (s) => s.overallStatus === 'critical'
      ).length;

      // 전체 상태 판단
      let overallStatus: 'online' | 'warning' | 'critical' = 'online';
      if (criticalServers > 0) {
        overallStatus = 'critical';
      } else if (warningServers > 0) {
        overallStatus = 'warning';
      }

      // Top Issues 추출 (이상 감지된 것들)
      const topIssues: SystemAnalysisSummary['topIssues'] = [];
      for (const server of serverResults) {
        if (server.anomalyDetection?.hasAnomalies) {
          for (const [metric, result] of Object.entries(
            server.anomalyDetection.results || {}
          )) {
            if (result.isAnomaly) {
              topIssues.push({
                serverId: server.serverId,
                serverName: server.serverName,
                metric,
                severity: result.severity,
                currentValue: result.currentValue,
              });
            }
          }
        }
      }

      // 상승 추세 예측 추출
      const predictions: SystemAnalysisSummary['predictions'] = [];
      for (const server of serverResults) {
        if (server.trendPrediction?.summary?.hasRisingTrends) {
          for (const [metric, result] of Object.entries(
            server.trendPrediction.results || {}
          )) {
            if (result.trend === 'increasing' && result.changePercent > 5) {
              predictions.push({
                serverId: server.serverId,
                serverName: server.serverName,
                metric,
                trend: result.trend,
                currentValue: result.currentValue,
                predictedValue: result.predictedValue,
                changePercent: result.changePercent,
                thresholdBreachMessage: (
                  result as { thresholdBreach?: { humanReadable?: string } }
                ).thresholdBreach?.humanReadable,
              });
            }
          }
        }
      }

      return {
        totalServers: serverResults.length,
        healthyServers,
        warningServers,
        criticalServers,
        overallStatus,
        topIssues: topIssues.slice(0, 5), // 상위 5개
        predictions: predictions.slice(0, 5), // 상위 5개
      };
    },
    []
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
        // 전체 시스템 분석 (각 서버 순차 분석)
        const targetServers =
          servers.length > 0
            ? servers
            : [
                { id: 'web-server-01', name: '웹 서버 01' },
                { id: 'web-server-02', name: '웹 서버 02' },
                { id: 'db-server-01', name: 'DB 서버 01' },
                { id: 'api-server-01', name: 'API 서버 01' },
              ];

        setProgress({ current: 0, total: targetServers.length });

        const serverResults: ServerAnalysisResult[] = [];

        for (let i = 0; i < targetServers.length; i++) {
          const server = targetServers[i];
          if (!server) continue;

          setProgress({ current: i + 1, total: targetServers.length });

          const serverResult = await analyzeSingleServer(
            server.id,
            server.name,
            'hostname' in server ? server : undefined
          );
          if (serverResult) {
            serverResults.push(serverResult);
          }
        }

        if (serverResults.length === 0) {
          throw new Error('모든 서버 분석에 실패했습니다.');
        }

        // 다중 서버 응답 생성
        const multiServerResult: MultiServerAnalysisResponse = {
          success: true,
          isMultiServer: true,
          timestamp: new Date().toISOString(),
          servers: serverResults,
          summary: createSummary(serverResults),
        };

        setResult(multiServerResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsAnalyzing(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [selectedServer, servers, analyzeSingleServer, createSummary]);

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
          <h1 className="flex items-center gap-3 text-xl font-bold text-gray-800">
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
