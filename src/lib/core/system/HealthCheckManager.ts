/**
 * Health Check Manager
 *
 * ProcessManager에서 분리된 헬스체크 전담 모듈
 * - 주기적 헬스체크 실행/중지
 * - 프로세스별 건강도 점수 관리
 * - 이벤트 버스를 통한 헬스체크 결과 알림
 *
 * @created 2026-02-11 (ProcessManager SRP 분리)
 */

import { systemLogger } from '@/lib/logger';
import {
  type ISystemEventBus,
  type ProcessEventPayload,
  SystemEventType,
} from '../interfaces/SystemEventBus';
import type { ProcessConfig, ProcessState } from './process-types';

/**
 * HealthCheckManager가 ProcessManager의 상태를 읽기 위한 인터페이스
 */
export type HealthCheckContext = {
  isRunning: () => boolean;
  getProcessIds: () => string[];
  getProcess: (id: string) => ProcessConfig | undefined;
  getState: (id: string) => ProcessState | undefined;
  getEventBus: () => ISystemEventBus | undefined;
  emitEvent: (event: string, payload: Record<string, unknown>) => void;
};

export class HealthCheckManager {
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly healthCheckIntervalMs: number;

  constructor(healthCheckIntervalMs = 300000) {
    this.healthCheckIntervalMs = healthCheckIntervalMs;
  }

  /**
   * 단일 프로세스 헬스체크 수행
   * 시스템이 실행 중이 아니면 건너뜀
   */
  async performHealthCheck(
    processId: string,
    ctx: HealthCheckContext
  ): Promise<void> {
    if (!ctx.isRunning()) {
      return;
    }

    const config = ctx.getProcess(processId);
    const state = ctx.getState(processId);

    if (!config || !state || state.status !== 'running') {
      return;
    }

    try {
      const isHealthy = await config.healthCheck();
      state.lastHealthCheck = new Date();

      if (isHealthy) {
        state.healthScore = Math.min(100, state.healthScore + 5);
      } else {
        state.healthScore = Math.max(0, state.healthScore - 20);

        if (state.healthScore < 50) {
          systemLogger.warn(
            `\u26a0\ufe0f ${config.name} 건강도 낮음: ${state.healthScore}%`
          );

          const eventBus = ctx.getEventBus();
          if (eventBus) {
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            eventBus.emit<ProcessEventPayload>({
              type: SystemEventType.PROCESS_HEALTH_CHECK,
              timestamp: Date.now(),
              source: 'ProcessManager',
              payload: {
                processId: config.id,
                processName: config.name,
                status: 'running',
                resources: {
                  cpu: cpuUsage.user / 1000000,
                  memory: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
                },
              },
            });
          }

          ctx.emitEvent('process:unhealthy', {
            processId,
            healthScore: state.healthScore,
          });
        }
      }
    } catch (error) {
      state.healthScore = Math.max(0, state.healthScore - 30);
      systemLogger.error(`${config.name} 헬스체크 오류:`, error);
    }
  }

  /**
   * 주기적 헬스체크 시작
   * 시스템이 실행 중일 때만 interval 시작
   */
  startHealthChecks(ctx: HealthCheckContext): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (!ctx.isRunning()) {
      systemLogger.warn(
        '\u26a0\ufe0f 시스템이 실행 중이 아니므로 헬스체크 시작을 건너뜁니다'
      );
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      void (async () => {
        if (!ctx.isRunning()) {
          this.stopHealthChecks();
          return;
        }

        for (const processId of ctx.getProcessIds()) {
          await this.performHealthCheck(processId, ctx);
        }
      })();
    }, this.healthCheckIntervalMs);

    systemLogger.system(
      `\ud83c\udfe5 헬스체크 시작 (간격: ${this.healthCheckIntervalMs / 1000}초)`
    );
  }

  /**
   * 헬스체크 중지
   * 시스템 종료 시 모든 헬스체크 동작을 0으로 만듦
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      systemLogger.system(
        '\ud83d\uded1 헬스체크 중지됨 - 모든 헬스체크 동작 0'
      );
    }
  }

  /**
   * 초기 헬스체크 (프로세스 시작 시 3회 시도)
   */
  async performInitialHealthCheck(config: ProcessConfig): Promise<boolean> {
    for (let i = 0; i < 3; i++) {
      try {
        const isHealthy = await config.healthCheck();
        if (isHealthy) return true;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        systemLogger.warn(`${config.name} 헬스체크 시도 ${i + 1} 실패:`, error);
      }
    }
    return false;
  }
}
