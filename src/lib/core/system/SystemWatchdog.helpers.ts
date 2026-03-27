export interface SystemMetrics {
  cpu: Array<{ timestamp: number; value: number }>;
  memory: Array<{ timestamp: number; value: number }>;
  errorRate: number;
  restartCount: number;
  performanceScore: number;
  stabilityScore: number;
}

export interface WatchdogAlerts {
  memoryLeak: boolean;
  highErrorRate: boolean;
  performanceDegradation: boolean;
  frequentRestarts: boolean;
}

export interface ProcessStatus {
  status: string;
  healthScore: number;
}

export interface SystemStatus {
  processes?: ProcessStatus[];
  metrics?: {
    uptime: number;
    totalProcesses: number;
    activeConnections: number;
    totalRestarts?: number;
  };
  [key: string]: unknown;
}

export function createInitialSystemMetrics(): SystemMetrics {
  return {
    cpu: [],
    memory: [],
    errorRate: 0,
    restartCount: 0,
    performanceScore: 100,
    stabilityScore: 100,
  };
}

export function calculateErrorRate(systemStatus: SystemStatus): number {
  if (
    !systemStatus.processes ||
    !Array.isArray(systemStatus.processes) ||
    systemStatus.processes.length === 0
  ) {
    return 0;
  }

  const totalProcesses = systemStatus.processes.length;
  const errorProcesses = systemStatus.processes.filter(
    (p: ProcessStatus) => p.status === 'error' || p.healthScore < 50
  ).length;

  return (errorProcesses / totalProcesses) * 100;
}

export function calculatePerformanceScore(metrics: SystemMetrics): number {
  let score = 100;

  if (metrics.memory.length > 0) {
    const avgMemory =
      metrics.memory.reduce((sum, m) => sum + m.value, 0) /
      metrics.memory.length;
    if (avgMemory > 500) score -= 20;
    if (avgMemory > 1000) score -= 30;
  }

  if (metrics.cpu.length > 0) {
    const avgCPU =
      metrics.cpu.reduce((sum, c) => sum + c.value, 0) / metrics.cpu.length;
    if (avgCPU > 70) score -= 15;
    if (avgCPU > 90) score -= 25;
  }

  if (metrics.errorRate > 10) score -= 20;
  if (metrics.errorRate > 25) score -= 30;

  return Math.max(0, score);
}

export function detectMemoryLeak(
  memory: Array<{ timestamp: number; value: number }>
): boolean {
  if (memory.length < 10) {
    return false;
  }

  const recentMemory = memory.slice(-10);
  let increasingCount = 0;
  for (let i = 1; i < recentMemory.length; i++) {
    const currentValue = recentMemory[i]?.value;
    const previousValue = recentMemory[i - 1]?.value;
    if (
      currentValue !== undefined &&
      previousValue !== undefined &&
      currentValue > previousValue
    ) {
      increasingCount++;
    }
  }

  return increasingCount > recentMemory.length * 0.8;
}

export function calculateStabilityScore(
  metrics: SystemMetrics,
  recentAlertsCount: number
): number {
  let score = 100;

  if (metrics.restartCount > 3) score -= 20;
  if (metrics.restartCount > 10) score -= 40;

  if (detectMemoryLeak(metrics.memory)) {
    score -= 30;
  }

  if (recentAlertsCount > 5) score -= 25;

  return Math.max(0, score);
}

export function getWatchdogRecommendation(alerts: WatchdogAlerts): string {
  if (alerts.memoryLeak) {
    return '메모리 누수가 의심됩니다. 메모리 사용량을 모니터링하고 필요시 재시작을 고려하세요.';
  }
  if (alerts.highErrorRate) {
    return '오류율이 높습니다. 로그를 확인하고 문제를 해결하세요.';
  }
  if (alerts.performanceDegradation) {
    return '성능이 저하되었습니다. 리소스 사용량을 확인하고 최적화를 고려하세요.';
  }
  if (alerts.frequentRestarts) {
    return '프로세스가 자주 재시작됩니다. 안정성 문제를 조사하세요.';
  }
  return '시스템이 정상적으로 작동 중입니다.';
}
