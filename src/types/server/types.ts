/**
 * Server Type Aliases
 *
 * `src/types/server-enums.ts`를 서버 환경/역할/상태의 SSOT로 유지한다.
 * 이 파일은 기존 import 경로 호환만 담당한다.
 */

import type {
  ServerEnvironment as CanonicalServerEnvironment,
  ServerRole as CanonicalServerRole,
  ServerStatus as CanonicalServerStatus,
} from '../server-enums';

export type ServerStatus = CanonicalServerStatus;
export type ServerEnvironment = CanonicalServerEnvironment;
export type ServerRole = CanonicalServerRole;
