/**
 * Report Card Component
 *
 * 개별 장애 보고서 카드 UI
 */

'use client';

import {
  Activity,
  CheckSquare,
  ClipboardCopy,
  Clock,
  Download,
  Eye,
  Server,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { formatTime } from '@/lib/format-date';
import { copyReportAsMarkdown, downloadReport } from './formatters';
import type { IncidentReport } from './types';
import {
  getSeverityColor,
  getSeverityIcon,
  getStatusBadgeStyle,
  getStatusLabel,
} from './utils';

interface ReportCardProps {
  report: IncidentReport;
  index: number;
  isSelected: boolean;
  downloadMenuId: string | null;
  onToggleDetail: (reportId: string) => void;
  onResolve: (reportId: string) => void;
  onSetDownloadMenuId: (id: string | null) => void;
}

/**
 * 상태 인디케이터 렌더링
 */
function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />;
    case 'investigating':
      return (
        <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
      );
    default:
      return <div className="h-2 w-2 rounded-full bg-green-500" />;
  }
}

/**
 * 시스템 요약 섹션
 */
function SystemSummarySection({
  systemSummary,
}: {
  systemSummary: NonNullable<IncidentReport['systemSummary']>;
}) {
  return (
    <div className="mb-3 grid grid-cols-4 gap-2 rounded-lg bg-white/60 p-3">
      <div className="text-center">
        <div className="text-lg font-bold text-gray-700">
          {systemSummary.totalServers}
        </div>
        <div className="text-xs text-gray-500">전체</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-green-600">
          {systemSummary.healthyServers}
        </div>
        <div className="text-xs text-gray-500">정상</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-yellow-600">
          {systemSummary.warningServers}
        </div>
        <div className="text-xs text-gray-500">주의</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-red-600">
          {systemSummary.criticalServers}
        </div>
        <div className="text-xs text-gray-500">위험</div>
      </div>
    </div>
  );
}

/**
 * 이상 항목 섹션
 */
function AnomaliesSection({
  anomalies,
}: {
  anomalies: NonNullable<IncidentReport['anomalies']>;
}) {
  return (
    <div className="rounded-lg bg-white/60 p-3">
      <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-700">
        <Activity className="h-3 w-3" />
        감지된 이상 항목
      </h4>
      <div className="space-y-1">
        {anomalies.slice(0, 5).map((anomaly, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-gray-600">
              {anomaly.server_name} - {anomaly.metric}
            </span>
            <span
              className={`font-medium ${
                anomaly.severity === 'critical'
                  ? 'text-red-600'
                  : 'text-yellow-600'
              }`}
            >
              {Math.round(anomaly.value)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 권장 조치 섹션
 */
function RecommendationsSection({
  recommendations,
}: {
  recommendations: NonNullable<IncidentReport['recommendations']>;
}) {
  return (
    <div className="rounded-lg bg-white/60 p-3">
      <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-700">
        <TrendingUp className="h-3 w-3" />
        권장 조치
      </h4>
      <ul className="space-y-1">
        {recommendations.map((rec, i) => (
          <li key={i} className="text-xs text-gray-600">
            • {rec.action}{' '}
            <span className="text-gray-400">(우선순위: {rec.priority})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 다운로드 메뉴
 */
function DownloadMenu({
  report,
  isOpen,
  onClose,
}: {
  report: IncidentReport;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full right-0 z-10 mb-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
      <button
        type="button"
        onClick={() => {
          downloadReport(report, 'md');
          onClose();
        }}
        className="flex w-full items-center space-x-2 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
      >
        <span>Markdown (.md)</span>
      </button>
      <button
        type="button"
        onClick={() => {
          downloadReport(report, 'txt');
          onClose();
        }}
        className="flex w-full items-center space-x-2 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
      >
        <span>Text (.txt)</span>
      </button>
    </div>
  );
}

/**
 * 장애 보고서 카드 컴포넌트
 */
export default function ReportCard({
  report,
  index,
  isSelected,
  downloadMenuId,
  onToggleDetail,
  onResolve,
  onSetDownloadMenuId,
}: ReportCardProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const handleCopyMarkdown = async () => {
    const success = await copyReportAsMarkdown(report);
    if (success) {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  return (
    <div
      className={`animate-fade-in rounded-lg border p-4 transition-shadow hover:shadow-md ${getSeverityColor(report.severity)}`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center space-x-2">
          {getSeverityIcon(report.severity)}
          <h3 className="font-medium text-gray-800">{report.title}</h3>
          <StatusIndicator status={report.status} />
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500" suppressHydrationWarning>
            {formatTime(report.timestamp)}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 text-sm text-gray-600">{report.description}</p>

      {/* System Summary */}
      {report.systemSummary && (
        <SystemSummarySection systemSummary={report.systemSummary} />
      )}

      {/* Detail Section (collapsed by default) */}
      {isSelected && (
        <div className="space-y-3">
          {report.anomalies && report.anomalies.length > 0 && (
            <AnomaliesSection anomalies={report.anomalies} />
          )}

          {report.recommendations && report.recommendations.length > 0 && (
            <RecommendationsSection recommendations={report.recommendations} />
          )}

          {report.pattern && (
            <div className="rounded-lg bg-purple-50 p-3">
              <h4 className="mb-1 text-xs font-semibold text-purple-700">
                감지된 패턴
              </h4>
              <p className="text-xs text-purple-600">{report.pattern}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500">
            영향받는 서버: {report.affectedServers.join(', ') || '없음'}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <span
            className={`rounded-full px-2 py-1 text-xs ${getStatusBadgeStyle(report.status)}`}
          >
            {getStatusLabel(report.status)}
          </span>

          <button
            type="button"
            onClick={() => onToggleDetail(report.id)}
            className={`rounded p-1.5 transition-all duration-200 hover:scale-110 active:scale-90 ${
              isSelected
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
            title="상세보기"
          >
            <Eye className="h-4 w-4" />
          </button>

          {report.status !== 'resolved' && (
            <button
              type="button"
              onClick={() => onResolve(report.id)}
              className="rounded p-1.5 text-gray-400 transition-all duration-200 hover:scale-110 hover:bg-green-100 hover:text-green-600 active:scale-90"
              title="해결 완료"
            >
              <CheckSquare className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className={`rounded p-1.5 transition-all duration-200 hover:scale-110 active:scale-90 ${
              copyState === 'copied'
                ? 'bg-green-100 text-green-600'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
            title={copyState === 'copied' ? 'MD 복사됨' : 'MD로 복사'}
          >
            <ClipboardCopy className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                onSetDownloadMenuId(
                  downloadMenuId === report.id ? null : report.id
                )
              }
              className="rounded p-1.5 text-gray-400 transition-all duration-200 hover:scale-110 hover:bg-gray-100 hover:text-gray-600 active:scale-90"
              title="보고서 다운로드"
            >
              <Download className="h-4 w-4" />
            </button>
            <DownloadMenu
              report={report}
              isOpen={downloadMenuId === report.id}
              onClose={() => onSetDownloadMenuId(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
