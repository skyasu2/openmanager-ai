'use client';

import { useMemo } from 'react';
import type {
  Alert,
  AlertSeverity,
  AlertState,
} from '@/services/monitoring/AlertManager';
import { useMonitoringReport } from './useMonitoringReport';

export type AlertHistoryFilter = {
  severity?: AlertSeverity;
  state?: AlertState;
  serverId?: string;
  timeRangeMs?: number;
  keyword?: string;
};

export type AlertHistoryResult = {
  alerts: Alert[];
  stats: {
    total: number;
    critical: number;
    warning: number;
    firing: number;
    resolved: number;
    avgResolutionSec: number;
  };
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
};

export function useAlertHistory(
  filter: AlertHistoryFilter = {}
): AlertHistoryResult {
  const { data, isLoading, isError, error } = useMonitoringReport();

  const alerts = useMemo(() => {
    if (!data) return [];

    const firing: Alert[] = data.firingAlerts;
    const resolved: Alert[] = data.resolvedAlerts;

    let combined = [
      ...firing.map((a) => ({ ...a, state: 'firing' as const })),
      ...resolved.map((a) => ({ ...a, state: 'resolved' as const })),
    ];

    // Cache Date.getTime() to avoid repeated parsing in filter/sort
    const timeCache = new Map<string, number>();
    const getTime = (iso: string) => {
      let t = timeCache.get(iso);
      if (t === undefined) {
        t = new Date(iso).getTime();
        timeCache.set(iso, t);
      }
      return t;
    };

    // severity filter
    if (filter.severity) {
      combined = combined.filter((a) => a.severity === filter.severity);
    }

    // state filter
    if (filter.state) {
      combined = combined.filter((a) => a.state === filter.state);
    }

    // serverId filter
    if (filter.serverId) {
      combined = combined.filter((a) => a.serverId === filter.serverId);
    }

    // time range filter
    if (filter.timeRangeMs) {
      const cutoff = Date.now() - filter.timeRangeMs;
      combined = combined.filter((a) => getTime(a.firedAt) >= cutoff);
    }

    // keyword filter
    if (filter.keyword) {
      const lower = filter.keyword.toLowerCase();
      combined = combined.filter(
        (a) =>
          a.serverId.toLowerCase().includes(lower) ||
          a.metric.toLowerCase().includes(lower)
      );
    }

    // sort newest first
    combined.sort((a, b) => getTime(b.firedAt) - getTime(a.firedAt));

    return combined;
  }, [
    data,
    filter.severity,
    filter.state,
    filter.serverId,
    filter.timeRangeMs,
    filter.keyword,
  ]);

  const stats = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === 'critical').length;
    const warning = alerts.filter((a) => a.severity === 'warning').length;
    const firing = alerts.filter((a) => a.state === 'firing').length;
    const resolved = alerts.filter((a) => a.state === 'resolved').length;

    const resolvedAlerts = alerts.filter(
      (a) => a.state === 'resolved' && a.resolvedAt
    );
    const avgResolutionSec =
      resolvedAlerts.length > 0
        ? Math.round(
            resolvedAlerts.reduce((sum, a) => sum + a.duration, 0) /
              resolvedAlerts.length
          )
        : 0;

    return {
      total: alerts.length,
      critical,
      warning,
      firing,
      resolved,
      avgResolutionSec,
    };
  }, [alerts]);

  const errorMessage =
    isError && error instanceof Error
      ? error.message
      : isError
        ? '모니터링 알림 이력을 불러오지 못했습니다.'
        : null;

  return { alerts, stats, isLoading, isError, errorMessage };
}
