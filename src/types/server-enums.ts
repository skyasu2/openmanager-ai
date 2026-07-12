/**
 * 🏗️ 서버 관련 Enum 타입 정의
 *
 * AI 교차검증 결과 기반으로 생성됨:
 * - Claude: 실용적 enum 구조 설계
 * - Gemini: 확장성 고려한 타입 체계
 * - Codex: 런타임 안전성 강화
 * - Previous AI review: 성능 최적화된 타입 선택
 */

// 🎯 서버 상태 Enum (Single Source of Truth)
export type ServerStatus =
  | 'online'
  | 'offline'
  | 'warning'
  | 'critical'
  | 'maintenance'
  | 'unknown';

// ⚡ 서버 상태 상수 배열 (런타임 검증 및 Zod 스키마용)
export const SERVER_STATUS_VALUES = [
  'online',
  'offline',
  'warning',
  'critical',
  'maintenance',
  'unknown',
] as const;

// 서버 환경 Enum
export type ServerEnvironment =
  | 'production'
  | 'staging'
  | 'development'
  | 'testing';

// 서버 역할 Enum
export type ServerRole =
  | 'web'
  | 'api'
  | 'database'
  | 'cache'
  | 'monitoring'
  | 'security'
  | 'backup'
  | 'load-balancer'
  | 'loadbalancer'
  | 'queue'
  | 'storage'
  | 'log'
  | 'app'
  | 'application'
  | 'fallback';

export function normalizeServerEnvironment(
  value: string | undefined
): ServerEnvironment {
  switch (value?.trim().toLowerCase()) {
    case 'production':
    case 'prod':
      return 'production';
    case 'staging':
    case 'stage':
      return 'staging';
    case 'testing':
    case 'test':
      return 'testing';
    default:
      return 'development';
  }
}

export function normalizeServerRole(value: string | undefined): ServerRole {
  switch (value?.trim().toLowerCase()) {
    case 'web':
    case 'api':
    case 'database':
    case 'cache':
    case 'monitoring':
    case 'security':
    case 'backup':
    case 'load-balancer':
    case 'loadbalancer':
    case 'queue':
    case 'storage':
    case 'log':
    case 'app':
    case 'application':
      return value.trim().toLowerCase() as ServerRole;
    default:
      return 'fallback';
  }
}

export function mapServerTypeToRole(value: string | undefined): ServerRole {
  const serverType = normalizeServerRole(value);
  return serverType === 'application' ? 'api' : serverType;
}
