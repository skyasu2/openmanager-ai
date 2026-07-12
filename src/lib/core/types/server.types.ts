/**
 * 🎯 Core Server Types
 *
 * 프로젝트 전체에서 사용되는 서버 관련 타입의 중앙 정의
 * - ServerMetrics: 21개 파일에서 중복 정의되던 타입 통합
 * - 모든 서버 관련 타입의 Single Source of Truth
 *
 * @created 2025-01-30
 * @author AI Systems Engineer
 */

import type { ServerStatus } from '@/types/common';

/**
 * 유연한 서버 메트릭 인터페이스
 * - 기본형(number)과 상세형(object)을 모두 지원하는 유니온 타입
 * - 하위 호환성 유지
 */
export interface FlexibleServerMetrics {
  // CPU 메트릭 (간단한 숫자 또는 상세 객체)
  cpu:
    | number
    | {
        usage: number;
        cores?: number;
        temperature?: number;
        loadAverage?: number[];
      };

  // 메모리 메트릭
  memory:
    | number
    | {
        used: number;
        total: number;
        usage: number;
        available?: number;
      };

  // 디스크 메트릭
  disk:
    | number
    | {
        used: number;
        total: number;
        usage: number;
        iops?: number;
        readSpeed?: number;
        writeSpeed?: number;
      };

  // 네트워크 메트릭
  network:
    | number
    | {
        in: number;
        out: number;
        bandwidth?: number;
        connections?: number;
      };

  // 시간 정보
  timestamp?: string | Date;
  uptime?: number;

  // 서버 식별 정보
  id?: string;
  hostname?: string;
  environment?: string;
  role?: string;
  region?: string;

  // 상태 정보
  status?: ServerStatus;
  health?: 'healthy' | 'degraded' | 'unhealthy';

  // 추가 메트릭
  responseTime?: number;
  errorRate?: number;
  requestsPerSecond?: number;
  activeSessions?: number;

  // 프로세스 정보
  processes?: {
    total: number;
    running: number;
    sleeping: number;
    zombie?: number;
  };

  // 서비스별 메트릭
  services?: Record<
    string,
    {
      status: string;
      cpu?: number;
      memory?: number;
    }
  >;

  // 원시 데이터 (호환성)
  raw?: unknown;
}

/**
 * 간단한 서버 메트릭 (레거시 호환)
 */
export interface SimpleServerMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * 상세 서버 메트릭
 */
export interface DetailedServerMetrics
  extends Required<
    Omit<FlexibleServerMetrics, 'cpu' | 'memory' | 'disk' | 'network'>
  > {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
    loadAverage?: number[];
  };
  memory: {
    used: number;
    total: number;
    usage: number;
    available?: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
    iops?: number;
    readSpeed?: number;
    writeSpeed?: number;
  };
  network: {
    in: number;
    out: number;
    bandwidth?: number;
    connections?: number;
  };
}

// Re-export 관련 타입들
export type { ServerStatus } from '@/types/common';
// Backward-compatible alias
export type { FlexibleServerMetrics as ServerMetrics };
