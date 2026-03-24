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
import { OTEL_METRIC } from '@/constants/otel-metric-names';
import {
  getOTelHourlyData,
  getOTelResourceCatalog,
  getOTelTimeSeries,
} from '@/data/otel-data';
import { logger } from '@/lib/logging';
import { getKSTMinuteOfDay } from '@/services/metrics/kst-time';
import {
  deriveNetworkErrors,
  deriveNetworkSplit,
  deriveZombieProcesses,
  estimateLoad15,
} from '@/services/server-data/server-data-transformer';
import type { EnhancedServerMetrics } from '@/services/server-data/server-data-types';
import type { OTelHourlySlot, OTelResourceCatalog } from '@/types/otel-metrics';
import type { MetricsHistory } from '@/types/server';
import { formatBytes } from '@/utils/utils-functions';

import {
  normalizeNetworkUtilizationPercent,
  normalizeUtilizationPercent,
  percentToBytesPerSecond,
} from './metric-normalization';
import { determineStatus } from './metric-transformers';

// ============================================================================
// Default Hardware Spec Constants
// ============================================================================

/** Default CPU core count when resource catalog lacks host.cpu.count */
const DEFAULT_CPU_CORES = 8;

/** Default memory size in bytes (16 GB) when resource catalog lacks host.memory.size */
const DEFAULT_MEMORY_BYTES = 16 * 1024 * 1024 * 1024;

/** Default disk size in bytes (200 GB) when resource catalog lacks host.disk.size */
const DEFAULT_DISK_BYTES = 200 * 1024 * 1024 * 1024;

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
// Fallback Helper
// ============================================================================

function fallback(
  value: number | undefined,
  defaultValue: number,
  label: string,
  serverId: string
): number {
  if (value !== undefined && !Number.isNaN(value)) return value;
  if (process.env.NODE_ENV === 'development') {
    logger.warn(
      `[otel-direct] Fallback: ${label}=${String(defaultValue)} for ${serverId}`
    );
  }
  return defaultValue;
}

function formatEstimatedNetworkRate(utilizationPercent: number): string {
  return `${formatBytes(percentToBytesPerSecond(utilizationPercent))}/s`;
}

// ============================================================================
// Metric Name → Handler Map
// ============================================================================

const METRIC_HANDLERS = new Map<
  string,
  (values: OTelMetricValues, value: number, unit?: string) => void
>([
  [
    OTEL_METRIC.CPU,
    (v, val, unit) => {
      v.cpu = normalizeUtilizationPercent(val, unit);
    },
  ],
  [
    OTEL_METRIC.MEMORY,
    (v, val, unit) => {
      v.memory = normalizeUtilizationPercent(val, unit);
    },
  ],
  [
    OTEL_METRIC.DISK,
    (v, val, unit) => {
      v.disk = normalizeUtilizationPercent(val, unit);
    },
  ],
  [
    OTEL_METRIC.NETWORK,
    (v, val, unit) => {
      v.network = normalizeNetworkUtilizationPercent(val, unit);
    },
  ],
  [
    OTEL_METRIC.LOAD_1M,
    (v, val) => {
      v.load1 = val;
    },
  ],
  [
    OTEL_METRIC.LOAD_1M_SEMCONV,
    (v, val) => {
      v.load1 = val;
    },
  ],
  [
    OTEL_METRIC.LOAD_5M,
    (v, val) => {
      v.load5 = val;
    },
  ],
  [
    OTEL_METRIC.LOAD_5M_SEMCONV,
    (v, val) => {
      v.load5 = val;
    },
  ],
  [
    OTEL_METRIC.PROCESSES,
    (v, val) => {
      v.processes = val;
    },
  ],
  [
    OTEL_METRIC.UPTIME,
    (v, val) => {
      v.uptime = val;
    },
  ],
  [
    OTEL_METRIC.HTTP_DURATION,
    (v, val) => {
      v.responseTimeMs = val * 1000;
    },
  ],
]);

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
    const handler = METRIC_HANDLERS.get(metric.name);
    if (!handler) continue;

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
      handler(values, dp.asDouble, metric.unit);
    }
  }

  // 2. EnhancedServerMetrics로 변환
  const results: EnhancedServerMetrics[] = [];

  for (const [serverId, values] of serverMetrics) {
    const resource = catalog.resources[serverId];
    const hostname = resource?.['host.name'] ?? `${serverId}.openmanager.kr`;
    const serverType = resource?.['server.role'] ?? 'unknown';

    // OTel mixed unit(1/By/s/%) → normalized percent(0-100)
    const cpu = values.cpu;
    const memory = values.memory;
    const disk = values.disk;
    const network = values.network;

    // 오프라인 판별: cpu+memory+disk 모두 0이면 오프라인 (Pipeline A와 통일)
    const status =
      cpu === 0 && memory === 0 && disk === 0
        ? ('offline' as const)
        : determineStatus(cpu, memory, disk, network);

    const load1 = values.load1;
    const load5 = values.load5;
    const load15 = estimateLoad15(load1, load5);
    const { networkIn, networkOut } = deriveNetworkSplit(network, serverType);
    const processes =
      fallback(values.processes, 120, 'processes', serverId) || 120;
    const zombieProcesses = deriveZombieProcesses(serverId, processes);
    const { receivedErrors, sentErrors } = deriveNetworkErrors(
      network,
      serverId
    );
    const uptimeSeconds =
      fallback(values.uptime, 2592000, 'uptime', serverId) || 2592000;
    const responseTime = fallback(
      values.responseTimeMs,
      150,
      'responseTime',
      serverId
    );

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
      responseTime,
      last_updated: timestamp,
      location: resource?.['cloud.availability_zone'] ?? 'unknown',
      alerts: [],
      ip: getServerIP(serverId) ?? '',
      os: resource?.['os.type'] ?? '',
      type: serverType,
      role: mapTypeToRole(serverType),
      environment: resource?.['deployment.environment.name'] ?? '',
      provider: 'OTel-Direct',
      specs: {
        cpu_cores: resource?.['host.cpu.count'] ?? DEFAULT_CPU_CORES,
        memory_gb: Math.round(
          (resource?.['host.memory.size'] ?? DEFAULT_MEMORY_BYTES) /
            (1024 * 1024 * 1024)
        ),
        disk_gb: Math.round(
          (resource?.['host.disk.size'] ?? DEFAULT_DISK_BYTES) /
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
        processes,
        zombieProcesses,
        loadAverage: `${load1.toFixed(2)}, ${load5.toFixed(2)}, ${load15.toFixed(2)}`,
        lastUpdate: timestamp,
      },
      networkInfo: {
        interface: 'eth0',
        receivedBytes: formatEstimatedNetworkRate(networkIn),
        sentBytes: formatEstimatedNetworkRate(networkOut),
        receivedUtilizationPercent: networkIn,
        sentUtilizationPercent: networkOut,
        receivedErrors,
        sentErrors,
        status,
      },
    });
  }

  // 3. Attach structured logs from slot to matching servers
  for (const log of slot.logs) {
    const serverId = log.resource;
    const server = results.find((s) => s.id === serverId);
    if (server) {
      if (!server.structuredLogs) server.structuredLogs = [];
      server.structuredLogs.push(log);
    }
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
export async function otelTimeSeriesToHistory(
  serverId: string,
  rangeHours: number = 24
): Promise<MetricsHistory[]> {
  const ts = await getOTelTimeSeries();
  if (!ts) return [];
  const serverIdx = ts.serverIds.indexOf(serverId);
  if (serverIdx === -1) return [];

  const cpuSeries = ts.metrics[OTEL_METRIC.CPU]?.[serverIdx];
  const memorySeries = ts.metrics[OTEL_METRIC.MEMORY]?.[serverIdx];
  const diskSeries = ts.metrics[OTEL_METRIC.DISK]?.[serverIdx];
  const networkSeries = ts.metrics[OTEL_METRIC.NETWORK]?.[serverIdx];
  const responseSeries = ts.metrics[OTEL_METRIC.HTTP_DURATION]?.[serverIdx];

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
      cpu: normalizeUtilizationPercent(cpuSeries[i] ?? 0),
      memory: normalizeUtilizationPercent(memorySeries?.[i] ?? 0),
      disk: normalizeUtilizationPercent(diskSeries?.[i] ?? 0),
      network: normalizeNetworkUtilizationPercent(networkSeries?.[i] ?? 0),
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
export async function loadCurrentOTelServers(): Promise<{
  servers: EnhancedServerMetrics[];
  hour: number;
  slotIndex: number;
  globalSlotIndex: number;
  minuteOfDay: number;
  dataSource: {
    scopeName: string;
    scopeVersion: string;
    catalogGeneratedAt: string | null;
    hour: number;
  } | null;
}> {
  const minuteOfDay = getKSTMinuteOfDay();
  const hour = Math.floor(minuteOfDay / 60);
  // 시간 내 슬롯 (0-5): hourly JSON slots[] 배열 인덱싱용
  const slotIndex = Math.floor((minuteOfDay % 60) / 10);
  // 전역 슬롯 (0-143): AI 엔진과 동일 스케일, parity 검증 및 표시용
  const globalSlotIndex = Math.floor(minuteOfDay / 10);

  const hourlyData = await getOTelHourlyData(hour);
  if (!hourlyData) {
    return {
      servers: [],
      hour,
      slotIndex,
      globalSlotIndex,
      minuteOfDay,
      dataSource: null,
    };
  }

  const catalog = await getOTelResourceCatalog();
  const dataSource = {
    scopeName: hourlyData.scope.name,
    scopeVersion: hourlyData.scope.version,
    catalogGeneratedAt: catalog?.generatedAt ?? null,
    hour: hourlyData.hour,
  };

  const slot =
    hourlyData.slots[slotIndex] ??
    hourlyData.slots[hourlyData.slots.length - 1];
  if (!slot) {
    return {
      servers: [],
      hour,
      slotIndex,
      globalSlotIndex,
      minuteOfDay,
      dataSource,
    };
  }

  if (!catalog) {
    return {
      servers: [],
      hour,
      slotIndex,
      globalSlotIndex,
      minuteOfDay,
      dataSource,
    };
  }
  const timestamp = new Date().toISOString();
  const servers = otelSlotToServers(slot, catalog, timestamp);

  return { servers, hour, slotIndex, globalSlotIndex, minuteOfDay, dataSource };
}

// ============================================================================
// Internal Helpers
// ============================================================================

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
