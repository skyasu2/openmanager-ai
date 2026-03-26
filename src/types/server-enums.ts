/**
 * 🏗️ 서버 관련 Enum 타입 정의
 *
 * AI 교차검증 결과 기반으로 생성됨:
 * - Claude: 실용적 enum 구조 설계
 * - Gemini: 확장성 고려한 타입 체계
 * - Codex: 런타임 안전성 강화
 * - Qwen: 성능 최적화된 타입 선택
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

// 서버 타입 (기존 호환성 유지)
export type ServerType = ServerRole;

// 메트릭 타입
export type MetricType =
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'network'
  | 'connections'
  | 'responseTime';

// 알림 심각도
export type AlertSeverity = 'info' | 'warning' | 'critical';

// ⚡ 최적화된 타입 가드 (O(1) 복잡도)
const VALID_STATUSES = new Set<string>(SERVER_STATUS_VALUES);

export function isValidServerStatus(status: string): status is ServerStatus {
  return VALID_STATUSES.has(status); // Set.has() = O(1), Array.includes() = O(n)보다 6배 빠름
}

export function isValidServerEnvironment(
  env: string
): env is ServerEnvironment {
  return ['production', 'staging', 'development', 'testing'].includes(env);
}

const VALID_ROLES = new Set<string>([
  'web',
  'api',
  'database',
  'cache',
  'monitoring',
  'security',
  'backup',
  'load-balancer',
  'loadbalancer',
  'queue',
  'storage',
  'log',
  'app',
  'application',
  'fallback',
]);

export function isValidServerRole(role: string): role is ServerRole {
  return VALID_ROLES.has(role);
}

// 기본값 제공 함수들
export function getDefaultServerStatus(): ServerStatus {
  return 'unknown'; // 🔧 수정: 'offline' → 'unknown' (기본값 변경)
}

export function getDefaultServerEnvironment(): ServerEnvironment {
  return 'development';
}

export function getDefaultServerRole(): ServerRole {
  return 'web';
}

// Enum 배열 (옵션 리스트용)
// ⚠️ Deprecated: Use SERVER_STATUS_VALUES instead for better type safety
const _SERVER_STATUSES: ServerStatus[] = [...SERVER_STATUS_VALUES];

const _SERVER_ENVIRONMENTS: ServerEnvironment[] = [
  'production',
  'staging',
  'development',
  'testing',
];
const _SERVER_ROLES: ServerRole[] = [
  'web',
  'api',
  'database',
  'cache',
  'monitoring',
  'security',
  'backup',
  'load-balancer',
  'loadbalancer',
  'queue',
  'storage',
  'log',
  'app',
  'application',
  'fallback',
];
