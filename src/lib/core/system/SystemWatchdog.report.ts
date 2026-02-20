import { getWatchdogRecommendation } from './SystemWatchdog.helpers';
import type { SystemMetrics, WatchdogAlerts } from './SystemWatchdog.helpers';
import type {
  WatchdogAlertEntry,
  WatchdogReport,
} from './SystemWatchdog.types';

export function createWatchdogReport(
  metrics: SystemMetrics,
  alerts: WatchdogAlerts,
  recentAlerts: WatchdogAlertEntry[]
): WatchdogReport {
  return {
    metrics,
    alerts,
    recentAlerts,
    recommendation: getWatchdogRecommendation(alerts),
  };
}
