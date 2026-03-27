import type { SystemMetrics, WatchdogAlerts } from './SystemWatchdog.helpers';

export interface WatchdogAlertEntry {
  timestamp: Date;
  type: string;
  message: string;
}

export interface WatchdogCpuTracker {
  previousCpuUsage: { user: number; system: number } | null;
  previousCpuTime: bigint | null;
}

export interface WatchdogReport {
  metrics: SystemMetrics;
  alerts: WatchdogAlerts;
  recentAlerts: WatchdogAlertEntry[];
  recommendation: string;
}
