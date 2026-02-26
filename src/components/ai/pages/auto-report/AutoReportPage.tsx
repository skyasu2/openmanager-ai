/**
 * 📄 자동 장애 보고서 페이지 v2.3
 *
 * 기능:
 * - 실시간 장애 리포트 생성 및 관리
 * - /api/ai/incident-report API 연동
 * - 전체 서버 종합 분석 표시
 * - 히스토리 조회 탭
 *
 * v2.3 변경사항 (2026-01-12):
 * - 탭 구조 추가 (생성 / 히스토리)
 * - IncidentHistoryPage 통합
 * - SLAWidget 추가
 *
 * v2.2 변경사항 (2025-12-27):
 * - 파일 분리 리팩토링 (941줄 → ~350줄)
 * - 타입, 유틸, 포맷터, 카드 컴포넌트 분리
 */

'use client';

import {
  AlertCircle,
  BookOpen,
  FileText,
  History,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { rulesLoader } from '@/config/rules/loader';
import { useServerQuery } from '@/hooks/useServerQuery';
import { logger } from '@/lib/logging';

import { IncidentHistoryPage } from './IncidentHistoryPage';
import ReportCard from './ReportCard';
import type { IncidentReport, ServerMetric } from './types';
import { extractNumericValue, mapSeverity } from './utils';

// ============================================================================
// Component
// ============================================================================

type TabType = 'generate' | 'history';

export default function AutoReportPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('generate');

  // Server data (React Query)
  const { data: servers = [] } = useServerQuery();

  // Reports state
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [downloadMenuId, setDownloadMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ragEnabled, setRagEnabled] = useState(false);

  // Generate new report
  const handleGenerateReport = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const metrics: ServerMetric[] = servers.map((server) => ({
        server_id: server.id,
        server_name: server.name,
        cpu: extractNumericValue(server.cpu ?? 0),
        memory: extractNumericValue(server.memory ?? 0),
        disk: extractNumericValue(server.disk ?? 0),
        network: extractNumericValue(server.network ?? 0),
        timestamp: new Date().toISOString(),
      }));

      const response = await fetch('/api/ai/incident-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          metrics,
          notify: true,
          enableRAG: ragEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();

      // Fallback 응답 처리
      if (data.source === 'fallback' || !data.success) {
        setError(
          data.message ||
            '보고서 생성 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.'
        );
        return;
      }

      // 보고서 데이터 없음 처리
      if (!data.report) {
        setError('보고서 데이터를 받지 못했습니다. 다시 시도해주세요.');
        return;
      }

      if (data.success && data.report) {
        // 시스템 요약: API 데이터 우선, 없으면 로컬 계산
        const apiSystemSummary = data.report.system_summary;
        const systemSummary = apiSystemSummary
          ? {
              totalServers: apiSystemSummary.total_servers ?? metrics.length,
              healthyServers: apiSystemSummary.healthy_servers ?? 0,
              warningServers: apiSystemSummary.warning_servers ?? 0,
              criticalServers: apiSystemSummary.critical_servers ?? 0,
            }
          : (() => {
              const statusCounts = { online: 0, warning: 0, critical: 0 };
              for (const m of metrics) {
                const status = rulesLoader.getServerStatus({
                  cpu: m.cpu,
                  memory: m.memory,
                  disk: m.disk,
                });
                statusCounts[status]++;
              }
              return {
                totalServers: metrics.length,
                healthyServers: statusCounts.online,
                warningServers: statusCounts.warning,
                criticalServers: statusCounts.critical,
              };
            })();

        // 이상 항목: API 데이터 우선, 없으면 로컬 계산
        const apiAnomalies = data.report.anomalies;
        const anomalies =
          Array.isArray(apiAnomalies) && apiAnomalies.length > 0
            ? apiAnomalies
            : metrics
                .filter(
                  (m) =>
                    rulesLoader.isWarning('cpu', m.cpu) ||
                    rulesLoader.isCritical('cpu', m.cpu) ||
                    rulesLoader.isWarning('memory', m.memory) ||
                    rulesLoader.isCritical('memory', m.memory) ||
                    rulesLoader.isWarning('disk', m.disk) ||
                    rulesLoader.isCritical('disk', m.disk)
                )
                .flatMap((m) => {
                  const items = [];
                  if (
                    rulesLoader.isWarning('cpu', m.cpu) ||
                    rulesLoader.isCritical('cpu', m.cpu)
                  )
                    items.push({
                      server_id: m.server_id,
                      server_name: m.server_name,
                      metric: 'CPU',
                      value: m.cpu,
                      severity: rulesLoader.isCritical('cpu', m.cpu)
                        ? 'critical'
                        : 'warning',
                    });
                  if (
                    rulesLoader.isWarning('memory', m.memory) ||
                    rulesLoader.isCritical('memory', m.memory)
                  )
                    items.push({
                      server_id: m.server_id,
                      server_name: m.server_name,
                      metric: 'Memory',
                      value: m.memory,
                      severity: rulesLoader.isCritical('memory', m.memory)
                        ? 'critical'
                        : 'warning',
                    });
                  if (
                    rulesLoader.isWarning('disk', m.disk) ||
                    rulesLoader.isCritical('disk', m.disk)
                  )
                    items.push({
                      server_id: m.server_id,
                      server_name: m.server_name,
                      metric: 'Disk',
                      value: m.disk,
                      severity: rulesLoader.isCritical('disk', m.disk)
                        ? 'critical'
                        : 'warning',
                    });
                  return items;
                });

        const newReport: IncidentReport = {
          id: data.report.id,
          title: data.report.title,
          severity: mapSeverity(data.report.severity),
          timestamp: new Date(data.report.created_at),
          affectedServers: data.report.affected_servers || [],
          description:
            data.report.root_cause_analysis?.primary_cause ||
            data.report.description ||
            '새로운 이상 징후가 감지되었습니다.',
          status: 'active',
          pattern: data.report.pattern,
          recommendations: data.report.recommendations,
          systemSummary,
          anomalies,
          timeline: data.report.timeline,
        };

        setReports((prev) => [newReport, ...prev]);
      }
    } catch (err) {
      logger.error('보고서 생성 실패:', err);
      setError(
        err instanceof Error
          ? err.message
          : '보고서 생성 중 오류가 발생했습니다.'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [servers, ragEnabled]);

  // Event handlers
  const handleResolve = useCallback((reportId: string) => {
    setReports((prev) =>
      prev.map((report) =>
        report.id === reportId
          ? { ...report, status: 'resolved' as const }
          : report
      )
    );
  }, []);

  const toggleDetail = useCallback((reportId: string) => {
    setSelectedReport((prev) => (prev === reportId ? null : reportId));
  }, []);

  // Filter reports
  const filteredReports =
    selectedSeverity === 'all'
      ? reports
      : reports.filter((report) => report.severity === selectedSeverity);

  // Filter options
  const filterOptions = [
    { id: 'all', label: '전체', count: reports.length },
    {
      id: 'critical',
      label: '심각',
      count: reports.filter((r) => r.severity === 'critical').length,
    },
    {
      id: 'warning',
      label: '경고',
      count: reports.filter((r) => r.severity === 'warning').length,
    },
    {
      id: 'info',
      label: '정보',
      count: reports.filter((r) => r.severity === 'info').length,
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  // 히스토리 탭은 별도 컴포넌트로 렌더링
  if (activeTab === 'history') {
    return (
      <div className="flex h-full flex-col">
        {/* Tab Header */}
        <div className="border-b border-gray-200 bg-white/80 px-4 pt-4 backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-red-500 to-pink-500">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  자동 장애보고서
                </h2>
                <p className="text-sm text-gray-600">
                  실시간 장애 리포트 생성 및 관리
                </p>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('generate')}
              className="flex items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
              보고서 생성
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="flex items-center gap-2 rounded-t-lg border-b-2 border-blue-500 px-4 py-2 text-sm font-medium text-blue-600"
            >
              <History className="h-4 w-4" />
              히스토리
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <IncidentHistoryPage />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-linear-to-br from-slate-50 to-pink-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 px-4 pt-4 backdrop-blur-sm">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-red-500 to-pink-500">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                자동 장애보고서
              </h2>
              <p className="text-sm text-gray-600">
                실시간 장애 리포트 생성 및 관리
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRagEnabled((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                ragEnabled
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={ragEnabled ? 'RAG 검색 끄기' : 'RAG 검색 켜기'}
            >
              <BookOpen className="h-4 w-4" />
              RAG
            </button>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="flex items-center space-x-2 rounded-lg bg-red-500 px-4 py-2 text-white transition-all duration-200 hover:scale-105 hover:bg-red-600 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`}
              />
              <span>{isGenerating ? '생성 중...' : '새 보고서'}</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className="flex items-center gap-2 rounded-t-lg border-b-2 border-red-500 px-4 py-2 text-sm font-medium text-red-600"
          >
            <RefreshCw className="h-4 w-4" />
            보고서 생성
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            <History className="h-4 w-4" />
            히스토리
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="border-b border-gray-200 bg-white/50 p-4">
        <div className="flex space-x-2">
          {filterOptions.map((filter) => (
            <button
              type="button"
              key={filter.id}
              onClick={() => setSelectedSeverity(filter.id)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                selectedSeverity === filter.id
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-red-100'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  보고서 생성 실패
                </p>
                <p className="mt-0.5 text-xs text-red-600">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Report List */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {filteredReports.map((report, index) => (
          <ReportCard
            key={report.id}
            report={report}
            index={index}
            isSelected={selectedReport === report.id}
            downloadMenuId={downloadMenuId}
            onToggleDetail={toggleDetail}
            onResolve={handleResolve}
            onSetDownloadMenuId={setDownloadMenuId}
          />
        ))}

        {filteredReports.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-700">
              보고서가 없습니다
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              새 보고서를 생성하여 장애 현황을 분석해보세요.
            </p>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="inline-flex items-center space-x-2 rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition-all hover:scale-105 hover:bg-red-600 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`}
              />
              <span>첫 보고서 생성하기</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Stats */}
      <div className="border-t border-gray-200 bg-white/80 p-4 backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-red-600">
              {reports.filter((r) => r.status === 'active').length}
            </div>
            <div className="text-xs text-gray-500">활성 이슈</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">
              {reports.filter((r) => r.status === 'resolved').length}
            </div>
            <div className="text-xs text-gray-500">해결됨</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-600">
              {reports.length}
            </div>
            <div className="text-xs text-gray-500">전체</div>
          </div>
        </div>
      </div>
    </div>
  );
}
