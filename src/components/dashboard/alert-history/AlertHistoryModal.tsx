'use client';

import { Bell, FileText } from 'lucide-react';
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
import { useAlertHistory } from '@/hooks/dashboard/useAlertHistory';
import { useScrollSentinel } from '@/hooks/dashboard/useScrollSentinel';
import { cn } from '@/lib/utils';
import type {
  Alert,
  AlertSeverity,
  AlertState,
} from '@/services/monitoring/AlertManager';
import {
  formatDashboardDateTime,
  formatRotatingTimestamp,
} from '@/utils/dashboard/rotating-timestamp';
import { formatMetricName, formatMetricValue } from '@/utils/metric-formatters';
import { supportsDashboardAlertAIPrefill } from '../alert-ai-context';
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

const normalizeInitialServerId = (
  initialServerId: string | null | undefined,
  serverIds: string[]
) =>
  initialServerId && serverIds.includes(initialServerId) ? initialServerId : '';

export function AlertHistoryPanel({
  active = true,
  serverIds,
  onAskAIAboutAlert,
  initialServerId = null,
}: Omit<AlertHistoryModalProps, 'open' | 'onClose'> & {
  active?: boolean;
}) {
  const normalizedInitialServerId = normalizeInitialServerId(
    initialServerId,
    serverIds
  );
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const [state, setState] = useState<AlertState | 'all'>('all');
  const [serverId, setServerId] = useState(normalizedInitialServerId);
  const [timeRangeMs, setTimeRangeMs] = useState(86_400_000);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
  const [isPending, startTransition] = useTransition();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const appliedInitialServerIdRef = useRef(normalizedInitialServerId);

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
    if (appliedInitialServerIdRef.current === normalizedInitialServerId) {
      return;
    }

    appliedInitialServerIdRef.current = normalizedInitialServerId;
    startTransition(() => {
      setServerId(normalizedInitialServerId);
      setDisplayCount(INITIAL_DISPLAY);
    });
  }, [normalizedInitialServerId]);

  useEffect(() => {
    if (!active) return;
    const now = new Date();
    sessionAnchorRef.current = now;
    setSessionAnchorLabel(formatDashboardDateTime(now));
  }, [active]);

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
  const loadMoreAlerts = useCallback(() => {
    setDisplayCount((currentCount) =>
      Math.min(alerts.length, currentCount + LOAD_MORE_COUNT)
    );
  }, [alerts.length]);
  const loadMoreSentinelRef = useScrollSentinel(
    loadMoreAlerts,
    hasMore && !isPending && !isLoading,
    { rootRef: scrollContainerRef }
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Bell size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">알림 이력</h2>
            <p className="text-xs text-gray-500">
              시스템 알림 이력 (firing + resolved) · 접속 시점 기준 시계열
            </p>
          </div>
          {stats.firing > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
              {stats.firing} 발생중
            </span>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <input
            id="alert-history-search"
            name="alert-history-search"
            type="text"
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder="서버, 메트릭 검색"
            aria-label="알림 검색"
            className="touch-text-safe-xs w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none sm:w-52 sm:py-1.5"
          />

          <div className="hidden h-4 w-px bg-gray-200 sm:block" />

          {/* Severity chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">심각도</span>
            {(['all', 'warning', 'critical'] as const).map((s) => (
              <FilterChip
                key={s}
                label={
                  s === 'all' ? '전체' : s === 'critical' ? '위험' : '경고'
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
            <span className="text-xs font-medium text-gray-500">상태</span>
            {(['all', 'firing', 'resolved'] as const).map((s) => (
              <FilterChip
                key={s}
                label={
                  s === 'all' ? '전체' : s === 'firing' ? '발생중' : '해결됨'
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
            id="alert-history-server-filter"
            name="alert-history-server-filter"
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
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 min-h-0 sm:px-6 bg-gray-50/30"
      >
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
            aria-busy={isLoading || isPending ? true : undefined}
            className="space-y-2"
          >
            {displayAlerts.map((alert) => {
              const colors = severityColors[alert.severity];
              return (
                <AlertHistoryRow
                  key={`${alert.id}-${alert.firedAt}`}
                  alert={alert}
                  badgeClassName={colors.badge}
                  borderClassName={colors.border}
                  anchorDate={sessionAnchorRef.current}
                  onAskAIAboutAlert={onAskAIAboutAlert}
                />
              );
            })}
            {hasMore && (
              <div className="py-3 text-center">
                <div
                  ref={loadMoreSentinelRef}
                  data-testid="alert-history-load-sentinel"
                  className="h-px"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={loadMoreAlerts}
                  disabled={isPending || isLoading}
                  className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
                >
                  더 보기 ({alerts.length - displayCount}건 남음)
                </button>
                <p className="mt-1 text-[11px] text-gray-400">
                  아래로 스크롤해도 자동으로 더 표시됩니다
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:grid-cols-5 sm:gap-4 sm:px-6">
        <StatCell
          label="전체"
          value={stats.total}
          color="text-gray-800"
          active={severity === 'all' && state === 'all'}
          onClick={() =>
            startTransition(() => {
              setSeverity('all');
              setState('all');
              setDisplayCount(INITIAL_DISPLAY);
            })
          }
        />
        <StatCell
          label="위험"
          value={stats.critical}
          color="text-red-600"
          active={severity === 'critical'}
          onClick={() =>
            handleFilterChange(() =>
              setSeverity((prev) => (prev === 'critical' ? 'all' : 'critical'))
            )
          }
        />
        <StatCell
          label="경고"
          value={stats.warning}
          color="text-amber-600"
          active={severity === 'warning'}
          onClick={() =>
            handleFilterChange(() =>
              setSeverity((prev) => (prev === 'warning' ? 'all' : 'warning'))
            )
          }
        />
        <StatCell
          label="발생중"
          value={stats.firing}
          color="text-red-500"
          active={state === 'firing'}
          onClick={() =>
            handleFilterChange(() =>
              setState((prev) => (prev === 'firing' ? 'all' : 'firing'))
            )
          }
        />
        <StatCell
          label="평균 해결"
          value={
            stats.avgResolutionSec > 0
              ? formatDuration(stats.avgResolutionSec)
              : '-'
          }
          color="text-blue-600"
        />
      </div>
    </div>
  );
}

export function AlertHistoryModal({
  open,
  onClose,
  serverIds,
  onAskAIAboutAlert,
  initialServerId,
}: AlertHistoryModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl flex flex-col gap-0 p-0">
        <AlertHistoryPanel
          active={open}
          serverIds={serverIds}
          onAskAIAboutAlert={onAskAIAboutAlert}
          initialServerId={initialServerId}
        />
      </DialogContent>
    </Dialog>
  );
}

export function AlertHistoryRow({
  alert,
  badgeClassName,
  borderClassName,
  anchorDate,
  onAskAIAboutAlert,
}: {
  alert: Alert;
  badgeClassName: string;
  borderClassName: string;
  anchorDate: Date;
  onAskAIAboutAlert?: (alert: Alert) => void;
}) {
  const router = useRouter();
  const isResolved = alert.state === 'resolved';
  const canAskAI =
    typeof onAskAIAboutAlert === 'function' &&
    supportsDashboardAlertAIPrefill(alert.metric);
  const rowClassName = cn(
    'rounded-lg border border-gray-200/80 bg-white p-3 border-l-4 shadow-sm',
    'transition-colors hover:bg-gray-50/50',
    borderClassName,
    isResolved && 'opacity-60 shadow-none'
  );

  const handleOpenLogs = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/dashboard/logs?server=${encodeURIComponent(alert.serverId)}`);
  };

  const content = (
    <>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div
          className="flex min-w-0 flex-wrap items-center gap-2.5"
          data-testid="alert-history-row-main"
        >
          <span
            className={cn(
              'inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold',
              badgeClassName
            )}
          >
            {alert.severity === 'critical' ? '위험' : '경고'}
          </span>
          <span
            className="min-w-0 max-w-full break-words text-sm font-medium text-gray-800 sm:truncate"
            data-testid="alert-history-row-server"
          >
            {alert.serverId}
          </span>
          <span
            className="min-w-0 max-w-full break-words text-xs text-gray-500 sm:truncate"
            data-testid="alert-history-row-metric"
          >
            {formatMetricName(alert.metric)} ={' '}
            {formatMetricValue(alert.metric, alert.value)}
          </span>
          <span className="shrink-0 text-xs text-gray-400">
            (임계값: {alert.threshold}%)
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
              isResolved
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            )}
          >
            {isResolved ? '해결됨' : '발생중'}
          </span>
          <span className="tabular-nums text-xs text-gray-400">
            {formatDuration(alert.duration)}
          </span>
          {canAskAI && (
            <button
              type="button"
              onClick={() => onAskAIAboutAlert(alert)}
              aria-label={`AI에게 ${alert.instance} ${formatMetricName(alert.metric)} 알림 분석 요청`}
              title="AI 분석"
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 transition-colors hover:bg-rose-50"
            >
              AI
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenLogs}
            aria-label={`${alert.serverId} 로그 보기`}
            title="로그 보기"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <FileText size={11} />
            로그
          </button>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
        <span>
          발생:{' '}
          {formatRotatingTimestamp(alert.firedAt, {
            anchorDate,
          })}
        </span>
        {alert.resolvedAt && (
          <span>
            해결:{' '}
            {formatRotatingTimestamp(alert.resolvedAt, {
              anchorDate,
            })}
          </span>
        )}
      </div>
    </>
  );

  return <div className={rowClassName}>{content}</div>;
}
