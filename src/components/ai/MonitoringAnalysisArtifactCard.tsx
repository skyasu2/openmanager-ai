'use client';

import { Activity, Download, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTimeSeries } from '@/data/otel-data';
import { useAIEntryController } from '@/hooks/ai/useAIEntryController';
import {
  createArtifactExecutionWorkspaceId,
  saveArtifactExecutionReplayPack,
} from '@/lib/ai/chat-artifacts/artifact-execution';
import { downloadBlobContent } from '@/lib/ai/chat-artifacts/download-utils';
import type { MonitoringAnalysisArtifact } from '@/lib/ai/domains/monitoring/artifact-types';
import type { OTelTimeSeries } from '@/types/otel-metrics';
import {
  MetricSparkline,
  sliceTimeSeriesForAsOf,
} from './analysis/MetricSparkline';
import {
  buildAnalysisMarkdown,
  calculateCapacityBarSegments,
  capacityAlertClass,
  formatBaselinePercent,
  formatBaselineTimestamp,
  formatCapacityTarget,
  formatCorrelatedLogSeverity,
  formatMetricLabel,
  formatMonitoringSourceLabel,
  formatQueryFocusServer,
  isCorrelatedLogEvidence,
  readBaselineRows,
  readCapacityAlerts,
  readCorrelatedLogRows,
  readDisplaySignals,
  readEvidenceRefs,
  readTimeLabel,
  signalClass,
} from './MonitoringAnalysisArtifactCard.utils';

export { buildAnalysisMarkdown, calculateCapacityBarSegments };

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

export function MonitoringAnalysisArtifactCard({
  artifact,
}: {
  artifact: MonitoringAnalysisArtifact;
}) {
  const [timeSeries, setTimeSeries] = useState<OTelTimeSeries | null>(null);

  useEffect(() => {
    let active = true;
    getTimeSeries().then((data) => {
      if (active) setTimeSeries(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const { openFullscreen } = useAIEntryController();
  const riskSignals = readDisplaySignals(artifact).slice(0, 3);
  const baselineRows = readBaselineRows(artifact).slice(0, 3);
  const correlatedLogRows = readCorrelatedLogRows(artifact).slice(0, 3);
  const capacityAlerts = readCapacityAlerts(artifact).slice(0, 3);
  const evidenceRefs = readEvidenceRefs(artifact)
    .filter((evidence) => !isCorrelatedLogEvidence(evidence))
    .slice(0, 3);
  const roleGroups = artifact.roleGroupSummary?.slice(0, 6) ?? [];
  const timeLabel = readTimeLabel(artifact);
  const sourceMode = artifact.analysis.sourceMode ?? 'unknown';
  const isStale = artifact.analysis.dataFreshness?.stale === true;
  const queryFocusServer = formatQueryFocusServer(artifact);
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
          {queryFocusServer && (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              기준(origin) 서버: {queryFocusServer}
            </p>
          )}
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
              <div className="mt-2 space-y-2.5">
                {capacityAlerts.map((alert) => {
                  const current = Math.round(alert.currentValue);
                  const predicted = Math.round(alert.predictedValue);
                  const capacityBar = calculateCapacityBarSegments(
                    current,
                    predicted
                  );
                  const isCritical = alert.severity === 'critical';
                  const barColor = isCritical ? 'bg-red-500' : 'bg-amber-500';
                  const predictedBarColor = isCritical
                    ? 'bg-red-300'
                    : 'bg-amber-300';
                  return (
                    <div
                      key={alert.id}
                      className={`rounded-md border px-2.5 py-2.5 ${capacityAlertClass(alert.severity)}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/dashboard/servers/${encodeURIComponent(alert.serverId)}`}
                            className="font-semibold underline decoration-slate-300 underline-offset-2 hover:text-cyan-700"
                          >
                            {alert.serverName || alert.serverId}
                          </Link>
                          <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono font-medium">
                            {alert.metric.toUpperCase()}
                          </span>
                        </div>
                        <span className="shrink-0 font-medium">
                          {formatCapacityTarget(alert)}
                        </span>
                      </div>
                      {/* 진행 바 */}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/50">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all`}
                            style={{ width: `${capacityBar.currentPercent}%` }}
                          />
                          {capacityBar.predictedDeltaPercent > 0 && (
                            <div
                              className={`absolute inset-y-0 rounded-full ${predictedBarColor}`}
                              style={{
                                left: `${capacityBar.predictedLeftPercent}%`,
                                width: `${capacityBar.predictedDeltaPercent}%`,
                              }}
                            />
                          )}
                          {/* 임계선 80% */}
                          <div
                            className="absolute inset-y-0 w-px bg-slate-400/60"
                            style={{ left: '80%' }}
                          />
                        </div>
                        {timeSeries && (
                          <MetricSparkline
                            values={sliceTimeSeriesForAsOf(
                              timeSeries,
                              alert.serverId,
                              alert.metric,
                              artifact.queryAsOfDataSlot,
                              12
                            )}
                            predicted={alert.predictedValue}
                            trend={
                              alert.severity === 'critical'
                                ? 'increasing'
                                : 'stable'
                            }
                            threshold={80}
                            width={80}
                            height={18}
                            className="shrink-0 opacity-80"
                            ariaLabel={`${alert.serverId} ${alert.metric} 추이`}
                          />
                        )}
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-inherit opacity-70">
                        <span>현재 {current}%</span>
                        <span>예측 {predicted}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {baselineRows.length > 0 && (
            <div className="mt-3 border-t border-cyan-100 pt-3">
              <p className="text-xs font-semibold text-slate-700">24h 기준선</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {baselineRows.map(({ signal, baseline }) => (
                  <div
                    key={`${signal.id}-${baseline.metric}`}
                    className="rounded-md border border-cyan-100 bg-cyan-50/60 px-2.5 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                      <Link
                        href={`/dashboard/servers/${encodeURIComponent(signal.serverId)}`}
                        className="font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-cyan-700"
                      >
                        {signal.serverName || signal.serverId}
                      </Link>
                      <span className="rounded bg-white px-1.5 py-0.5 font-mono font-medium text-cyan-800">
                        {formatMetricLabel(baseline.metric)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-slate-700">
                      현재 {formatBaselinePercent(baseline.current)} · 평균{' '}
                      {formatBaselinePercent(baseline.avg24h)} · p95{' '}
                      {formatBaselinePercent(baseline.p95)}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">
                      피크 {formatBaselinePercent(baseline.max)} @{' '}
                      {formatBaselineTimestamp(
                        baseline.peakTimestamp,
                        baseline.peakSlot
                      )}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">
                      경고 슬롯 {baseline.warningSlots} · 위험 슬롯{' '}
                      {baseline.criticalSlots}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {(riskSignals.length > 0 ||
        correlatedLogRows.length > 0 ||
        evidenceRefs.length > 0) && (
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

          {correlatedLogRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">동반 로그</p>
              <ul className="mt-1.5 space-y-1.5 text-xs leading-5 text-slate-600">
                {correlatedLogRows.map((row) => (
                  <li
                    key={
                      row.evidenceRefId ||
                      `${row.serverId}-${row.severity}-${row.summary}`
                    }
                    className="flex flex-wrap items-start gap-1.5"
                  >
                    <Link
                      href={`/dashboard/servers/${encodeURIComponent(row.serverId)}`}
                      className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-cyan-700"
                    >
                      {row.serverName || row.serverId}
                    </Link>
                    <span
                      className={`rounded-md px-2 py-0.5 ${signalClass(row.severity)}`}
                    >
                      {formatCorrelatedLogSeverity(row.severity)}
                    </span>
                    <span className="min-w-0 flex-1 break-words">
                      {row.summary}
                    </span>
                  </li>
                ))}
              </ul>
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
