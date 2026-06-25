/**
 * 📄 자동 장애 보고서 페이지 v2.4
 *
 * 기능:
 * - 클릭 시 장애 리포트 생성 및 다운로드
 * - /api/ai/incident-report API 연동
 * - 전체 서버 종합 분석 표시
 * - 보고서는 세션 내 메모리에만 유지
 */

'use client';

import { AlertCircle, FileText, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  createArtifactExecutionWorkspaceId,
  executeChatArtifact,
  saveArtifactExecutionReplayPack,
} from '@/lib/ai/chat-artifacts/artifact-execution';
import { createArtifactWorkspaceStore } from '@/lib/ai/chat-artifacts/artifact-workspace-store';
import type { IncidentReportArtifact } from '@/lib/ai/domains/monitoring/artifact-types';
import { logger } from '@/lib/logging';
import type { JobDataSlot } from '@/types/ai-jobs';

import ReportCard from './ReportCard';
import type { IncidentReport } from './types';

// ============================================================================
// Module-level cache — survives Activity hide/show and potential remounts
// ============================================================================
let reportsCache: IncidentReport[] = [];

interface AutoReportPageProps {
  artifactWorkspaceId?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

interface ReportQuickStart {
  id: string;
  label: string;
  description: string;
  query: string;
  category: string;
  severity?: string;
}

const REPORT_QUICK_STARTS: ReportQuickStart[] = [
  {
    id: 'incident',
    label: '장애 보고서',
    description: '현재 임계치 초과 서버와 조치 우선순위 정리',
    query: '현재 이상 징후를 장애 보고서 형식으로 정리해줘',
    category: 'incident',
    severity: 'auto',
  },
  {
    id: 'ops-summary',
    label: '정기 운영 보고서',
    description: '24시간 상태와 경고 서버 추이를 운영 요약으로 정리',
    query: '최근 24시간 운영 상태를 정기 운영 보고서로 요약해줘',
    category: 'operations',
    severity: 'info',
  },
  {
    id: 'risk-summary',
    label: '리스크 요약 보고서',
    description: '위험 서버의 장애 가능성과 우선 조치 항목을 보고서로 정리',
    query: '현재 위험 서버의 장애 리스크와 우선 조치 항목을 보고서로 정리해줘',
    category: 'risk',
    severity: 'warning',
  },
];

export default function AutoReportPage({
  artifactWorkspaceId,
  queryAsOfDataSlot,
}: AutoReportPageProps = {}) {
  // Reports state — initialized from module-level cache
  const [reports, setReportsState] = useState<IncidentReport[]>(reportsCache);
  const setReports = useCallback(
    (
      updater: IncidentReport[] | ((prev: IncidentReport[]) => IncidentReport[])
    ) => {
      setReportsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        reportsCache = next;
        return next;
      });
    },
    []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [downloadMenuId, setDownloadMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artifactWorkspaceId) return;

    const replayPack =
      createArtifactWorkspaceStore().readReplayPack(artifactWorkspaceId);
    const artifact = replayPack?.entries.find(
      (entry) => entry.schema.artifactKind === 'incident-report'
    )?.payload as IncidentReportArtifact | undefined;
    if (!artifact) return;

    setReports((prev) => [
      {
        ...artifact.report,
        timestamp:
          artifact.report.timestamp instanceof Date
            ? artifact.report.timestamp
            : new Date(artifact.report.timestamp),
      },
      ...prev.filter((report) => report.id !== artifact.report.id),
    ]);
  }, [artifactWorkspaceId, setReports]);

  // Generate new report
  const handleGenerateReport = useCallback(
    async (preset?: ReportQuickStart) => {
      setIsGenerating(true);
      setError(null);

      try {
        const artifact = await executeChatArtifact({
          kind: 'incident-report',
          query:
            preset?.query ?? '현재 이상 징후를 장애 보고서 형식으로 정리해줘',
          sessionId: 'auto-report-page',
          queryAsOfDataSlot,
        });
        saveArtifactExecutionReplayPack({
          artifact,
          workspaceId: createArtifactExecutionWorkspaceId(artifact),
        });
        setReports((prev) => [
          artifact.report,
          ...prev.filter((report) => report.id !== artifact.report.id),
        ]);
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
    },
    [setReports, queryAsOfDataSlot]
  );

  // Event handlers
  const handleResolve = useCallback(
    (reportId: string) => {
      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? { ...report, status: 'resolved' as const }
            : report
        )
      );
    },
    [setReports]
  );

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

  return (
    <div className="flex h-full flex-col bg-linear-to-br from-slate-50 to-pink-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 px-4 pt-4 backdrop-blur-sm">
        <div className="flex flex-col gap-3 pb-4 min-[560px]:flex-row min-[560px]:items-start min-[560px]:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-r from-red-500 to-pink-500">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-800">
                장애 보고서 작성
              </h2>
              <p className="text-sm text-gray-600">생성·복사·다운로드</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {queryAsOfDataSlot && (
              <span className="whitespace-nowrap rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                기준 {queryAsOfDataSlot.timeLabel} · slot{' '}
                {queryAsOfDataSlot.slotIndex}
              </span>
            )}
            <button
              type="button"
              data-testid="report-generate-btn"
              onClick={() => handleGenerateReport()}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-600 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`}
              />
              <span>{isGenerating ? '생성 중...' : '새 보고서'}</span>
            </button>
          </div>
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
              aria-pressed={selectedSeverity === filter.id}
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
        <div
          className={`mx-4 mt-3 rounded-lg border p-3 ${error.includes('로그인이 필요합니다') ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-2">
              <AlertCircle
                className={`mt-0.5 h-5 w-5 shrink-0 ${error.includes('로그인이 필요합니다') ? 'text-blue-500' : 'text-red-500'}`}
              />
              <div>
                <p
                  className={`text-sm font-medium ${error.includes('로그인이 필요합니다') ? 'text-blue-800' : 'text-red-800'}`}
                >
                  {error.includes('로그인이 필요합니다')
                    ? '로그인이 필요합니다'
                    : '보고서 생성 실패'}
                </p>
                <p
                  className={`mt-0.5 text-xs ${error.includes('로그인이 필요합니다') ? 'text-blue-600' : 'text-red-600'}`}
                >
                  {error}
                </p>
                {error.includes('로그인이 필요합니다') && (
                  <Link
                    href="/login"
                    className="mt-2 inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    로그인하기
                  </Link>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className={`rounded-lg p-1 transition-colors ${error.includes('로그인이 필요합니다') ? 'text-blue-400 hover:bg-blue-100 hover:text-blue-600' : 'text-red-400 hover:bg-red-100 hover:text-red-600'}`}
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Report List */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-24">
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
            <div className="mx-auto mb-4 grid max-w-md gap-2 text-left">
              {REPORT_QUICK_STARTS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleGenerateReport(preset)}
                  disabled={isGenerating}
                  className="rounded-lg border border-red-100 bg-white px-3 py-2 text-left transition-colors hover:border-red-200 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-gray-800">
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              data-testid="report-generate-cta"
              onClick={() => handleGenerateReport()}
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
