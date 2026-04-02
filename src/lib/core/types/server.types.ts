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

/**
 * 서버 메트릭 히스토리
 */

/**
 * 타입 가드: SimpleServerMetrics 체크
 */
function _isSimpleMetrics(
  metrics: FlexibleServerMetrics
): metrics is SimpleServerMetrics {
  return (
    typeof metrics.cpu === 'number' &&
    typeof metrics.memory === 'number' &&
    typeof metrics.disk === 'number' &&
    typeof metrics.network === 'number'
  );
}

/**
 * 타입 가드: DetailedServerMetrics 체크
 */
function _isDetailedMetrics(
  metrics: FlexibleServerMetrics
): metrics is DetailedServerMetrics {
  return (
    typeof metrics.cpu === 'object' &&
    typeof metrics.memory === 'object' &&
    typeof metrics.disk === 'object' &&
    typeof metrics.network === 'object'
  );
}

/**
 * 헬퍼: 간단한 메트릭을 상세 메트릭으로 변환
 */
function _toDetailedMetrics(
  simple: SimpleServerMetrics
): DetailedServerMetrics {
  return {
    cpu: {
      usage: simple.cpu,
      cores: 1, // 기본값
    },
    memory: {
      used: simple.memory,
      total: 100, // 기본값 (퍼센트 가정)
      usage: simple.memory,
    },
    disk: {
      used: simple.disk,
      total: 100, // 기본값 (퍼센트 가정)
      usage: simple.disk,
    },
    network: {
      in: simple.network / 2, // 추정
      out: simple.network / 2, // 추정
    },
    timestamp: simple.timestamp || new Date().toISOString(),
    id: (simple.id as string) || 'unknown',
    hostname: (simple.hostname as string) || 'unknown',
  } as DetailedServerMetrics;
}

/**
 * 헬퍼: 메트릭 정규화 (어떤 형태든 받아서 일관된 형태로 변환)
 */
function _normalizeMetrics(
  metrics: Partial<FlexibleServerMetrics>
): FlexibleServerMetrics {
  return {
    cpu: metrics.cpu ?? 0,
    memory: metrics.memory ?? 0,
    disk: metrics.disk ?? 0,
    network: metrics.network ?? 0,
    ...metrics,
  };
}

// Re-export 관련 타입들
export type { ServerStatus } from '@/types/common';
// Backward-compatible alias
export type { FlexibleServerMetrics as ServerMetrics };
