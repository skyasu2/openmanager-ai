import {
  type SystemEvent,
  SystemEventType,
  type WatchdogEventPayload,
} from '../interfaces/SystemEventBus';
import type { SystemMetrics, WatchdogAlerts } from './SystemWatchdog.helpers';
import { detectMemoryLeak } from './SystemWatchdog.helpers';

export interface WatchdogAlertDispatchPlan {
  alertType: string;
  message: string;
  eventPayload: SystemEvent<WatchdogEventPayload>;
}

export function getCurrentWatchdogAlerts(
  metrics: SystemMetrics
): WatchdogAlerts {
  return {
    memoryLeak: detectMemoryLeak(metrics.memory),
    highErrorRate: metrics.errorRate > 25,
    performanceDegradation: metrics.performanceScore < 60,
    frequentRestarts: metrics.restartCount > 5,
  };
}

export function buildWatchdogAlertPlans(
  metrics: SystemMetrics,
  latestMemory: number,
  alerts = getCurrentWatchdogAlerts(metrics)
): WatchdogAlertDispatchPlan[] {
  const plans: WatchdogAlertDispatchPlan[] = [];

  if (alerts.memoryLeak) {
    plans.push({
      alertType: 'memory-leak',
      message: '메모리 누수 패턴 감지됨',
      eventPayload: {
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'memory-leak',
          severity: 'critical',
          message: '메모리 누수 패턴 감지됨',
          metrics: { memoryUsage: latestMemory },
        },
      },
    });
  }

  if (alerts.highErrorRate) {
    const message = `높은 오류율 감지 (${metrics.errorRate.toFixed(1)}%)`;
    plans.push({
      alertType: 'high-error-rate',
      message,
      eventPayload: {
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'high-error-rate',
          severity: 'warning',
          message,
          metrics: { errorRate: metrics.errorRate },
        },
      },
    });
  }

  if (alerts.performanceDegradation) {
    plans.push({
      alertType: 'performance-degradation',
      message: '시스템 성능 저하 감지',
      eventPayload: {
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'performance-degradation',
          severity: 'warning',
          message: '시스템 성능 저하 감지',
          metrics: { performanceScore: metrics.performanceScore },
        },
      },
    });
  }

  if (metrics.stabilityScore < 70) {
    const message = `시스템 안정성 문제 감지 (${metrics.stabilityScore.toFixed(1)}%)`;
    plans.push({
      alertType: 'stability',
      message,
      eventPayload: {
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'stability',
          severity: 'warning',
          message,
          metrics: { stabilityScore: metrics.stabilityScore },
        },
      },
    });
  }

  if (alerts.frequentRestarts) {
    const message = `빈번한 프로세스 재시작 감지 (${metrics.restartCount}회)`;
    plans.push({
      alertType: 'frequent-restarts',
      message,
      eventPayload: {
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'frequent-restarts',
          severity: 'warning',
          message,
          metrics: { restartCount: metrics.restartCount },
        },
      },
    });
  }

  return plans;
}
