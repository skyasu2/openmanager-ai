import type { SystemMetrics, SystemStatus } from './SystemWatchdog.helpers';
import { calculateErrorRate } from './SystemWatchdog.helpers';
import type { WatchdogCpuTracker } from './SystemWatchdog.types';

const HISTORY_WINDOW_MS = 5 * 60 * 1000;

export function estimateCPUUsageDelta(cpuTracker: WatchdogCpuTracker): number {
  const currentTime = process.hrtime.bigint();
  const currentUsage = process.cpuUsage();

  if (cpuTracker.previousCpuUsage && cpuTracker.previousCpuTime) {
    const elapsedNs = Number(currentTime - cpuTracker.previousCpuTime);
    const elapsedMs = elapsedNs / 1_000_000;
    const userDelta =
      (currentUsage.user - cpuTracker.previousCpuUsage.user) / 1000;
    const systemDelta =
      (currentUsage.system - cpuTracker.previousCpuUsage.system) / 1000;
    const totalCPUTime = userDelta + systemDelta;
    const cpuPercent = elapsedMs > 0 ? (totalCPUTime / elapsedMs) * 100 : 0;

    cpuTracker.previousCpuUsage = currentUsage;
    cpuTracker.previousCpuTime = currentTime;

    return Math.max(0, Math.min(100, cpuPercent));
  }

  cpuTracker.previousCpuUsage = currentUsage;
  cpuTracker.previousCpuTime = currentTime;
  return 0;
}

export function collectRuntimeMetrics(
  metrics: SystemMetrics,
  cpuTracker: WatchdogCpuTracker,
  timestamp: number
): { memoryMB: number; cpuEstimate: number } {
  const memoryUsage = process.memoryUsage();
  const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

  metrics.memory.push({
    timestamp,
    value: memoryMB,
  });

  const cpuEstimate = estimateCPUUsageDelta(cpuTracker);
  metrics.cpu.push({
    timestamp,
    value: cpuEstimate,
  });

  trimMetricsHistory(metrics, timestamp - HISTORY_WINDOW_MS);

  return { memoryMB, cpuEstimate };
}

export function trimMetricsHistory(
  metrics: SystemMetrics,
  cutoffTime: number
): void {
  metrics.memory = metrics.memory.filter((item) => item.timestamp > cutoffTime);
  metrics.cpu = metrics.cpu.filter((item) => item.timestamp > cutoffTime);
}

export function syncMetricsFromSystemStatus(
  metrics: SystemMetrics,
  systemStatus?: SystemStatus
): void {
  if (!systemStatus) return;

  // SystemStatusPayload.metrics에 totalRestarts 필드 없음 → 별도 추적 필요 시 추가
  const metricsWithRestarts = systemStatus.metrics as
    | (typeof systemStatus.metrics & { totalRestarts?: number })
    | undefined;
  metrics.restartCount = metricsWithRestarts?.totalRestarts ?? 0;
  metrics.errorRate = calculateErrorRate(systemStatus);
}
