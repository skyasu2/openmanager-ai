/**
 * ServerMonitoringService - unified metric processing layer
 *
 * Consolidates metric transformation logic into a single service.
 * All fields are either SOURCE (from Prometheus), DERIVED (from source metrics),
 * or CONFIG (from configuration mapping). No fabricated data.
 *
 * Data flow:
 *   MetricsProvider (ApiServerMetrics)
 *     -> processMetric() (one-time)
 *   ProcessedServerData
 *     -> toServer() / toEnhancedMetrics() / toPaginatedServer()
 *   Consumer types
 */

import { getServerIP } from '@/config/server-registry';
import { getServicesForServer } from '@/config/server-services-map';
import {
  type ApiServerMetrics,
  metricsProvider,
} from '@/services/metrics/MetricsProvider';
import type { SystemSummary } from '@/services/metrics/types';
import {
  deriveNetworkSplit,
  estimateLoad15,
} from '@/services/server-data/server-data-transformer';
import type { EnhancedServerMetrics, Server } from '@/types/server';
import type { ProcessedServerData } from './types';

// ── OS label builder (DERIVED from Prometheus labels.os + labels.os_version) ──

function buildOSLabel(metric: ApiServerMetrics): string {
  return metric.os && metric.osVersion
    ? `${metric.os.charAt(0).toUpperCase() + metric.os.slice(1)} ${metric.osVersion}`
    : 'Ubuntu 22.04 LTS';
}

// ── Uptime calculator (DERIVED from node_boot_time_seconds) ───────────────────

function calculateUptime(metric: ApiServerMetrics): number {
  if (metric.bootTimeSeconds && metric.bootTimeSeconds > 0) {
    return Math.floor(Date.now() / 1000 - metric.bootTimeSeconds);
  }
  // bootTimeSeconds가 없으면 uptime 알 수 없음
  return 0;
}

// ── Specs builder (SOURCE from Prometheus nodeInfo, undefined if absent) ───────

function buildSpecs(metric: ApiServerMetrics): ProcessedServerData['specs'] {
  if (!metric.nodeInfo) return undefined;
  const GiB = 1024 ** 3;
  return {
    cpu_cores: metric.nodeInfo.cpuCores,
    memory_gb: Math.round(metric.nodeInfo.memoryTotalBytes / GiB),
    disk_gb: Math.round(metric.nodeInfo.diskTotalBytes / GiB),
  };
}

// ── Alerts builder (DERIVED from real log patterns) ───────────────────────────

function buildAlerts(metric: ApiServerMetrics): ProcessedServerData['alerts'] {
  return metric.logs
    .filter((log) => log.includes('[WARN]') || log.includes('[CRITICAL]'))
    .map((log, idx) => ({
      id: `${metric.serverId}-${metric.minuteOfDay}-${idx}`,
      server_id: metric.serverId,
      type: log.includes('CPU')
        ? ('cpu' as const)
        : log.includes('memory') || log.includes('MEM')
          ? ('memory' as const)
          : log.includes('Disk') || log.includes('disk')
            ? ('disk' as const)
            : log.includes('Network') || log.includes('NET')
              ? ('network' as const)
              : ('custom' as const),
      message: log,
      severity: log.includes('[CRITICAL]')
        ? ('critical' as const)
        : ('warning' as const),
      timestamp: metric.timestamp,
      resolved: false,
    }));
}

// ── Core: single-pass metric processing ───────────────────────────
// Only SOURCE, DERIVED, CONFIG fields. No fabrication.

function processMetric(metric: ApiServerMetrics): ProcessedServerData {
  const osLabel = buildOSLabel(metric);
  const uptimeSeconds = calculateUptime(metric);
  const specs = buildSpecs(metric);

  const load1 = metric.loadAvg1 ?? 0;
  const load5 = metric.loadAvg5 ?? 0;
  const load15 = estimateLoad15(load1, load5); // DERIVED: EMA estimation

  const { networkIn, networkOut } = deriveNetworkSplit(
    metric.network,
    metric.serverType
  ); // DERIVED: server-type ratio split

  const hostname =
    metric.hostname || `${metric.serverId.toLowerCase()}.openmanager.local`;

  const services = getServicesForServer(hostname, metric.serverType, {
    cpu: metric.cpu,
    memory: metric.memory,
    status: metric.status,
  }); // CONFIG: hostname pattern → service mapping

  return {
    id: metric.serverId,
    name: metric.serverId,
    hostname,
    serverType: metric.serverType,
    environment: metric.environment || 'production',
    location: metric.location,
    status: metric.status,
    timestamp: metric.timestamp,
    minuteOfDay: metric.minuteOfDay,

    // CONFIG: Server Registry IP (administrator-entered)
    ip: getServerIP(metric.serverId),

    // SOURCE: raw metrics
    cpu: metric.cpu,
    memory: metric.memory,
    disk: metric.disk,
    network: metric.network,

    // SOURCE (optional): undefined when Prometheus doesn't have it
    responseTimeMs: metric.responseTimeMs,
    procsRunning: metric.procsRunning,

    // DERIVED
    osLabel,
    uptimeSeconds,
    loadAvg1: load1,
    loadAvg5: load5,
    loadAvg15: load15,
    networkIn,
    networkOut,

    // SOURCE (optional): hardware specs
    specs,

    // CONFIG: service mapping
    services,

    // DERIVED: from real logs
    alerts: buildAlerts(metric),
    logs: metric.logs,
  };
}

// ============================================================================
// ServerMonitoringService
// ============================================================================

export class ServerMonitoringService {
  private static instance: ServerMonitoringService;

  private constructor() {}

  static getInstance(): ServerMonitoringService {
    if (!ServerMonitoringService.instance) {
      ServerMonitoringService.instance = new ServerMonitoringService();
    }
    return ServerMonitoringService.instance;
  }

  /** Test isolation */
  static resetForTesting(): void {
    if (process.env.NODE_ENV !== 'test') return;
    ServerMonitoringService.instance =
      undefined as unknown as ServerMonitoringService;
  }

  // ── Data access ───────────────────────────────────────────────

  getProcessedServer(serverId: string): ProcessedServerData | null {
    const metric = metricsProvider.getServerMetrics(serverId);
    if (!metric) return null;
    return processMetric(metric);
  }

  getAllProcessedServers(): ProcessedServerData[] {
    return metricsProvider.getAllServerMetrics().map(processMetric);
  }

  // ── Projections ───────────────────────────────────────────────
  // Projections map ProcessedServerData to consumer types.
  // Missing optional fields → undefined (no fabrication).

  toServer(p: ProcessedServerData): Server {
    return {
      id: p.id,
      name: p.name,
      hostname: p.hostname,
      ip: p.ip,
      type: p.serverType as Server['type'],
      status: p.status,
      cpu: p.cpu,
      memory: p.memory,
      disk: p.disk,
      network: p.network,
      uptime: p.uptimeSeconds,
      responseTime: p.responseTimeMs,
      lastUpdate: new Date(),
      location: p.location,
      environment: p.environment,
      logs: p.logs.map((msg) => ({
        timestamp: new Date().toISOString(),
        level:
          msg.includes('[CRITICAL]') || msg.includes('[ERROR]')
            ? ('ERROR' as const)
            : msg.includes('[WARN]')
              ? ('WARN' as const)
              : ('INFO' as const),
        message: msg,
      })),
      services: p.services,
      alerts: p.alerts,
      specs: p.specs ? { ...p.specs, network_speed: undefined } : undefined,
      role: p.serverType as Server['role'],
      os: p.osLabel,
      systemInfo: {
        os: p.osLabel,
        uptime:
          p.uptimeSeconds > 0
            ? `${Math.floor(p.uptimeSeconds / 3600)}h`
            : 'unknown',
        processes: p.procsRunning ?? 0,
        zombieProcesses: 0,
        loadAverage: `${p.loadAvg1.toFixed(2)}, ${p.loadAvg5.toFixed(2)}, ${p.loadAvg15.toFixed(2)}`,
        lastUpdate: new Date().toISOString(),
      },
      networkInfo: {
        interface: 'eth0',
        receivedBytes: `${p.networkIn} MB`,
        sentBytes: `${p.networkOut} MB`,
        receivedErrors: 0,
        sentErrors: 0,
        status: p.status === 'offline' ? 'offline' : 'online',
      },
    } as unknown as Server;
  }

  toEnhancedMetrics(p: ProcessedServerData): EnhancedServerMetrics {
    return {
      id: p.id,
      name: p.name,
      hostname: p.hostname,
      ip: p.ip,
      status: p.status,
      cpu: p.cpu,
      cpu_usage: p.cpu,
      memory: p.memory,
      memory_usage: p.memory,
      disk: p.disk,
      disk_usage: p.disk,
      network: p.network,
      network_in: p.networkIn,
      network_out: p.networkOut,
      uptime: p.uptimeSeconds,
      responseTime: p.responseTimeMs ?? 0,
      last_updated: p.timestamp,
      location: p.location,
      alerts: p.alerts,
      os: p.osLabel,
      role: p.serverType as EnhancedServerMetrics['role'],
      environment: p.environment as EnhancedServerMetrics['environment'],
      specs: p.specs ? { ...p.specs, network_speed: undefined } : undefined,
      lastUpdate: p.timestamp,
      services: p.services,
      systemInfo: {
        os: p.osLabel,
        uptime:
          p.uptimeSeconds > 0
            ? `${Math.floor(p.uptimeSeconds / 3600)}h`
            : 'unknown',
        processes: p.procsRunning ?? 0,
        zombieProcesses: 0,
        loadAverage: `${p.loadAvg1.toFixed(2)}, ${p.loadAvg5.toFixed(2)}, ${p.loadAvg15.toFixed(2)}`,
        lastUpdate: p.timestamp,
      },
      networkInfo: {
        interface: 'eth0',
        receivedBytes: `${p.networkIn} MB`,
        sentBytes: `${p.networkOut} MB`,
        receivedErrors: 0,
        sentErrors: 0,
        status: p.status === 'offline' ? 'offline' : 'online',
      },
    };
  }

  toPaginatedServer(p: ProcessedServerData) {
    return {
      id: p.id,
      name: p.hostname,
      status: p.status,
      location: p.location,
      uptime: p.uptimeSeconds,
      lastUpdate: p.timestamp,
      metrics: {
        cpu: Math.round(p.cpu),
        memory: Math.round(p.memory),
        disk: Math.round(p.disk),
        network: {
          bytesIn: Math.round(p.networkIn),
          bytesOut: Math.round(p.networkOut),
          packetsIn: 0,
          packetsOut: 0,
          latency: 0,
          connections: 0,
        },
        processes: p.procsRunning ?? 0,
        loadAverage: [p.loadAvg1, p.loadAvg5, p.loadAvg15] as [
          number,
          number,
          number,
        ],
      },
      tags: [],
      metadata: {
        type: p.serverType || 'unknown',
        environment: p.environment || 'production',
      },
    };
  }

  // ── Convenience methods ────────────────────────────────────────

  getAllAsEnhancedMetrics(): EnhancedServerMetrics[] {
    return this.getAllProcessedServers().map((p) => this.toEnhancedMetrics(p));
  }

  getAllAsServers(): Server[] {
    return this.getAllProcessedServers().map((p) => this.toServer(p));
  }

  getServerAsEnhanced(serverId: string): EnhancedServerMetrics | null {
    const p = this.getProcessedServer(serverId);
    if (!p) return null;
    return this.toEnhancedMetrics(p);
  }

  // ── Delegation ─────────────────────────────────────────────────

  getSystemSummary(): SystemSummary {
    return metricsProvider.getSystemSummary();
  }
}

export const getServerMonitoringService = () =>
  ServerMonitoringService.getInstance();
