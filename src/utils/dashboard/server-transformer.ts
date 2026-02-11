import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types';
import {
  deriveNetworkErrors,
  deriveNetworkSplit,
  deriveZombieProcesses,
} from '@/services/server-data/server-data-transformer';
import type {
  Server,
  ServerEnvironment,
  ServerRole,
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

    return {
      id: s.id,
      name: s.name || s.hostname || 'Unknown',
      hostname: s.hostname || s.name || 'Unknown',
      status: s.status,
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
      specs: s.specs || {
        cpu_cores: 4,
        memory_gb: 8,
        disk_gb: 250,
        network_speed: '1Gbps',
      },
      lastUpdate:
        typeof s.lastUpdate === 'string'
          ? new Date(s.lastUpdate)
          : s.lastUpdate || new Date(),
      services: Array.isArray(s.services) ? (s.services as Service[]) : [],
      networkStatus:
        s.status === 'online'
          ? 'online'
          : s.status === 'warning'
            ? 'warning'
            : 'critical',
      systemInfo: s.systemInfo || {
        os: s.os || 'Ubuntu 22.04 LTS',
        uptime:
          typeof s.uptime === 'string'
            ? s.uptime
            : `${Math.floor((s.uptime || 0) / 3600)}h`,
        processes: 120,
        zombieProcesses: deriveZombieProcesses(s.id, 120),
        loadAverage: '0.50, 0.45, 0.40',
        lastUpdate:
          typeof s.lastUpdate === 'string'
            ? s.lastUpdate
            : s.lastUpdate instanceof Date
              ? s.lastUpdate.toISOString()
              : new Date().toISOString(),
      },
      networkInfo:
        s.networkInfo ||
        (() => {
          const serverType = s.type || 'web';
          const { networkIn, networkOut } = deriveNetworkSplit(
            network,
            serverType
          );
          const errors = deriveNetworkErrors(network, s.id);
          return {
            interface: 'eth0',
            receivedBytes: `${networkIn} MB`,
            sentBytes: `${networkOut} MB`,
            receivedErrors: errors.receivedErrors,
            sentErrors: errors.sentErrors,
            status:
              s.status === 'online'
                ? ('online' as const)
                : s.status === 'warning'
                  ? ('warning' as const)
                  : ('critical' as const),
          };
        })(),
    };
  });
}
