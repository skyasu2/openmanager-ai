'use client';

import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MonitoringAlert } from '@/schemas/api.monitoring-report.schema';
import { formatMetricName, formatMetricValue } from '@/utils/metric-formatters';
import { supportsDashboardAlertAIPrefill } from './alert-ai-context';
import { StatCell } from './shared/StatCell';

const severityBadge: Record<MonitoringAlert['severity'], string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
};

function formatElapsedDuration(seconds: number): string {
  if (seconds < 60) return '방금 전';
  return `${Math.round(seconds / 60)}분 경과`;
}

interface ActiveAlertsModalProps {
  open: boolean;
  onClose: () => void;
  alerts: MonitoringAlert[];
  onAskAIAboutAlert?: (alert: MonitoringAlert) => void;
}

export function ActiveAlertsPanel({
  alerts,
  onAskAIAboutAlert,
}: Pick<ActiveAlertsModalProps, 'alerts' | 'onAskAIAboutAlert'>) {
  const sorted = [...alerts].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return b.value - a.value;
  });

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-100 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">활성 알림</h2>
            <p className="text-xs text-gray-500">
              현재 진행 중인 시스템 활성 알림
            </p>
          </div>
          {(criticalCount > 0 || warningCount > 0) && (
            <div className="ml-auto flex items-center gap-2">
              {criticalCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                  {criticalCount} 위험
                </span>
              )}
              {warningCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  {warningCount} 경고
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/30 px-4 py-4 sm:px-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <AlertTriangle size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">현재 활성 알림이 없습니다</p>
            <p className="mt-1 text-xs">시스템이 안정적으로 동작 중입니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onAskAIAboutAlert={onAskAIAboutAlert}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-gray-100 bg-gray-50/80 px-6 py-3">
        <StatCell label="전체" value={alerts.length} color="text-gray-800" />
        <StatCell label="위험" value={criticalCount} color="text-red-600" />
        <StatCell label="경고" value={warningCount} color="text-amber-600" />
      </div>
    </div>
  );
}

export function ActiveAlertsModal({
  open,
  onClose,
  alerts,
  onAskAIAboutAlert,
}: ActiveAlertsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] w-[95vw] max-w-2xl flex flex-col gap-0 p-0">
        <ActiveAlertsPanel
          alerts={alerts}
          onAskAIAboutAlert={onAskAIAboutAlert}
        />
      </DialogContent>
    </Dialog>
  );
}

function AlertRow({
  alert,
  onAskAIAboutAlert,
}: {
  alert: MonitoringAlert;
  onAskAIAboutAlert?: (alert: MonitoringAlert) => void;
}) {
  const canAskAI =
    typeof onAskAIAboutAlert === 'function' &&
    supportsDashboardAlertAIPrefill(alert.metric);
  const rowClassName = cn(
    'flex w-full items-center justify-between rounded-lg border border-gray-200/80 bg-white px-4 py-3 text-left shadow-sm',
    canAskAI
      ? 'cursor-pointer transition-colors hover:bg-gray-50/50'
      : 'cursor-default'
  );
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase',
            severityBadge[alert.severity]
          )}
        >
          {alert.severity === 'critical' ? '위험' : '경고'}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-800">
            {alert.instance}
          </div>
          <div className="truncate text-xs text-gray-500">
            {formatMetricName(alert.metric)} ={' '}
            {formatMetricValue(alert.metric, alert.value)}
          </div>
        </div>
      </div>
      <span className="ml-3 shrink-0 tabular-nums text-xs text-gray-400">
        {formatElapsedDuration(alert.duration)}
      </span>
    </>
  );

  if (!canAskAI) {
    return <div className={rowClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onAskAIAboutAlert(alert)}
      aria-label={`AI에게 ${alert.instance} ${formatMetricName(alert.metric)} 경고 분석 요청`}
      className={rowClassName}
    >
      {content}
    </button>
  );
}
