import type { Service } from './server';
import type { ServerStatus } from './server-enums';

/**
 * Server Metrics Type Definitions
 *
 * 서버 메트릭 시스템의 모든 타입 정의를 중앙 관리
 * - 서버 데이터 구조
 * - 이벤트 및 시나리오 타입
 * - 성능 및 캐싱 관련 타입
 */

// ==========================================
// 서버 데이터 구조
// ==========================================

/**
 * 🛡️ Unified Raw Server Data
 *
 * 서버의 원시 데이터 표현 (JSON 파일, API 응답, 시나리오 로더 등)
 * - 모든 소스에서 사용 가능한 통합 타입
 * - 필수 필드: id, name, hostname, type, status, core metrics
 * - 선택 필드: 환경 정보, 스펙, 서비스 등
 *
 * @unified 이전에 3개 파일에 분산되어 있던 정의를 통합 (2025-11-24)
 */
export interface RawServerData {
  // ===== Core Identity (Required) =====
  id: string;
  name: string;
  hostname: string;
  type: string; // 'web', 'db', 'cache', etc.

  // ===== Status (Required) =====
  /**
   * 서버 상태 - canonical type from server-enums.ts
   * @see src/types/server-enums.ts (Single Source of Truth)
   */
  status: ServerStatus;

  // ===== Core Metrics (Required) =====
  cpu: number; // 0-100 percentage
  memory: number; // 0-100 percentage
  disk: number; // 0-100 percentage
  network: number; // MBps or usage percentage
  uptime: number; // seconds

  // ===== Environment (Optional) =====
  environment?: string; // 'production', 'staging', 'development'
  location?: string; // 'Seoul', 'Tokyo', etc.
  region?: string; // 'ap-northeast-2', etc.
  provider?: string; // 'AWS', 'GCP', 'Azure', etc.

  // ===== Hardware Specs (Optional) =====
  specs?: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
  };

  // ===== Services (Optional) =====
  /**
   * Primary service name (singular)
   * @deprecated Use services array instead
   */
  service?: string;
  /**
   * Running services (plural)
   */
  services?: Service[];

  // ===== Additional Metadata (Optional) =====
  role?: string; // 'master', 'slave', 'primary', 'replica', etc.
  ip?: string;
  os?: string;
  processes?: number;
  connections?: number;
  responseTime?: number; // milliseconds
  alerts?: number;
  lastUpdate?: string | number | Date;

  // ===== Events & Trends (Optional) =====
  events?: string[];
  trend?: 'stable' | 'increasing' | 'decreasing';
  networkStatus?: string;

  // ===== Extended Prometheus Metrics (Optional) =====
  load1?: number; // 1분 평균 로드 (node_load1)
  load5?: number; // 5분 평균 로드 (node_load5)
  bootTimeSeconds?: number; // 부팅 시간 Unix timestamp (node_boot_time_seconds)
}

/**
 * 서버 메트릭 (핵심 모니터링 데이터)
 */
export interface ServerMetrics {
  name: string;
  cpu: number;
  memory: number;
  disk: number;
  network?: number;
  uptime: number;
  status: ServerStatus;
}

/**
 * 시간별 서버 데이터 (JSON 파일 구조)
 */
export interface HourlyServerData {
  servers: Record<string, RawServerData>;
  scenario?: string;
  summary?: {
    total: number;
    online: number;
    warning: number;
    critical: number;
  };
}

// ==========================================
// 이벤트 및 시나리오
// ==========================================

/**
 * 서버 이벤트 결과
 */
export interface ServerEventResult {
  hasEvent: boolean;
  impact: number;
  type: string;
  description?: string;
}

/**
 * 서버 타입별 프로파일 및 장애 시나리오
 */
export interface ServerTypeProfile {
  type: string;
  normalRanges: {
    cpu: [number, number];
    memory: [number, number];
    disk: [number, number];
    network: [number, number];
  };
  scenarios: {
    [key: string]: {
      name: string;
      probability: number; // 0-1 확률
      effects: {
        cpu?: number;
        memory?: number;
        disk?: number;
        network?: number;
      };
      status: 'online' | 'warning' | 'critical';
    };
  };
}

// ==========================================
// 배치 처리
// ==========================================

/**
 * 배치 서버 정보
 */
export interface BatchServerInfo {
  id: string;
  type: string;
  baseMetrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

/**
 * 배치 메트릭 결과
 */
export interface BatchMetricsResult {
  id: string;
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  events: ServerEventResult;
}

// ==========================================
// 성능 및 캐싱
// ==========================================

/**
 * 성능 통계
 */
export interface PerformanceStats {
  variationMode: 'realistic';
  cacheOptimization: 'disabled';
  responseTime: string;
  dataSource: string;
}

/**
 * 파일 캐시 구조
 */
export interface FileCache {
  data: HourlyServerData;
  timestamp: number;
  hour: number;
}

// ==========================================
// 유틸리티 타입
// ==========================================

/**
 * 정렬 가능한 메트릭 키
 */
export type SortableKey = keyof Pick<
  ServerMetrics,
  'cpu' | 'memory' | 'disk' | 'network' | 'uptime' | 'name'
>;

// ==========================================
// 타입 가드 및 검증 유틸리티
// ==========================================

/**
 * 숫자 값 안전 변환
 */
export const ensureNumber = (
  value: number | undefined,
  fallback: number = 0
): number => {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
};
