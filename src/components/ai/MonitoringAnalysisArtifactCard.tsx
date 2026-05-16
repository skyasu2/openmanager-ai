'use client';

import { Activity, Download, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';
import { useAIEntryController } from '@/hooks/ai/useAIEntryController';
import {
  createArtifactExecutionWorkspaceId,
  saveArtifactExecutionReplayPack,
} from '@/lib/ai/chat-artifacts/artifact-execution';
import { downloadBlobContent } from '@/lib/ai/chat-artifacts/download-utils';
import type { MonitoringAnalysisArtifact } from '@/lib/ai/chat-artifacts/types';
import type {
  MonitoringBatchCapacityAlert,
  MonitoringBatchEvidenceRef,
  MonitoringBatchFactSignal,
  MonitoringBatchRiskSignal,
} from '@/types/intelligent-monitoring.types';

type MonitoringDisplaySignal =
  | MonitoringBatchRiskSignal
  | MonitoringBatchFactSignal;

function buildRoleGroupMarkdown(artifact: MonitoringAnalysisArtifact): string {
  const roleGroups = artifact.roleGroupSummary ?? [];
  if (roleGroups.length === 0) {
    return '';
  }

  return roleGroups
    .map(
      (group) =>
        `- ${group.role}: ${group.count}대, CPU ${group.avgCpu}%, MEM ${group.avgMemory}%, DISK ${group.avgDisk}%, 주의 ${group.warningCount}대, 위험 ${group.criticalCount}대`
    )
    .join('\n');
}

function buildCapacityAlertsMarkdown(
  artifact: MonitoringAnalysisArtifact
): string {
  const alerts = readCapacityAlerts(artifact);
  if (alerts.length === 0) {
    return '';
  }

  return alerts
    .map(
      (alert) =>
        `- ${alert.serverName || alert.serverId}: ${alert.metric.toUpperCase()} 현재 ${Math.round(alert.currentValue)}%, 예측 ${Math.round(alert.predictedValue)}% · ${alert.humanReadable}`
    )
    .join('\n');
}

export function buildAnalysisMarkdown(
  artifact: MonitoringAnalysisArtifact
): string {
  const riskSignals = readDisplaySignals(artifact);
  const timeLabel = readTimeLabel(artifact);
  const roleGroupLines = buildRoleGroupMarkdown(artifact);
  const capacityAlertLines = buildCapacityAlertsMarkdown(artifact);
  const warningLines =
    riskSignals.length > 0
      ? riskSignals
          .map(
            (signal) =>
              `- ${signal.serverName || signal.serverId}: ${signal.metric} ${signal.value}% (${signal.severity})`
          )
          .join('\n')
      : '- 감지된 위험 신호 없음';

  return [
    `# ${artifact.title}`,
    '',
    `- 생성 시각: ${new Date(artifact.generatedAt).toLocaleString('ko-KR')}`,
    `- 데이터 기준: ${timeLabel}`,
    `- 분석 서버: ${artifact.serverCount}대`,
    `- 위험 신호: ${artifact.riskSignalCount}건`,
    `- 주의 서버: ${artifact.warningServers}대`,
    `- 위험 서버: ${artifact.criticalServers}대`,
    '',
    '## 요약',
    '',
    artifact.summary,
    '',
    ...(roleGroupLines ? ['## 역할별 현황', '', roleGroupLines, ''] : []),
    ...(capacityAlertLines
      ? ['## 용량 소진 예측', '', capacityAlertLines, '']
      : []),
    '## 위험 신호',
    '',
    warningLines,
    '',
  ].join('\n');
}

function downloadAnalysis(
  artifact: MonitoringAnalysisArtifact,
  format: 'md' | 'json'
): void {
  const stamp = artifact.generatedAt.replace(/[:.]/g, '-');
  if (format === 'json') {
    downloadBlobContent(
      JSON.stringify(artifact.analysis, null, 2),
      `monitoring-analysis-${stamp}.json`,
      'application/json'
    );
    return;
  }

  downloadBlobContent(
    buildAnalysisMarkdown(artifact),
    `monitoring-analysis-${stamp}.md`,
    'text/markdown'
  );
}

function signalClass(severity: 'warning' | 'critical'): string {
  return severity === 'critical'
    ? 'bg-red-50 text-red-700'
    : 'bg-amber-50 text-amber-700';
}

function capacityAlertClass(severity: 'warning' | 'critical'): string {
  return severity === 'critical'
    ? 'border-red-100 bg-red-50 text-red-800'
    : 'border-amber-100 bg-amber-50 text-amber-800';
}

function readRiskSignals(
  artifact: MonitoringAnalysisArtifact
): MonitoringBatchRiskSignal[] {
  return Array.isArray(artifact.analysis.riskSignals)
    ? artifact.analysis.riskSignals
    : [];
}

function readFactSignals(
  artifact: MonitoringAnalysisArtifact
): MonitoringBatchFactSignal[] {
  return Array.isArray(artifact.analysis.factPack?.signals)
    ? artifact.analysis.factPack.signals
    : [];
}

function readDisplaySignals(
  artifact: MonitoringAnalysisArtifact
): MonitoringDisplaySignal[] {
  const factSignals = readFactSignals(artifact);
  return factSignals.length > 0 ? factSignals : readRiskSignals(artifact);
}

function readCapacityAlerts(
  artifact: MonitoringAnalysisArtifact
): MonitoringBatchCapacityAlert[] {
  if (Array.isArray(artifact.capacityAlerts)) {
    return artifact.capacityAlerts;
  }

  return Array.isArray(artifact.analysis.capacityAlerts)
    ? artifact.analysis.capacityAlerts
    : [];
}

function readEvidenceRefs(
  artifact: MonitoringAnalysisArtifact
): MonitoringBatchEvidenceRef[] {
  if (Array.isArray(artifact.analysis.factPack?.evidenceRefs)) {
    return artifact.analysis.factPack.evidenceRefs;
  }

  return Array.isArray(artifact.analysis.evidenceRefs)
    ? artifact.analysis.evidenceRefs
    : [];
}

function readTimeLabel(artifact: MonitoringAnalysisArtifact): string {
  return (
    artifact.analysis.slot?.timeLabel ||
    artifact.queryAsOfDataSlot?.timeLabel ||
    '현재'
  );
}

function formatMonitoringSourceLabel(sourceMode: string): string {
  if (sourceMode === 'live-otel') {
    return 'Live telemetry';
  }
  if (sourceMode === 'replay-json') {
    return 'OpenTelemetry snapshot';
  }
  return 'Monitoring snapshot';
}

function formatCapacityEta(minutes: number | null): string {
  if (minutes === null) {
    return '예측 없음';
  }
  if (minutes <= 0) {
    return '현재';
  }
  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours}시간 ${remainingMinutes}분`
    : `${hours}시간`;
}

function formatCapacityTarget(alert: MonitoringBatchCapacityAlert): string {
  if (alert.timeToCriticalMinutes !== null) {
    return `위험 도달 ${formatCapacityEta(alert.timeToCriticalMinutes)}`;
  }

  return `주의 도달 ${formatCapacityEta(alert.timeToWarningMinutes)}`;
}

export function MonitoringAnalysisArtifactCard({
  artifact,
}: {
  artifact: MonitoringAnalysisArtifact;
}) {
  const { openFullscreen } = useAIEntryController();
  const riskSignals = readDisplaySignals(artifact).slice(0, 3);
  const capacityAlerts = readCapacityAlerts(artifact).slice(0, 3);
  const evidenceRefs = readEvidenceRefs(artifact).slice(0, 3);
  const roleGroups = artifact.roleGroupSummary?.slice(0, 6) ?? [];
  const timeLabel = readTimeLabel(artifact);
  const sourceMode = artifact.analysis.sourceMode ?? 'unknown';
  const isStale = artifact.analysis.dataFreshness?.stale === true;
  const openInMonitoringTab = () => {
    const saveResult = saveArtifactExecutionReplayPack({
      artifact,
      workspaceId: createArtifactExecutionWorkspaceId(artifact, 'chat-card'),
    });

    openFullscreen({
      selectedFunction: 'intelligent-monitoring',
      queryAsOfDataSlot: artifact.queryAsOfDataSlot,
      ...(saveResult.saved && {
        artifactWorkspaceId: saveResult.replayPack.workspaceId,
      }),
    });
  };

  return (
    <section className="mt-3 rounded-lg border border-cyan-200 bg-white p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            이상감지/추세 분석
          </p>
          <h3 className="mt-1 truncate text-sm font-medium text-slate-800">
            {artifact.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {artifact.summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
            <span>데이터 {formatMonitoringSourceLabel(sourceMode)}</span>
            <span>기준 {timeLabel}</span>
            {isStale && <span className="text-amber-700">stale data</span>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">분석 서버</p>
              <p className="text-base font-semibold text-slate-900">
                {artifact.serverCount}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">위험 신호</p>
              <p className="text-base font-semibold text-amber-700">
                {artifact.riskSignalCount}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">상태</p>
              <p className="text-xs font-medium text-slate-700">
                주의 {artifact.warningServers}대 · 위험{' '}
                {artifact.criticalServers}대
              </p>
            </div>
          </div>

          {roleGroups.length > 0 && (
            <div className="mt-3 border-t border-cyan-100 pt-3">
              <p className="text-xs font-semibold text-slate-700">
                역할별 현황
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roleGroups.map((group) => (
                  <div
                    key={group.role}
                    className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {group.role}
                      </p>
                      <p className="shrink-0 text-xs font-medium text-slate-600">
                        {group.count}대
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">
                      CPU {group.avgCpu}% · MEM {group.avgMemory}% · DISK{' '}
                      {group.avgDisk}%
                    </p>
                    {(group.warningCount > 0 || group.criticalCount > 0) && (
                      <p className="mt-1 text-[11px] leading-4 text-amber-700">
                        주의 {group.warningCount}대 · 위험 {group.criticalCount}
                        대
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {capacityAlerts.length > 0 && (
            <div className="mt-3 border-t border-cyan-100 pt-3">
              <p className="text-xs font-semibold text-slate-700">
                용량 소진 예측
              </p>
              <div className="mt-2 space-y-2">
                {capacityAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-md border px-2.5 py-2 ${capacityAlertClass(alert.severity)}`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Link
                        href={`/dashboard/servers/${encodeURIComponent(alert.serverId)}`}
                        className="font-semibold underline decoration-slate-300 underline-offset-2 hover:text-cyan-700"
                      >
                        {alert.serverName || alert.serverId}
                      </Link>
                      <span className="rounded-md bg-white/70 px-2 py-1 font-medium">
                        {alert.metric.toUpperCase()}{' '}
                        {Math.round(alert.currentValue)}%
                      </span>
                      <span>{formatCapacityTarget(alert)}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4">
                      예측 {Math.round(alert.predictedValue)}% ·{' '}
                      {alert.humanReadable}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {(riskSignals.length > 0 || evidenceRefs.length > 0) && (
        <div className="mt-3 space-y-3 border-t border-cyan-100 pt-3">
          {riskSignals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">위험 신호</p>
              <div className="mt-1.5 space-y-1.5">
                {riskSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600"
                  >
                    <Link
                      href={`/dashboard/servers/${encodeURIComponent(signal.serverId)}`}
                      className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-cyan-700"
                    >
                      {signal.serverName || signal.serverId}
                    </Link>
                    <span
                      className={`rounded-md px-2 py-1 ${signalClass(signal.severity)}`}
                    >
                      {signal.metric} {Math.round(signal.value)}%
                    </span>
                    <span className="text-slate-500">
                      임계치 {Math.round(signal.threshold)}% ·{' '}
                      {'trend' in signal ? signal.trend : signal.thresholdLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {evidenceRefs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">근거</p>
              <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">
                {evidenceRefs.map((evidence) => (
                  <li key={evidence.id}>{evidence.summary}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadAnalysis(artifact, 'md')}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          MD 다운로드
        </button>
        <button
          type="button"
          onClick={() => downloadAnalysis(artifact, 'json')}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          JSON 다운로드
        </button>
        <button
          type="button"
          onClick={openInMonitoringTab}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-cyan-700 px-2.5 text-xs font-medium text-white transition-colors hover:bg-cyan-800"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          이상감지/추세에서 보기
        </button>
      </div>
    </section>
  );
}
