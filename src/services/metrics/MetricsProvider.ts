/**
 * 🎯 MetricsProvider - 단일 데이터 소스 (Single Source of Truth)
 *
 * 역할:
 * - 현재 한국 시간(KST) 기준으로 hourly-data JSON 파일에서 메트릭 제공
 * - Prometheus 포맷 JSON → 내부 ServerMetrics 인터페이스 변환
 * - Cloud Run AI와 동일한 데이터 소스 사용 (데이터 일관성 보장)
 * - 모든 API와 컴포넌트가 이 서비스를 통해 일관된 데이터 접근
 *
 * @updated 2026-02-12 - OTLP Standard Format 적용
 * @updated 2026-02-10 - SRP 분리 (kst-time, types, time-comparison)
 * @updated 2026-02-04 - Prometheus 포맷 전환
 * @updated 2026-01-19 - Vercel 호환성: 번들 기반 loader로 변경 (fs 제거)
 * @updated 2026-01-04 - hourly-data 통합 (AI와 데이터 동기화)
 */

import { getServerStatus as getRulesServerStatus } from '@/config/rules/loader';
import {
  extractServerId,
  getHourlyData as getBundledHourlyData,
  type HourlyData,
  type PrometheusTarget,
} from '@/data/hourly-data';
import { getOTelHourlyData } from '@/data/otel-metrics';
import { logger } from '@/lib/logging';
import type { OTelResourceAttributes } from '@/types/otel-metrics';
import type { ExportMetricsServiceRequest } from '@/types/otel-standard';
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

let cachedOTelData: { hour: number; data: ExportMetricsServiceRequest } | null =
  null;

// OTel→ServerMetrics 변환 캐시 (동일 hour+minute 내 재변환 방지)
let cachedOTelConversion: {
  hour: number;
  minute: number;
  metrics: ApiServerMetrics[];
} | null = null;

/**
 * OTel 사전 계산 데이터 로드 (Primary)
 * @description 빌드 타임에 OTel SDK로 처리된 데이터 우선 사용
 */
function loadOTelData(hour: number): ExportMetricsServiceRequest | null {
  if (cachedOTelData?.hour === hour) {
    return cachedOTelData.data;
  }

  const data = getOTelHourlyData(hour);
  if (data) {
    cachedOTelData = { hour, data };
    logger.info(
      `[MetricsProvider] OTel 데이터 로드: hour-${hour.toString().padStart(2, '0')} (${data.resourceMetrics.length}개 Resources)`
    );
    return data;
  }

  return null;
}

/**
 * OTel Standard Data → ApiServerMetrics[] 변환
 * 특정 분(minute)에 해당하는 데이터 포인트를 추출하여 변환
 */
function extractMetricsFromStandard(
  data: ExportMetricsServiceRequest,
  timestamp: string,
  minuteOfDay: number
): ApiServerMetrics[] {
  const serverMap = new Map<string, ApiServerMetrics>();
  const targetMinute = minuteOfDay % 60; // 0~59

  // ResourceMetrics(Host) 단위 순회
  for (const resMetric of data.resourceMetrics) {
    // 1. Hostname 식별 & ServerID 추출
    const hostnameAttr = resMetric.resource.attributes.find(
      (a) => a.key === 'host.name'
    );
    const hostname = hostnameAttr?.value.stringValue;
    if (!hostname) continue;

    // Server ID 규칙: 도메인 제거 (web-nginx-icn-01.openmanager.kr -> web-nginx-icn-01)
    const serverId = hostname.split('.')[0];
    if (!serverId) continue;

    // 2. 서버 객체 초기화 (없으면 생성)
    if (!serverMap.has(serverId)) {
      // Resource Attributes에서 메타데이터 추출
      const getAttr = (k: string) =>
        resMetric.resource.attributes.find((a) => a.key === k)?.value
          .stringValue;

      serverMap.set(serverId, {
        serverId,
        serverType: getAttr('host.type') ?? 'unknown',
        location: getAttr('cloud.availability_zone') ?? 'unknown',
        timestamp,
        minuteOfDay,
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
        logs: [],
        status: 'online',
        hostname: hostname,
        environment: getAttr('deployment.environment'),
        os: getAttr('os.type'),
        otelResource: Object.fromEntries(
          resMetric.resource.attributes.map((a) => [a.key, a.value.stringValue])
        ) as unknown as OTelResourceAttributes,
      });
    }

    const server = serverMap.get(serverId)!;

    // 3. Metrics 순회 (CPU, Memory, etc.)
    for (const scopeMetric of resMetric.scopeMetrics) {
      for (const metric of scopeMetric.metrics) {
        // 해당 분(minute)의 DataPoint 찾기
        // OpenManager AI 데이터 생성 규칙상 DataPoints는 0~59분 순서대로 생성됨
        // 안전을 위해 배열 길이 체크
        let dp = null;
        if (metric.gauge) {
          dp =
            metric.gauge.dataPoints[targetMinute] ||
            metric.gauge.dataPoints[metric.gauge.dataPoints.length - 1];
        } else if (metric.sum) {
          dp =
            metric.sum.dataPoints[targetMinute] ||
            metric.sum.dataPoints[metric.sum.dataPoints.length - 1];
        }

        if (!dp || dp.asDouble === undefined) continue;
        const value = dp.asDouble;

        // Metric Name 매핑
        switch (metric.name) {
          case 'system.cpu.utilization':
            server.cpu = Math.round(value * 100 * 10) / 10;
            break;
          case 'system.memory.utilization':
            server.memory = Math.round(value * 100 * 10) / 10;
            break;
          case 'system.filesystem.utilization':
            server.disk = Math.round(value * 100 * 10) / 10;
            break;
          case 'system.network.io':
            server.network = value;
            break;
          case 'system.status':
            if (value === 0) server.status = 'offline';
            break;
          case 'system.cpu.load_average.1m':
            server.loadAvg1 = value;
            break;
          case 'system.cpu.load_average.5m':
            server.loadAvg5 = value;
            break;
          case 'http.server.request.duration':
            server.responseTimeMs = value * 1000; // s → ms
            break;
          case 'system.processes.count':
            server.procsRunning = value;
            break;
        }
      }
    }
  }

  // 4. 상태 결정 및 후처리
  return Array.from(serverMap.values()).map((server) => {
    if (server.status !== 'offline') {
      server.status = determineStatus(
        server.cpu,
        server.memory,
        server.disk,
        server.network
      );
    }
    return server;
  });
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
    MetricsProvider.instance = undefined as unknown as MetricsProvider;
    cachedHourlyData = null;
    cachedOTelData = null;
    cachedOTelConversion = null;
    MetricsProvider.cachedServerList = null;
  }

  /**
   * 현재 시간 기준 단일 서버 메트릭 조회
   * Priority: OTel → Prometheus hourly-data
   */
  public getServerMetrics(serverId: string): ApiServerMetrics | null {
    const minuteOfDay = getKSTMinuteOfDay();
    const timestamp = getKSTTimestamp();
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const slotIndex = Math.floor(minute / 10); // for Fallback

    // 1. OTel 데이터 (Primary) — 변환 캐시 사용
    const otelData = loadOTelData(hour);
    if (otelData) {
      let allMetrics: ApiServerMetrics[];
      if (
        cachedOTelConversion?.hour === hour &&
        cachedOTelConversion.minute === minute
      ) {
        allMetrics = cachedOTelConversion.metrics;
      } else {
        allMetrics = extractMetricsFromStandard(
          otelData,
          timestamp,
          minuteOfDay
        );
        if (allMetrics.length > 0) {
          cachedOTelConversion = { hour, minute, metrics: allMetrics };
        }
      }
      const found = allMetrics.find((m) => m.serverId === serverId);
      if (found) {
        return found;
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
        // Fallback 데이터에서도 찾기
        const instanceKey = `${serverId}:9100`;
        const target = dataPoint.targets[instanceKey];
        if (target) {
          return targetToServerMetrics(target, timestamp, minuteOfDay);
        }

        // serverId만으로 찾기 시도 (instanceKey가 다를 경우)
        const foundKey = Object.keys(dataPoint.targets).find((k) =>
          k.startsWith(serverId)
        );
        const foundTarget = foundKey ? dataPoint.targets[foundKey] : undefined;
        if (foundTarget) {
          return targetToServerMetrics(foundTarget, timestamp, minuteOfDay);
        }
      }
    }

    return null;
  }

  /**
   * 현재 시간 기준 모든 서버 메트릭 조회
   * Priority: OTel → Prometheus hourly-data
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
      if (
        cachedOTelConversion?.hour === hour &&
        cachedOTelConversion.minute === minute
      ) {
        return cachedOTelConversion.metrics;
      }
      const metrics = extractMetricsFromStandard(
        otelData,
        timestamp,
        minuteOfDay
      );
      if (metrics.length > 0) {
        cachedOTelConversion = { hour, minute, metrics };
        return metrics;
      }
    }

    // 2. Prometheus hourly-data (Fallback)
    const hourlyData = loadHourlyData(hour);
    if (hourlyData) {
      const dataPoint = hourlyData.dataPoints[slotIndex];
      if (dataPoint?.targets) {
        return Object.values(dataPoint.targets).map((target) =>
          targetToServerMetrics(target, timestamp, minuteOfDay)
        );
      }
    }

    logger.warn(
      '[MetricsProvider] OTel + hourly-data 모두 로드 실패, 빈 배열 반환'
    );
    return [];
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
   * Priority: OTel → hourly-data
   */
  public getMetricsAtTime(
    serverId: string,
    minuteOfDay: number
  ): ApiServerMetrics | null {
    if (minuteOfDay < 0 || minuteOfDay >= 1440) {
      return null;
    }

    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const slotIndex = Math.floor(minute / 10);
    const timestamp = getKSTTimestamp();

    // 1. OTel (Primary)
    const otelData = loadOTelData(hour);
    if (otelData) {
      const metrics = extractMetricsFromStandard(
        otelData,
        timestamp,
        minuteOfDay
      );
      const found = metrics.find((m) => m.serverId === serverId);
      if (found) return found;
    }

    // 2. hourly-data (Fallback)
    const hourlyData = loadHourlyData(hour);
    const dataPoint = hourlyData?.dataPoints[slotIndex];
    if (dataPoint?.targets) {
      const instanceKey = `${serverId}:9100`;
      const target = dataPoint.targets[instanceKey];
      if (target) return targetToServerMetrics(target, timestamp, minuteOfDay);

      const foundKey = Object.keys(dataPoint.targets).find((k) =>
        k.startsWith(serverId)
      );
      const foundTarget = foundKey ? dataPoint.targets[foundKey] : undefined;
      if (foundTarget) {
        return targetToServerMetrics(foundTarget, timestamp, minuteOfDay);
      }
    }

    return null;
  }

  // Server List 캐시
  private static cachedServerList: Array<{
    serverId: string;
    serverType: string;
    location: string;
  }> | null = null;
  /**
   * 서버 목록 조회 (OTel Standard Resource 기반)
   * 캐싱 적용으로 성능 최적화 (O(N) -> O(1))
   */
  public getServerList(): Array<{
    serverId: string;
    serverType: string;
    location: string;
  }> {
    if (MetricsProvider.cachedServerList) {
        return MetricsProvider.cachedServerList;
    }

    // 0시 데이터를 로드하여 리소스 목록 추출 (가장 확실한 방법)
    const data = loadOTelData(0);
    if (!data) return [];

    const servers: Array<{
      serverId: string;
      serverType: string;
      location: string;
    }> = [];

    for (const resMetric of data.resourceMetrics) {
      const getAttr = (k: string) =>
        resMetric.resource.attributes.find((a) => a.key === k)?.value
          .stringValue;

      const hostname = getAttr('host.name');
      if (!hostname) continue;

      const serverId = hostname.split('.')[0];
      if (!serverId) continue;

      servers.push({
        serverId,
        serverType: getAttr('host.type') ?? 'unknown',
        location: getAttr('cloud.availability_zone') ?? 'unknown',
      });
    }

    MetricsProvider.cachedServerList = servers;
    return servers;
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
      slotIndex: Math.floor(minutes / 10),
      humanReadable: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} KST`,
    };
  }
}

// 편의를 위한 싱글톤 인스턴스 export
export const metricsProvider = MetricsProvider.getInstance();
