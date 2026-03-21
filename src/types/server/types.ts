/**
 * Server Type Aliases
 *
 * 서버 환경, 역할, 상태 타입 정의
 */

import type {
  ServerEnvironment as EnumServerEnvironment,
  ServerRole as EnumServerRole,
  ServerStatus as EnumServerStatus,
} from '../server-enums';

// 타입 충돌 방지를 위해 타입 이름 변경
export type {
  EnumServerEnvironment as ServerEnvironmentEnum,
  EnumServerRole as ServerRoleEnum,
  EnumServerStatus as ServerStatusEnum,
};

// 기존 타입들과의 호환성을 위해 재정의
export type ServerStatus = EnumServerStatus;

// 확장된 환경 타입 (호환성 유지)
export type ServerEnvironment =
  | EnumServerEnvironment
  | 'on-premise'
  | 'aws'
  | 'gcp'
  | 'azure';

// 확장된 역할 타입 (호환성 유지)
export type ServerRole =
  | EnumServerRole
  | 'app'
  | 'fallback'
  | 'loadbalancer'
  | 'application';
