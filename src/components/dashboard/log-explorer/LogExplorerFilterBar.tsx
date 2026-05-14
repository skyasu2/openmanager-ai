import { RotateCcw } from 'lucide-react';
import { FilterChip } from '../shared/FilterChip';
import { StatCell } from '../shared/StatCell';

type LogLevelFilter = 'info' | 'warn' | 'error' | 'all';

type LogExplorerFilterBarProps = {
  stats: {
    total: number;
    info: number;
    warn: number;
    error: number;
  };
  level: LogLevelFilter;
  source: string;
  serverId: string;
  keyword: string;
  sources: string[];
  serverIds: string[];
  activeFilterLabels: string[];
  hasActiveFilters: boolean;
  onLevelStatClick: (level: LogLevelFilter) => void;
  onKeywordChange: (value: string) => void;
  onFilterChange: (update: () => void) => void;
  onSetLevel: (level: LogLevelFilter) => void;
  onSetSource: (source: string) => void;
  onSetServerId: (serverId: string) => void;
  onResetFilters: () => void;
};

export function LogExplorerFilterBar({
  stats,
  level,
  source,
  serverId,
  keyword,
  sources,
  serverIds,
  activeFilterLabels,
  hasActiveFilters,
  onLevelStatClick,
  onKeywordChange,
  onFilterChange,
  onSetLevel,
  onSetSource,
  onSetServerId,
  onResetFilters,
}: LogExplorerFilterBarProps) {
  return (
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
          onClick={() => onLevelStatClick('all')}
          testId="log-stat-all"
        />
        <StatCell
          label="정보"
          value={stats.info}
          color="text-green-600"
          active={level === 'info'}
          ariaLabel="정보 로그 필터"
          onClick={() => onLevelStatClick('info')}
          testId="log-stat-info"
        />
        <StatCell
          label="경고"
          value={stats.warn}
          color="text-yellow-600"
          active={level === 'warn'}
          ariaLabel="경고 로그 필터"
          onClick={() => onLevelStatClick('warn')}
          testId="log-stat-warn"
        />
        <StatCell
          label="오류"
          value={stats.error}
          color="text-red-600"
          active={level === 'error'}
          ariaLabel="오류 로그 필터"
          onClick={() => onLevelStatClick('error')}
          testId="log-stat-error"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <input
          id="log-explorer-search"
          name="log-explorer-search"
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="로그 검색"
          aria-label="로그 키워드 검색"
          className="touch-text-safe-xs w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none sm:w-52 sm:py-1.5"
        />

        <div className="hidden h-4 w-px bg-gray-200 sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500">레벨:</span>
          {(['all', 'info', 'warn', 'error'] as const).map((item) => (
            <FilterChip
              key={item}
              label={
                item === 'all'
                  ? '전체'
                  : item === 'info'
                    ? '정보'
                    : item === 'warn'
                      ? '경고'
                      : '오류'
              }
              active={level === item}
              onClick={() => onFilterChange(() => onSetLevel(item))}
              variant={item}
            />
          ))}
        </div>

        <div className="hidden h-4 w-px bg-gray-200 sm:block" />

        <div className="grid grid-cols-2 gap-2 sm:flex sm:min-w-0 sm:flex-wrap sm:items-center">
          <select
            id="log-explorer-source-filter"
            name="log-explorer-source-filter"
            value={source}
            onChange={(e) => onFilterChange(() => onSetSource(e.target.value))}
            aria-label="소스 필터"
            className="touch-text-safe-xs w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-gray-700 focus:border-blue-400 focus:outline-none sm:w-auto sm:py-1"
          >
            <option value="">전체 소스</option>
            {sources.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            id="log-explorer-server-filter"
            name="log-explorer-server-filter"
            value={serverId}
            onChange={(e) =>
              onFilterChange(() => onSetServerId(e.target.value))
            }
            aria-label="서버 필터"
            className="touch-text-safe-xs w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-gray-700 focus:border-blue-400 focus:outline-none sm:w-auto sm:py-1"
          >
            <option value="">전체 서버</option>
            {serverIds.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onResetFilters}
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
  );
}
