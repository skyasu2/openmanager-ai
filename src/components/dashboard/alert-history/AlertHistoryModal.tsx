'use client';

import { Bell } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAlertHistory } from '@/hooks/dashboard/useAlertHistory';
import { cn } from '@/lib/utils';
import type {
  AlertSeverity,
  AlertState,
} from '@/services/monitoring/AlertManager';
import {
  formatDashboardDateTime,
  formatRotatingTimestamp,
} from '@/utils/dashboard/rotating-timestamp';
import { FilterChip } from '../shared/FilterChip';
import { StatCell } from '../shared/StatCell';
import type { AlertHistoryModalProps } from './alert-history.types';
import { TIME_RANGE_OPTIONS } from './alert-history.types';

const severityColors: Record<AlertSeverity, { badge: string; border: string }> =
  {
    critical: {
      badge: 'bg-red-100 text-red-700 border-red-200',
      border: 'border-l-red-500',
    },
    warning: {
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
      border: 'border-l-amber-500',
    },
  };

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

const INITIAL_DISPLAY = 50;
const LOAD_MORE_COUNT = 50;

export function AlertHistoryModal({
  open,
  onClose,
  serverIds,
}: AlertHistoryModalProps) {
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const [state, setState] = useState<AlertState | 'all'>('all');
  const [serverId, setServerId] = useState('');
  const [timeRangeMs, setTimeRangeMs] = useState(86_400_000);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
  const [isPending, startTransition] = useTransition();

  const sessionAnchorRef = useRef(new Date());
  const [sessionAnchorLabel, setSessionAnchorLabel] = useState('');
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
      severity: severity === 'all' ? undefined : severity,
      state: state === 'all' ? undefined : state,
      serverId: serverId || undefined,
      timeRangeMs: timeRangeMs || undefined,
      keyword: debouncedKeyword || undefined,
    }),
    [severity, state, serverId, timeRangeMs, debouncedKeyword]
  );

  const { alerts, stats, isLoading, isError, errorMessage } =
    useAlertHistory(filterParams);

  const displayAlerts = useMemo(
    () => alerts.slice(0, displayCount),
    [alerts, displayCount]
  );
  const hasMore = alerts.length > displayCount;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="border-b border-gray-100 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Bell size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                Alert History
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                시스템 알림 이력 (firing + resolved) · 접속 시점 기준 시계열
              </DialogDescription>
            </div>
            {stats.firing > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                {stats.firing} active
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Search & Filter Bar */}
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <input
              type="text"
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              placeholder="서버, 메트릭 검색"
              aria-label="알림 검색"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none sm:w-52 sm:py-1.5"
            />

            <div className="hidden h-4 w-px bg-gray-200 sm:block" />

            {/* Severity chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500">
                Severity:
              </span>
              {(['all', 'warning', 'critical'] as const).map((s) => (
                <FilterChip
                  key={s}
                  label={
                    s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
                  }
                  active={severity === s}
                  onClick={() => handleFilterChange(() => setSeverity(s))}
                  variant={s}
                />
              ))}
            </div>

            <div className="hidden h-4 w-px bg-gray-200 sm:block" />

            {/* State chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500">State:</span>
              {(['all', 'firing', 'resolved'] as const).map((s) => (
                <FilterChip
                  key={s}
                  label={
                    s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
                  }
                  active={state === s}
                  onClick={() => handleFilterChange(() => setState(s))}
                  variant={s}
                />
              ))}
            </div>

            <div className="hidden h-4 w-px bg-gray-200 sm:block" />

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

            {/* Time range */}
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  active={timeRangeMs === opt.value}
                  onClick={() =>
                    handleFilterChange(() => setTimeRangeMs(opt.value))
                  }
                  variant="time"
                />
              ))}
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
            <span className="text-gray-500">(연/월/일/시:분:초)</span>
          </div>
        </div>

        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 sm:px-6 bg-gray-50/30">
          {errorMessage && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {errorMessage}
            </div>
          )}
          {isLoading && displayAlerts.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            </div>
          ) : isError && displayAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">
                알림 이력을 불러오지 못했습니다
              </p>
              <p className="text-xs mt-1">
                잠시 후 다시 시도하거나 필터를 변경해 주세요
              </p>
            </div>
          ) : displayAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">알림 이력이 없습니다</p>
              <p className="text-xs mt-1">
                선택한 필터 조건에 맞는 알림이 없습니다
              </p>
            </div>
          ) : (
            <div
              className={cn(
                'space-y-2',
                (isLoading || isPending) &&
                  displayAlerts.length > 0 &&
                  'opacity-50 transition-opacity duration-200'
              )}
            >
              {displayAlerts.map((alert) => {
                const colors = severityColors[alert.severity];
                const isResolved = alert.state === 'resolved';

                return (
                  <div
                    key={`${alert.id}-${alert.firedAt}`}
                    className={cn(
                      'rounded-lg border border-gray-200/80 bg-white p-3 border-l-4 transition-colors hover:bg-gray-50/50 shadow-sm',
                      colors.border,
                      isResolved && 'opacity-60 shadow-none'
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            'inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase',
                            colors.badge
                          )}
                        >
                          {alert.severity}
                        </span>
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {alert.serverId}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          {alert.metric} = {alert.value?.toFixed(1) ?? 'N/A'}%
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          (threshold: {alert.threshold}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            isResolved
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          )}
                        >
                          {alert.state}
                        </span>
                        <span className="text-xs text-gray-400 tabular-nums">
                          {formatDuration(alert.duration)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
                      <span>
                        Fired:{' '}
                        {formatRotatingTimestamp(alert.firedAt, {
                          anchorDate: sessionAnchorRef.current,
                        })}
                      </span>
                      {alert.resolvedAt && (
                        <span>
                          Resolved:{' '}
                          {formatRotatingTimestamp(alert.resolvedAt, {
                            anchorDate: sessionAnchorRef.current,
                          })}
                        </span>
                      )}
                    </div>
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
                    className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                  >
                    더 보기 ({alerts.length - displayCount}건 남음)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:grid-cols-5 sm:gap-4 sm:px-6">
          <StatCell label="Total" value={stats.total} color="text-gray-800" />
          <StatCell
            label="Critical"
            value={stats.critical}
            color="text-red-600"
          />
          <StatCell
            label="Warning"
            value={stats.warning}
            color="text-amber-600"
          />
          <StatCell label="Firing" value={stats.firing} color="text-red-500" />
          <StatCell
            label="Avg Res."
            value={
              stats.avgResolutionSec > 0
                ? formatDuration(stats.avgResolutionSec)
                : '-'
            }
            color="text-blue-600"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
