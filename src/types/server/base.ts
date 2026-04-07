/**
 * Base Types (No Dependencies)
 *
 * 다른 파일에서 공통으로 사용하는 기본 타입
 */

import type { AlertSeverity } from '../common';
import type { ServerStatus } from '../server-enums';

/**
 * 프로세스 정보
 */
export interface ProcessInfo {
  pid: number;
  /**
   * 프로세스 이름은 런타임/OS/데이터 소스마다 열려 있으므로 string으로 유지한다.
   */
  name: string;
  cpu: number;
  memory: number;
  user: string;
}

/**
 * 서버 알림
 */
export interface ServerAlert {
  id: string;
  server_id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'responseTime' | 'custom';
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  resolved: boolean;
  relatedServers?: string[];
  rootCause?: string;
}

/**
 * 서버 건강 상태
 */
export interface ServerHealth {
  score: number;
  trend: number[];
  status: ServerStatus;
  issues?: string[];
  lastChecked?: string;
}

/**
 * UI/전송 계층에서 자주 쓰는 health 요약 형태
 * - score/trend는 필수
 * - status/issues/lastChecked는 점진적으로 채워도 된다
 */
export type ServerHealthSummary = Pick<ServerHealth, 'score' | 'trend'> &
  Partial<Pick<ServerHealth, 'status' | 'issues' | 'lastChecked'>>;

/**
 * 서버 사양 정보
 */
export interface ServerSpecs {
  cpu_cores: number;
  memory_gb: number;
  disk_gb: number;
  network_speed?: string;
}

/**
 * 서버 메트릭
 * - 중앙화된 라이브러리 타입에서 재사용
 */
export type { ServerMetrics } from '@/lib/core/types';
