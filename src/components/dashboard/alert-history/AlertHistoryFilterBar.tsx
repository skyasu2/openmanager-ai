import type {
  AlertSeverity,
  AlertState,
} from '@/services/monitoring/AlertManager';
import { FilterChip } from '../shared/FilterChip';
import { TIME_RANGE_OPTIONS } from './alert-history.types';

type AlertHistoryFilterBarProps = {
  keyword: string;
  severity: AlertSeverity | 'all';
  state: AlertState | 'all';
  serverId: string;
  timeRangeMs: number;
  serverIds: string[];
  onKeywordChange: (value: string) => void;
  onFilterChange: (
    update: () => void,
    options?: { serverTouched?: boolean }
  ) => void;
  onSetSeverity: (severity: AlertSeverity | 'all') => void;
  onSetState: (state: AlertState | 'all') => void;
  onSetServerId: (serverId: string) => void;
  onSetTimeRangeMs: (timeRangeMs: number) => void;
};

export function AlertHistoryFilterBar({
  keyword,
  severity,
  state,
  serverId,
  timeRangeMs,
  serverIds,
  onKeywordChange,
  onFilterChange,
  onSetSeverity,
  onSetState,
  onSetServerId,
  onSetTimeRangeMs,
}: AlertHistoryFilterBarProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <input
          id="alert-history-search"
          name="alert-history-search"
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="서버, 메트릭 검색"
          aria-label="알림 검색"
          className="touch-text-safe-xs w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none sm:w-52 sm:py-1.5"
        />

        <div className="hidden h-4 w-px bg-gray-200 sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500">심각도</span>
          {(['all', 'warning', 'critical'] as const).map((item) => (
            <FilterChip
              key={item}
              label={
                item === 'all' ? '전체' : item === 'critical' ? '위험' : '경고'
              }
              active={severity === item}
              onClick={() => onFilterChange(() => onSetSeverity(item))}
              variant={item}
            />
          ))}
        </div>

        <div className="hidden h-4 w-px bg-gray-200 sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500">상태</span>
          {(['all', 'firing', 'resolved'] as const).map((item) => (
            <FilterChip
              key={item}
              label={
                item === 'all'
                  ? '전체'
                  : item === 'firing'
                    ? '발생중'
                    : '해결됨'
              }
              active={state === item}
              onClick={() => onFilterChange(() => onSetState(item))}
              variant={item}
            />
          ))}
        </div>

        <div className="hidden h-4 w-px bg-gray-200 sm:block" />

        <select
          id="alert-history-server-filter"
          name="alert-history-server-filter"
          value={serverId}
          onChange={(e) =>
            onFilterChange(() => onSetServerId(e.target.value), {
              serverTouched: true,
            })
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

        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          {TIME_RANGE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={timeRangeMs === option.value}
              onClick={() =>
                onFilterChange(() => onSetTimeRangeMs(option.value))
              }
              variant="time"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
