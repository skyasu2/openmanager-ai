/**
 * Process Manager Types
 *
 * ProcessManager에서 사용하는 타입 정의
 *
 * @created 2026-02-10 (ProcessManager.ts SRP 분리)
 */

export interface ProcessConfig {
  id: string;
  name: string;
  startCommand: () => Promise<void>;
  stopCommand: () => Promise<void>;
  healthCheck: () => Promise<boolean>;
  criticalLevel: 'high' | 'medium' | 'low';
  autoRestart: boolean;
  maxRestarts: number;
  dependencies?: string[]; // 의존하는 프로세스들
  startupDelay?: number; // 시작 후 대기 시간 (ms)
}

export interface ProcessState {
  id: string;
  status:
    | 'stopped'
    | 'starting'
    | 'running'
    | 'stopping'
    | 'error'
    | 'restarting';
  startedAt?: Date;
  stoppedAt?: Date;
  lastHealthCheck?: Date;
  restartCount: number;
  errors: Array<{ timestamp: Date; message: string; error: Error | unknown }>;
  uptime: number;
  healthScore: number; // 0-100
}

export interface SystemMetrics {
  totalProcesses: number;
  runningProcesses: number;
  healthyProcesses: number;
  systemUptime: number;
  memoryUsage: number;
  averageHealthScore: number;
  totalRestarts: number;
  lastStabilityCheck: Date;
}
