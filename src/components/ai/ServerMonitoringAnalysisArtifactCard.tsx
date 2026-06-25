'use client';

import { Activity, Download, FileText } from 'lucide-react';
import Link from 'next/link';
import { downloadBlobContent } from '@/lib/ai/chat-artifacts/download-utils';
import type { ServerMonitoringAnalysisArtifact } from '@/lib/ai/domains/monitoring/artifact-types';

function statusClass(
  status: ServerMonitoringAnalysisArtifact['overallStatus']
): string {
  switch (status) {
    case 'critical':
      return 'bg-red-50 text-red-700';
    case 'warning':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-emerald-50 text-emerald-700';
  }
}

function buildServerMonitoringMarkdown(
  artifact: ServerMonitoringAnalysisArtifact
): string {
  const evidenceLines =
    artifact.evidence && artifact.evidence.length > 0
      ? artifact.evidence
          .map((entry) => `- ${entry.metric ?? 'metric'}: ${entry.summary}`)
          .join('\n')
      : '- 감지된 이상 신호 없음';

  return [
    `# ${artifact.title}`,
    '',
    `- 생성 시각: ${new Date(artifact.generatedAt).toLocaleString('ko-KR')}`,
    `- 데이터 기준: ${artifact.dataSlot ?? artifact.queryAsOfDataSlot?.timeLabel ?? '현재'}`,
    `- 서버: ${artifact.serverName} (${artifact.serverId})`,
    `- 상태: ${artifact.overallStatus}`,
    `- 이상 신호: ${artifact.server.anomalyDetection?.anomalyCount ?? 0}건`,
    '',
    '## 요약',
    '',
    artifact.summary,
    '',
    '## 증거',
    '',
    evidenceLines,
    '',
  ].join('\n');
}

function downloadAnalysis(
  artifact: ServerMonitoringAnalysisArtifact,
  format: 'md' | 'json'
): void {
  const stamp = artifact.generatedAt.replace(/[:.]/g, '-');
  if (format === 'json') {
    downloadBlobContent(
      JSON.stringify(artifact.analysis, null, 2),
      `server-monitoring-analysis-${stamp}.json`,
      'application/json'
    );
    return;
  }

  downloadBlobContent(
    buildServerMonitoringMarkdown(artifact),
    `server-monitoring-analysis-${stamp}.md`,
    'text/markdown'
  );
}

export function ServerMonitoringAnalysisArtifactCard({
  artifact,
}: {
  artifact: ServerMonitoringAnalysisArtifact;
}) {
  const anomalyCount = artifact.server.anomalyDetection?.anomalyCount ?? 0;
  const risingMetrics =
    artifact.server.trendPrediction?.summary?.increasingMetrics ?? [];
  const evidence = artifact.evidence?.slice(0, 3) ?? [];
  const timeLabel =
    artifact.dataSlot ?? artifact.queryAsOfDataSlot?.timeLabel ?? '현재';

  return (
    <section className="mt-3 rounded-lg border border-emerald-200 bg-white p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            단일 서버 이상감지/추세 분석
          </p>
          <h3 className="mt-1 truncate text-sm font-medium text-slate-800">
            {artifact.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {artifact.summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
            <Link
              href={`/dashboard/servers/${encodeURIComponent(artifact.serverId)}`}
              className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
            >
              {artifact.serverName}
            </Link>
            <span>기준 {timeLabel}</span>
            {artifact.source && <span>source {artifact.source}</span>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">상태</p>
              <p
                className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusClass(artifact.overallStatus)}`}
              >
                {artifact.overallStatus}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">이상 신호</p>
              <p className="text-base font-semibold text-slate-900">
                {anomalyCount}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">상승 추세</p>
              <p className="text-base font-semibold text-slate-900">
                {risingMetrics.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {evidence.length > 0 && (
        <div className="mt-3 border-t border-emerald-100 pt-3">
          <p className="text-xs font-semibold text-slate-700">주요 증거</p>
          <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">
            {evidence.map((entry) => (
              <li key={entry.id}>{entry.summary}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-emerald-100 pt-3">
        <button
          type="button"
          onClick={() => downloadAnalysis(artifact, 'md')}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Markdown
        </button>
        <button
          type="button"
          onClick={() => downloadAnalysis(artifact, 'json')}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          JSON
        </button>
      </div>
    </section>
  );
}
