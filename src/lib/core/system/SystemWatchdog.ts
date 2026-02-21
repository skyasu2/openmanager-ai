/**
 * 🐕 시스템 Watchdog (리팩토링 버전)
 *
 * 순환 의존성 제거를 위해 이벤트 버스 패턴 적용
 * ProcessManager와의 직접 의존성을 제거하고 이벤트 기반 통신 사용
 */

import { systemLogger } from '@/lib/logger';
import {
  type ISystemEventBus,
  SystemEventType,
  type SystemStatusPayload,
  type WatchdogEventPayload,
} from '../interfaces/SystemEventBus';
import {
  buildWatchdogAlertPlans,
  getCurrentWatchdogAlerts,
} from './SystemWatchdog.alerts';
import {
  calculatePerformanceScore,
  calculateStabilityScore,
  createInitialSystemMetrics,
  type SystemMetrics,
  type SystemStatus,
  type WatchdogAlerts,
} from './SystemWatchdog.helpers';
import {
  collectRuntimeMetrics,
  syncMetricsFromSystemStatus,
} from './SystemWatchdog.metrics';
import { createWatchdogReport } from './SystemWatchdog.report';
import type {
  WatchdogAlertEntry,
  WatchdogCpuTracker,
  WatchdogReport,
} from './SystemWatchdog.types';

export type { SystemMetrics, WatchdogAlerts } from './SystemWatchdog.helpers';

/**
 * 리팩토링된 SystemWatchdog
 * 이벤트 버스를 통해 ProcessManager와 통신
 */
export class SystemWatchdog {
  private eventBus?: ISystemEventBus;
  private metrics: SystemMetrics = createInitialSystemMetrics();
  private monitoringInterval?: NodeJS.Timeout;
  private alertsHistory: WatchdogAlertEntry[] = [];
  private systemStatus?: SystemStatus;
  private readonly maxHistoryLength = 100;
  private readonly monitoringIntervalMs = 30000; // 30초 (과도한 헬스체크 방지)
  private cpuTracker: WatchdogCpuTracker = {
    previousCpuUsage: null,
    previousCpuTime: null,
  };

  constructor(eventBus?: ISystemEventBus) {
    if (eventBus) {
      this.setEventBus(eventBus);
    }
  }

  /**
   * 이벤트 버스 설정 및 이벤트 리스너 등록
   */
  setEventBus(eventBus: ISystemEventBus): void {
    this.eventBus = eventBus;

    // ProcessManager로부터 시스템 상태 업데이트 수신
    this.eventBus.on<SystemStatusPayload>(
      SystemEventType.SYSTEM_HEALTHY,
      (event) => {
        this.handleSystemStatusUpdate(event.payload);
      }
    );

    this.eventBus.on<SystemStatusPayload>(
      SystemEventType.SYSTEM_DEGRADED,
      (event) => {
        this.handleSystemStatusUpdate(event.payload);
      }
    );

    this.eventBus.on<SystemStatusPayload>(
      SystemEventType.SYSTEM_ERROR,
      (event) => {
        this.handleSystemStatusUpdate(event.payload);
      }
    );
  }

  /**
   * 시스템 상태 업데이트 처리
   */
  private handleSystemStatusUpdate(payload: SystemStatusPayload): void {
    // ProcessManager로부터 받은 시스템 상태 업데이트
    this.systemStatus = {
      processes: payload.services?.map((service) => ({
        status:
          service.status === 'up'
            ? 'running'
            : service.status === 'degraded'
              ? 'degraded'
              : 'error',
        healthScore:
          service.status === 'up'
            ? 100
            : service.status === 'degraded'
              ? 50
              : 0,
      })),
      metrics: payload.metrics,
    };
  }

  /**
   * Watchdog 시작
   */
  start(): void {
    if (this.monitoringInterval) {
      this.stop();
    }

    systemLogger.system('🐕 시스템 Watchdog 활성화');

    this.monitoringInterval = setInterval(() => {
      void this.runMonitoringCycle();
    }, this.monitoringIntervalMs);

    // 초기 메트릭스 수집
    void this.collectMetrics();
  }

  /**
   * Watchdog 중지
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      systemLogger.system('🐕 시스템 Watchdog 비활성화');
    }
  }

  /**
   * 모니터링 사이클: 메트릭 수집 → 안정성 분석 → 알림 확인 (순차)
   */
  private async runMonitoringCycle(): Promise<void> {
    await this.collectMetrics();
    this.analyzeStability();
    this.checkAlerts();
  }

  /**
   * 시스템 메트릭스 수집
   */
  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now();

    try {
      const { memoryMB, cpuEstimate } = collectRuntimeMetrics(
        this.metrics,
        this.cpuTracker,
        timestamp
      );
      syncMetricsFromSystemStatus(this.metrics, this.systemStatus);

      // 메트릭스를 이벤트 버스를 통해 공유
      if (this.eventBus) {
        this.eventBus.emit<WatchdogEventPayload>({
          type: SystemEventType.WATCHDOG_ALERT,
          timestamp: Date.now(),
          source: 'SystemWatchdog',
          payload: {
            alertType: 'metrics-update',
            severity: 'info',
            message: 'System metrics updated',
            metrics: {
              cpuUsage: cpuEstimate,
              memoryUsage: memoryMB,
              errorRate: this.metrics.errorRate,
            },
          },
        });
      }
    } catch (error) {
      systemLogger.warn('메트릭스 수집 실패:', error);
    }
  }

  /**
   * 안정성 분석
   */
  private analyzeStability(): void {
    this.metrics.performanceScore = calculatePerformanceScore(this.metrics);
    this.metrics.stabilityScore = calculateStabilityScore(
      this.metrics,
      this.getRecentAlerts(10 * 60 * 1000).length
    );

    // 성능 저하 감지
    if (this.metrics.performanceScore < 60) {
      this.addAlert(
        'performance',
        `시스템 성능 저하 감지 (${this.metrics.performanceScore.toFixed(1)}%)`
      );
    }

    // 안정성 문제 감지
    if (this.metrics.stabilityScore < 70) {
      this.addAlert(
        'stability',
        `시스템 안정성 문제 감지 (${this.metrics.stabilityScore.toFixed(1)}%)`
      );
    }
  }

  /**
   * 알림 확인
   */
  private checkAlerts(): void {
    if (!this.eventBus) return;

    const plans = buildWatchdogAlertPlans(
      this.metrics,
      this.getLatestMemory(),
      this.getCurrentAlerts()
    );

    for (const plan of plans) {
      this.addAlert(plan.alertType, plan.message);
      this.eventBus.emit(plan.eventPayload);
    }
  }

  /**
   * 현재 알림 상태 확인
   */
  private getCurrentAlerts(): WatchdogAlerts {
    return getCurrentWatchdogAlerts(this.metrics);
  }

  /**
   * 최근 알림 조회
   */
  private getRecentAlerts(timeWindow: number): WatchdogAlertEntry[] {
    const cutoffTime = Date.now() - timeWindow;
    return this.alertsHistory.filter(
      (alert) => alert.timestamp.getTime() > cutoffTime
    );
  }

  /**
   * 알림 추가
   */
  private addAlert(type: string, message: string): void {
    const alert = {
      timestamp: new Date(),
      type,
      message,
    };

    this.alertsHistory.push(alert);

    // 히스토리 크기 제한
    if (this.alertsHistory.length > this.maxHistoryLength) {
      this.alertsHistory = this.alertsHistory.slice(-this.maxHistoryLength);
    }

    systemLogger.warn(`⚠️ [Watchdog Alert] ${message}`);
  }

  /**
   * 최신 메모리 사용량 반환
   */
  private getLatestMemory(): number {
    if (this.metrics.memory.length === 0) return 0;
    return this.metrics.memory[this.metrics.memory.length - 1]?.value ?? 0;
  }

  /**
   * 메트릭스 조회
   */
  getMetrics(): SystemMetrics {
    return {
      ...this.metrics,
      cpu: [...this.metrics.cpu],
      memory: [...this.metrics.memory],
    };
  }

  /**
   * 알림 히스토리 조회
   */
  getAlertsHistory(): WatchdogAlertEntry[] {
    return [...this.alertsHistory];
  }

  /**
   * 상태 리포트 생성
   */
  generateReport(): WatchdogReport {
    const alerts = this.getCurrentAlerts();
    const recentAlerts = this.getRecentAlerts(15 * 60 * 1000); // 15분

    return createWatchdogReport(this.getMetrics(), alerts, recentAlerts);
  }
}
