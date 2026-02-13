'use client';

import { FileSearch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type GlobalLogFilter,
  useGlobalLogs,
} from '@/hooks/dashboard/useGlobalLogs';
import { cn } from '@/lib/utils';
import type { LogExplorerModalProps } from './log-explorer.types';

const levelStyles: Record<
  Exclude<GlobalLogFilter['level'], undefined>,
  { badge: string; text: string; border: string }
> = {
  info: {
    badge: 'bg-green-500 text-white',
    text: 'text-green-300',
    border: 'border-l-green-500',
  },
  warn: {
    badge: 'bg-yellow-500 text-white',
    text: 'text-yellow-300',
    border: 'border-l-yellow-500',
  },
  error: {
    badge: 'bg-red-500 text-white',
    text: 'text-red-300',
    border: 'border-l-red-500',
  },
};

function formatTimestamp(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function LogExplorerModal({
  open,
  onClose,
  servers,
}: LogExplorerModalProps) {
  const [level, setLevel] = useState<'info' | 'warn' | 'error' | 'all'>('all');
  const [source, setSource] = useState('');
  const [serverId, setServerId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  // Debounce keyword with proper cleanup on unmount
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedKeyword(value), 300);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const filterParams = useMemo(
    () => ({
      level: level === 'all' ? undefined : level,
      source: source || undefined,
      serverId: serverId || undefined,
      keyword: debouncedKeyword || undefined,
    }),
    [level, source, serverId, debouncedKeyword]
  );

  const { logs, stats, sources, serverIds, isError, errorMessage, retry } =
    useGlobalLogs(servers, filterParams);

  // Limit display to 500 entries for performance
  const displayLogs = useMemo(() => logs.slice(0, 500), [logs]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <FileSearch size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                Log Explorer
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                전체 서버 로그 통합 뷰
              </DialogDescription>
            </div>
            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {stats.total} logs
            </span>
          </div>
        </DialogHeader>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-3">
          {/* Keyword search */}
          <input
            type="text"
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder="Search logs..."
            aria-label="로그 키워드 검색"
            className="w-48 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
          />

          <div className="h-4 w-px bg-gray-200" />

          {/* Level chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">Level:</span>
            {(['all', 'info', 'warn', 'error'] as const).map((l) => (
              <FilterChip
                key={l}
                label={l === 'all' ? 'All' : l.toUpperCase()}
                active={level === l}
                onClick={() => setLevel(l)}
                variant={l}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-gray-200" />

          {/* Source dropdown */}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="소스 필터"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Server dropdown */}
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            aria-label="서버 필터"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
          >
            <option value="">All Servers</option>
            {serverIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        {/* Log Result List - Terminal style */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
          <div className="relative h-full overflow-y-auto p-4 font-mono text-xs">
            {errorMessage && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded border border-amber-300/80 bg-amber-100/90 px-3 py-2 text-[11px] text-amber-900">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={retry}
                  className="shrink-0 rounded border border-amber-500 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-200"
                >
                  재시도
                </button>
              </div>
            )}

            {isError && displayLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <FileSearch size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  로그를 불러오지 못했습니다
                </p>
                <p className="text-xs mt-1 text-gray-600">
                  잠시 후 다시 시도해 주세요
                </p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-3 rounded border border-gray-400/60 px-3 py-1 text-[11px] text-gray-300 hover:bg-white/10"
                >
                  다시 시도
                </button>
              </div>
            ) : displayLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <FileSearch size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No logs found</p>
                <p className="text-xs mt-1 text-gray-600">
                  필터를 조정하여 로그를 검색하세요
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {displayLogs.map((log, idx) => {
                  const style = levelStyles[log.level];
                  return (
                    <div
                      key={`${log.serverId}-${log.timestamp}-${idx}`}
                      className={cn(
                        'flex items-start gap-2 rounded px-2.5 py-1.5 border-l-2',
                        style.border,
                        'bg-white/[0.03] hover:bg-white/[0.06] transition-colors'
                      )}
                    >
                      {/* Server badge */}
                      <span className="shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                        {log.serverId.split('.')[0]}
                      </span>
                      {/* Timestamp */}
                      <span className="shrink-0 text-gray-500 tabular-nums">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      {/* Level badge */}
                      <span
                        className={cn(
                          'shrink-0 inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                          style.badge
                        )}
                      >
                        {log.level}
                      </span>
                      {/* Source tag */}
                      <span className="shrink-0 text-purple-400/80 text-[10px]">
                        [{log.source}]
                      </span>
                      {/* Message */}
                      <span className={cn('flex-1 break-all', style.text)}>
                        {log.message}
                      </span>
                    </div>
                  );
                })}
                {logs.length > 500 && (
                  <div className="text-center py-3 text-gray-500 text-xs">
                    Showing 500 of {logs.length} logs. Refine filters to see
                    more.
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Fade overlay */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-900 to-transparent" />
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-4 gap-4 border-t border-gray-100 px-6 py-3 bg-gray-50/80">
          <StatCell label="Total" value={stats.total} color="text-gray-800" />
          <StatCell label="INFO" value={stats.info} color="text-green-600" />
          <StatCell label="WARN" value={stats.warn} color="text-yellow-600" />
          <StatCell label="ERROR" value={stats.error} color="text-red-600" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  variant = 'all',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: 'all' | Exclude<GlobalLogFilter['level'], undefined>;
}) {
  const activeColors: Record<
    'all' | Exclude<GlobalLogFilter['level'], undefined>,
    string
  > = {
    all: 'border-blue-500 bg-blue-500 text-white',
    info: 'border-green-500 bg-green-500 text-white',
    warn: 'border-yellow-500 bg-yellow-500 text-white',
    error: 'border-red-500 bg-red-500 text-white',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        active
          ? (activeColors[variant] ?? activeColors.all)
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
      )}
    >
      {label}
    </button>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={cn('text-lg font-bold', color)}>{value}</div>
      <div className="text-[10px] font-medium text-gray-400 uppercase">
        {label}
      </div>
    </div>
  );
}
