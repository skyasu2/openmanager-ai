/**
 * 🎯 시스템 이벤트 핸들러 - 중재자 패턴 구현
 *
 * ProcessManager와 SystemWatchdog 간의 통신을 중재하여
 * 순환 의존성을 해결합니다.
 */

import { logger } from '@/lib/logging';
import {
  type EventListener,
  type ISystemEventBus,
  type ProcessEventPayload,
  type SystemEvent,
  SystemEventType,
  type SystemStatusPayload,
  type WatchdogEventPayload,
} from '../interfaces/SystemEventBus';

// 이벤트 핸들러 설정
interface EventHandlerConfig {
  enableHistory?: boolean;
  historyLimit?: number;
  enableDebugLogging?: boolean;
  retryFailedEvents?: boolean;
  maxRetries?: number;
}

/**
 * 시스템 이벤트 버스 구현체
 */
export class SystemEventBus implements ISystemEventBus {
  private listeners: Map<SystemEventType, Set<EventListener>> = new Map();
  private history: SystemEvent[] = [];
  private config: EventHandlerConfig;

  constructor(config: EventHandlerConfig = {}) {
    this.config = {
      enableHistory: true,
      historyLimit: 100,
      enableDebugLogging: false,
      retryFailedEvents: true,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * 이벤트 발행
   */
  emit<T>(event: SystemEvent<T>): void {
    if (this.config.enableDebugLogging) {
      logger.info(`🚌 [EventBus] Emitting: ${event.type}`, event);
    }

    // 히스토리 저장
    if (this.config.enableHistory) {
      this.addToHistory(event);
    }

    // 리스너 호출
    const listeners = this.listeners.get(event.type);
    if (listeners && listeners.size > 0) {
      listeners.forEach((listener) => {
        void this.invokeListener(listener, event);
      });
    }
  }

  /**
   * 이벤트 구독
   */
  on<T>(eventType: SystemEventType, listener: EventListener<T>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const listeners = this.listeners.get(eventType);
    listeners?.add(listener as unknown as EventListener);
  }

  /**
   * 이벤트 구독 해제
   */
  off<T>(eventType: SystemEventType, listener: EventListener<T>): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener as unknown as EventListener);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * 일회성 이벤트 구독
   */
  once<T>(eventType: SystemEventType, listener: EventListener<T>): void {
    const onceWrapper: EventListener<T> = (event) => {
      void this.invokeListener(listener, event);
      this.off(eventType, onceWrapper);
    };
    this.on(eventType, onceWrapper);
  }

  /**
   * 모든 리스너 제거
   */
  removeAllListeners(eventType?: SystemEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 이벤트 타입별 리스너 수
   */
  listenerCount(eventType: SystemEventType): number {
    const listeners = this.listeners.get(eventType);
    return listeners ? listeners.size : 0;
  }

  /**
   * 이벤트 히스토리 조회
   */
  getHistory(eventType?: SystemEventType, limit?: number): SystemEvent[] {
    let filtered = this.history;

    if (eventType) {
      filtered = filtered.filter((event) => event.type === eventType);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * 리스너 안전 호출
   */
  private async invokeListener<T>(
    listener: EventListener<T>,
    event: SystemEvent<T>
  ): Promise<void> {
    try {
      const result = listener(event);
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      if (this.config.enableDebugLogging) {
        logger.error(`❌ [EventBus] Listener error for ${event.type}:`, error);
      }

      // 재시도 로직
      if (this.config.retryFailedEvents && event.metadata) {
        const retryCount = event.metadata.retryCount || 0;
        if (retryCount < (this.config.maxRetries || 3)) {
          setTimeout(
            () => {
              this.emit({
                ...event,
                metadata: {
                  ...event.metadata,
                  retryCount: retryCount + 1,
                },
              });
            },
            2 ** retryCount * 1000
          ); // Exponential backoff
        }
      }
    }
  }

  /**
   * 히스토리에 이벤트 추가
   */
  private addToHistory(event: SystemEvent): void {
    this.history.push(event);

    // 히스토리 크기 제한
    if (this.history.length > (this.config.historyLimit || 100)) {
      this.history.shift();
    }
  }
}

/**
 * 시스템 이벤트 중재자
 * ProcessManager와 SystemWatchdog 간의 통신을 조율
 */
export class SystemEventMediator {
  private eventBus: SystemEventBus;
  private processHealthThresholds = {
    cpu: 80,
    memory: 85,
  };

  constructor(eventBus?: SystemEventBus) {
    this.eventBus =
      eventBus ||
      new SystemEventBus({
        enableDebugLogging: process.env.NODE_ENV === 'development',
      });
    this.setupEventHandlers();
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    // Process 이벤트 처리
    this.eventBus.on<ProcessEventPayload>(
      SystemEventType.PROCESS_ERROR,
      this.handleProcessError.bind(this)
    );

    this.eventBus.on<ProcessEventPayload>(
      SystemEventType.PROCESS_HEALTH_CHECK,
      this.handleProcessHealthCheck.bind(this)
    );

    // Watchdog 이벤트 처리
    this.eventBus.on<WatchdogEventPayload>(
      SystemEventType.WATCHDOG_THRESHOLD_EXCEEDED,
      this.handleThresholdExceeded.bind(this)
    );

    // System 이벤트 처리
    this.eventBus.on<SystemStatusPayload>(
      SystemEventType.SYSTEM_CRITICAL,
      this.handleSystemCritical.bind(this)
    );
  }

  /**
   * Process 에러 처리
   */
  private handleProcessError(event: SystemEvent<ProcessEventPayload>): void {
    const { payload } = event;

    // Watchdog에 알림
    this.eventBus.emit<WatchdogEventPayload>({
      type: SystemEventType.WATCHDOG_ALERT,
      timestamp: Date.now(),
      source: 'SystemEventMediator',
      payload: {
        severity: 'error',
        message: `Process error: ${payload.processName} (${payload.error?.message})`,
        metrics: payload.resources
          ? {
              cpuUsage: payload.resources.cpu,
              memoryUsage: payload.resources.memory,
            }
          : undefined,
      },
      metadata: {
        priority: 'high',
        correlationId: event.metadata?.correlationId,
      },
    });
  }

  /**
   * Process 헬스 체크 처리
   */
  private handleProcessHealthCheck(
    event: SystemEvent<ProcessEventPayload>
  ): void {
    const { payload } = event;

    if (payload.resources) {
      const { cpu, memory } = payload.resources;

      // 임계값 체크
      if (
        cpu > this.processHealthThresholds.cpu ||
        memory > this.processHealthThresholds.memory
      ) {
        this.eventBus.emit<WatchdogEventPayload>({
          type: SystemEventType.WATCHDOG_THRESHOLD_EXCEEDED,
          timestamp: Date.now(),
          source: 'SystemEventMediator',
          payload: {
            severity: 'warning',
            message: `Process ${payload.processName} exceeding resource limits`,
            metrics: {
              cpuUsage: cpu,
              memoryUsage: memory,
            },
            threshold:
              cpu > this.processHealthThresholds.cpu
                ? {
                    name: 'CPU',
                    value: cpu,
                    limit: this.processHealthThresholds.cpu,
                  }
                : {
                    name: 'Memory',
                    value: memory,
                    limit: this.processHealthThresholds.memory,
                  },
          },
        });
      }
    }
  }

  /**
   * 임계값 초과 처리
   */
  private handleThresholdExceeded(
    event: SystemEvent<WatchdogEventPayload>
  ): void {
    const { payload } = event;

    // 시스템 상태 업데이트
    this.eventBus.emit<SystemStatusPayload>({
      type:
        payload.severity === 'critical'
          ? SystemEventType.SYSTEM_CRITICAL
          : SystemEventType.SYSTEM_DEGRADED,
      timestamp: Date.now(),
      source: 'SystemEventMediator',
      payload: {
        status: payload.severity === 'critical' ? 'critical' : 'degraded',
        services: [], // ProcessManager에서 채울 예정
        metrics: {
          uptime: 0, // ProcessManager에서 채울 예정
          totalProcesses: 0,
          activeConnections: 0,
        },
      },
    });
  }

  /**
   * 시스템 위급 상황 처리
   */
  private handleSystemCritical(event: SystemEvent<SystemStatusPayload>): void {
    logger.error(
      '🚨 [SystemEventMediator] System critical state detected!',
      event
    );

    // 여기서 알림, 복구 프로세스 등을 트리거할 수 있습니다
    // 예: 이메일 알림, Slack 알림, 자동 복구 스크립트 실행 등
  }

  /**
   * EventBus 인스턴스 반환
   */
  getEventBus(): SystemEventBus {
    return this.eventBus;
  }
}

// 싱글톤 인스턴스
let mediatorInstance: SystemEventMediator | null = null;

/**
 * SystemEventMediator 싱글톤 인스턴스 반환
 */
export function getSystemEventMediator(): SystemEventMediator {
  if (!mediatorInstance) {
    mediatorInstance = new SystemEventMediator();
  }
  return mediatorInstance;
}

/**
 * SystemEventBus 싱글톤 인스턴스 반환
 */
export function getSystemEventBus(): SystemEventBus {
  return getSystemEventMediator().getEventBus();
}
