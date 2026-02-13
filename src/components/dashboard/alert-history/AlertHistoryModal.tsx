'use client';

import { Bell } from 'lucide-react';
import { useMemo, useState } from 'react';
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

function formatTime(isoString: string): string {
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

export function AlertHistoryModal({
  open,
  onClose,
  serverIds,
}: AlertHistoryModalProps) {
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const [state, setState] = useState<AlertState | 'all'>('all');
  const [serverId, setServerId] = useState('');
  const [timeRangeMs, setTimeRangeMs] = useState(86_400_000);

  const filterParams = useMemo(
    () => ({
      severity: severity === 'all' ? undefined : severity,
      state: state === 'all' ? undefined : state,
      serverId: serverId || undefined,
      timeRangeMs: timeRangeMs || undefined,
    }),
    [severity, state, serverId, timeRangeMs]
  );

  const { alerts, stats, isLoading, isError, errorMessage } =
    useAlertHistory(filterParams);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Bell size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                Alert History
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                시스템 알림 이력 (firing + resolved)
              </DialogDescription>
            </div>
            {stats.firing > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                {stats.firing} active
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-3">
          {/* Severity chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">Severity:</span>
            {(['all', 'warning', 'critical'] as const).map((s) => (
              <FilterChip
                key={s}
                label={
                  s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
                }
                active={severity === s}
                onClick={() => setSeverity(s)}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-gray-200" />

          {/* State chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">State:</span>
            {(['all', 'firing', 'resolved'] as const).map((s) => (
              <FilterChip
                key={s}
                label={
                  s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
                }
                active={state === s}
                onClick={() => setState(s)}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-gray-200" />

          {/* Server dropdown */}
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            aria-label="서버 필터"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
          >
            <option value="">전체 서버</option>
            {serverIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>

          {/* Time range */}
          <div className="flex items-center gap-1.5 ml-auto">
            {TIME_RANGE_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                active={timeRangeMs === opt.value}
                onClick={() => setTimeRangeMs(opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {errorMessage && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {errorMessage}
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            </div>
          ) : isError && alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">
                알림 이력을 불러오지 못했습니다
              </p>
              <p className="text-xs mt-1">
                잠시 후 다시 시도하거나 필터를 변경해 주세요
              </p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">알림 이력이 없습니다</p>
              <p className="text-xs mt-1">
                선택한 기간에 발생한 알림이 없습니다
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => {
                const colors = severityColors[alert.severity];
                const isResolved = alert.state === 'resolved';

                return (
                  <div
                    key={`${alert.id}-${alert.firedAt}`}
                    className={cn(
                      'rounded-lg border border-gray-100 bg-white p-3 border-l-4 transition-colors',
                      colors.border,
                      isResolved && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
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
                        <span className="text-xs text-gray-500">
                          {alert.metric} = {alert.value.toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-400">
                          (threshold: {alert.threshold}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                      <span>Fired: {formatTime(alert.firedAt)}</span>
                      {alert.resolvedAt && (
                        <span>Resolved: {formatTime(alert.resolvedAt)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-5 gap-4 border-t border-gray-100 px-6 py-3 bg-gray-50/80">
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
            label="Avg Resolution"
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

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        active
          ? 'border-blue-500 bg-blue-500 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
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
  value: number | string;
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
