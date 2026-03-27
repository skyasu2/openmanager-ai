/**
 * Server Configuration Types
 *
 * 서버 타입 정의, 설정 관련 타입
 */

import type { ServerRole } from './types';

/**
 * 서버 타입 정의
 */
export interface ServerTypeDefinition {
  type: ServerRole;
  tags: string[];
  characteristics: {
    cpuWeight: number;
    memoryWeight: number;
    diskWeight: number;
    networkWeight: number;
    responseTimeBase: number;
    stabilityFactor: number;
  };
  failureProne: string[];
  dependencies: ServerRole[];
}
