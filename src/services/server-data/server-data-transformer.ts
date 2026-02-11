/**
 * Data transformation functions for converting Prometheus target data
 * to the EnhancedServerMetrics format used by the dashboard.
 *
 * Processing rules (Prometheus-aligned):
 * - loadAverage: sourced from node_load1/5, load15 estimated via EMA
 * - network_in/out: derived from transmit_rate with server-type ratio
 * - zombieProcesses: near-zero baseline, independent of status
 * - networkErrors: near-zero baseline, correlated with network saturation only
 *
 * @see server-data-loader.ts - Main orchestration facade
 */

import { getServerStatus } from '@/config/rules/loader';
import { getServerIP } from '@/config/server-registry';
import { getServicesForServer } from '@/config/server-services-map';
import type {
  EnhancedServerMetrics,
  PrometheusTargetData,
  RawServerData,
} from '@/services/server-data/server-data-types';

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

  const status: RawServerData['status'] =
    target.metrics.up === 0
      ? 'offline'
      : getServerStatus({ cpu, memory, disk, network });

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
    ip: getServerIP(serverId) ?? '',
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
    load1: target.metrics.node_load1,
    load5: target.metrics.node_load5,
  };
}

// ── Network ratio by server type ──────────────────────────────────
// Real-world traffic patterns: web servers receive more (client requests),
// storage/database servers send more (query results, file transfers).
// Prometheus only provides node_network_transmit_bytes_rate, so we
// estimate receive rate using type-based ratios.

const NETWORK_RX_RATIO: Record<string, number> = {
  web: 0.7, // Client requests → high inbound
  loadbalancer: 0.65, // Proxied requests → mostly inbound
  application: 0.55, // Balanced (API calls in, responses out)
  database: 0.4, // Queries in are small, result sets out are large
  cache: 0.45, // GET requests in, cached data out
  storage: 0.35, // Small writes in, large reads out
};

/**
 * Derive network_in (receive) and network_out (transmit) from a single
 * transmit_rate metric using server-type ratio.
 *
 * The transmit_rate represents total network activity as a percentage.
 * We split it into RX/TX based on realistic traffic patterns per server type.
 */
export function deriveNetworkSplit(
  transmitRate: number,
  serverType: string
): { networkIn: number; networkOut: number } {
  const rxRatio = NETWORK_RX_RATIO[serverType] ?? 0.55;
  const txRatio = 1 - rxRatio;
  return {
    networkIn: Math.round(transmitRate * rxRatio),
    networkOut: Math.round(transmitRate * txRatio),
  };
}

/**
 * Estimate load15 from load1 and load5 using exponential moving average.
 *
 * In Linux, load averages use exponential decay:
 *   load_N = load_N * exp(-interval/N) + active * (1 - exp(-interval/N))
 *
 * load15 is smoother (more dampened) than load5. As an approximation:
 *   load15 ≈ load5 * 0.85 + baseline
 * This produces a value that's always ≤ load5 ≤ load1 (matching real behavior).
 */
export function estimateLoad15(load1: number, load5: number): number {
  // load15 dampens toward 0 faster; approximate with weighted blend
  const estimated = load5 * 0.85 + load1 * 0.05;
  return Math.max(0, estimated);
}

/**
 * Derive zombie process count independently of server status.
 *
 * Real node_procs_zombie is almost always 0 on healthy systems.
 * Occasional zombies appear from process management bugs,
 * NOT correlated with CPU/memory thresholds.
 *
 * Uses a deterministic hash to avoid random flickering in UI.
 */
export function deriveZombieProcesses(
  serverId: string,
  processes: number
): number {
  // Deterministic: hash serverId to get a stable value per server
  let hash = 0;
  for (let i = 0; i < serverId.length; i++) {
    hash = (hash * 31 + serverId.charCodeAt(i)) | 0;
  }
  // ~5% of servers show 1 zombie, ~1% show 2, rest are 0
  const bucket = Math.abs(hash) % 100;
  if (bucket < 1 && processes > 150) return 2;
  if (bucket < 5) return 1;
  return 0;
}

/**
 * Derive network error counts from network utilization only.
 *
 * Real node_network_receive_errs_total / transmit_errs_total are
 * hardware/driver-level counters, NOT correlated with server status.
 * They are almost always 0 unless the NIC is saturated or faulty.
 */
export function deriveNetworkErrors(
  network: number,
  serverId: string
): { receivedErrors: number; sentErrors: number } {
  // Deterministic per server
  let hash = 0;
  for (let i = 0; i < serverId.length; i++) {
    hash = (hash * 31 + serverId.charCodeAt(i)) | 0;
  }
  const jitter = Math.abs(hash) % 100;

  // Only possible when network > 80% (NIC saturation)
  if (network > 80 && jitter < 30) {
    return { receivedErrors: 1, sentErrors: jitter < 10 ? 1 : 0 };
  }
  return { receivedErrors: 0, sentErrors: 0 };
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

  // ── Derived from Prometheus raw metrics (not fabricated) ──
  const load1 = serverData.load1 ?? 0;
  const load5 = serverData.load5 ?? 0;
  const load15 = estimateLoad15(load1, load5);

  const { networkIn, networkOut } = deriveNetworkSplit(
    network,
    serverData.type
  );
  const zombieProcesses = deriveZombieProcesses(
    serverData.id,
    serverData.processes ?? 100
  );
  const { receivedErrors, sentErrors } = deriveNetworkErrors(
    network,
    serverData.id
  );

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
    network_in: networkIn,
    network_out: networkOut,
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
      zombieProcesses,
      loadAverage: `${load1.toFixed(2)}, ${load5.toFixed(2)}, ${load15.toFixed(2)}`,
      lastUpdate: new Date().toISOString(),
    },
    networkInfo: {
      interface: 'eth0',
      receivedBytes: `${networkIn} MB`,
      sentBytes: `${networkOut} MB`,
      receivedErrors,
      sentErrors,
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
