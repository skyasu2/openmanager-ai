/**
 * 이상감지/추세 페이지 v5.1
 *
 * 버튼 클릭으로 서버 상태와 경량 추세 분석
 * - Cloud Run /api/ai/analyze-server 호출
 * - 이상 탐지 + 트렌드 분석 + AI 인사이트 표시
 *
 * v5.1 변경사항 (2025-12-26):
 * - 전체 시스템 분석: 각 서버별 개별 분석 + 종합 요약
 * - 다중 서버 결과 표시 지원
 */

'use client';

import { Monitor, Play, RefreshCw, Server } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import AnalysisResultsCard from '@/components/ai/AnalysisResultsCard';
import { useServerQuery } from '@/hooks/useServerQuery';
import {
  createArtifactExecutionWorkspaceId,
  executeChatArtifact,
  saveArtifactExecutionReplayPack,
} from '@/lib/ai/chat-artifacts/artifact-execution';
import { createArtifactWorkspaceStore } from '@/lib/ai/chat-artifacts/artifact-workspace-store';
import type {
  MonitoringAnalysisArtifact,
  ServerMonitoringCurrentMetrics,
} from '@/lib/ai/domains/monitoring/artifact-types';
import type { JobDataSlot } from '@/types/ai-jobs';
import type {
  AnalysisResponse,
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
  artifactWorkspaceId?: string;
  queryAsOfDataSlot?: JobDataSlot;
  autoAnalyzeOnVisible?: boolean;
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

function clampConfidence(value: number): number {
  return Math.max(0.5, Math.min(0.98, Math.round(value * 100) / 100));
}

function calculateSnapshotRiskConfidence(
  signal: MonitoringBatchRiskSignal
): number {
  const distanceAboveThreshold = Math.max(signal.value - signal.threshold, 0);
  const remainingRange = Math.max(100 - signal.threshold, 1);
  const thresholdDistanceRatio = Math.min(
    distanceAboveThreshold / remainingRange,
    1
  );
  const base = signal.severity === 'critical' ? 0.78 : 0.58;
  const distanceWeight = signal.severity === 'critical' ? 0.2 : 0.25;
  const trendAdjustment =
    signal.trend === 'up' ? 0.03 : signal.trend === 'down' ? -0.04 : 0;

  return clampConfidence(
    base + thresholdDistanceRatio * distanceWeight + trendAdjustment
  );
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
          confidence: calculateSnapshotRiskConfidence(signal),
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
      confidence: calculateSnapshotRiskConfidence(signal),
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

function createServerMonitoringCurrentMetrics(
  serverData?: EnhancedServerMetrics
): ServerMonitoringCurrentMetrics | undefined {
  if (!serverData) return undefined;

  return {
    cpu: serverData.cpu,
    memory: serverData.memory,
    disk: serverData.disk,
    network: serverData.network,
    load1: serverData.systemInfo?.loadAverage?.split(',')[0]
      ? Number.parseFloat(serverData.systemInfo.loadAverage.split(',')[0]!)
      : undefined,
    load5: serverData.systemInfo?.loadAverage?.split(',')[1]
      ? Number.parseFloat(serverData.systemInfo.loadAverage.split(',')[1]!)
      : undefined,
    cpuCores: serverData.specs?.cpu_cores,
  };
}

export default function IntelligentMonitoringPage({
  artifactWorkspaceId,
  queryAsOfDataSlot,
  autoAnalyzeOnVisible = false,
}: IntelligentMonitoringPageProps = {}) {
  // 서버 데이터 (React Query)
  const {
    data: servers = [],
    isLoading: isServerListLoading,
    isError: isServerListError,
  } = useServerQuery();

  // 상태
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasAutoAnalyzedRef = useRef(false);

  useEffect(() => {
    if (!artifactWorkspaceId) return;

    const replayPack =
      createArtifactWorkspaceStore().readReplayPack(artifactWorkspaceId);
    const artifact = replayPack?.entries.find(
      (entry) => entry.schema.artifactKind === 'monitoring-analysis'
    )?.payload as MonitoringAnalysisArtifact | undefined;
    if (!artifact) return;

    hasAutoAnalyzedRef.current = true;
    setError(null);
    setIsAnalyzing(false);
    setProgress({ current: 0, total: 0 });
    setResult(adaptMonitoringBatchResponse(artifact.analysis));
  }, [artifactWorkspaceId]);

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
    ): Promise<ServerAnalysisResult> => {
      const artifact = await executeChatArtifact({
        kind: 'server-monitoring-analysis',
        query: `${serverName} 이상감지/추세 분석`,
        sessionId: 'intelligent-monitoring-page',
        serverId,
        serverName,
        currentMetrics: createServerMonitoringCurrentMetrics(serverData),
        queryAsOfDataSlot,
      });
      saveArtifactExecutionReplayPack({
        artifact,
        workspaceId: createArtifactExecutionWorkspaceId(artifact),
      });

      return artifact.server;
    },
    [queryAsOfDataSlot]
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
        if (!serverInfo) {
          throw new Error(
            '선택한 서버 데이터를 찾을 수 없습니다. 서버 목록을 다시 확인해 주세요.'
          );
        }
        const serverResult = await analyzeSingleServer(
          selectedServer,
          serverInfo.name,
          serverInfo // Pass server info
        );

        setResult(serverResult);
      } else {
        // 전체 시스템 분석은 Chat과 동일한 artifact execution layer를 사용한다.
        setProgress({ current: 0, total: 1 });
        const artifact = await executeChatArtifact({
          kind: 'monitoring-analysis',
          query: '전체 시스템 이상감지/추세 분석',
          sessionId: 'intelligent-monitoring-page',
          queryAsOfDataSlot,
        });
        saveArtifactExecutionReplayPack({
          artifact,
          workspaceId: createArtifactExecutionWorkspaceId(artifact),
        });
        setProgress({ current: 1, total: 1 });
        setResult(adaptMonitoringBatchResponse(artifact.analysis));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsAnalyzing(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [selectedServer, servers, analyzeSingleServer, queryAsOfDataSlot]);

  useEffect(() => {
    if (!autoAnalyzeOnVisible || hasAutoAnalyzedRef.current) {
      return;
    }

    hasAutoAnalyzedRef.current = true;
    void runAnalysis();
  }, [autoAnalyzeOnVisible, runAnalysis]);

  const serverListStatusLabel = isServerListLoading
    ? '서버 목록 로딩 중'
    : servers.length > 0
      ? `전체 시스템 (${servers.length}개 서버)`
      : isServerListError
        ? '전체 시스템 (서버 목록 로드 실패)'
        : '전체 시스템 (서버 목록 없음)';

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
            이상감지/추세
          </h1>
          {queryAsOfDataSlot && (
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              기준 {queryAsOfDataSlot.timeLabel} · slot{' '}
              {queryAsOfDataSlot.slotIndex}
            </span>
          )}
        </div>
      </header>

      {/* 컨트롤 영역 */}
      <div className="border-b border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          {/* 서버 선택 */}
          <div className="min-w-0 flex-1">
            <label
              htmlFor="server-select"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              분석 대상
            </label>
            <select
              id="server-select"
              aria-describedby="server-select-help"
              value={selectedServer}
              onChange={handleServerChange}
              disabled={isAnalyzing || isServerListLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="">{serverListStatusLabel}</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
            <p id="server-select-help" className="mt-1 text-xs text-gray-500">
              전체 시스템 또는 특정 서버를 선택해 이상감지·추세 분석 범위를
              정합니다.
            </p>
            {servers.length === 0 && !isServerListLoading && (
              <p className="mt-1 text-xs text-amber-700">
                서버 목록을 불러오지 못해 단일 서버 분석 옵션은 숨겼습니다. 전체
                분석은 AI Engine의 현재 데이터 슬롯 기준으로 실행됩니다.
              </p>
            )}
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
