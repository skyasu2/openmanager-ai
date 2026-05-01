'use client';

import { Bell, FileSearch, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  type GlobalLogEntry,
  type GlobalLogFilter,
  useGlobalLogs,
} from '@/hooks/dashboard/useGlobalLogs';
import { useScrollSentinel } from '@/hooks/dashboard/useScrollSentinel';
import { cn } from '@/lib/utils';
import {
  formatDashboardDateTime,
  formatRotatingTimestamp,
} from '@/utils/dashboard/rotating-timestamp';
import { FilterChip } from '../shared/FilterChip';
import { StatCell } from '../shared/StatCell';
import type { LogExplorerModalProps } from './log-explorer.types';

const levelStyles: Record<
  Exclude<GlobalLogFilter['level'], undefined>,
  { badge: string; text: string; border: string }
> = {
  info: {
    badge: 'bg-green-500 text-white',
    text: 'text-green-700',
    border: 'border-l-green-500',
  },
  warn: {
    badge: 'bg-yellow-500 text-white',
    text: 'text-amber-700',
    border: 'border-l-yellow-500',
  },
  error: {
    badge: 'bg-red-500 text-white',
    text: 'text-red-700',
    border: 'border-l-red-500',
  },
};

const INITIAL_DISPLAY = 50;
const LOAD_MORE_COUNT = 50;

type LogGroup = {
  key: string;
  logs: GlobalLogEntry[];
  patternKey: string;
  representative: GlobalLogEntry;
};

const normalizeLogPattern = (message: string): string =>
  message
    .toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/g, '<hex>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/\b\d+(?:\.\d+)?(?:ms|s|%|mb|gb|kb|b)?\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim();

const getPatternKey = (log: GlobalLogEntry): string =>
  [log.serverId, log.level, log.source, normalizeLogPattern(log.message)].join(
    '|'
  );

const getLogKey = (log: GlobalLogEntry, index: number): string =>
  `${log.serverId}-${log.timestamp}-${log.level}-${log.source}-${index}`;

const groupConsecutiveLogs = (logs: GlobalLogEntry[]): LogGroup[] => {
  const groups: LogGroup[] = [];

  logs.forEach((log, index) => {
    const patternKey = getPatternKey(log);
    const previousGroup = groups.at(-1);

    if (previousGroup?.patternKey === patternKey) {
      previousGroup.logs.push(log);
      return;
    }

    groups.push({
      key: getLogKey(log, index),
      logs: [log],
      patternKey,
      representative: log,
    });
  });

  return groups;
};

function LogAlertButton({
  serverId,
  onOpenAlertHistory,
}: {
  serverId: string;
  onOpenAlertHistory: (serverId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpenAlertHistory(serverId);
      }}
      aria-label={`${serverId} 알림 이력 보기`}
      title="알림 이력"
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
    >
      <Bell size={11} />
      알림
    </button>
  );
}

export function LogExplorerPanel({
  active = true,
  initialServerId = null,
}: {
  active?: boolean;
  initialServerId?: string | null;
}) {
  const [level, setLevel] = useState<'info' | 'warn' | 'error' | 'all'>('all');
  const [source, setSource] = useState('');
  const [serverId, setServerId] = useState(initialServerId ?? '');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const appliedInitialServerIdRef = useRef(initialServerId ?? '');
  const previousLoadedLogsRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sessionAnchorRef = useRef(new Date());
  const [sessionAnchorLabel, setSessionAnchorLabel] = useState('');
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
  const [expandedLogKey, setExpandedLogKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
      setExpandedLogKey(null);
    });
  };

  useEffect(() => {
    const normalizedInitialServerId = initialServerId ?? '';
    if (appliedInitialServerIdRef.current === normalizedInitialServerId) {
      return;
    }

    appliedInitialServerIdRef.current = normalizedInitialServerId;
    startTransition(() => {
      setServerId(normalizedInitialServerId);
      setDisplayCount(INITIAL_DISPLAY);
      setExpandedLogKey(null);
    });
  }, [initialServerId]);

  const handleLevelStatClick = (nextLevel: typeof level) => {
    handleFilterChange(() =>
      setLevel((currentLevel) =>
        currentLevel === nextLevel || nextLevel === 'all' ? 'all' : nextLevel
      )
    );
  };

  const resetFilters = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startTransition(() => {
      setLevel('all');
      setSource('');
      setServerId('');
      setKeyword('');
      setDebouncedKeyword('');
      setDisplayCount(INITIAL_DISPLAY);
      setExpandedLogKey(null);
    });
  };

  const handleOpenAlertHistory = useCallback(
    (targetServerId: string) => {
      router.push(
        `/dashboard/alerts?server=${encodeURIComponent(targetServerId)}`
      );
    },
    [router]
  );

  useEffect(() => {
    if (!active) return;
    const now = new Date();
    sessionAnchorRef.current = now;
    setSessionAnchorLabel(formatDashboardDateTime(now));
  }, [active]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: debouncedKeyword is intentional trigger
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY);
    setExpandedLogKey(null);
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
    hasNextPage: hasNextLogPage = false,
    isFetchingNextPage: isFetchingNextLogPage = false,
    fetchNextPage: fetchNextLogPage,
    windowStart,
    windowEnd,
  } = useGlobalLogs(filterParams);

  const displayLogs = useMemo(
    () => logs.slice(0, displayCount),
    [logs, displayCount]
  );
  const displayLogGroups = useMemo(
    () => groupConsecutiveLogs(displayLogs),
    [displayLogs]
  );
  const hasMore = logs.length > displayCount;
  const canLoadMore = hasMore || hasNextLogPage || isFetchingNextLogPage;
  const loadMoreLogs = useCallback(() => {
    if (displayCount < logs.length) {
      setDisplayCount((currentCount) =>
        Math.min(logs.length, currentCount + LOAD_MORE_COUNT)
      );
      return;
    }

    if (hasNextLogPage && !isFetchingNextLogPage) {
      void fetchNextLogPage?.();
    }
  }, [
    displayCount,
    fetchNextLogPage,
    hasNextLogPage,
    isFetchingNextLogPage,
    logs.length,
  ]);
  const loadMoreSentinelRef = useScrollSentinel(
    loadMoreLogs,
    canLoadMore && !isFetchingNextLogPage && !isPending,
    { rootRef: scrollContainerRef }
  );

  useEffect(() => {
    const previousLoadedLogs = previousLoadedLogsRef.current;

    if (logs.length < previousLoadedLogs) {
      previousLoadedLogsRef.current = logs.length;
      return;
    }

    if (
      previousLoadedLogs > 0 &&
      logs.length > previousLoadedLogs &&
      displayCount >= previousLoadedLogs
    ) {
      setDisplayCount((currentCount) =>
        Math.min(logs.length, currentCount + LOAD_MORE_COUNT)
      );
    }

    previousLoadedLogsRef.current = logs.length;
  }, [displayCount, logs.length]);
  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (level !== 'all') labels.push(`레벨 ${level.toUpperCase()}`);
    if (source) labels.push(`소스 ${source}`);
    if (serverId) labels.push(`서버 ${serverId}`);
    if (keyword) labels.push(`검색어 "${keyword}"`);
    return labels;
  }, [keyword, level, serverId, source]);
  const hasActiveFilters = activeFilterLabels.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <FileSearch size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">로그 탐색기</h2>
            <p className="text-xs text-gray-500">24시간 OTel 로그 통합 검색</p>
          </div>
          <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {stats.total}개 로그
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div
          data-testid="log-stats-bar"
          className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-gray-50/90 p-2 sm:grid-cols-4"
        >
          <StatCell
            label="전체"
            value={stats.total}
            color="text-gray-800"
            active={level === 'all'}
            ariaLabel="전체 로그 보기"
            onClick={() => handleLevelStatClick('all')}
            testId="log-stat-all"
          />
          <StatCell
            label="정보"
            value={stats.info}
            color="text-green-600"
            active={level === 'info'}
            ariaLabel="정보 로그 필터"
            onClick={() => handleLevelStatClick('info')}
            testId="log-stat-info"
          />
          <StatCell
            label="경고"
            value={stats.warn}
            color="text-yellow-600"
            active={level === 'warn'}
            ariaLabel="경고 로그 필터"
            onClick={() => handleLevelStatClick('warn')}
            testId="log-stat-warn"
          />
          <StatCell
            label="오류"
            value={stats.error}
            color="text-red-600"
            active={level === 'error'}
            ariaLabel="오류 로그 필터"
            onClick={() => handleLevelStatClick('error')}
            testId="log-stat-error"
          />
        </div>

        {/* Keyword search */}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <input
            id="log-explorer-search"
            name="log-explorer-search"
            type="text"
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder="로그 검색"
            aria-label="로그 키워드 검색"
            className="touch-text-safe-xs w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none sm:w-52 sm:py-1.5"
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

          <div className="grid grid-cols-2 gap-2 sm:flex sm:min-w-0 sm:flex-wrap sm:items-center">
            {/* Source dropdown */}
            <select
              id="log-explorer-source-filter"
              name="log-explorer-source-filter"
              value={source}
              onChange={(e) =>
                handleFilterChange(() => setSource(e.target.value))
              }
              aria-label="소스 필터"
              className="touch-text-safe-xs w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-gray-700 focus:border-blue-400 focus:outline-none sm:w-auto sm:py-1"
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
              id="log-explorer-server-filter"
              name="log-explorer-server-filter"
              value={serverId}
              onChange={(e) =>
                handleFilterChange(() => setServerId(e.target.value))
              }
              aria-label="서버 필터"
              className="touch-text-safe-xs w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-gray-700 focus:border-blue-400 focus:outline-none sm:w-auto sm:py-1"
            >
              <option value="">전체 서버</option>
              {serverIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 sm:ml-auto sm:py-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
        </div>

        <div
          data-testid="log-explorer-filter-summary"
          className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5 text-[11px] text-gray-500"
        >
          <span className="font-medium text-gray-600">활성 필터:</span>
          {hasActiveFilters ? (
            activeFilterLabels.map((label) => (
              <span
                key={label}
                className="max-w-full break-words rounded-full bg-gray-100 px-2 py-0.5 text-gray-700"
              >
                {label}
              </span>
            ))
          ) : (
            <span>없음</span>
          )}
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

      {/* Log Result List */}
      <div
        data-testid="log-explorer-terminal"
        className="relative min-h-[320px] flex-1 overflow-hidden bg-white sm:max-h-[56vh]"
      >
        <div
          ref={scrollContainerRef}
          data-testid="log-explorer-scroll-container"
          className="relative h-full overflow-y-auto p-4 font-mono text-xs"
          style={{ contain: 'strict' }}
        >
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
              <p className="text-sm font-medium">로그를 불러오지 못했습니다</p>
              <p className="text-xs mt-1 text-gray-600">
                잠시 후 다시 시도해 주세요
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-3 rounded border border-gray-300 px-3 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
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
            <div aria-busy={isPending ? true : undefined} className="space-y-1">
              {displayLogGroups.map((group) => {
                const log = group.representative;
                const logLevel = log.level as keyof typeof levelStyles;
                const style = levelStyles[logLevel] ?? levelStyles.info;
                const logKey = group.key;
                const isExpanded = expandedLogKey === logKey;
                const isGrouped = group.logs.length > 1;
                const toggleExpanded = () =>
                  setExpandedLogKey((currentKey) =>
                    currentKey === logKey ? null : logKey
                  );
                const rowToneClass =
                  logLevel === 'error'
                    ? 'bg-red-50 hover:bg-red-100'
                    : 'bg-white hover:bg-gray-50';
                return (
                  <div
                    key={logKey}
                    className={cn(
                      'flex w-full gap-1.5 rounded border-l-2 px-2.5 py-1.5 transition-colors sm:gap-2',
                      isExpanded
                        ? 'flex-wrap items-start'
                        : 'flex-nowrap items-center',
                      style.border,
                      rowToneClass
                    )}
                  >
                    <button
                      type="button"
                      data-testid="log-explorer-log-row"
                      aria-expanded={isExpanded}
                      onClick={toggleExpanded}
                      className={cn(
                        'flex min-w-0 flex-1 gap-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 sm:gap-2',
                        isExpanded
                          ? 'flex-wrap items-start'
                          : 'flex-nowrap items-center',
                        rowToneClass
                      )}
                    >
                      {/* Server badge */}
                      <span className="max-w-[120px] shrink-0 truncate rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        {log.serverId.split('.')[0]}
                      </span>
                      {/* Timestamp */}
                      <span
                        className={cn(
                          'shrink-0 tabular-nums',
                          logLevel === 'error' ? 'text-red-700' : 'text-sky-600'
                        )}
                      >
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
                      <span
                        className={cn(
                          'shrink-0 text-[10px]',
                          logLevel === 'error'
                            ? 'text-red-700/80'
                            : 'text-purple-400/80'
                        )}
                      >
                        [{log.source}]
                      </span>
                      {/* Message */}
                      <span
                        data-testid="log-explorer-log-message"
                        className={cn(
                          'min-w-0 flex-1 break-words',
                          isExpanded
                            ? 'basis-full whitespace-pre-wrap sm:basis-auto'
                            : 'truncate',
                          style.text
                        )}
                      >
                        {log.message}
                      </span>
                      {isGrouped && (
                        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                          ×{group.logs.length}
                        </span>
                      )}
                    </button>
                    <LogAlertButton
                      serverId={log.serverId}
                      onOpenAlertHistory={handleOpenAlertHistory}
                    />
                    {isGrouped && isExpanded && (
                      <div
                        data-testid="log-explorer-log-group-details"
                        className="basis-full space-y-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] text-gray-600"
                      >
                        {group.logs.slice(1, 6).map((groupLog) => (
                          <div
                            key={`${groupLog.timestamp}-${groupLog.message}`}
                            className="flex flex-wrap items-center gap-2 break-words"
                          >
                            <span className="tabular-nums">
                              {formatRotatingTimestamp(groupLog.timestamp, {
                                anchorDate: sessionAnchorRef.current,
                              })}
                            </span>
                            <span className="min-w-0 flex-1 break-words">
                              {groupLog.message}
                            </span>
                            <LogAlertButton
                              serverId={groupLog.serverId}
                              onOpenAlertHistory={handleOpenAlertHistory}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {canLoadMore && (
                <div className="text-center py-3">
                  <div
                    ref={loadMoreSentinelRef}
                    data-testid="log-explorer-load-sentinel"
                    className="h-px"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={loadMoreLogs}
                    disabled={isFetchingNextLogPage}
                    className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isFetchingNextLogPage
                      ? '불러오는 중...'
                      : hasMore
                        ? `더 보기 (${logs.length - displayCount}건 남음)`
                        : '다음 로그 불러오기'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Fade overlay */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  );
}

export function LogExplorerModal({ open, onClose }: LogExplorerModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl flex flex-col gap-0 p-0">
        <LogExplorerPanel active={open} />
      </DialogContent>
    </Dialog>
  );
}
