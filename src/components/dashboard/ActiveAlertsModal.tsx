'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { MonitoringAlert } from '@/schemas/api.monitoring-report.schema';
import { formatMetricName, formatMetricValue } from '@/utils/metric-formatters';

const severityBadge: Record<MonitoringAlert['severity'], string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
};

interface ActiveAlertsModalProps {
  open: boolean;
  onClose: () => void;
  alerts: MonitoringAlert[];
}

export function ActiveAlertsModal({
  open,
  onClose,
  alerts,
}: ActiveAlertsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC 키로 닫기 + 포커스 트래핑
  useEffect(() => {
    if (!open) return;

    // 모달 열릴 때 포커스 이동
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog?.querySelector<HTMLElement>('button')?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Tab 포커스 트래핑
      if (e.key === 'Tab' && dialog) {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0] as HTMLElement | undefined;
        const last = focusable[focusable.length - 1] as HTMLElement | undefined;
        if (!first || !last) return;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sorted = [...alerts].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return b.value - a.value;
  });

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="활성 알림 상세"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      onKeyDown={(e) => {
        if (
          e.target === overlayRef.current &&
          (e.key === 'Enter' || e.key === ' ')
        ) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="relative mx-4 w-full max-w-2xl rounded-2xl border border-gray-200/60 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100">
              <AlertTriangle size={18} className="text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Active Alerts</h2>
              <p className="text-xs text-gray-500">
                {criticalCount > 0 && (
                  <span className="mr-2 font-semibold text-rose-600">
                    위험 {criticalCount}건
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="font-semibold text-amber-600">
                    경고 {warningCount}건
                  </span>
                )}
                {alerts.length === 0 && '활성 알림 없음'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <AlertTriangle size={32} className="mb-3 text-gray-300" />
              <p className="text-sm">현재 활성 알림이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-2xs font-bold uppercase ${severityBadge[alert.severity]}`}
                    >
                      {alert.severity}
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
                  <span className="shrink-0 text-xs text-gray-400 ml-3">
                    {alert.duration > 0
                      ? `${Math.round(alert.duration / 60)}분 경과`
                      : 'just now'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-3">
          <p className="text-center text-xs text-gray-400">
            총 {alerts.length}개 활성 알림 · 임계값 기준: system-rules.json
          </p>
        </div>
      </div>
    </div>
  );
}
