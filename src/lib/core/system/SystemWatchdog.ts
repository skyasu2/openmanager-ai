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
  calculateErrorRate,
  calculatePerformanceScore,
  calculateStabilityScore,
  createInitialSystemMetrics,
  detectMemoryLeak,
  getWatchdogRecommendation,
  type SystemMetrics,
  type SystemStatus,
  type WatchdogAlerts,
} from './SystemWatchdog.helpers';

export type { SystemMetrics, WatchdogAlerts } from './SystemWatchdog.helpers';

/**
 * 리팩토링된 SystemWatchdog
 * 이벤트 버스를 통해 ProcessManager와 통신
 */
export class SystemWatchdog {
  private eventBus?: ISystemEventBus;
  private metrics: SystemMetrics = createInitialSystemMetrics();
  private monitoringInterval?: NodeJS.Timeout;
  private alertsHistory: Array<{
    timestamp: Date;
    type: string;
    message: string;
  }> = [];
  private systemStatus?: SystemStatus;
  private readonly maxHistoryLength = 100;
  private readonly monitoringIntervalMs = 30000; // 30초 (과도한 헬스체크 방지)

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
      void this.collectMetrics();
      void this.analyzeStability();
      void this.checkAlerts();
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
   * 시스템 메트릭스 수집
   */
  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now();

    try {
      // 메모리 사용량 수집
      const memoryUsage = process.memoryUsage();
      const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

      this.metrics.memory.push({
        timestamp,
        value: memoryMB,
      });

      // CPU 사용량 추정 (Node.js에서는 정확한 CPU 사용량 측정이 어려우므로 대안 사용)
      const cpuEstimate = await this.estimateCPUUsage();
      this.metrics.cpu.push({
        timestamp,
        value: cpuEstimate,
      });

      // 오래된 데이터 정리 (최근 5분만 유지)
      const cutoffTime = timestamp - 5 * 60 * 1000; // 5분 전
      this.metrics.memory = this.metrics.memory.filter(
        (m) => m.timestamp > cutoffTime
      );
      this.metrics.cpu = this.metrics.cpu.filter(
        (c) => c.timestamp > cutoffTime
      );

      // 시스템 상태에서 오류율 및 재시작 횟수 업데이트
      if (this.systemStatus) {
        const totalRestarts = this.systemStatus.metrics?.totalRestarts || 0;
        this.metrics.restartCount = totalRestarts;
        this.metrics.errorRate = calculateErrorRate(this.systemStatus);
      }

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
   * CPU 사용량 추정
   */
  private async estimateCPUUsage(): Promise<number> {
    const startTime = process.hrtime.bigint();
    const startUsage = process.cpuUsage();

    // 짧은 작업 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 100));

    const endTime = process.hrtime.bigint();
    const endUsage = process.cpuUsage(startUsage);

    const elapsedTime = Number(endTime - startTime) / 1000000; // ms로 변환
    const totalCPUTime = (endUsage.user + endUsage.system) / 1000; // ms로 변환

    const cpuPercent = Math.min(100, (totalCPUTime / elapsedTime) * 100);
    return Math.max(0, cpuPercent);
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
    const alerts = this.getCurrentAlerts();

    // 메모리 누수 알림
    if (alerts.memoryLeak && this.eventBus) {
      this.addAlert('memory-leak', '메모리 누수 패턴 감지됨');
      this.eventBus.emit<WatchdogEventPayload>({
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'memory-leak',
          severity: 'critical',
          message: '메모리 누수 패턴 감지됨',
          metrics: {
            memoryUsage: this.getLatestMemory(),
          },
        },
      });
    }

    // 높은 오류율 알림
    if (alerts.highErrorRate && this.eventBus) {
      this.addAlert(
        'high-error-rate',
        `높은 오류율 감지 (${this.metrics.errorRate.toFixed(1)}%)`
      );
      this.eventBus.emit<WatchdogEventPayload>({
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'high-error-rate',
          severity: 'warning',
          message: `높은 오류율 감지 (${this.metrics.errorRate.toFixed(1)}%)`,
          metrics: {
            errorRate: this.metrics.errorRate,
          },
        },
      });
    }

    // 성능 저하 알림
    if (alerts.performanceDegradation && this.eventBus) {
      this.addAlert('performance-degradation', '시스템 성능 저하 감지');
      this.eventBus.emit<WatchdogEventPayload>({
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'performance-degradation',
          severity: 'warning',
          message: '시스템 성능 저하 감지',
          metrics: {
            performanceScore: this.metrics.performanceScore,
          },
        },
      });
    }

    // 빈번한 재시작 알림
    if (alerts.frequentRestarts && this.eventBus) {
      this.addAlert(
        'frequent-restarts',
        `빈번한 프로세스 재시작 감지 (${this.metrics.restartCount}회)`
      );
      this.eventBus.emit<WatchdogEventPayload>({
        type: SystemEventType.WATCHDOG_ALERT,
        timestamp: Date.now(),
        source: 'SystemWatchdog',
        payload: {
          alertType: 'frequent-restarts',
          severity: 'warning',
          message: `빈번한 프로세스 재시작 감지 (${this.metrics.restartCount}회)`,
          metrics: {
            restartCount: this.metrics.restartCount,
          },
        },
      });
    }
  }

  /**
   * 현재 알림 상태 확인
   */
  private getCurrentAlerts(): WatchdogAlerts {
    return {
      memoryLeak: detectMemoryLeak(this.metrics.memory),
      highErrorRate: this.metrics.errorRate > 25,
      performanceDegradation: this.metrics.performanceScore < 60,
      frequentRestarts: this.metrics.restartCount > 5,
    };
  }

  /**
   * 최근 알림 조회
   */
  private getRecentAlerts(timeWindow: number): Array<{
    timestamp: Date;
    type: string;
    message: string;
  }> {
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
    return { ...this.metrics };
  }

  /**
   * 알림 히스토리 조회
   */
  getAlertsHistory(): Array<{
    timestamp: Date;
    type: string;
    message: string;
  }> {
    return [...this.alertsHistory];
  }

  /**
   * 상태 리포트 생성
   */
  generateReport(): {
    metrics: SystemMetrics;
    alerts: WatchdogAlerts;
    recentAlerts: Array<{
      timestamp: Date;
      type: string;
      message: string;
    }>;
    recommendation: string;
  } {
    const alerts = this.getCurrentAlerts();
    const recentAlerts = this.getRecentAlerts(15 * 60 * 1000); // 15분

    return {
      metrics: this.getMetrics(),
      alerts,
      recentAlerts,
      recommendation: getWatchdogRecommendation(alerts),
    };
  }
}
