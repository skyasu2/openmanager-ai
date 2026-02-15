/**
 * Core Server Types
 *
 * 기본 서버 엔티티 타입 정의
 */

import type {
  ServerHealth,
  ServerMetrics,
  ServerSpecs,
  ServerStatus,
} from '../server-common';
import type { OTelLogRecord } from '../otel-metrics';
import type { LogEntry, NetworkInfo, Service, SystemInfo } from './entities';
import type { ServerAlert } from './metrics';
import type { ServerEnvironment, ServerRole } from './types';

export type { ServerStatus, ServerHealth, ServerMetrics, ServerSpecs };

/**
 * 서버 인스턴스 (대시보드용 확장 타입)
 */
export interface ServerInstance {
  id: string;
  name: string;
  status: ServerStatus;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: number | string;
  lastCheck: string;
  type: string;
  environment: string;
  region: string;
  version: string;
  tags: string[];
  alerts: number;

  // 기본 속성들 (필수)
  location: string;
  lastUpdated: string;
  provider: string;

  // SafeServerCard 호환성을 위한 추가 속성들
  os?: string;
  ip?: string;
  cpuHistory?: number[];
  memoryHistory?: number[];
  services?: Service[];
  responseTime?: number;
  description?: string;

  // 확장된 속성들
  health?: ServerHealth;
  specs?: ServerSpecs;

  requests?: {
    total: number;
    success: number;
    errors: number;
    averageTime: number;
  };

  errors?: {
    count: number;
    recent: string[];
    lastError?: string;
  };

  custom?: {
    updateInterval?: number;
    enableMockData?: boolean;
    [key: string]: unknown;
  };

  metrics?: ServerMetrics;
}

/**
 * 기본 서버 타입
 */
export interface Server {
  id: string;
  name: string;
  hostname?: string;
  status: ServerStatus;
  cpu: number;
  memory: number;
  disk: number;
  network?: number;
  responseTime?: number;
  uptime: string | number;
  location: string;
  alerts?: number | ServerAlert[];
  ip?: string;
  os?: string;
  type?: ServerRole;
  description?: string;
  environment?: ServerEnvironment;
  provider?: string;
  role?: ServerRole;
  lastSeen?: string;
  metrics?: {
    cpu: {
      usage: number;
      cores: number;
      temperature: number;
    };
    memory: {
      used: number;
      total: number;
      usage: number;
    };
    disk: {
      used: number;
      total: number;
      usage: number;
    };
    network: {
      bytesIn: number;
      bytesOut: number;
      packetsIn: number;
      packetsOut: number;
    };
    timestamp: string;
    uptime: number;
  };
  specs?: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
    network_speed?: string;
  };
  lastUpdate?: Date;
  services?: Service[];
  logs?: LogEntry[];
  networkInfo?: NetworkInfo;
  networkStatus?: ServerStatus;
  systemInfo?: SystemInfo;
  health?: {
    score: number;
    trend: number[];
  };
  alertsSummary?: {
    total: number;
    critical: number;
    warning: number;
  };

  // 확장 Prometheus 메트릭 (AI 컨텍스트 및 상세 보기용)
  load1?: number; // 1분 평균 로드 (node_load1)
  load5?: number; // 5분 평균 로드 (node_load5)
  bootTimeSeconds?: number; // 부팅 시간 Unix timestamp (node_boot_time_seconds)
  cpuCores?: number; // CPU 코어 수 (load 해석용)

  /** OTel structured logs (populated by OTel-Direct pipeline) */
  structuredLogs?: OTelLogRecord[];
}
