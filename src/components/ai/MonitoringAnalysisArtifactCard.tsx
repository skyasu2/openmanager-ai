'use client';

import { Activity, Download, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';
import { useAIEntryController } from '@/hooks/ai/useAIEntryController';
import type { MonitoringAnalysisArtifact } from '@/lib/ai/chat-artifacts/types';

function downloadBlob({
  content,
  filename,
  type,
}: {
  content: string;
  filename: string;
  type: string;
}): void {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildAnalysisMarkdown(artifact: MonitoringAnalysisArtifact): string {
  const warningLines =
    artifact.analysis.riskSignals.length > 0
      ? artifact.analysis.riskSignals
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
    `- 데이터 기준: ${artifact.analysis.slot.timeLabel}`,
    `- 분석 서버: ${artifact.serverCount}대`,
    `- 위험 신호: ${artifact.riskSignalCount}건`,
    `- 주의 서버: ${artifact.warningServers}대`,
    `- 위험 서버: ${artifact.criticalServers}대`,
    '',
    '## 요약',
    '',
    artifact.summary,
    '',
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
    downloadBlob({
      content: JSON.stringify(artifact.analysis, null, 2),
      filename: `monitoring-analysis-${stamp}.json`,
      type: 'application/json',
    });
    return;
  }

  downloadBlob({
    content: buildAnalysisMarkdown(artifact),
    filename: `monitoring-analysis-${stamp}.md`,
    type: 'text/markdown',
  });
}

function signalClass(severity: 'warning' | 'critical'): string {
  return severity === 'critical'
    ? 'bg-red-50 text-red-700'
    : 'bg-amber-50 text-amber-700';
}

export function MonitoringAnalysisArtifactCard({
  artifact,
}: {
  artifact: MonitoringAnalysisArtifact;
}) {
  const { openFullscreen } = useAIEntryController();
  const riskSignals = artifact.analysis.riskSignals.slice(0, 3);
  const evidenceRefs = artifact.analysis.evidenceRefs.slice(0, 3);

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
            <span>source {artifact.analysis.sourceMode}</span>
            <span>기준 {artifact.analysis.slot.timeLabel}</span>
            {artifact.analysis.dataFreshness.stale && (
              <span className="text-amber-700">stale data</span>
            )}
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
                      임계치 {Math.round(signal.threshold)}% · {signal.trend}
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
          onClick={() =>
            openFullscreen({
              selectedFunction: 'intelligent-monitoring',
              queryAsOfDataSlot: artifact.queryAsOfDataSlot,
            })
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-cyan-700 px-2.5 text-xs font-medium text-white transition-colors hover:bg-cyan-800"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          이상감지/추세에서 보기
        </button>
      </div>
    </section>
  );
}
