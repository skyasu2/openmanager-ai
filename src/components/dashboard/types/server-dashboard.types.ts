/**
 * ServerDashboard 컴포넌트 any 타입 제거를 위한 타입 정의
 * any 타입 제거를 위한 명확한 타입 정의
 */

import type {
  Server,
  ServerAlert,
  ServerEnvironment,
  ServerRole,
  Service,
} from '@/types/server';
import { serverTypeGuards } from '@/utils/serverUtils';

// 서버 확장 타입 (any 타입 제거용)
export interface ExtendedServer extends Omit<Server, 'type' | 'environment'> {
  hostname: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: string | number;
  ip: string;
  os: string;
  type: ServerRole;
  environment: ServerEnvironment;
  provider: string;
  lastUpdate: Date;
  alerts: number | ServerAlert[];
  services: Service[];
  specs: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
    network_speed?: string;
  };
  health: {
    score: number;
    trend: number[];
  };
  alertsSummary: {
    total: number;
    critical: number;
    warning: number;
  };
}

// 서버 타입 가드
export function isExtendedServer(server: unknown): server is ExtendedServer {
  const s = server as Record<string, unknown>;
  return (
    s &&
    typeof s === 'object' &&
    'cpu' in s &&
    'memory' in s &&
    'disk' in s &&
    typeof s.cpu === 'number' &&
    typeof s.memory === 'number' &&
    typeof s.disk === 'number'
  );
}

// 서버를 ExtendedServer로 안전하게 변환
export function toExtendedServer(server: Server): ExtendedServer {
  // 속성 확인을 위한 타입 체크
  const hasProperty = <T extends object, K extends PropertyKey>(
    obj: T,
    key: K
  ): obj is T & Record<K, unknown> => {
    return key in obj;
  };

  return {
    ...server,
    hostname: server.hostname || server.name,
    cpu:
      hasProperty(server, 'cpu') && typeof server.cpu === 'number'
        ? server.cpu
        : 0,
    memory:
      hasProperty(server, 'memory') && typeof server.memory === 'number'
        ? server.memory
        : 0,
    disk:
      hasProperty(server, 'disk') && typeof server.disk === 'number'
        ? server.disk
        : 0,
    network:
      hasProperty(server, 'network') && typeof server.network === 'number'
        ? server.network
        : 25,
    uptime: server.uptime || 'N/A',
    ip: server.ip || '-',
    os: server.os || 'Ubuntu 22.04',
    type: (server.type || 'api') as ServerRole,
    environment: (server.environment || 'production') as ServerEnvironment,
    provider: server.provider || 'Unknown',
    lastUpdate:
      hasProperty(server, 'lastUpdate') && server.lastUpdate instanceof Date
        ? server.lastUpdate
        : new Date(),
    alerts: server.alerts || 0,
    services: server.services || [],
    specs:
      hasProperty(server, 'specs') &&
      typeof server.specs === 'object' &&
      server.specs !== null
        ? (server.specs as ExtendedServer['specs'])
        : {
            cpu_cores: 4,
            memory_gb: 16,
            disk_gb: 500,
          },
    health: server.health || {
      score: 85,
      trend: [],
    },
    alertsSummary: server.alertsSummary || {
      total: serverTypeGuards.getAlerts(server.alerts),
      critical: 0,
      warning: serverTypeGuards.getAlerts(server.alerts),
    },
  };
}
