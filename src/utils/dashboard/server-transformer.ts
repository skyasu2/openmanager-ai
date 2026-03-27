import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types';
import type {
  Server,
  ServerEnvironment,
  ServerRole,
  ServerStatus,
  Service,
} from '@/types/server';

/**
 * 🔄 Server Data Transformer
 *
 * EnhancedServerData를 Server 타입으로 변환하는 순수 함수
 * - 타입 안전성 보장
 * - 기본값 제공
 * - 메트릭 데이터 정규화
 */
export function transformServerData(
  rawServers: EnhancedServerData[]
): Server[] {
  if (!rawServers || !Array.isArray(rawServers) || rawServers.length === 0) {
    return [];
  }

  return rawServers.map((s): Server => {
    const cpu = Math.round(s.cpu || s.cpu_usage || 0);
    const memory = Math.round(s.memory || s.memory_usage || 0);
    const disk = Math.round(s.disk || s.disk_usage || 0);
    const network = Math.round(
      s.network || (s.network_in || 0) + (s.network_out || 0) || 0
    );

    const normalizedStatus: ServerStatus =
      s.status === 'online' ||
      s.status === 'warning' ||
      s.status === 'critical' ||
      s.status === 'offline' ||
      s.status === 'maintenance' ||
      s.status === 'unknown'
        ? s.status
        : 'unknown';

    return {
      id: s.id,
      name: s.name || s.hostname || 'Unknown',
      hostname: s.hostname || s.name || 'Unknown',
      status: normalizedStatus,
      cpu: cpu,
      memory: memory,
      disk: disk,
      network: network,
      uptime: s.uptime || 0,
      location: s.location || 'Unknown',
      alerts:
        typeof s.alerts === 'number'
          ? s.alerts
          : Array.isArray(s.alerts)
            ? s.alerts.length
            : 0,
      ip: s.ip || '-',
      os: s.os || 'Ubuntu 22.04 LTS',
      role: (s.type || s.role || 'worker') as ServerRole,
      environment: (s.environment || 'production') as ServerEnvironment,
      provider: s.provider || 'On-Premise',
      specs: s.specs,
      lastUpdate:
        typeof s.lastUpdate === 'string'
          ? new Date(s.lastUpdate)
          : s.lastUpdate || new Date(),
      services: Array.isArray(s.services) ? (s.services as Service[]) : [],
      networkStatus: normalizedStatus,
      systemInfo: s.systemInfo,
      networkInfo: s.networkInfo,
    };
  });
}
