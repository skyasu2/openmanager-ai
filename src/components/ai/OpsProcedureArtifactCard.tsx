'use client';

import { Download, FileText } from 'lucide-react';
import {
  buildOpsProcedureJson,
  buildOpsProcedureMarkdown,
} from '@/lib/ai/chat-artifacts/ops-procedure-artifact';
import type { OpsProcedureArtifact } from '@/lib/ai/chat-artifacts/types';

function downloadBlob(content: string, filename: string, type: string): void {
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

function downloadProcedure(
  artifact: OpsProcedureArtifact,
  format: 'md' | 'json'
): void {
  const stamp = artifact.generatedAt.replace(/[:.]/g, '-');
  if (format === 'json') {
    downloadBlob(
      buildOpsProcedureJson(artifact),
      `ops-procedure-${stamp}.json`,
      'application/json'
    );
    return;
  }

  downloadBlob(
    buildOpsProcedureMarkdown(artifact),
    `ops-procedure-${stamp}.md`,
    'text/markdown'
  );
}

function safetyClass(
  safetyLevel: OpsProcedureArtifact['codeBlocks'][number]['safetyLevel']
): string {
  switch (safetyLevel) {
    case 'mutating':
      return 'bg-red-50 text-red-700';
    case 'notification-only':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-emerald-50 text-emerald-700';
  }
}

export function OpsProcedureArtifactCard({
  artifact,
}: {
  artifact: OpsProcedureArtifact;
}) {
  const firstBlock = artifact.codeBlocks[0];
  const metricLabel = artifact.inputs.metric?.toUpperCase() ?? 'metric';
  const threshold = artifact.inputs.threshold ?? '-';

  return (
    <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">운영 절차</p>
          <h3 className="mt-1 truncate text-sm font-medium text-slate-800">
            {artifact.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {artifact.summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
            <span>{artifact.procedureType}</span>
            <span>
              {metricLabel} {threshold}%
            </span>
            <span>source {artifact.source}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
        <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
          <p className="text-[11px] text-slate-500">증거</p>
          <p className="text-base font-semibold text-slate-900">
            {artifact.evidence.length}
          </p>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
          <p className="text-[11px] text-slate-500">코드/설정</p>
          <p className="text-base font-semibold text-slate-900">
            {artifact.codeBlocks.length}
          </p>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
          <p className="text-[11px] text-slate-500">검토</p>
          <p className="text-xs font-medium text-slate-700">
            {artifact.validation.requiresManualReview ? 'manual review' : 'ok'}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">주요 증거</p>
          <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">
            {artifact.evidence.slice(0, 3).map((entry) => (
              <li key={entry.id}>{entry.summary}</li>
            ))}
          </ul>
        </div>

        {firstBlock && (
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs font-semibold text-slate-700">
                {firstBlock.title}
              </p>
              <span
                className={`rounded-md px-2 py-1 text-[11px] ${safetyClass(firstBlock.safetyLevel)}`}
              >
                {firstBlock.safetyLevel}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                executable {firstBlock.executable ? 'true' : 'false'}
              </span>
            </div>
            {firstBlock.requiredEnv.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {firstBlock.requiredEnv.map((envName) => (
                  <span
                    key={envName}
                    className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                  >
                    {envName}
                  </span>
                ))}
              </div>
            )}
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              <code>{firstBlock.content}</code>
            </pre>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadProcedure(artifact, 'md')}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          MD 다운로드
        </button>
        <button
          type="button"
          onClick={() => downloadProcedure(artifact, 'json')}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          JSON 다운로드
        </button>
      </div>
    </section>
  );
}
