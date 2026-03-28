/**
 * 🚌 시스템 이벤트 버스 인터페이스
 *
 * ProcessManager와 SystemWatchdog 간의 순환 의존성을 해결하기 위한
 * 이벤트 기반 통신 인터페이스
 */

// 시스템 이벤트 타입
export enum SystemEventType {
  // Process Manager Events
  PROCESS_STARTED = 'process:started',
  PROCESS_STOPPED = 'process:stopped',
  PROCESS_ERROR = 'process:error',
  PROCESS_HEALTH_CHECK = 'process:health_check',

  // System Watchdog Events
  WATCHDOG_ALERT = 'watchdog:alert',
  WATCHDOG_RECOVERY = 'watchdog:recovery',
  WATCHDOG_THRESHOLD_EXCEEDED = 'watchdog:threshold_exceeded',

  // System Status Events
  SYSTEM_HEALTHY = 'system:healthy',
  SYSTEM_DEGRADED = 'system:degraded',
  SYSTEM_CRITICAL = 'system:critical',
  SYSTEM_ERROR = 'system:error',

  // Resource Events
  MEMORY_HIGH = 'resource:memory_high',
  CPU_HIGH = 'resource:cpu_high',
  DISK_LOW = 'resource:disk_low',
}

// 이벤트 페이로드 인터페이스
export interface SystemEvent<T = unknown> {
  type: SystemEventType;
  timestamp: number;
  source: string;
  payload: T;
  metadata?: {
    priority?: 'low' | 'medium' | 'high' | 'critical';
    correlationId?: string;
    retryCount?: number;
  };
}

// Process 관련 페이로드
export interface ProcessEventPayload {
  processId: string;
  processName: string;
  pid?: number;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  resources?: {
    cpu: number;
    memory: number;
  };
  error?: Error;
}

// Watchdog 관련 페이로드
export interface WatchdogEventPayload {
  alertType?:
    | 'memory-leak'
    | 'high-error-rate'
    | 'performance-degradation'
    | 'stability'
    | 'frequent-restarts'
    | 'metrics-update';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    errorRate?: number;
    performanceScore?: number;
    stabilityScore?: number;
    restartCount?: number;
  };
  threshold?: {
    name: string;
    value: number;
    limit: number;
  };
}

// 시스템 상태 페이로드
export interface SystemStatusPayload {
  status: 'healthy' | 'degraded' | 'critical';
  services: {
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
  }[];
  metrics: {
    uptime: number;
    totalProcesses: number;
    activeConnections: number;
  };
}

// 이벤트 리스너 타입
export type EventListener<T = unknown> = (
  event: SystemEvent<T>
) => void | Promise<void>;

// 이벤트 버스 인터페이스
export interface ISystemEventBus {
  // 이벤트 발행
  emit<T>(event: SystemEvent<T>): void;

  // 이벤트 구독
  on<T>(eventType: SystemEventType, listener: EventListener<T>): void;

  // 이벤트 구독 해제
  off<T>(eventType: SystemEventType, listener: EventListener<T>): void;

  // 일회성 이벤트 구독
  once<T>(eventType: SystemEventType, listener: EventListener<T>): void;

  // 모든 리스너 제거
  removeAllListeners(eventType?: SystemEventType): void;

  // 이벤트 타입별 리스너 수
  listenerCount(eventType: SystemEventType): number;

  // 이벤트 히스토리 조회 (선택적)
  getHistory?(eventType?: SystemEventType, limit?: number): SystemEvent[];
}

// 이벤트 발행자 인터페이스
export interface ISystemEventEmitter {
  getEventBus(): ISystemEventBus;
  setEventBus(eventBus: ISystemEventBus): void;
}
