/**
 * Base Types (No Dependencies)
 *
 * 다른 파일에서 공통으로 사용하는 기본 타입
 */

import type { AlertSeverity } from '../common';

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
