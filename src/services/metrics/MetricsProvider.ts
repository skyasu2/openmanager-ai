/**
 * 🎯 MetricsProvider - 단일 데이터 소스 (Single Source of Truth)
 *
 * 역할:
 * - 현재 한국 시간(KST) 기준으로 hourly-data JSON 파일에서 메트릭 제공
 * - Prometheus 포맷 JSON → 내부 ServerMetrics 인터페이스 변환
 * - Cloud Run AI와 동일한 데이터 소스 사용 (데이터 일관성 보장)
 * - 모든 API와 컴포넌트가 이 서비스를 통해 일관된 데이터 접근
 *
 * @updated 2026-02-10 - SRP 분리 (kst-time, types, time-comparison)
 * @updated 2026-02-04 - Prometheus 포맷 전환
 * @updated 2026-01-19 - Vercel 호환성: 번들 기반 loader로 변경 (fs 제거)
 * @updated 2026-01-04 - hourly-data 통합 (AI와 데이터 동기화)
 */

import { getServerStatus as getRulesServerStatus } from '@/config/rules/loader';
import {
  FIXED_24H_DATASETS,
  type Fixed10MinMetric,
  getDataAtMinute,
} from '@/data/fixed-24h-metrics';
import {
  extractServerId,
  getHourlyData as getBundledHourlyData,
  type HourlyData,
  type PrometheusTarget,
} from '@/data/hourly-data';
import {
  getOTelHourlyData,
  getOTelResourceCatalog,
} from '@/data/otel-processed';
import { logger } from '@/lib/logging';
import type { OTelHourlyFile, OTelHourlySlot } from '@/types/otel-metrics';
import { getKSTMinuteOfDay, getKSTTimestamp } from './kst-time';
import type { ApiServerMetrics, SystemSummary } from './types';

export {
  calculateRelativeDateTime,
  getKSTDateTime,
  getKSTMinuteOfDay,
  getKSTTimestamp,
} from './kst-time';
export {
  compareServerMetrics,
  getMetricsAtRelativeTime,
} from './time-comparison';
// Re-export for backward compatibility
export type {
  ApiServerMetrics,
  ApiServerMetrics as ServerMetrics,
  SystemSummary,
  TimeComparisonResult,
} from './types';

// ============================================================================
// OTel Data Cache & Loader (Primary - 번들 기반)
// ============================================================================

let cachedOTelData: { hour: number; data: OTelHourlyFile } | null = null;

// hostname → serverId 역색인 캐시 (O(n) 순회 → O(1) lookup)
let hostnameIndex: Map<string, string> | null = null;

function getHostnameIndex(): Map<string, string> {
  if (hostnameIndex) return hostnameIndex;
  const catalog = getOTelResourceCatalog();
  hostnameIndex = new Map();
  for (const [serverId, r] of Object.entries(catalog.resources)) {
    hostnameIndex.set(r['host.name'], serverId);
  }
  return hostnameIndex;
}

// OTel→ServerMetrics 변환 캐시 (동일 hour+slotIndex 내 재변환 방지)
let cachedOTelConversion: {
  hour: number;
  slotIndex: number;
  metrics: ApiServerMetrics[];
} | null = null;

/**
 * OTel 사전 계산 데이터 로드 (Primary)
 * @description 빌드 타임에 OTel SDK로 처리된 데이터 우선 사용
 */
function loadOTelData(hour: number): OTelHourlyFile | null {
  if (cachedOTelData?.hour === hour) {
    return cachedOTelData.data;
  }

  const data = getOTelHourlyData(hour);
  if (data) {
    cachedOTelData = { hour, data };
    logger.info(
      `[MetricsProvider] OTel 데이터 로드: hour-${hour.toString().padStart(2, '0')} (${data.slots.length}개 slot)`
    );
    return data;
  }

  return null;
}

/**
 * OTel slot → ApiServerMetrics[] 변환
 * OTel 메트릭 이름에서 값을 추출하여 기존 API 인터페이스로 변환
 */
function otelSlotToServerMetrics(
  slot: OTelHourlySlot,
  timestamp: string,
  minuteOfDay: number
): ApiServerMetrics[] {
  const catalog = getOTelResourceCatalog();
  const index = getHostnameIndex();
  const serverMap = new Map<string, ApiServerMetrics>();

  // OTel metric data points에서 서버별 메트릭 수집
  for (const metric of slot.metrics) {
    for (const dp of metric.dataPoints) {
      const hostname = dp.attributes['host.name'];
      // hostname → serverId 찾기 (역색인 O(1))
      const serverId = index.get(hostname);
      if (!serverId) continue;

      if (!serverMap.has(serverId)) {
        const resource = catalog.resources[serverId];
        serverMap.set(serverId, {
          serverId,
          serverType: resource?.['host.type'] ?? 'unknown',
          location: resource?.['cloud.availability_zone'] ?? 'unknown',
          timestamp,
          minuteOfDay,
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 0,
          logs: [],
          status: 'online',
          hostname: resource?.['host.name'],
          environment: resource?.['deployment.environment'],
          os: resource?.['os.type'],
          otelResource: resource,
        });
      }

      const server = serverMap.get(serverId)!;

      // OTel ratio (0-1) → percent (0-100) 역변환
      switch (metric.name) {
        case 'system.cpu.utilization':
          server.cpu = Math.round(dp.asDouble * 100 * 10) / 10;
          break;
        case 'system.memory.utilization':
          server.memory = Math.round(dp.asDouble * 100 * 10) / 10;
          break;
        case 'system.filesystem.utilization':
          server.disk = Math.round(dp.asDouble * 100 * 10) / 10;
          break;
        case 'system.network.io':
          server.network = dp.asDouble;
          break;
        case 'system.status':
          if (dp.asDouble === 0) server.status = 'offline';
          break;
        case 'system.cpu.load_average.1m':
          server.loadAvg1 = dp.asDouble;
          break;
        case 'system.cpu.load_average.5m':
          server.loadAvg5 = dp.asDouble;
          break;
        case 'http.server.request.duration':
          server.responseTimeMs = dp.asDouble * 1000; // s → ms
          break;
        case 'system.processes.count':
          server.procsRunning = dp.asDouble;
          break;
      }
    }
  }

  // 로그 매핑
  for (const log of slot.logs) {
    const server = serverMap.get(log.resource);
    if (server) {
      server.logs.push(`[${log.severityText}] ${log.body}`);
      if (!server.structuredLogs) server.structuredLogs = [];
      server.structuredLogs.push(log);
    }
  }

  // 상태 결정 (offline이 아닌 경우 메트릭 기반 판별)
  for (const server of serverMap.values()) {
    if (server.status !== 'offline') {
      server.status = determineStatus(
        server.cpu,
        server.memory,
        server.disk,
        server.network
      );
    }
  }

  return Array.from(serverMap.values());
}

// ============================================================================
// Hourly Data Cache & Loader (Fallback - 번들 기반)
// ============================================================================

let cachedHourlyData: { hour: number; data: HourlyData } | null = null;

/**
 * hourly-data 로드 (번들 기반, Fallback)
 * @description OTel 데이터 없을 때 원본 Prometheus 데이터 사용
 */
function loadHourlyData(hour: number): HourlyData | null {
  if (cachedHourlyData?.hour === hour) {
    return cachedHourlyData.data;
  }

  const data = getBundledHourlyData(hour);
  if (data) {
    cachedHourlyData = { hour, data };
    const targetCount = Object.keys(data.dataPoints[0]?.targets || {}).length;
    logger.info(
      `[MetricsProvider] hourly-data fallback 로드: hour-${hour.toString().padStart(2, '0')} (${targetCount}개 target)`
    );
    return data;
  }

  logger.warn(`[MetricsProvider] hourly-data 없음: hour-${hour}`);
  return null;
}

// ============================================================================
// Prometheus → ServerMetrics 변환
// ============================================================================

/**
 * PrometheusTarget → ServerMetrics 변환
 */
function targetToServerMetrics(
  target: PrometheusTarget,
  timestamp: string,
  minuteOfDay: number
): ApiServerMetrics {
  const serverId = extractServerId(target.instance);
  const cpu = target.metrics.node_cpu_usage_percent;
  const memory = target.metrics.node_memory_usage_percent;
  const disk = target.metrics.node_filesystem_usage_percent;
  const network = target.metrics.node_network_transmit_bytes_rate;

  const metricsStatus = determineStatus(cpu, memory, disk, network);
  let status: ApiServerMetrics['status'];
  if (target.metrics.up === 0) {
    status = metricsStatus === 'critical' ? 'critical' : 'offline';
    if (metricsStatus === 'critical' || metricsStatus === 'warning') {
      logger.warn(
        `[MetricsProvider] ${serverId}: up=0 but metrics indicate ${metricsStatus} (cpu=${cpu}%, mem=${memory}%)`
      );
    }
  } else {
    status = metricsStatus;
  }

  return {
    serverId,
    serverType: target.labels.server_type,
    location: target.labels.datacenter,
    timestamp,
    minuteOfDay,
    cpu,
    memory,
    disk,
    network,
    logs: target.logs || [],
    status,
    nodeInfo: target.nodeInfo
      ? {
          cpuCores: target.nodeInfo.cpu_cores,
          memoryTotalBytes: target.nodeInfo.memory_total_bytes,
          diskTotalBytes: target.nodeInfo.disk_total_bytes,
        }
      : undefined,
    hostname: target.labels.hostname,
    environment: target.labels.environment,
    os: target.labels.os,
    osVersion: target.labels.os_version,
    loadAvg1: target.metrics.node_load1,
    loadAvg5: target.metrics.node_load5,
    bootTimeSeconds: target.metrics.node_boot_time_seconds,
    procsRunning: target.metrics.node_procs_running,
    responseTimeMs: target.metrics.node_http_request_duration_milliseconds,
  };
}

/**
 * 메트릭 값 기반 서버 상태 판별
 * @see /src/config/rules/system-rules.json (Single Source of Truth)
 */
function determineStatus(
  cpu: number,
  memory: number,
  disk: number,
  network: number
): 'online' | 'warning' | 'critical' | 'offline' {
  return getRulesServerStatus({ cpu, memory, disk, network });
}

// ============================================================================
// MetricsProvider Class (Singleton)
// ============================================================================

/**
 * 🎯 MetricsProvider 클래스
 * Singleton 패턴으로 구현하여 일관된 데이터 제공
 */
export class MetricsProvider {
  private static instance: MetricsProvider;

  private constructor() {}

  public static getInstance(): MetricsProvider {
    if (!MetricsProvider.instance) {
      MetricsProvider.instance = new MetricsProvider();
    }
    return MetricsProvider.instance;
  }

  /** 테스트 격리용: 싱글톤 인스턴스 및 캐시 리셋 */
  static resetForTesting(): void {
    if (process.env.NODE_ENV !== 'test') return;
    // @ts-expect-error -- 테스트 격리를 위한 의도적 리셋
    MetricsProvider.instance = undefined;
    cachedHourlyData = null;
    cachedOTelData = null;
    hostnameIndex = null;
    cachedOTelConversion = null;
  }

  /**
   * 현재 시간 기준 단일 서버 메트릭 조회
   * Priority: OTel → Prometheus hourly-data → fixed-24h fallback
   */
  public getServerMetrics(serverId: string): ApiServerMetrics | null {
    const minuteOfDay = getKSTMinuteOfDay();
    const timestamp = getKSTTimestamp();
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const slotIndex = Math.floor(minute / 10);

    // 1. OTel 데이터 (Primary) — 변환 캐시 사용
    const otelData = loadOTelData(hour);
    if (otelData) {
      const slot = otelData.slots[slotIndex];
      if (slot) {
        let allMetrics: ApiServerMetrics[];
        if (
          cachedOTelConversion?.hour === hour &&
          cachedOTelConversion.slotIndex === slotIndex
        ) {
          allMetrics = cachedOTelConversion.metrics;
        } else {
          allMetrics = otelSlotToServerMetrics(slot, timestamp, minuteOfDay);
          if (allMetrics.length > 0) {
            cachedOTelConversion = { hour, slotIndex, metrics: allMetrics };
          }
        }
        const found = allMetrics.find((m) => m.serverId === serverId);
        if (found) {
          return { ...found, timestamp, minuteOfDay };
        }
      }
    }

    // 2. Prometheus hourly-data (Fallback)
    const hourlyData = loadHourlyData(hour);
    if (hourlyData) {
      const dataPoint = hourlyData.dataPoints[slotIndex];

      if (!dataPoint) {
        logger.warn(
          `[MetricsProvider] slot ${slotIndex} not found for hour-${hour}, using fallback`
        );
      }

      if (dataPoint?.targets) {
        const instanceKey = `${serverId}:9100`;
        const target = dataPoint.targets[instanceKey];
        if (target) {
          return targetToServerMetrics(target, timestamp, minuteOfDay);
        }
      }
    }

    // 3. Fixed data (Last resort)
    const dataset = FIXED_24H_DATASETS.find((d) => d.serverId === serverId);
    if (!dataset) return null;

    const dataPoint = getDataAtMinute(dataset, minuteOfDay);
    if (!dataPoint) return null;

    return {
      serverId: dataset.serverId,
      serverType: dataset.serverType,
      location: dataset.location,
      timestamp,
      minuteOfDay,
      cpu: dataPoint.cpu,
      memory: dataPoint.memory,
      disk: dataPoint.disk,
      network: dataPoint.network,
      logs: dataPoint.logs,
      status: determineStatus(
        dataPoint.cpu,
        dataPoint.memory,
        dataPoint.disk,
        dataPoint.network
      ),
    };
  }

  /**
   * 현재 시간 기준 모든 서버 메트릭 조회
   * Priority: OTel → Prometheus hourly-data → fixed-24h fallback
   */
  public getAllServerMetrics(): ApiServerMetrics[] {
    const minuteOfDay = getKSTMinuteOfDay();
    const timestamp = getKSTTimestamp();
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const slotIndex = Math.floor(minute / 10);

    // 1. OTel 데이터 (Primary) — 변환 캐시 사용
    const otelData = loadOTelData(hour);
    if (otelData) {
      const slot = otelData.slots[slotIndex];
      if (slot) {
        if (
          cachedOTelConversion?.hour === hour &&
          cachedOTelConversion.slotIndex === slotIndex
        ) {
          return cachedOTelConversion.metrics.map((m) => ({
            ...m,
            timestamp,
            minuteOfDay,
          }));
        }
        const metrics = otelSlotToServerMetrics(slot, timestamp, minuteOfDay);
        if (metrics.length > 0) {
          cachedOTelConversion = { hour, slotIndex, metrics };
          return metrics;
        }
      }
    }

    // 2. Prometheus hourly-data (Fallback)
    const hourlyData = loadHourlyData(hour);
    if (hourlyData) {
      const dataPoint = hourlyData.dataPoints[slotIndex];

      if (!dataPoint) {
        logger.warn(
          `[MetricsProvider] slot ${slotIndex} not found for hour-${hour} in getAllServerMetrics, using fallback`
        );
      }

      if (dataPoint?.targets) {
        return Object.values(dataPoint.targets).map((target) =>
          targetToServerMetrics(target, timestamp, minuteOfDay)
        );
      }
    }

    // 3. Fixed data (Last resort)
    logger.warn(
      '[MetricsProvider] hourly-data 로드 실패, fallback to fixed data'
    );
    return FIXED_24H_DATASETS.map((dataset) => {
      const dataPoint = getDataAtMinute(dataset, minuteOfDay);
      if (!dataPoint) {
        return {
          serverId: dataset.serverId,
          serverType: dataset.serverType,
          location: dataset.location,
          timestamp,
          minuteOfDay,
          cpu: dataset.baseline.cpu,
          memory: dataset.baseline.memory,
          disk: dataset.baseline.disk,
          network: dataset.baseline.network,
          logs: [],
          status: 'online' as const,
        };
      }

      return {
        serverId: dataset.serverId,
        serverType: dataset.serverType,
        location: dataset.location,
        timestamp,
        minuteOfDay,
        cpu: dataPoint.cpu,
        memory: dataPoint.memory,
        disk: dataPoint.disk,
        network: dataPoint.network,
        logs: dataPoint.logs,
        status: determineStatus(
          dataPoint.cpu,
          dataPoint.memory,
          dataPoint.disk,
          dataPoint.network
        ),
      };
    });
  }

  /**
   * 시스템 전체 요약 정보
   */
  public getSystemSummary(): SystemSummary {
    const minuteOfDay = getKSTMinuteOfDay();
    const allMetrics = this.getAllServerMetrics();

    const statusCounts = allMetrics.reduce(
      (acc, m) => {
        acc[m.status]++;
        return acc;
      },
      { online: 0, warning: 0, critical: 0, offline: 0 }
    );

    // offline 서버(metrics=0)를 평균 계산에서 제외하여 왜곡 방지
    const onlineMetrics = allMetrics.filter((m) => m.status !== 'offline');
    const count = onlineMetrics.length || 1;
    const avgCpu =
      Math.round(
        (onlineMetrics.reduce((sum, m) => sum + m.cpu, 0) / count) * 10
      ) / 10;
    const avgMemory =
      Math.round(
        (onlineMetrics.reduce((sum, m) => sum + m.memory, 0) / count) * 10
      ) / 10;
    const avgDisk =
      Math.round(
        (onlineMetrics.reduce((sum, m) => sum + m.disk, 0) / count) * 10
      ) / 10;
    const avgNetwork =
      Math.round(
        (onlineMetrics.reduce((sum, m) => sum + m.network, 0) / count) * 10
      ) / 10;

    return {
      timestamp: getKSTTimestamp(),
      minuteOfDay,
      totalServers: allMetrics.length,
      onlineServers: statusCounts.online,
      warningServers: statusCounts.warning,
      criticalServers: statusCounts.critical,
      offlineServers: statusCounts.offline,
      averageCpu: avgCpu,
      averageMemory: avgMemory,
      averageDisk: avgDisk,
      averageNetwork: avgNetwork,
    };
  }

  /**
   * 경고/위험 상태 서버만 반환 (AI 컨텍스트 주입용)
   */
  public getAlertServers(): Array<{
    serverId: string;
    cpu: number;
    memory: number;
    disk: number;
    status: string;
  }> {
    const allMetrics = this.getAllServerMetrics();
    return allMetrics
      .filter(
        (s) =>
          s.status === 'warning' ||
          s.status === 'critical' ||
          s.status === 'offline'
      )
      .map((s) => ({
        serverId: s.serverId,
        cpu: s.cpu,
        memory: s.memory,
        disk: s.disk,
        status: s.status,
      }));
  }

  /**
   * 특정 시간대 메트릭 조회 (히스토리용)
   */
  public getMetricsAtTime(
    serverId: string,
    minuteOfDay: number
  ): Fixed10MinMetric | null {
    const dataset = FIXED_24H_DATASETS.find((d) => d.serverId === serverId);
    if (!dataset) return null;

    return getDataAtMinute(dataset, minuteOfDay) || null;
  }

  /**
   * 서버 목록 조회
   */
  public getServerList(): Array<{
    serverId: string;
    serverType: string;
    location: string;
  }> {
    return FIXED_24H_DATASETS.map((d) => ({
      serverId: d.serverId,
      serverType: d.serverType,
      location: d.location,
    }));
  }

  /**
   * 디버그용: 현재 시간 정보
   */
  public getTimeInfo(): {
    kstTime: string;
    minuteOfDay: number;
    slotIndex: number;
    humanReadable: string;
  } {
    const minuteOfDay = getKSTMinuteOfDay();
    const hours = Math.floor(minuteOfDay / 60);
    const minutes = minuteOfDay % 60;

    return {
      kstTime: getKSTTimestamp(),
      minuteOfDay,
      slotIndex: minuteOfDay / 10,
      humanReadable: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} KST`,
    };
  }
}

// 편의를 위한 싱글톤 인스턴스 export
export const metricsProvider = MetricsProvider.getInstance();
