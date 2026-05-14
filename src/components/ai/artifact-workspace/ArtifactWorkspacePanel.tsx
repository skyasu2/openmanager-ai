'use client';

import {
  Download,
  GitCompareArrows,
  HelpCircle,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import type { ArtifactReplayPack } from '@/lib/ai/chat-artifacts/artifact-workspace-registry';
import {
  type ArtifactReplayPackComparisonSummary,
  type ArtifactWorkspaceHistoryMessage,
  type ArtifactWorkspaceStore,
  createArtifactReplayPackComparisonSummary,
  createArtifactReplayPackExport,
  createArtifactWorkspaceStore,
  extractArtifactReplayPackFromChatHistory,
} from '@/lib/ai/chat-artifacts/artifact-workspace-store';
import { cn } from '@/lib/utils';

interface ArtifactWorkspacePanelProps {
  className?: string;
  messages: ArtifactWorkspaceHistoryMessage[];
  store?: ArtifactWorkspaceStore;
  workspaceId: string;
}

function firstReplayPackId(packs: ArtifactReplayPack[]): string {
  return packs[0]?.workspaceId ?? '';
}

function secondReplayPackId(packs: ArtifactReplayPack[]): string {
  return packs[1]?.workspaceId ?? firstReplayPackId(packs);
}

function formatImportError(
  reason: 'invalid_json' | 'unsupported_replay_pack'
): string {
  return reason === 'invalid_json'
    ? '잘못된 JSON 파일입니다.'
    : '지원하지 않는 replay pack입니다.';
}

function formatPackOptionLabel(pack: ArtifactReplayPack): string {
  return `${pack.workspaceId} (${pack.entries.length})`;
}

function triggerDownload(exportPayload: {
  fileName: string;
  mimeType: 'application/json';
  contents: string;
}) {
  if (typeof document === 'undefined') return;

  const blob = new Blob([exportPayload.contents], {
    type: exportPayload.mimeType,
  });
  const createObjectUrl = URL.createObjectURL?.bind(URL);
  const revokeObjectUrl = URL.revokeObjectURL?.bind(URL);

  if (!createObjectUrl) return;

  const url = createObjectUrl(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = exportPayload.fileName;
  anchor.rel = 'noopener';
  anchor.click();
  revokeObjectUrl?.(url);
}

export function ArtifactWorkspacePanel({
  className,
  messages,
  store,
  workspaceId,
}: ArtifactWorkspacePanelProps) {
  const workspaceStore = useMemo(
    () => store ?? createArtifactWorkspaceStore(),
    [store]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replayPacks, setReplayPacks] = useState<ArtifactReplayPack[]>(() =>
    workspaceStore.listReplayPacks()
  );
  const [selectedExportId, setSelectedExportId] = useState(() =>
    firstReplayPackId(replayPacks)
  );
  const [leftCompareId, setLeftCompareId] = useState(() =>
    firstReplayPackId(replayPacks)
  );
  const [rightCompareId, setRightCompareId] = useState(() =>
    secondReplayPackId(replayPacks)
  );
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [comparison, setComparison] =
    useState<ArtifactReplayPackComparisonSummary | null>(null);

  const currentReplayPack = useMemo(
    () =>
      extractArtifactReplayPackFromChatHistory({
        workspaceId,
        messages,
      }),
    [messages, workspaceId]
  );
  const supportedCurrentArtifactCount = currentReplayPack.entries.length;
  const hasReplayPacks = replayPacks.length > 0;
  const canCompare = replayPacks.length >= 2;

  const refreshReplayPacks = () => {
    const nextPacks = workspaceStore.listReplayPacks();
    setReplayPacks(nextPacks);
    setSelectedExportId((current) =>
      nextPacks.some((pack) => pack.workspaceId === current)
        ? current
        : firstReplayPackId(nextPacks)
    );
    setLeftCompareId((current) =>
      nextPacks.some((pack) => pack.workspaceId === current)
        ? current
        : firstReplayPackId(nextPacks)
    );
    setRightCompareId((current) =>
      nextPacks.some((pack) => pack.workspaceId === current)
        ? current
        : secondReplayPackId(nextPacks)
    );
  };

  const handleSave = () => {
    setErrorMessage('');
    setComparison(null);
    if (supportedCurrentArtifactCount === 0) {
      setStatusMessage('');
      setErrorMessage('저장 가능한 아티팩트가 없습니다.');
      return;
    }

    workspaceStore.saveReplayPack(currentReplayPack);
    refreshReplayPacks();
    setStatusMessage('현재 대화 replay pack을 저장했습니다.');
  };

  const handleExport = () => {
    setErrorMessage('');
    const pack = workspaceStore.readReplayPack(selectedExportId);
    if (!pack) {
      setStatusMessage('');
      setErrorMessage('내보낼 replay pack을 선택하세요.');
      return;
    }

    const exportPayload = createArtifactReplayPackExport(pack);
    if (!exportPayload) {
      setStatusMessage('');
      setErrorMessage('내보내기 payload를 생성할 수 없습니다.');
      return;
    }

    triggerDownload(exportPayload);
    setStatusMessage('replay pack JSON 내보내기를 준비했습니다.');
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage('');
    setComparison(null);
    let contents: string;
    try {
      contents = await file.text();
    } catch {
      setStatusMessage('');
      setErrorMessage('replay pack 파일을 읽을 수 없습니다.');
      return;
    }

    const result = workspaceStore.importReplayPackExport(contents);
    if (result.status === 'rejected') {
      setStatusMessage('');
      setErrorMessage(formatImportError(result.reason));
      refreshReplayPacks();
      return;
    }

    refreshReplayPacks();
    setStatusMessage('replay pack JSON을 가져왔습니다.');
  };

  const handleCompare = () => {
    setErrorMessage('');
    setComparison(null);
    if (!canCompare) {
      setStatusMessage('');
      setErrorMessage('비교할 replay pack이 2개 이상 필요합니다.');
      return;
    }
    if (leftCompareId === rightCompareId) {
      setStatusMessage('');
      setErrorMessage('서로 다른 replay pack을 선택하세요.');
      return;
    }

    const left = workspaceStore.readReplayPack(leftCompareId);
    const right = workspaceStore.readReplayPack(rightCompareId);
    if (!left || !right) {
      setStatusMessage('');
      setErrorMessage('비교할 replay pack을 선택하세요.');
      return;
    }

    setComparison(createArtifactReplayPackComparisonSummary(left, right));
    setStatusMessage('replay pack 비교를 완료했습니다.');
  };

  const handleClear = () => {
    workspaceStore.clear();
    setStatusMessage('로컬 replay pack을 모두 지웠습니다.');
    setErrorMessage('');
    setComparison(null);
    refreshReplayPacks();
  };

  return (
    <section
      className={cn(
        'space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-sm',
        className
      )}
      data-testid="artifact-workspace-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            아티팩트 워크스페이스
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            replay pack {replayPacks.length}개 · 현재 대화{' '}
            {supportedCurrentArtifactCount}개
            <span
              role="img"
              aria-label="replay pack 설명"
              className="ml-1 inline-flex align-[-2px] text-slate-400"
              title="대화 이력과 분석 결과를 저장·불러오는 스냅샷"
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasReplayPacks}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="로컬 replay pack 지우기"
          aria-label="로컬 replay pack 지우기"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={supportedCurrentArtifactCount === 0}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          현재 대화 저장
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={!hasReplayPacks}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          내보내기
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          가져오기
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="replay pack JSON 가져오기"
        data-testid="artifact-replay-pack-file-input"
        className="hidden"
        onChange={(event) => {
          void handleImportFile(event);
        }}
      />

      {hasReplayPacks ? (
        <div className="space-y-2">
          <div className="space-y-1 rounded border border-slate-200 bg-slate-50 p-2">
            {replayPacks.map((pack) => (
              <div
                key={pack.workspaceId}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate font-medium text-slate-700">
                  {pack.workspaceId}
                </span>
                <span className="shrink-0 text-slate-500">
                  {pack.entries.length} entries
                </span>
              </div>
            ))}
          </div>
          <label className="block text-xs font-medium text-slate-500">
            내보낼 replay pack
            <select
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
              value={selectedExportId}
              onChange={(event) => setSelectedExportId(event.target.value)}
            >
              {replayPacks.map((pack) => (
                <option key={pack.workspaceId} value={pack.workspaceId}>
                  {formatPackOptionLabel(pack)}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
            <div className="grid grid-cols-1 gap-2">
              <label className="block text-xs font-medium text-slate-500">
                기준 replay pack
                <select
                  className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                  value={leftCompareId}
                  onChange={(event) => setLeftCompareId(event.target.value)}
                >
                  {replayPacks.map((pack) => (
                    <option key={pack.workspaceId} value={pack.workspaceId}>
                      {formatPackOptionLabel(pack)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                비교 replay pack
                <select
                  className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                  value={rightCompareId}
                  onChange={(event) => setRightCompareId(event.target.value)}
                >
                  {replayPacks.map((pack) => (
                    <option key={pack.workspaceId} value={pack.workspaceId}>
                      {formatPackOptionLabel(pack)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={handleCompare}
              disabled={!canCompare}
              className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
              비교
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
            저장된 replay pack 없음
          </p>
          <button
            type="button"
            disabled
            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 opacity-40"
          >
            <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
            비교
          </button>
        </div>
      )}

      {comparison && (
        <div
          className="space-y-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800"
          data-testid="artifact-workspace-comparison"
        >
          <div className="grid grid-cols-2 gap-1.5">
            <span>matched {comparison.matchedCount}</span>
            <span>missing {comparison.missingCount}</span>
            <span>added {comparison.addedCount}</span>
            <span>changed {comparison.changedCount}</span>
          </div>
          {comparison.items.length > 0 && (
            <ul
              aria-label="replay pack 비교 상세"
              className="space-y-1 border-t border-emerald-200 pt-2"
            >
              {comparison.items.map((item) => (
                <li
                  key={`${item.status}:${item.id}`}
                  className="flex min-w-0 items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-emerald-900">
                    {item.label}
                  </span>
                  <span className="shrink-0 font-medium">{item.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {statusMessage && (
        <p className="text-xs text-emerald-700" role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className="text-xs text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
