/**
 * AlertManager - 메트릭 기반 알림 생성/관리
 *
 * 원본 메트릭 → threshold 비교 → 알림 생성/해소 추적
 * - Alert 상태: firing → resolved, 지속 시간 추적
 * - 임계값: system-rules.json SSOT
 * - 메모리 내 최근 200개 히스토리
 *
 * @created 2026-02-04
 */

import { getAllThresholds } from '@/config/rules/loader';
import type { ServerMetrics } from '@/services/metrics/MetricsProvider';

export type AlertSeverity = 'warning' | 'critical';
export type AlertState = 'firing' | 'resolved';

export type Alert = {
  id: string;
  serverId: string;
  instance: string;
  labels: Record<string, string>;
  metric: string;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  state: AlertState;
  firedAt: string;
  resolvedAt?: string;
  duration: number;
};

function loadThresholds(): Record<
  string,
  { warning: number; critical: number }
> {
  const t = getAllThresholds();
  return {
    cpu: { warning: t.cpu.warning, critical: t.cpu.critical },
    memory: { warning: t.memory.warning, critical: t.memory.critical },
    disk: { warning: t.disk.warning, critical: t.disk.critical },
    network: { warning: t.network.warning, critical: t.network.critical },
  };
}

const MAX_HISTORY = 200;

export class AlertManager {
  private activeAlerts: Map<string, Alert> = new Map();
  private history: Alert[] = [];

  evaluate(allMetrics: ServerMetrics[], timestamp: string): Alert[] {
    const thresholds = loadThresholds();
    const currentAlertIds = new Set<string>();

    for (const server of allMetrics) {
      const metricPairs: Array<{ key: string; value: number }> = [
        { key: 'cpu', value: server.cpu },
        { key: 'memory', value: server.memory },
        { key: 'disk', value: server.disk },
        { key: 'network', value: server.network },
      ];

      for (const { key, value } of metricPairs) {
        const threshold = thresholds[key];
        if (!threshold) continue;

        let severity: AlertSeverity | null = null;
        let thresholdValue = 0;

        if (value >= threshold.critical) {
          severity = 'critical';
          thresholdValue = threshold.critical;
        } else if (value >= threshold.warning) {
          severity = 'warning';
          thresholdValue = threshold.warning;
        }

        if (severity) {
          const alertId = `${server.serverId}-${key}`;
          currentAlertIds.add(alertId);

          const existing = this.activeAlerts.get(alertId);
          if (existing) {
            existing.value = value;
            existing.severity = severity;
            existing.threshold = thresholdValue;
            existing.duration = Math.round(
              (Date.now() - new Date(existing.firedAt).getTime()) / 1000
            );
          } else {
            const alert: Alert = {
              id: alertId,
              serverId: server.serverId,
              instance: `${server.serverId}:9100`,
              labels: {
                server_type: server.serverType,
                location: server.location,
              },
              metric: key,
              value,
              threshold: thresholdValue,
              severity,
              state: 'firing',
              firedAt: timestamp,
              duration: 0,
            };
            this.activeAlerts.set(alertId, alert);
          }
        }
      }
    }

    // resolve alerts no longer firing
    for (const [id, alert] of this.activeAlerts) {
      if (!currentAlertIds.has(id) && alert.state === 'firing') {
        alert.state = 'resolved';
        alert.resolvedAt = timestamp;
        alert.duration = Math.round(
          (Date.now() - new Date(alert.firedAt).getTime()) / 1000
        );

        this.history.push({ ...alert });
        if (this.history.length > MAX_HISTORY) {
          this.history.shift();
        }

        this.activeAlerts.delete(id);
      }
    }

    return this.getFiringAlerts();
  }

  getFiringAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(
      (a) => a.state === 'firing'
    );
  }

  getCriticalAlerts(): Alert[] {
    return this.getFiringAlerts().filter((a) => a.severity === 'critical');
  }

  getWarningAlerts(): Alert[] {
    return this.getFiringAlerts().filter((a) => a.severity === 'warning');
  }

  getRecentHistory(): Alert[] {
    return [...this.history];
  }

  getAllAlerts(): { firing: Alert[]; resolved: Alert[] } {
    return {
      firing: this.getFiringAlerts(),
      resolved: [...this.history],
    };
  }
}
