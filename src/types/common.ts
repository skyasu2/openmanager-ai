/**
 * 🔧 Common Types
 *
 * 프로젝트 전체에서 공통으로 사용되는 타입 정의
 * - 중복 제거를 위한 기본 타입들
 * - 확장 가능한 인터페이스 구조
 */

// 기본 서비스 상태 타입
export type ServiceStatus =
  | 'running'
  | 'stopped'
  | 'warning'
  | 'failed'
  | 'starting'
  | 'stopping'
  | 'error'
  | 'unknown';

// 🎯 서버 상태 타입 (2025-09-30 타입 통합)
// Single Source of Truth: src/types/server-enums.ts
import type { ServerStatus } from './server-enums';

export type { ServerStatus };

// 알림 심각도 타입
export type AlertSeverity = 'info' | 'warning' | 'critical';

// 환경 타입
export type Environment = 'production' | 'staging' | 'development';

// 서버 타입
export type ServerType =
  | 'web'
  | 'database'
  | 'api'
  | 'cache'
  | 'storage'
  | 'gateway'
  | 'worker'
  | 'monitoring'
  | 'mail'
  | 'proxy'
  | 'analytics'
  | 'ci_cd'
  | 'security';

// 클라우드 제공자 타입
export type CloudProvider =
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'onpremise'
  | 'kubernetes';

// 기본 서비스 인터페이스
export interface BaseService {
  name: string;
  status: ServiceStatus;
  port?: number;
  description?: string;
}

// 서버 메트릭은 중앙화된 타입 시스템에서 가져옴
export type { ServerMetrics } from '@/lib/core/types';

// 기본 알림 인터페이스
export interface BaseAlert {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  resolved: boolean;
}

// 🔧 메타데이터 타입 정의 개선
export type MetadataValue = string | number | boolean | null | undefined;
export type ServerMetadata = Record<string, MetadataValue>;
export type ExtensibleMetadata = Record<
  string,
  MetadataValue | MetadataValue[]
>;

// 기본 서버 정보 인터페이스
export interface BaseServer {
  id: string;
  hostname: string;
  name: string;
  type: ServerType;
  environment: Environment;
  status: ServerStatus;
  created_at: Date;
}

// 🔧 API 응답 타입 시스템 개선
export interface ApiErrorDetails {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
  stack?: string;
}

// API 응답 기본 구조 - any 제거
export interface BaseApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: ApiErrorDetails;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

// 페이지네이션 정보
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 시간 범위 인터페이스
export interface TimeRange {
  start: Date;
  end: Date;
}

// 필터 옵션 인터페이스
export interface FilterOptions {
  serverTypes?: ServerType[];
  environments?: Environment[];
  statuses?: ServerStatus[];
  timeRange?: TimeRange;
  search?: string;
}

// 정렬 옵션 인터페이스
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// 로그 레벨 타입
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 🔧 로그 데이터 타입 시스템 개선
export type LogDataValue = string | number | boolean | null | Date;
export type LogData = Record<string, LogDataValue | LogDataValue[]>;

// 🔧 에러 컨텍스트 타입 시스템 개선
export type ErrorContextValue = string | number | boolean | null | undefined;
export type ErrorContext = Record<string, ErrorContextValue>;

// 유틸리티 타입들
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 🔍 분석 상세 정보 타입
 */
export interface AnalysisDetail {
  type: 'metric' | 'trend' | 'anomaly' | 'recommendation' | 'insight';
  name: string;
  value: MetadataValue;
  description?: string;
  severity?: AlertSeverity;
  timestamp?: string;
}

/**
 * 🎯 타입 가드 함수들
 */
export const isMetadataValue = (value: unknown): value is MetadataValue => {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  );
};

const _isLogData = (value: unknown): value is LogData => {
  if (!value || typeof value !== 'object') return false;

  return Object.values(value).every(
    (v) => isMetadataValue(v) || (Array.isArray(v) && v.every(isMetadataValue))
  );
};

const _isErrorContext = (value: unknown): value is ErrorContext => {
  if (!value || typeof value !== 'object') return false;

  return Object.values(value).every(
    (v) =>
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      v === null ||
      v === undefined
  );
};
