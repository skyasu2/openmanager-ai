'use client';

import { FileSearch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
import {
  formatDashboardDateTime,
  formatRotatingTimestamp,
} from '@/utils/dashboard/rotating-timestamp';
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

const INITIAL_DISPLAY = 100;
const LOAD_MORE_COUNT = 100;

export function LogExplorerModal({ open, onClose }: LogExplorerModalProps) {
  const [level, setLevel] = useState<'info' | 'warn' | 'error' | 'all'>('all');
  const [source, setSource] = useState('');
  const [serverId, setServerId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const sessionAnchorRef = useRef(new Date());
  const [sessionAnchorLabel, setSessionAnchorLabel] = useState('');
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
  const [isPending, startTransition] = useTransition();

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

  const handleFilterChange = (update: () => void) => {
    startTransition(() => {
      update();
      setDisplayCount(INITIAL_DISPLAY);
    });
  };

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    sessionAnchorRef.current = now;
    setSessionAnchorLabel(formatDashboardDateTime(now));
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: debouncedKeyword is intentional trigger
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY);
  }, [debouncedKeyword]);

  const filterParams = useMemo(
    () => ({
      level: level === 'all' ? undefined : level,
      source: source || undefined,
      serverId: serverId || undefined,
      keyword: debouncedKeyword || undefined,
    }),
    [level, source, serverId, debouncedKeyword]
  );

  const {
    logs,
    stats,
    sources,
    serverIds,
    isLoading,
    isError,
    errorMessage,
    retry,
    windowStart,
    windowEnd,
  } = useGlobalLogs(filterParams);

  const displayLogs = useMemo(
    () => logs.slice(0, displayCount),
    [logs, displayCount]
  );
  const hasMore = logs.length > displayCount;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="border-b border-gray-100 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <FileSearch size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                로그 탐색기
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                24시간 OTel 로그 통합 검색
              </DialogDescription>
            </div>
            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {stats.total}개 로그
            </span>
          </div>
        </DialogHeader>

        {/* Search & Filter Bar */}
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          {/* Keyword search */}
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <input
              type="text"
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              placeholder="로그 검색"
              aria-label="로그 키워드 검색"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none sm:w-52 sm:py-1.5"
            />

            <div className="hidden h-4 w-px bg-gray-200 sm:block" />

            {/* Level chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500">레벨:</span>
              {(['all', 'info', 'warn', 'error'] as const).map((l) => (
                <FilterChip
                  key={l}
                  label={
                    l === 'all'
                      ? '전체'
                      : l === 'info'
                        ? '정보'
                        : l === 'warn'
                          ? '경고'
                          : '오류'
                  }
                  active={level === l}
                  onClick={() => handleFilterChange(() => setLevel(l))}
                  variant={l}
                />
              ))}
            </div>

            <div className="hidden h-4 w-px bg-gray-200 sm:block" />

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              {/* Source dropdown */}
              <select
                value={source}
                onChange={(e) =>
                  handleFilterChange(() => setSource(e.target.value))
                }
                aria-label="소스 필터"
                className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none sm:w-auto sm:py-1"
              >
                <option value="">전체 소스</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Server dropdown */}
              <select
                value={serverId}
                onChange={(e) =>
                  handleFilterChange(() => setServerId(e.target.value))
                }
                aria-label="서버 필터"
                className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none sm:w-auto sm:py-1"
              >
                <option value="">전체 서버</option>
                {serverIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
              Realtime Anchor
            </span>
            <span className="font-medium tabular-nums text-gray-700">
              {sessionAnchorLabel || '-'}
            </span>
            {windowStart && windowEnd && (
              <span className="text-gray-500">
                데이터 범위: {formatRotatingTimestamp(windowStart)}
                {' ~ '}
                {formatRotatingTimestamp(windowEnd)}
              </span>
            )}
          </div>
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

            {isLoading && displayLogs.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              </div>
            ) : isError && displayLogs.length === 0 ? (
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
                <p className="text-sm font-medium">로그가 없습니다</p>
                <p className="text-xs mt-1 text-gray-600">
                  필터를 조정하여 로그를 검색하세요
                </p>
              </div>
            ) : (
              <div
                className={cn(
                  'space-y-1',
                  isPending && 'opacity-60 transition-opacity duration-200'
                )}
              >
                {displayLogs.map((log) => {
                  const logLevel = log.level as keyof typeof levelStyles;
                  const style = levelStyles[logLevel] ?? levelStyles.info;
                  return (
                    <div
                      key={`${log.serverId}-${log.timestamp}-${log.level}-${log.source}-${log.message.slice(0, 32)}`}
                      className={cn(
                        'flex flex-wrap items-start gap-1.5 rounded border-l-2 px-2.5 py-1.5 sm:flex-nowrap sm:gap-2',
                        style.border,
                        'bg-white/[0.03] hover:bg-white/[0.06] transition-colors'
                      )}
                    >
                      {/* Server badge */}
                      <span className="max-w-[120px] shrink-0 truncate rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                        {log.serverId.split('.')[0]}
                      </span>
                      {/* Timestamp */}
                      <span className="shrink-0 text-sky-300/85 tabular-nums">
                        {formatRotatingTimestamp(log.timestamp, {
                          anchorDate: sessionAnchorRef.current,
                        })}
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
                      <span
                        className={cn(
                          'basis-full break-all sm:basis-auto sm:flex-1',
                          style.text
                        )}
                      >
                        {log.message}
                      </span>
                    </div>
                  );
                })}
                {hasMore && (
                  <div className="text-center py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDisplayCount((prev) => prev + LOAD_MORE_COUNT)
                      }
                      className="rounded-md border border-gray-500/40 px-4 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors"
                    >
                      더 보기 ({logs.length - displayCount}건 남음)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Fade overlay */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-900 to-transparent" />
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:grid-cols-4 sm:gap-4 sm:px-6">
          <StatCell label="전체" value={stats.total} color="text-gray-800" />
          <StatCell label="정보" value={stats.info} color="text-green-600" />
          <StatCell label="경고" value={stats.warn} color="text-yellow-600" />
          <StatCell label="오류" value={stats.error} color="text-red-600" />
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
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors sm:py-0.5',
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
      <div className={cn('text-base font-bold sm:text-lg', color)}>{value}</div>
      <div className="text-[10px] font-medium text-gray-400 uppercase">
        {label}
      </div>
    </div>
  );
}
