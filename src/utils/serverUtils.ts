/**
 * 🛠️ 서버 관련 공통 유틸리티 함수
 *
 * 중복 코드 제거 및 번들 크기 최적화
 * - 타입 가드 함수
 * - 서버 데이터 변환 함수
 * - 업타임 포맷팅
 * - 상태 매핑
 */

import { deriveNetworkSplit } from '@/services/server-data/server-data-transformer';
import type {
  EnhancedServerMetrics,
  Server,
  ServerAlert,
  ServerEnvironment,
  ServerRole,
  Service,
} from '@/types/server';
import type { ServerStatus } from '@/types/server-enums'; // 🔧 추가: Single Source of Truth

/**
 * 서버 타입 가드 함수들
 */
export const serverTypeGuards = {
  getCpu: (server: Server): number => {
    return typeof server.cpu === 'number' ? server.cpu : 0;
  },

  getMemory: (server: Server): number => {
    return typeof server.memory === 'number' ? server.memory : 0;
  },

  getDisk: (server: Server): number => {
    return typeof server.disk === 'number' ? server.disk : 0;
  },

  getNetwork: (server: Server): number => {
    return typeof server.network === 'number' ? server.network : 25;
  },

  getSpecs: (server: Server): NonNullable<Server['specs']> => {
    return (
      server.specs || {
        cpu_cores: 4,
        memory_gb: 8,
        disk_gb: 250,
        network_speed: '1Gbps',
      }
    );
  },

  getStatus: (status: Server['status']): ServerStatus => {
    // 🔧 수정: ServerStatus 타입 사용
    // 모든 상태를 그대로 반환 (이미 ServerStatus 타입)
    return status;
  },

  getAlerts: (alerts: Server['alerts']): number => {
    if (typeof alerts === 'number') return alerts;
    if (Array.isArray(alerts)) return alerts.length;
    return 0;
  },
};

/**
 * 업타임 포맷팅
 */
export function formatUptime(uptime?: number | string): string {
  if (typeof uptime === 'string') return uptime;
  if (typeof uptime !== 'number' || uptime <= 0) return '0m';

  const days = Math.floor(uptime / (24 * 3600));
  const hours = Math.floor((uptime % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * 서버 상태 우선순위 매핑
 */
export const SERVER_STATUS_PRIORITY = {
  critical: 0,
  unknown: 0, // 🔧 수정: 'offline' → 'unknown' (일관성)
  warning: 1,
  online: 2, // 🔧 수정: 'healthy' → 'online' (일관성)
} as const;

/**
 * 서버 정렬 함수
 */
export function sortServersByStatus(servers: Server[]): Server[] {
  return [...servers].sort((a, b) => {
    const priorityA =
      SERVER_STATUS_PRIORITY[a.status as keyof typeof SERVER_STATUS_PRIORITY] ??
      3;
    const priorityB =
      SERVER_STATUS_PRIORITY[b.status as keyof typeof SERVER_STATUS_PRIORITY] ??
      3;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 같은 우선순위면 알림 수로 정렬 (많은 순)
    const alertsA = serverTypeGuards.getAlerts(a.alerts);
    const alertsB = serverTypeGuards.getAlerts(b.alerts);

    return alertsB - alertsA;
  });
}

/**
 * 서버 데이터 정규화
 */
export function normalizeServerData(server: unknown): Server {
  if (typeof server !== 'object' || server === null) {
    throw new Error('Invalid server data');
  }

  const s = server as Record<string, unknown>;

  // 타입 안전성을 위한 헬퍼 함수
  const getString = (key: string, defaultValue: string): string => {
    const value = s[key];
    return typeof value === 'string' ? value : defaultValue;
  };

  const getNumber = (key: string, defaultValue: number): number => {
    const value = s[key];
    return typeof value === 'number' ? value : defaultValue;
  };

  const getStatus = (): ServerStatus => {
    // 🔧 수정: ServerStatus 타입 사용
    const status = s.status;
    // 'healthy' → 'online' 변환
    if (status === 'healthy') return 'online';
    // ServerStatus 타입 검증
    if (
      status === 'online' ||
      status === 'offline' ||
      status === 'critical' ||
      status === 'warning' ||
      status === 'maintenance' ||
      status === 'unknown'
    ) {
      return status;
    }
    return 'offline';
  };

  const partialServer: Partial<Server> = {
    id: getString('id', getString('hostname', 'unknown')),
    name: getString('name', getString('hostname', 'Unknown Server')),
    hostname: getString('hostname', getString('name', 'Unknown')),
    status: getStatus(),
    uptime: getNumber('uptime', 0),
    location: getString('location', 'Unknown'),
    ip: getString('ip', '192.168.1.1'),
    os: getString('os', 'Ubuntu 22.04 LTS'),
    role: getString('type', getString('role', 'worker')) as ServerRole,
    environment: getString('environment', 'production') as ServerEnvironment,
    provider: getString('provider', 'On-Premise'),
    lastUpdate: s.lastUpdate instanceof Date ? s.lastUpdate : new Date(),
    services: Array.isArray(s.services) ? (s.services as Service[]) : [],
    networkStatus: (() => {
      // 🔧 수정: 'healthy' → 'online' 변환
      const ns = s.networkStatus;
      if (ns === 'healthy') return 'online';
      if (
        ns === 'offline' ||
        ns === 'critical' ||
        ns === 'online' ||
        ns === 'warning' ||
        ns === 'maintenance'
      ) {
        return ns;
      }
      return undefined;
    })(),
  };

  // 서버 타입 가드를 통한 메트릭 추출
  const serverWithMetrics = { ...partialServer, ...s } as unknown as Server;

  return {
    ...partialServer,
    cpu: serverTypeGuards.getCpu(serverWithMetrics),
    memory: serverTypeGuards.getMemory(serverWithMetrics),
    disk: serverTypeGuards.getDisk(serverWithMetrics),
    network: serverTypeGuards.getNetwork(serverWithMetrics),
    alerts:
      typeof s.alerts === 'number'
        ? s.alerts
        : Array.isArray(s.alerts)
          ? (s.alerts as ServerAlert[])
          : undefined,
    specs: serverTypeGuards.getSpecs(serverWithMetrics),
  } as Server;
}

/**
 * 메트릭 색상 결정
 */
export function getMetricColor(
  value: number,
  type: 'cpu' | 'memory' | 'disk' | 'network'
) {
  const thresholds = {
    cpu: { warning: 70, critical: 85 },
    memory: { warning: 80, critical: 90 },
    disk: { warning: 80, critical: 95 },
    network: { warning: 70, critical: 85 }, // 🔧 수정: 60→70, 80→85 (다른 메트릭과 일관성)
  };

  const threshold = thresholds[type];
  if (value >= threshold.critical) {
    return {
      bg: 'from-red-500 to-red-600',
      text: 'text-red-700',
      border: 'border-red-300',
      status: 'critical' as const,
    };
  } else if (value >= threshold.warning) {
    return {
      bg: 'from-amber-500 to-amber-600',
      text: 'text-amber-700',
      border: 'border-amber-300',
      status: 'warning' as const,
    };
  } else {
    const colors = {
      cpu: {
        bg: 'from-blue-500 to-blue-600',
        text: 'text-blue-700',
        border: 'border-blue-300',
      },
      memory: {
        bg: 'from-purple-500 to-purple-600',
        text: 'text-purple-700',
        border: 'border-purple-300',
      },
      disk: {
        bg: 'from-indigo-500 to-indigo-600',
        text: 'text-indigo-700',
        border: 'border-indigo-300',
      },
      network: {
        bg: 'from-emerald-500 to-emerald-600',
        text: 'text-emerald-700',
        border: 'border-emerald-300',
      },
    };
    return {
      ...colors[type],
      status: 'online' as const,
    };
  }
}

/**
 * 서버 건강도 계산
 */
export function calculateServerHealth(server: Server): number {
  const cpu = serverTypeGuards.getCpu(server);
  const memory = serverTypeGuards.getMemory(server);
  const disk = serverTypeGuards.getDisk(server);

  // 가중 평균 계산 (CPU: 40%, Memory: 40%, Disk: 20%)
  const weightedScore =
    (100 - cpu) * 0.4 + (100 - memory) * 0.4 + (100 - disk) * 0.2;

  return Math.round(Math.max(0, Math.min(100, weightedScore)));
}

/**
 * Server 객체를 EnhancedServerMetrics로 변환
 */
export function mapServerToEnhanced(server: Server): EnhancedServerMetrics {
  // uptime을 number로 변환
  const uptimeNumber =
    typeof server.uptime === 'number'
      ? server.uptime
      : parseInt(String(server.uptime), 10) || 0;

  // 타입 변환: EnhancedServerMetrics는 'maintenance'와 'unknown'을 허용하지 않음
  const enhancedStatus = (() => {
    if (server.status === 'unknown' || server.status === 'maintenance') {
      return 'offline';
    }
    return server.status;
  })();

  return {
    // 기본 식별 정보
    id: server.id,
    hostname: server.hostname ?? server.id,
    environment: server.environment ?? 'production',
    role: server.role ?? 'app',
    status: enhancedStatus,

    // 메트릭 데이터
    cpu: server.cpu,
    memory: server.memory,
    disk: server.disk,
    network: server.network ?? 0,

    // 호환성 필드 매핑
    cpu_usage: server.cpu,
    memory_usage: server.memory,
    disk_usage: server.disk,
    network_in: deriveNetworkSplit(server.network ?? 0, server.role ?? 'web')
      .networkIn,
    network_out: deriveNetworkSplit(server.network ?? 0, server.role ?? 'web')
      .networkOut,
    alerts: [],

    // 성능 정보
    responseTime: server.responseTime ?? 0,
    uptime: uptimeNumber,

    // 타임스탬프 (현재 시간)
    timestamp: new Date().toISOString(),
    last_updated: new Date().toISOString(),

    // UI에서 필요한 필드
    name: server.name ?? server.id,
    ip: server.ip ?? server.hostname,
    os: server.os,

    // 추가 필드 (Optional)
    location: server.location,
    type: server.type,
    provider: server.provider,
    specs: server.specs,
    lastUpdate: server.lastUpdate
      ? new Date(server.lastUpdate).toISOString()
      : undefined,
    systemInfo: server.systemInfo,
    networkInfo: server.networkInfo,
  };
}
