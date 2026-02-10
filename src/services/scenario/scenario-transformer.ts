/**
 * Data transformation functions for converting Prometheus target data
 * to the EnhancedServerMetrics format used by the dashboard.
 *
 * @see scenario-loader.ts - Main orchestration facade
 */

import { getServicesForServer } from '@/config/server-services-map';
import type {
  EnhancedServerMetrics,
  PrometheusTargetData,
  RawServerData,
} from '@/services/scenario/scenario-types';

/**
 * PrometheusTargetData -> RawServerData 변환
 */
export function targetToRawServerData(
  target: PrometheusTargetData
): RawServerData {
  const serverId = target.instance.replace(/:9100$/, '');
  const cpu = target.metrics.node_cpu_usage_percent;
  const memory = target.metrics.node_memory_usage_percent;
  const disk = target.metrics.node_filesystem_usage_percent;
  const network = target.metrics.node_network_transmit_bytes_rate;

  let status: RawServerData['status'] = 'online';
  if (target.metrics.up === 0) {
    status = 'offline';
  } else if (cpu >= 90 || memory >= 90 || disk >= 90 || network >= 85) {
    status = 'critical';
  } else if (cpu >= 80 || memory >= 80 || disk >= 80 || network >= 70) {
    status = 'warning';
  }

  return {
    id: serverId,
    name: target.labels.hostname.replace('.openmanager.kr', ''),
    hostname: target.labels.hostname,
    type: target.labels.server_type,
    location: target.labels.datacenter,
    environment: target.labels.environment,
    status,
    cpu,
    memory,
    disk,
    network,
    responseTime: target.metrics.node_http_request_duration_milliseconds,
    uptime: Math.round(
      Date.now() / 1000 - target.metrics.node_boot_time_seconds
    ),
    ip: '',
    os: `${target.labels.os} ${target.labels.os_version}`,
    specs: {
      cpu_cores: target.nodeInfo.cpu_cores,
      memory_gb: Math.round(
        target.nodeInfo.memory_total_bytes / (1024 * 1024 * 1024)
      ),
      disk_gb: Math.round(
        target.nodeInfo.disk_total_bytes / (1024 * 1024 * 1024)
      ),
    },
    services: [],
    processes: target.metrics.node_procs_running,
  };
}

/**
 * RawServerData -> EnhancedServerMetrics 변환
 */
export function convertToEnhancedMetrics(
  serverData: RawServerData,
  currentHour: number
): EnhancedServerMetrics {
  const cpu = serverData.cpu ?? 0;
  const memory = serverData.memory ?? 0;
  const disk = serverData.disk ?? 0;
  const network = serverData.network ?? 0;
  const status = serverData.status ?? 'online';

  return {
    id: serverData.id,
    name: serverData.name,
    hostname: serverData.hostname,
    status,
    cpu,
    cpu_usage: cpu,
    memory,
    memory_usage: memory,
    disk,
    disk_usage: disk,
    network,
    network_in: Math.round(network * 0.6),
    network_out: Math.round(network * 0.4),
    uptime: serverData.uptime ?? 2592000,
    responseTime: serverData.responseTime ?? 150,
    last_updated: new Date().toISOString(),
    location: serverData.location,
    alerts: [],
    ip: serverData.ip,
    os: serverData.os,
    type: serverData.type,
    role: mapTypeToRole(serverData.type),
    environment: serverData.environment,
    provider: `DataCenter-${currentHour.toString().padStart(2, '0')}`,
    specs: {
      cpu_cores: serverData.specs?.cpu_cores ?? 8,
      memory_gb: serverData.specs?.memory_gb ?? 16,
      disk_gb: serverData.specs?.disk_gb ?? 200,
      network_speed: '1Gbps',
    },
    lastUpdate: new Date().toISOString(),
    services: getServicesForServer(serverData.hostname, serverData.type, {
      cpu,
      memory,
      status,
    }),
    systemInfo: {
      os: serverData.os,
      uptime: `${Math.floor((serverData.uptime ?? 2592000) / 3600)}h`,
      processes: serverData.processes ?? 120,
      zombieProcesses: status === 'critical' ? 3 : status === 'warning' ? 1 : 0,
      loadAverage: `${(cpu / 20).toFixed(2)}, ${((cpu - 5) / 20).toFixed(2)}, ${((cpu - 10) / 20).toFixed(2)}`,
      lastUpdate: new Date().toISOString(),
    },
    networkInfo: {
      interface: 'eth0',
      receivedBytes: `${(network * 0.6).toFixed(1)} MB`,
      sentBytes: `${(network * 0.4).toFixed(1)} MB`,
      receivedErrors: status === 'critical' ? 2 : 0,
      sentErrors: status === 'critical' ? 1 : 0,
      status,
    },
  };
}

/**
 * 서버 타입 -> 역할 매핑
 */
function mapTypeToRole(type: string): string {
  const roleMap: Record<string, string> = {
    web: 'web',
    application: 'api',
    database: 'database',
    cache: 'cache',
    storage: 'storage',
    loadbalancer: 'loadbalancer',
  };
  return roleMap[type] || type;
}
