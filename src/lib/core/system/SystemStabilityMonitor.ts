/**
 * System Stability Monitor
 *
 * ProcessManager에서 분리된 시스템 안정성 모니터링 모듈
 * - 30분 안정성 타이머 관리
 * - 안정성 달성 시 이벤트 발행
 *
 * @created 2026-02-11 (ProcessManager SRP 분리)
 */

import { systemLogger } from '@/lib/logger';
import type { SystemMetrics } from './process-types';

/**
 * SystemStabilityMonitor가 시스템 메트릭을 읽기 위한 인터페이스
 */
export type StabilityContext = {
  getSystemMetrics: () => SystemMetrics;
  emitEvent: (event: string, payload: Record<string, unknown>) => void;
};

export class SystemStabilityMonitor {
  private stabilityTimeout?: NodeJS.Timeout;
  private readonly stabilityTimeoutMs: number;

  constructor(stabilityTimeoutMs = 30 * 60 * 1000) {
    this.stabilityTimeoutMs = stabilityTimeoutMs;
  }

  /**
   * 30분 안정성 모니터링 설정
   */
  setupStabilityMonitoring(ctx: StabilityContext): void {
    this.clearStabilityTimeout();

    this.stabilityTimeout = setTimeout(() => {
      void (async () => {
        const metrics = ctx.getSystemMetrics();
        if (metrics.healthyProcesses === metrics.totalProcesses) {
          systemLogger.system('\ud83c\udfc6 시스템 30분 안정성 달성!');
          ctx.emitEvent('system:stable', { metrics, duration: 30 });
        }
      })();
    }, this.stabilityTimeoutMs);
  }

  /**
   * 안정성 타이머 정리
   */
  clearStabilityTimeout(): void {
    if (this.stabilityTimeout) {
      clearTimeout(this.stabilityTimeout);
      this.stabilityTimeout = undefined;
    }
  }
}
