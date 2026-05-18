'use client';

import { Download, FileText, Server } from 'lucide-react';
import Link from 'next/link';
import { downloadBlobContent } from '@/lib/ai/chat-artifacts/download-utils';
import {
  buildServerSnapshotJson,
  buildServerSnapshotMarkdown,
  readServerSnapshotAlerts,
  readServerSnapshotSummary,
  readServerSnapshotTimeLabel,
  readServerSnapshotTopServers,
} from '@/lib/ai/chat-artifacts/server-snapshot-artifact';
import type { ServerSnapshotArtifact } from '@/lib/ai/chat-artifacts/types';

function statusClass(
  status: ServerSnapshotArtifact['topServers'][number]['status']
): string {
  switch (status) {
    case 'critical':
    case 'offline':
      return 'bg-red-50 text-red-700';
    case 'warning':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-emerald-50 text-emerald-700';
  }
}

function alertClass(
  severity: ServerSnapshotArtifact['alerts'][number]['severity']
): string {
  return severity === 'critical' ? 'text-red-700' : 'text-amber-700';
}

function downloadSnapshot(
  artifact: ServerSnapshotArtifact,
  format: 'md' | 'json'
): void {
  const stamp = artifact.generatedAt.replace(/[:.]/g, '-');
  if (format === 'json') {
    downloadBlobContent(
      buildServerSnapshotJson(artifact),
      `server-snapshot-${stamp}.json`,
      'application/json'
    );
    return;
  }

  downloadBlobContent(
    buildServerSnapshotMarkdown(artifact),
    `server-snapshot-${stamp}.md`,
    'text/markdown'
  );
}

export function ServerSnapshotArtifactCard({
  artifact,
}: {
  artifact: ServerSnapshotArtifact;
}) {
  const topServers = readServerSnapshotTopServers(artifact).slice(0, 3);
  const alerts = readServerSnapshotAlerts(artifact).slice(0, 3);
  const timeLabel = readServerSnapshotTimeLabel(artifact);
  const summary = readServerSnapshotSummary(artifact);

  return (
    <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Server className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            서버 상태 스냅샷
          </p>
          <h3 className="mt-1 truncate text-sm font-medium text-slate-800">
            {artifact.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
            <span>source {artifact.source ?? 'unknown'}</span>
            <span>기준 {timeLabel}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">총 서버</p>
              <p className="text-base font-semibold text-slate-900">
                {artifact.totals.total}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">주의</p>
              <p className="text-base font-semibold text-amber-700">
                {artifact.totals.warning}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">위험</p>
              <p className="text-base font-semibold text-red-700">
                {artifact.totals.critical + artifact.totals.offline}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">평균 CPU</p>
              <p className="text-xs font-medium text-slate-700">
                CPU {artifact.averages.cpu}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">위험 상위 서버</p>
          {topServers.length > 0 ? (
            <div className="mt-1.5 space-y-1.5">
              {topServers.map((server) => (
                <div
                  key={server.id}
                  className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600"
                >
                  <Link
                    href={`/dashboard/servers/${encodeURIComponent(server.id)}`}
                    className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                  >
                    {server.name || server.id}
                  </Link>
                  <span
                    className={`rounded-md px-2 py-1 ${statusClass(server.status)}`}
                  >
                    {server.status}
                  </span>
                  <span>
                    {server.primaryRisk.toUpperCase()}{' '}
                    {server[server.primaryRisk]}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              표시할 위험 상위 서버 없음
            </p>
          )}
        </div>

        {alerts.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-700">주요 알림</p>
            <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">
              {alerts.map((alert) => (
                <li
                  key={`${alert.serverId}-${alert.metric}`}
                  className={alertClass(alert.severity)}
                >
                  {alert.summary}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadSnapshot(artifact, 'md')}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          MD 다운로드
        </button>
        <button
          type="button"
          onClick={() => downloadSnapshot(artifact, 'json')}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          JSON 다운로드
        </button>
      </div>
    </section>
  );
}
