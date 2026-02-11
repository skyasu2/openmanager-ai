/**
 * Server Metrics Types
 *
 * 서버 메트릭, 알림, 히스토리 관련 타입
 */

import type { ServerSpecs } from '../server-common';
import type { ProcessInfo, ServerAlert } from './base';
import type { NetworkInfo, Service, SystemInfo } from './entities';
import type { ServerEnvironment, ServerRole, ServerStatus } from './types';

// Re-export from base for backward compatibility
export type { ProcessInfo, ServerAlert };

/**
 * 메트릭 히스토리
 */
export interface MetricsHistory {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network:
    | number
    | {
        bytesReceived: number;
        bytesSent: number;
      };
  responseTime?: number;
  connections?: number;
}

/**
 * 시계열 메트릭
 */
export interface TimeSeriesMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  processes?: ProcessInfo[];
}

/**
 * 확장된 서버 메트릭 (AI 교차검증 결과 반영)
 */
export interface EnhancedServerMetrics {
  // 기본 속성들
  id: string;
  hostname: string;
  environment: ServerEnvironment;
  role: ServerRole;
  status: ServerStatus;

  // 호환성 확장을 위한 추가 필드들
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_in: number;
  network_out: number;
  responseTime: number;
  uptime: number;
  last_updated: string;
  alerts: ServerAlert[];

  // Enhanced 속성들
  name: string;
  network_usage?: number;
  timestamp?: string;
  pattern_info?: unknown;
  correlation_metrics?: unknown;
  patternsEnabled?: boolean;
  currentLoad?: number;
  activeFailures?: number;

  // 호환성을 위한 추가 속성들
  network?: number;
  cpu?: number;
  memory?: number;
  disk?: number;

  // 추가 호환성 필드들
  ip?: string;
  os?: string;
  connections?: number;
  services?: Service[];
  processes?: ProcessInfo[];

  // 서버 기본 정보
  location?: string;
  type?: ServerRole;
  provider?: string;
  specs?: ServerSpecs;
  lastUpdate?: string;
  systemInfo?: SystemInfo;
  networkInfo?: NetworkInfo;

  // 메타데이터 정보
  metadata?: {
    serverType?: ServerRole;
    timeSlot?: number;
    hour?: number;
    minute?: number;
    timeInfo?: {
      normalized: number;
      actual: number;
      cycle24h: number;
      slot10min: number;
      hour: number;
      validUntil: number;
    };
    [key: string]: unknown;
  };

  // 기존 Server 타입과의 호환성을 위한 metrics 속성
  metrics?: {
    cpu?: {
      usage: number;
      cores?: number;
      temperature?: number;
    };
    memory?: {
      used?: number;
      total?: number;
      usage: number;
    };
    disk?: {
      used?: number;
      total?: number;
      usage: number;
    };
    network?: {
      bytesIn?: number;
      bytesOut?: number;
      packetsIn?: number;
      packetsOut?: number;
      in?: number;
      out?: number;
    };
    timestamp?: string;
    uptime?: number;
  };

  // 트렌드 속성
  trends?: {
    cpu: 'increasing' | 'decreasing' | 'stable';
    memory: 'increasing' | 'decreasing' | 'stable';
    disk: 'increasing' | 'decreasing' | 'stable';
    network: 'increasing' | 'decreasing' | 'stable';
  };
}
