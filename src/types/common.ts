/**
 * 🔧 Common Types
 *
 * 프로젝트 전체에서 공통으로 사용되는 타입 정의
 * - 중복 제거를 위한 기본 타입들
 * - 확장 가능한 인터페이스 구조
 */

// 🔧 환경변수 타입 확장 - 중앙집중화된 환경변수 시스템 사용
// 환경변수 타입 정의는 '@/types/environment'에서 관리됩니다.
import '@/types/environment';

// 환경변수 모킹을 위한 타입 (새로운 시스템으로 위임)
export type { MockEnvironmentConfig } from '@/types/environment';

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

// 확장된 서비스 인터페이스
export interface ExtendedService extends BaseService {
  pid?: number;
  memory?: number;
  cpu?: number;
  restartCount?: number;
  uptime?: number;
  version?: string;
}

// 기본 메트릭 인터페이스
export interface BaseMetrics {
  timestamp: Date;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_in: number;
  network_out: number;
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

// 서버 알림 인터페이스
export interface ServerAlert extends BaseAlert {
  server_id: string;
  hostname: string;
  metric?: string;
  value?: number;
  threshold?: number;
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

// 확장된 서버 정보 인터페이스 - any 제거
export interface ExtendedServer extends BaseServer {
  location?: string;
  provider?: CloudProvider;
  specs?: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
  };
  tags?: string[];
  metadata?: ServerMetadata; // any 대신 구체적 타입 사용
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

// 페이지네이션된 응답
export interface PaginatedResponse<T> extends BaseApiResponse<T[]> {
  pagination: PaginationInfo;
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

// 쿼리 옵션 인터페이스
export interface QueryOptions {
  filters?: FilterOptions;
  sort?: SortOptions;
  pagination?: {
    page: number;
    limit: number;
  };
}

// 시스템 상태 인터페이스
export interface SystemStatus {
  totalServers: number;
  healthyServers: number;
  warningServers: number;
  criticalServers: number;
  offlineServers: number;
  averageCpu: number;
  averageMemory: number;
  isGenerating?: boolean;
}

// 로그 레벨 타입
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 🔧 로그 데이터 타입 시스템 개선
export type LogDataValue = string | number | boolean | null | Date;
export type LogData = Record<string, LogDataValue | LogDataValue[]>;

// 로그 엔트리 인터페이스 - any 제거
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  module: string;
  data?: LogData; // any 대신 구체적 타입 사용
}

// 설정 인터페이스
export interface BaseConfig {
  name: string;
  version: string;
  environment: Environment;
  debug: boolean;
}

// 🔧 에러 컨텍스트 타입 시스템 개선
export type ErrorContextValue = string | number | boolean | null | undefined;
export type ErrorContext = Record<string, ErrorContextValue>;

// 에러 정보 인터페이스 - any 제거
export interface ErrorInfo {
  code: string;
  message: string;
  stack?: string;
  context?: ErrorContext; // any 대신 구체적 타입 사용
  timestamp: Date;
}

// 헬스체크 결과 인터페이스
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration?: number;
    };
  };
  timestamp: Date;
}

// 유틸리티 타입들
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ID 생성 함수 타입
export type IdGenerator = () => string;

// 🔧 이벤트 핸들러 타입 시스템 개선
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;
export type AsyncFunction<T = unknown, R = unknown> = (data: T) => Promise<R>;

/**
 * 🤖 AI 관련 통합 타입 정의
 */
export interface StandardAIResponse {
  success: boolean;
  response: string;
  confidence: number;
  sources?: string[];
  suggestions?: string[];
  processingTime: number;
  sessionLearning?: boolean;
  notice?: string;
  reliability?: 'high' | 'medium' | 'low';
  source?: string;
  error?: string;
  intent?: {
    category: string;
    confidence: number;
    keywords?: string[];
  };
  metadata?: {
    sessionId: string;
    timestamp: string;
    version?: string;
    engineUsed?: string;
  };
}

/**
 * 🔗 MCP 관련 통합 타입 정의
 */
export interface StandardMCPResponse {
  success: boolean;
  content: string;
  confidence: number;
  sources: string[];
  metadata?: {
    sessionId?: string;
    timestamp?: string;
    processingTime?: number;
    engineUsed?: string;
  };
  error?: string;
}

/**
 * 🔄 세션 관리 통합 타입
 */
export interface SessionContext {
  sessionId: string;
  conversationId?: string;
  userIntent?: string;
  previousActions?: string[];
  currentState?: ExtensibleMetadata; // any 대신 구체적 타입 사용
  metadata?: ExtensibleMetadata; // any 대신 구체적 타입 사용
  lastQuery?: string;
  createdAt: Date;
  lastUpdated: Date;
}

/**
 * 📊 분석 응답 통합 타입
 */
export interface StandardAnalysisResponse {
  success: boolean;
  query: string;
  analysis: {
    summary: string;
    details: AnalysisDetail[]; // unknown[] 대신 구체적 타입 사용
    confidence: number;
    processingTime: number;
  };
  recommendations: string[];
  metadata: {
    sessionId: string;
    timestamp: string;
    version: string;
    engineUsed: string;
  };
  error?: string;
}

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

export const isLogData = (value: unknown): value is LogData => {
  if (!value || typeof value !== 'object') return false;

  return Object.values(value).every(
    (v) => isMetadataValue(v) || (Array.isArray(v) && v.every(isMetadataValue))
  );
};

export const isErrorContext = (value: unknown): value is ErrorContext => {
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
