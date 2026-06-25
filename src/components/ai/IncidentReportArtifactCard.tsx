'use client';

import {
  AlertTriangle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  MapPin,
  Settings,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { downloadReport } from '@/components/ai/pages/auto-report/formatters';
import type { IncidentReport } from '@/components/ai/pages/auto-report/types';
import { useAIEntryController } from '@/hooks/ai/useAIEntryController';
import {
  createArtifactExecutionWorkspaceId,
  saveArtifactExecutionReplayPack,
} from '@/lib/ai/chat-artifacts/artifact-execution';
import type { IncidentReportArtifact } from '@/lib/ai/domains/monitoring/artifact-types';

function normalizeReportForDownload(report: IncidentReport): IncidentReport {
  return {
    ...report,
    timestamp:
      report.timestamp instanceof Date
        ? report.timestamp
        : new Date(report.timestamp),
  };
}

function severityClass(severity: IncidentReport['severity']): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'warning':
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700';
  }
}

function formatMetricValue(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}%` : '-';
}

function formatTimestamp(ts: Date | string): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SIX_W_CONFIG = [
  { key: 'who', label: '누가', Icon: User },
  { key: 'what', label: '무엇을', Icon: FileText },
  { key: 'when', label: '언제', Icon: Clock },
  { key: 'where', label: '어디서', Icon: MapPin },
  { key: 'why', label: '왜', Icon: HelpCircle },
  { key: 'how', label: '어떻게', Icon: Settings },
] as const;

function SixWGrid({ report }: { report: IncidentReport }) {
  const who =
    report.affectedServers.length > 0
      ? `${report.affectedServers[0]}${report.affectedServers.length > 1 ? ` 외 ${report.affectedServers.length - 1}대` : ''}`
      : '시스템';
  const what = report.title;
  const when = formatTimestamp(report.timestamp);
  const where =
    report.affectedServers.length > 0
      ? report.affectedServers.slice(0, 2).join(', ')
      : '전체 시스템';
  const why =
    report.pattern ??
    (report.description.length > 60
      ? `${report.description.slice(0, 60)}…`
      : report.description);
  const how =
    report.recommendations != null && report.recommendations.length > 0
      ? (report.recommendations[0]?.action ?? '보고서에서 확인')
      : '보고서에서 확인';

  const values: Record<(typeof SIX_W_CONFIG)[number]['key'], string> = {
    who,
    what,
    when,
    where,
    why,
    how,
  };

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-amber-100 bg-amber-50/40 p-2.5">
      {SIX_W_CONFIG.map(({ key, label, Icon }) => (
        <div key={key} className="flex items-start gap-1.5 min-w-0">
          <Icon
            className="mt-0.5 h-3 w-3 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
              {label}
            </p>
            <p className="truncate text-[11px] leading-4 text-slate-700">
              {values[key]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatUptimeImpact(
  systemSummary: IncidentReport['systemSummary']
): string | null {
  if (!systemSummary) return null;

  const parts = [
    typeof systemSummary.uptimePercent === 'number'
      ? `가용률 ${systemSummary.uptimePercent}%`
      : null,
    typeof systemSummary.affectedDurationMinutes === 'number'
      ? `경고 지속 ${systemSummary.affectedDurationMinutes}분`
      : null,
    systemSummary.dataSlotLabel ? `기준 ${systemSummary.dataSlotLabel}` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(' | ') : null;
}

export function IncidentReportArtifactCard({
  artifact,
}: {
  artifact: IncidentReportArtifact;
}) {
  const { openFullscreen } = useAIEntryController();
  const report = artifact.report;
  const affectedServers = report.affectedServers.slice(0, 4);
  const recommendations = report.recommendations?.slice(0, 2) ?? [];
  const anomalies = report.anomalies?.slice(0, 2) ?? [];
  const timeline = report.timeline?.slice(0, 2) ?? [];
  const logPatterns = report.logPatterns?.slice(0, 3) ?? [];
  const uptimeImpact = formatUptimeImpact(report.systemSummary);
  const degradation = artifact.degradation?.degraded
    ? artifact.degradation
    : null;
  const hasDetails =
    affectedServers.length > 0 ||
    recommendations.length > 0 ||
    anomalies.length > 0 ||
    timeline.length > 0 ||
    logPatterns.length > 0;
  const openInReportTab = () => {
    const saveResult = saveArtifactExecutionReplayPack({
      artifact,
      workspaceId: createArtifactExecutionWorkspaceId(artifact, 'chat-card'),
    });

    openFullscreen({
      selectedFunction: 'auto-report',
      queryAsOfDataSlot: artifact.queryAsOfDataSlot,
      ...(saveResult.saved && {
        artifactWorkspaceId: saveResult.replayPack.workspaceId,
      }),
    });
  };

  return (
    <section className="mt-3 rounded-lg border border-amber-200 bg-white p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">장애 보고서</p>
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${severityClass(report.severity)}`}
            >
              {report.severity}
            </span>
            {degradation && (
              <span
                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                title={
                  degradation.reasonCode
                    ? `보완 경로: ${degradation.reasonCode}`
                    : '보완 경로'
                }
              >
                도구 기반 보완
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-sm font-medium text-slate-800">
            {report.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {report.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
            <span>영향 서버 {report.affectedServers.length}대</span>
            {artifact.queryAsOfDataSlot?.timeLabel && (
              <span>기준 {artifact.queryAsOfDataSlot.timeLabel}</span>
            )}
          </div>
          {uptimeImpact && (
            <p className="mt-1 text-[11px] leading-4 text-amber-700">
              {uptimeImpact}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <SixWGrid report={report} />
      </div>

      {hasDetails && (
        <div className="mt-3 space-y-3 border-t border-amber-100 pt-3">
          {affectedServers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">영향 서버</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {affectedServers.map((serverId) => (
                  <Link
                    key={serverId}
                    href={`/dashboard/servers/${encodeURIComponent(serverId)}`}
                    className="inline-flex min-h-7 items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    {serverId}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">권장 조치</p>
              <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">
                {recommendations.map((item) => (
                  <li key={`${item.priority}-${item.action}`}>
                    <span className="font-medium text-slate-800">
                      {item.action}
                    </span>
                    {item.expected_impact && (
                      <span className="text-slate-500">
                        {' '}
                        · {item.expected_impact}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {anomalies.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">이상 징후</p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-600">
                {anomalies.map((item) => (
                  <span
                    key={`${item.server_id}-${item.metric}`}
                    className="rounded-md bg-red-50 px-2 py-1 text-red-700"
                  >
                    {item.metric} {formatMetricValue(item.value)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {logPatterns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">
                반복 로그 패턴
              </p>
              <div className="mt-1.5 space-y-1.5">
                {logPatterns.map((pattern) => (
                  <div
                    key={`${pattern.serverId}-${pattern.severity}-${pattern.message}`}
                    className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs leading-5 text-slate-600"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          pattern.severity === 'ERROR'
                            ? 'font-semibold text-red-700'
                            : 'font-semibold text-amber-700'
                        }
                      >
                        {pattern.severity}
                      </span>
                      <span>{pattern.count}건</span>
                      <Link
                        href={`/dashboard/servers/${encodeURIComponent(pattern.serverId)}`}
                        className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-amber-700"
                      >
                        {pattern.serverId}
                      </Link>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-slate-500">
                      {pattern.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {timeline.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">타임라인</p>
              <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">
                {timeline.map((item) => (
                  <li key={`${item.timestamp}-${item.event}`}>{item.event}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            downloadReport(normalizeReportForDownload(report), 'md')
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          MD 다운로드
        </button>
        <button
          type="button"
          onClick={() =>
            downloadReport(normalizeReportForDownload(report), 'txt')
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          TXT 다운로드
        </button>
        <button
          type="button"
          onClick={openInReportTab}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          장애 보고서 작성에서 보기
        </button>
      </div>
    </section>
  );
}
