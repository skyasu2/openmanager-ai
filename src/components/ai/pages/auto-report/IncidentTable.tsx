'use client';

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Download,
  FileText,
  RefreshCw,
  X,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { copyReportAsMarkdown, downloadReport } from './formatters';
import { IncidentTimeline } from './IncidentTimeline';
import type { IncidentReport } from './types';
import type { PaginationInfo } from './useIncidentHistory';
import { getSeverityColor, getSeverityLabel } from './utils';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-100 text-red-700 border-red-200',
  investigating: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  open: '열림',
  investigating: '조사중',
  resolved: '해결됨',
  closed: '종료',
  active: '활성',
};

interface ReportCardProps {
  report: IncidentReport;
  isSelected: boolean;
  onSelect: (report: IncidentReport) => void;
  formatDate: (date: Date) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

const ReportCard = memo(function ReportCard({
  report,
  isSelected,
  onSelect,
  formatDate,
  getStatusBadge,
}: ReportCardProps) {
  const handleClick = useCallback(() => {
    onSelect(report);
  }, [onSelect, report]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full rounded-lg border bg-white p-4 text-left transition-all hover:shadow-md ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityColor(report.severity)}`}
            >
              {getSeverityLabel(report.severity)}
            </span>
            {getStatusBadge(report.status)}
          </div>
          <h3 className="mt-2 truncate font-medium text-gray-800">
            {report.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">
            {report.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            {formatDate(report.timestamp)}
          </div>
          {report.affectedServers.length > 0 && (
            <div className="mt-1 text-xs text-gray-400">
              {report.affectedServers.length}개 서버 영향
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

ReportCard.displayName = 'ReportCard';

function getStatusBadge(status: string) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.open}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

interface IncidentTableProps {
  reports: IncidentReport[];
  loading: boolean;
  selectedReport: IncidentReport | null;
  pagination: PaginationInfo;
  formatDate: (date: Date) => string;
  onReportSelect: (report: IncidentReport) => void;
  onCloseDetail: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export const IncidentTable = memo(function IncidentTable({
  reports,
  loading,
  selectedReport,
  pagination,
  formatDate,
  onReportSelect,
  onCloseDetail,
  onPrevPage,
  onNextPage,
}: IncidentTableProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Reports List */}
      <div
        className={`flex-1 overflow-y-auto p-4 ${selectedReport ? 'w-1/2' : 'w-full'}`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-700">
              보고서가 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              조건에 맞는 보고서가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isSelected={selectedReport?.id === report.id}
                onSelect={onReportSelect}
                formatDate={formatDate}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={pagination.page <= 1}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-4 text-sm text-gray-600">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={onNextPage}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Report Detail Panel */}
      {selectedReport && (
        <div className="w-1/2 overflow-y-auto border-l border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">보고서 상세</h3>
            <button
              type="button"
              onClick={onCloseDetail}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Report Info */}
          <div className="mb-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityColor(selectedReport.severity)}`}
                >
                  {getSeverityLabel(selectedReport.severity)}
                </span>
                {getStatusBadge(selectedReport.status)}
                {selectedReport.pattern && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {selectedReport.pattern}
                  </span>
                )}
              </div>
              <h4 className="mt-2 text-xl font-bold text-gray-800">
                {selectedReport.title}
              </h4>
              <p className="mt-2 text-gray-600">{selectedReport.description}</p>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(selectedReport.timestamp)}
              </div>
              <div>{selectedReport.affectedServers.length}개 서버 영향</div>
            </div>
          </div>

          {/* System Summary */}
          {selectedReport.systemSummary && (
            <div className="mb-6">
              <h5 className="mb-3 font-medium text-gray-700">시스템 요약</h5>
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <div className="text-lg font-bold text-gray-700">
                    {selectedReport.systemSummary.totalServers}
                  </div>
                  <div className="text-xs text-gray-500">전체</div>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center">
                  <div className="text-lg font-bold text-green-600">
                    {selectedReport.systemSummary.healthyServers}
                  </div>
                  <div className="text-xs text-gray-500">정상</div>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3 text-center">
                  <div className="text-lg font-bold text-yellow-600">
                    {selectedReport.systemSummary.warningServers}
                  </div>
                  <div className="text-xs text-gray-500">주의</div>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center">
                  <div className="text-lg font-bold text-red-600">
                    {selectedReport.systemSummary.criticalServers}
                  </div>
                  <div className="text-xs text-gray-500">위험</div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          {selectedReport.timeline && selectedReport.timeline.length > 0 && (
            <div className="mb-6">
              <h5 className="mb-3 font-medium text-gray-700">타임라인</h5>
              <IncidentTimeline events={selectedReport.timeline} />
            </div>
          )}

          {/* Recommendations */}
          {selectedReport.recommendations &&
            selectedReport.recommendations.length > 0 && (
              <div>
                <h5 className="mb-3 font-medium text-gray-700">권장 조치</h5>
                <div className="space-y-2">
                  {selectedReport.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-gray-700">
                          {rec.action}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            rec.priority === 'high'
                              ? 'bg-red-100 text-red-700'
                              : rec.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        예상 효과: {rec.expected_impact}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Action Buttons */}
          <DetailActionButtons report={selectedReport} />
        </div>
      )}
    </div>
  );
});

interface DetailActionButtonsProps {
  report: IncidentReport;
}

function DetailActionButtons({ report }: DetailActionButtonsProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const handleCopy = async () => {
    const success = await copyReportAsMarkdown(report);
    if (success) {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  return (
    <div className="mt-6 flex items-center gap-2 border-t border-gray-200 pt-4">
      <button
        type="button"
        onClick={handleCopy}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
          copyState === 'copied'
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <ClipboardCopy className="h-4 w-4" />
        {copyState === 'copied' ? 'MD 복사됨' : 'MD로 복사'}
      </button>
      <button
        type="button"
        onClick={() => downloadReport(report, 'md')}
        className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200"
      >
        <Download className="h-4 w-4" />
        다운로드
      </button>
    </div>
  );
}
