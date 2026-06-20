'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MonitoringAlert } from '@/schemas/api.monitoring-report.schema';
import { formatMetricName, formatMetricValue } from '@/utils/metric-formatters';

const MAX_INLINE_ALERTS = 5;
const ALERT_CARD_HIGHLIGHT_MS = 2500;
const ALERT_CARD_HIGHLIGHT_CLASSES = {
  critical: 'ring-rose-500',
  warning: 'ring-amber-500',
} as const;

const severityStyles: Record<
  MonitoringAlert['severity'],
  {
    badge: string;
    border: string;
    label: string;
  }
> = {
  critical: {
    badge: 'border-red-200 bg-red-50 text-red-700',
    border: 'border-l-red-500',
    label: '위험',
  },
  warning: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    border: 'border-l-amber-500',
    label: '경고',
  },
};

interface AlertFeedPanelProps {
  alerts: MonitoringAlert[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  className?: string;
}

function formatElapsedDuration(seconds: number): string {
  if (seconds < 60) return '방금 전';
  return `${Math.round(seconds / 60)}분 경과`;
}

function sortAlerts(alerts: MonitoringAlert[]): MonitoringAlert[] {
  return [...alerts].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return b.duration - a.duration;
  });
}

function AlertFeedSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={`alert-feed-skeleton-${index}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AlertFeedPanel({
  alerts,
  isLoading = false,
  isError = false,
  errorMessage,
  className,
}: AlertFeedPanelProps) {
  const router = useRouter();
  const sortedAlerts = sortAlerts(alerts).slice(0, MAX_INLINE_ALERTS);
  const criticalCount = alerts.filter(
    (alert) => alert.severity === 'critical'
  ).length;
  const warningCount = alerts.filter(
    (alert) => alert.severity === 'warning'
  ).length;

  return (
    <aside
      data-testid="dashboard-alert-feed"
      className={cn(
        'hidden min-h-[28rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:flex',
        className
      )}
      aria-label="인시던트 피드"
    >
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-900">
              인시던트 피드
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              접속 시점 기준 활성 알림
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/alerts')}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            전체
          </button>
        </div>

        {(criticalCount > 0 || warningCount > 0) && (
          <div className="mt-3 flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                {criticalCount} 위험
              </span>
            )}
            {warningCount > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {warningCount} 경고
              </span>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 px-3 py-3">
        {isLoading && sortedAlerts.length === 0 ? (
          <AlertFeedSkeleton />
        ) : isError && sortedAlerts.length === 0 ? (
          <div className="flex h-full min-h-60 flex-col items-center justify-center px-3 text-center text-slate-400">
            <AlertTriangle className="mb-3 h-9 w-9 opacity-40" />
            <p className="text-sm font-medium text-slate-600">
              알림을 불러오지 못했습니다
            </p>
            <p className="mt-1 text-xs">
              {errorMessage || '잠시 후 다시 시도해 주세요'}
            </p>
          </div>
        ) : sortedAlerts.length === 0 ? (
          <div className="flex h-full min-h-60 flex-col items-center justify-center px-3 text-center text-slate-400">
            <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-700">
              모든 시스템 정상
            </p>
            <p className="mt-1 text-xs">현재 활성 인시던트가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedAlerts.map((alert) => (
              <AlertFeedRow key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function AlertFeedRow({ alert }: { alert: MonitoringAlert }) {
  const router = useRouter();
  const styles = severityStyles[alert.severity];
  const serverId = alert.serverId || alert.instance;

  const handleAlertClick = () => {
    const cardElement = document.getElementById(`server-card-${serverId}`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cardElement.querySelector<HTMLButtonElement>('button')?.focus({
        preventScroll: true,
      });

      const highlightColor = ALERT_CARD_HIGHLIGHT_CLASSES[alert.severity];
      cardElement.classList.remove(
        ...Object.values(ALERT_CARD_HIGHLIGHT_CLASSES)
      );
      cardElement.classList.add('ring-4', highlightColor, 'ring-offset-2');

      window.setTimeout(() => {
        cardElement.classList.remove('ring-4', highlightColor, 'ring-offset-2');
      }, ALERT_CARD_HIGHLIGHT_MS);
    } else {
      router.push(`/dashboard/servers/${encodeURIComponent(serverId)}`);
    }
  };

  return (
    <button
      type="button"
      aria-label={`${alert.instance} 서버 카드로 이동`}
      onClick={handleAlertClick}
      className={cn(
        'w-full rounded-lg border border-l-4 border-slate-200 bg-white px-3 py-3 text-left shadow-xs transition-colors hover:bg-slate-50',
        styles.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold',
                styles.badge
              )}
            >
              {styles.label}
            </span>
            <span className="truncate text-sm font-medium text-slate-800">
              {alert.instance}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            {formatMetricName(alert.metric)} ={' '}
            {formatMetricValue(alert.metric, alert.value)}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500">
          {formatElapsedDuration(alert.duration)}
        </span>
      </div>
    </button>
  );
}
