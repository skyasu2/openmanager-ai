/**
 * OTel Direct Transform — OTel processed data → EnhancedServerMetrics
 *
 * 기존 5단계 파이프라인(OTel→OTLP→ApiServerMetrics→RawServerData→EnhancedServerMetrics)을
 * 단일 변환으로 대체. 프론트엔드가 OTel 데이터를 직접 소비.
 *
 * @created 2026-02-15
 */

import { getServerIP } from '@/config/server-registry';
import { getServicesForServer } from '@/config/server-services-map';
import {
  getOTelHourlyData,
  getOTelResourceCatalog,
  getOTelTimeSeries,
} from '@/data/otel-processed';
import { getKSTMinuteOfDay } from '@/services/metrics/kst-time';
import {
  deriveNetworkErrors,
  deriveNetworkSplit,
  deriveZombieProcesses,
  estimateLoad15,
} from '@/services/server-data/server-data-transformer';
import type {
  OTelHourlySlot,
  OTelResourceAttributes,
  OTelResourceCatalog,
} from '@/types/otel-metrics';
import type { EnhancedServerMetrics } from '@/services/server-data/server-data-types';
import type { MetricsHistory } from '@/types/server';

import { determineStatus } from './metric-transformers';

// ============================================================================
// Types
// ============================================================================

type OTelMetricValues = {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  load1: number;
  load5: number;
  processes: number;
  uptime: number;
  responseTimeMs: number;
};

// ============================================================================
// Core: Slot → EnhancedServerMetrics[]
// ============================================================================

/**
 * OTel hourly slot을 EnhancedServerMetrics 배열로 변환
 *
 * @param slot - OTel hourly slot (metrics + logs)
 * @param catalog - OTel resource catalog (서버 메타데이터)
 * @param timestamp - ISO 8601 타임스탬프
 */
export function otelSlotToServers(
  slot: OTelHourlySlot,
  catalog: OTelResourceCatalog,
  timestamp: string
): EnhancedServerMetrics[] {
  // 1. 서버별 메트릭 값 수집
  const serverMetrics = new Map<string, OTelMetricValues>();

  for (const metric of slot.metrics) {
    for (const dp of metric.dataPoints) {
      const hostname = dp.attributes['host.name'];
      if (!hostname) continue;

      const serverId = hostname.split('.')[0];
      if (!serverId) continue;

      if (!serverMetrics.has(serverId)) {
        serverMetrics.set(serverId, {
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 0,
          load1: 0,
          load5: 0,
          processes: 0,
          uptime: 0,
          responseTimeMs: 0,
        });
      }

      const values = serverMetrics.get(serverId)!;
      applyMetricValue(values, metric.name, dp.asDouble);
    }
  }

  // 2. EnhancedServerMetrics로 변환
  const results: EnhancedServerMetrics[] = [];

  for (const [serverId, values] of serverMetrics) {
    const resource = catalog.resources[serverId];
    const hostname = resource?.['host.name'] ?? `${serverId}.openmanager.kr`;
    const serverType = resource?.['host.type'] ?? 'unknown';

    // OTel ratio(0-1) → percent(0-100)
    const cpu = Math.round(values.cpu * 100 * 10) / 10;
    const memory = Math.round(values.memory * 100 * 10) / 10;
    const disk = Math.round(values.disk * 100 * 10) / 10;
    const network = values.network;

    // 오프라인 판별: cpu+memory+disk 모두 0이면 offline
    const status =
      cpu === 0 && memory === 0 && disk === 0
        ? ('offline' as const)
        : determineStatus(cpu, memory, disk, network);

    const load1 = values.load1;
    const load5 = values.load5;
    const load15 = estimateLoad15(load1, load5);
    const { networkIn, networkOut } = deriveNetworkSplit(network, serverType);
    const zombieProcesses = deriveZombieProcesses(
      serverId,
      values.processes || 120
    );
    const { receivedErrors, sentErrors } = deriveNetworkErrors(
      network,
      serverId
    );
    const uptimeSeconds = values.uptime || 2592000;

    results.push({
      id: serverId,
      name: hostname.replace('.openmanager.kr', ''),
      hostname,
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
      uptime: uptimeSeconds,
      responseTime: values.responseTimeMs || 150,
      last_updated: timestamp,
      location: resource?.['cloud.availability_zone'] ?? 'unknown',
      alerts: [],
      ip: getServerIP(serverId) ?? '',
      os: resource?.['os.type'] ?? '',
      type: serverType,
      role: mapTypeToRole(serverType),
      environment: resource?.['deployment.environment'] ?? '',
      provider: 'OTel-Direct',
      specs: {
        cpu_cores:
          (resource as Partial<OTelResourceAttributes>)?.['host.cpu.count'] ??
          8,
        memory_gb: Math.round(
          ((resource as Partial<OTelResourceAttributes>)?.[
            'host.memory.size'
          ] ?? 16 * 1024 * 1024 * 1024) /
            (1024 * 1024 * 1024)
        ),
        disk_gb: Math.round(
          ((resource as Partial<OTelResourceAttributes>)?.['host.disk.size'] ??
            200 * 1024 * 1024 * 1024) /
            (1024 * 1024 * 1024)
        ),
        network_speed: '1Gbps',
      },
      lastUpdate: timestamp,
      services: getServicesForServer(hostname, serverType, {
        cpu,
        memory,
        status,
      }),
      systemInfo: {
        os: resource?.['os.description'] ?? resource?.['os.type'] ?? '',
        uptime: `${Math.floor(uptimeSeconds / 3600)}h`,
        processes: values.processes || 120,
        zombieProcesses,
        loadAverage: `${load1.toFixed(2)}, ${load5.toFixed(2)}, ${load15.toFixed(2)}`,
        lastUpdate: timestamp,
      },
      networkInfo: {
        interface: 'eth0',
        receivedBytes: `${networkIn} MB`,
        sentBytes: `${networkOut} MB`,
        receivedErrors,
        sentErrors,
        status,
      },
    });
  }

  return results;
}

// ============================================================================
// TimeSeries → MetricsHistory[]
// ============================================================================

/**
 * OTel timeseries 데이터를 특정 서버의 MetricsHistory 배열로 변환
 *
 * @param serverId - 서버 ID
 * @param rangeHours - 히스토리 범위 (기본 24시간)
 */
export function otelTimeSeriesToHistory(
  serverId: string,
  rangeHours: number = 24
): MetricsHistory[] {
  const ts = getOTelTimeSeries();
  const serverIdx = ts.serverIds.indexOf(serverId);
  if (serverIdx === -1) return [];

  const cpuSeries = ts.metrics['system.cpu.utilization']?.[serverIdx];
  const memorySeries = ts.metrics['system.memory.utilization']?.[serverIdx];
  const diskSeries = ts.metrics['system.filesystem.utilization']?.[serverIdx];
  const networkSeries = ts.metrics['system.network.io']?.[serverIdx];
  const responseSeries =
    ts.metrics['http.server.request.duration']?.[serverIdx];

  if (!cpuSeries) return [];

  // rangeHours에 따라 최근 데이터만 slice
  const totalPoints = ts.timestamps.length;
  const pointsPerHour = 6; // 10분 간격
  const pointsNeeded = Math.min(totalPoints, rangeHours * pointsPerHour);
  const startIdx = totalPoints - pointsNeeded;

  const history: MetricsHistory[] = [];

  for (let i = startIdx; i < totalPoints; i++) {
    const epochSec = ts.timestamps[i];
    if (epochSec === undefined) continue;

    history.push({
      timestamp: new Date(epochSec * 1000).toISOString(),
      cpu: Math.round((cpuSeries[i] ?? 0) * 100 * 10) / 10,
      memory: Math.round((memorySeries?.[i] ?? 0) * 100 * 10) / 10,
      disk: Math.round((diskSeries?.[i] ?? 0) * 100 * 10) / 10,
      network: Math.round(networkSeries?.[i] ?? 0),
      responseTime: Math.round((responseSeries?.[i] ?? 0) * 1000), // s → ms
      connections: 0,
    });
  }

  return history;
}

// ============================================================================
// Convenience: 현재 시간 기준 전체 대시보드 데이터 로드
// ============================================================================

/**
 * 현재 KST 시간 기준으로 OTel 데이터를 로드하여 서버 목록 반환
 */
export function loadCurrentOTelServers(): {
  servers: EnhancedServerMetrics[];
  hour: number;
  slotIndex: number;
  minuteOfDay: number;
} {
  const minuteOfDay = getKSTMinuteOfDay();
  const hour = Math.floor(minuteOfDay / 60);
  const slotIndex = Math.floor((minuteOfDay % 60) / 10);

  const hourlyData = getOTelHourlyData(hour);
  if (!hourlyData) {
    return { servers: [], hour, slotIndex, minuteOfDay };
  }

  const slot =
    hourlyData.slots[slotIndex] ??
    hourlyData.slots[hourlyData.slots.length - 1];
  if (!slot) {
    return { servers: [], hour, slotIndex, minuteOfDay };
  }

  const catalog = getOTelResourceCatalog();
  const timestamp = new Date().toISOString();
  const servers = otelSlotToServers(slot, catalog, timestamp);

  return { servers, hour, slotIndex, minuteOfDay };
}

// ============================================================================
// Internal Helpers
// ============================================================================

function applyMetricValue(
  values: OTelMetricValues,
  metricName: string,
  value: number
): void {
  switch (metricName) {
    case 'system.cpu.utilization':
      values.cpu = value;
      break;
    case 'system.memory.utilization':
      values.memory = value;
      break;
    case 'system.filesystem.utilization':
      values.disk = value;
      break;
    case 'system.network.io':
      values.network = value;
      break;
    case 'system.cpu.load_average.1m':
      values.load1 = value;
      break;
    case 'system.cpu.load_average.5m':
      values.load5 = value;
      break;
    case 'system.process.count':
      values.processes = value;
      break;
    case 'system.uptime':
      values.uptime = value;
      break;
    case 'http.server.request.duration':
      values.responseTimeMs = value * 1000; // s → ms
      break;
  }
}

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
