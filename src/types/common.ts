/**
 * 🔧 Common Types
 *
 * 프로젝트 전체에서 실제로 재사용되는 최소 공통 타입 정의
 * - 중복 제거를 위한 기본 타입들
 * - 장기 미사용 export는 개별 타입 파일로 분리/제거
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

// 서버 메트릭은 중앙화된 타입 시스템에서 가져옴
export type { ServerMetrics } from '@/lib/core/types';

// 페이지네이션 정보
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 로그 레벨 타입
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
