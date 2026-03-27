/**
 * 통합 프로세스 관리 시스템 (리팩토링 버전)
 *
 * 순환 의존성 제거를 위해 이벤트 버스 패턴 적용
 * SystemWatchdog와의 직접 의존성을 제거하고 이벤트 기반 통신 사용
 *
 * SRP 분리:
 * - 타입 정의 -> process-types.ts
 * - 헬스체크 -> HealthCheckManager.ts
 * - 안정성 모니터링 -> SystemStabilityMonitor.ts
 *
 * @updated 2026-02-11 - SRP 분리 (HealthCheck, StabilityMonitor)
 */

import { EventEmitter } from 'events';
import { systemLogger } from '@/lib/logger';
import {
  type ISystemEventBus,
  type ISystemEventEmitter,
  SystemEventType,
  type SystemStatusPayload,
} from '../interfaces/SystemEventBus';
import { HealthCheckManager } from './HealthCheckManager';
import {
  buildServiceStatuses,
  buildSystemMetrics,
  calculateProcessStartupOrder,
  calculateSystemUptime,
} from './ProcessManager.helpers';
import {
  type RuntimeContext,
  restartManagedProcess,
  startManagedProcess,
  stopManagedProcess,
} from './ProcessManager.runtime';
import type {
  ProcessConfig,
  ProcessState,
  SystemMetrics,
} from './process-types';
import { SystemStabilityMonitor } from './SystemStabilityMonitor';

// Re-export split modules for barrel access
export {
  type HealthCheckContext,
  HealthCheckManager,
} from './HealthCheckManager';
// Re-export types for backward compatibility
export type {
  ProcessConfig,
  ProcessState,
  SystemMetrics,
} from './process-types';
export {
  type StabilityContext,
  SystemStabilityMonitor,
} from './SystemStabilityMonitor';

/**
 * 리팩토링된 ProcessManager
 * 이벤트 버스를 통해 SystemWatchdog와 통신
 */
export class ProcessManager
  extends EventEmitter
  implements ISystemEventEmitter
{
  private processes = new Map<string, ProcessConfig>();
  private states = new Map<string, ProcessState>();
  private eventBus?: ISystemEventBus;
  private isSystemRunning = false;
  private systemStartTime?: Date;

  // 위임 모듈
  private readonly healthCheckManager: HealthCheckManager;
  private readonly stabilityMonitor: SystemStabilityMonitor;

  // 헬스체크 간격 최적화: 웜업 3단계 이후에만 동작, 5분 간격
  private readonly healthCheckIntervalMs = 300000; // 5분
  private readonly stabilityTimeoutMs = 30 * 60 * 1000; // 30분

  constructor(eventBus?: ISystemEventBus) {
    super();
    this.healthCheckManager = new HealthCheckManager(
      this.healthCheckIntervalMs
    );
    this.stabilityMonitor = new SystemStabilityMonitor(this.stabilityTimeoutMs);

    if (eventBus) {
      this.setEventBus(eventBus);
    }
    this.setupGracefulShutdown();
  }

  /**
   * 이벤트 버스 설정
   */
  setEventBus(eventBus: ISystemEventBus): void {
    this.eventBus = eventBus;
    this.eventBus.emit({
      type: SystemEventType.SYSTEM_HEALTHY,
      timestamp: Date.now(),
      source: 'ProcessManager',
      payload: {
        status: 'healthy',
        services: [],
        metrics: {
          uptime: 0,
          totalProcesses: this.processes.size,
          activeConnections: 0,
        },
      },
    });
  }

  /**
   * 이벤트 버스 반환
   */
  getEventBus(): ISystemEventBus {
    if (!this.eventBus) {
      throw new Error('Event bus not set');
    }
    return this.eventBus;
  }

  /**
   * 프로세스 등록
   */
  registerProcess(config: ProcessConfig): void {
    this.processes.set(config.id, config);
    this.states.set(config.id, {
      id: config.id,
      status: 'stopped',
      restartCount: 0,
      errors: [],
      uptime: 0,
      healthScore: 100,
    });

    systemLogger.system(`\u2705 프로세스 등록: ${config.name} (${config.id})`);
    this.emit('process:registered', { processId: config.id, config });
  }

  /**
   * 시스템 전체 시작 - 30분 모니터링 포함
   */
  async startSystem(options?: {
    mode?: 'fast' | 'full';
    skipStabilityCheck?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.isSystemRunning) {
      return {
        success: false,
        message: '시스템이 이미 실행 중입니다',
        errors: ['ALREADY_RUNNING'],
        warnings: [],
      };
    }

    try {
      systemLogger.system('\ud83d\ude80 통합 프로세스 관리 시스템 시작...');
      this.isSystemRunning = true;
      this.systemStartTime = new Date();

      // 1단계: 의존성 순서로 프로세스 시작
      const startOrder = calculateProcessStartupOrder(this.processes);
      systemLogger.system(
        `\ud83d\udccb 시작 순서: ${startOrder.join(' \u2192 ')}`
      );

      for (const processId of startOrder) {
        const success = await this.startProcess(processId);
        if (!success) {
          const config = this.processes.get(processId);
          const errorMsg = `${config?.name || processId} 시작 실패`;
          errors.push(errorMsg);
          systemLogger.error(errorMsg);

          // Critical 프로세스 실패 시 전체 시스템 롤백
          if (config?.criticalLevel === 'high') {
            await this.emergencyShutdown();
            return {
              success: false,
              message: `Critical 프로세스 ${config.name} 실패로 시스템 시작 중단`,
              errors,
              warnings,
            };
          } else {
            warnings.push(`Non-critical 프로세스 ${config?.name} 시작 실패`);
          }
        }

        // 프로세스 간 안정화 대기
        const config = this.processes.get(processId);
        const delay = config?.startupDelay || 1000;
        await this.delay(delay);
      }

      // 2단계: 헬스체크 시스템 시작
      this.healthCheckManager.startHealthChecks(
        this.createHealthCheckContext()
      );

      // 3단계: 이벤트 버스를 통해 Watchdog 시작 요청
      if (this.eventBus) {
        this.eventBus.emit({
          type: SystemEventType.SYSTEM_HEALTHY,
          timestamp: Date.now(),
          source: 'ProcessManager',
          payload: {
            status: 'healthy',
            services: buildServiceStatuses(this.processes, this.states),
            metrics: {
              uptime: 0,
              totalProcesses: this.processes.size,
              activeConnections: 0,
            },
          },
        });
      }

      // 4단계: 30분 안정성 모니터링 설정
      if (!options?.skipStabilityCheck) {
        this.stabilityMonitor.setupStabilityMonitoring(
          this.createStabilityContext()
        );
      }

      const runningCount = Array.from(this.states.values()).filter(
        (s: ProcessState) => s.status === 'running'
      ).length;

      systemLogger.system(
        `\u2705 시스템 시작 완료 (${runningCount}/${this.processes.size} 프로세스 실행 중)`
      );
      this.emit('system:started', {
        runningCount,
        totalCount: this.processes.size,
      });

      return {
        success: true,
        message: `시스템 시작 완료 (${runningCount}/${this.processes.size} 프로세스)`,
        errors,
        warnings,
      };
    } catch (error) {
      systemLogger.error('시스템 시작 실패:', error);
      await this.emergencyShutdown();

      return {
        success: false,
        message: '시스템 시작 중 치명적 오류 발생',
        errors: [error instanceof Error ? error.message : '알 수 없는 오류'],
        warnings,
      };
    }
  }

  /**
   * 개별 프로세스 시작
   */
  private async startProcess(processId: string): Promise<boolean> {
    return startManagedProcess(this.createRuntimeContext(), processId);
  }

  /**
   * 시스템 정지
   */
  async stopSystem(): Promise<{
    success: boolean;
    message: string;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!this.isSystemRunning) {
      return {
        success: false,
        message: '시스템이 실행 중이 아닙니다',
        errors: ['NOT_RUNNING'],
      };
    }

    try {
      systemLogger.system('\ud83d\uded1 시스템 정지 시작...');

      // 1단계: 안정성 모니터링 중지
      this.stabilityMonitor.clearStabilityTimeout();

      // 2단계: 헬스체크 중지
      this.healthCheckManager.stopHealthChecks();

      // 3단계: 이벤트 버스를 통해 시스템 정지 알림
      if (this.eventBus) {
        this.eventBus.emit<SystemStatusPayload>({
          type: SystemEventType.SYSTEM_DEGRADED,
          timestamp: Date.now(),
          source: 'ProcessManager',
          payload: {
            status: 'degraded',
            services: buildServiceStatuses(this.processes, this.states),
            metrics: {
              uptime: calculateSystemUptime(this.systemStartTime),
              totalProcesses: this.processes.size,
              activeConnections: 0,
            },
          },
        });
      }

      // 4단계: 역순으로 프로세스 정지
      const stopOrder = calculateProcessStartupOrder(this.processes).reverse();
      for (const processId of stopOrder) {
        const success = await this.stopProcess(processId);
        if (!success) {
          const config = this.processes.get(processId);
          errors.push(`${config?.name || processId} 정지 실패`);
        }
      }

      this.isSystemRunning = false;
      const stoppedCount = Array.from(this.states.values()).filter(
        (s: ProcessState) => s.status === 'stopped'
      ).length;

      systemLogger.system(
        `\u2705 시스템 정지 완료 (${stoppedCount}/${this.processes.size} 프로세스 정지)`
      );

      this.emit('system:stopped', {
        stoppedCount,
        totalCount: this.processes.size,
      });

      return {
        success: true,
        message: `시스템 정지 완료 (${stoppedCount}/${this.processes.size} 프로세스)`,
        errors,
      };
    } catch (error) {
      systemLogger.error('시스템 정지 실패:', error);
      return {
        success: false,
        message: '시스템 정지 중 오류 발생',
        errors: [error instanceof Error ? error.message : '알 수 없는 오류'],
      };
    }
  }

  /**
   * 프로세스 재시작
   */
  private async restartProcess(processId: string): Promise<boolean> {
    return restartManagedProcess(this.createRuntimeContext(), processId);
  }

  private async stopProcess(processId: string): Promise<boolean> {
    return stopManagedProcess(this.createRuntimeContext(), processId);
  }

  private async emergencyShutdown(): Promise<void> {
    systemLogger.error('\ud83d\udea8 긴급 시스템 종료 시작...');
    this.isSystemRunning = false;

    this.healthCheckManager.stopHealthChecks();

    const stopPromises = Array.from(this.processes.keys()).map((id) =>
      this.stopProcess(id).catch((error) =>
        systemLogger.error(`프로세스 ${id} 종료 실패:`, error)
      )
    );

    await Promise.allSettled(stopPromises);
    this.emit('system:emergency-shutdown');
  }

  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      systemLogger.system(
        `\ud83d\udce5 ${signal} 신호 수신, Graceful shutdown 시작...`
      );
      await this.stopSystem();
      process.exit(0);
    };

    process.on('SIGTERM', () => {
      void shutdownHandler('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdownHandler('SIGINT');
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getSystemStatus(): {
    running: boolean;
    processes: Map<string, ProcessState>;
    metrics: SystemMetrics;
  } {
    return {
      running: this.isSystemRunning,
      processes: new Map(this.states),
      metrics: this.getSystemMetrics(),
    };
  }

  getSystemMetrics(): SystemMetrics {
    return buildSystemMetrics({
      processes: this.processes,
      states: this.states,
      systemStartTime: this.systemStartTime,
    });
  }

  private createRuntimeContext(): RuntimeContext {
    return {
      processes: this.processes,
      states: this.states,
      healthCheckManager: this.healthCheckManager,
      eventBus: this.eventBus,
      emitLocal: (event, payload) => this.emit(event, payload),
      restartProcess: (id) => this.restartProcess(id),
      startProcess: (id) => this.startProcess(id),
      stopProcess: (id) => this.stopProcess(id),
      delay: (ms) => this.delay(ms),
    };
  }

  /**
   * HealthCheckManager용 컨텍스트 생성
   */
  private createHealthCheckContext() {
    return {
      isRunning: () => this.isSystemRunning,
      getProcessIds: () => Array.from(this.processes.keys()),
      getProcess: (id: string) => this.processes.get(id),
      getState: (id: string) => this.states.get(id),
      getEventBus: () => this.eventBus,
      emitEvent: (event: string, payload: Record<string, unknown>) =>
        this.emit(event, payload),
    };
  }

  /**
   * SystemStabilityMonitor용 컨텍스트 생성
   */
  private createStabilityContext() {
    return {
      getSystemMetrics: () => this.getSystemMetrics(),
      emitEvent: (event: string, payload: Record<string, unknown>) =>
        this.emit(event, payload),
    };
  }
}
