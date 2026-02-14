import { getServerStatus as getRulesServerStatus } from '@/config/rules/loader';
import { extractServerId, type PrometheusTarget } from '@/data/hourly-data';
import { getOTelResourceCatalog } from '@/data/otel-processed';
import { logger } from '@/lib/logging';
import type { OTelResourceAttributes } from '@/types/otel-metrics';
import type { ExportMetricsServiceRequest } from '@/types/otel-standard';
import type { ApiServerMetrics } from './types';

// ============================================================================
// Shared Logic
// ============================================================================

/**
 * 메트릭 값 기반 서버 상태 판별
 * @see /src/config/rules/system-rules.json (Single Source of Truth)
 */
export function determineStatus(
  cpu: number,
  memory: number,
  disk: number,
  network: number
): 'online' | 'warning' | 'critical' | 'offline' {
  return getRulesServerStatus({ cpu, memory, disk, network });
}

/**
 * OTel datapoint 인덱스 계산
 * - 60개(1분 해상도): minute 그대로 사용
 * - 6개(10분 해상도) 등: 분(0~59)을 데이터 길이에 비례 매핑
 */
function getDataPointIndex(
  dataPointLength: number,
  minuteOfDay: number
): number {
  if (dataPointLength <= 1) return 0;

  const minuteInHour = ((minuteOfDay % 60) + 60) % 60;
  if (dataPointLength === 60) return minuteInHour;

  return Math.min(
    dataPointLength - 1,
    Math.floor((minuteInHour / 60) * dataPointLength)
  );
}

function pickDataPoint<T extends { asDouble?: number }>(
  dataPoints: T[] | undefined,
  minuteOfDay: number
): T | null {
  if (!dataPoints || dataPoints.length === 0) return null;
  const idx = getDataPointIndex(dataPoints.length, minuteOfDay);
  return dataPoints[idx] ?? dataPoints[dataPoints.length - 1] ?? null;
}

// ============================================================================
// OTel Data Transformation
// ============================================================================

/**
 * OTel Standard Data → ApiServerMetrics[] 변환
 * 특정 분(minute)에 해당하는 데이터 포인트를 추출하여 변환
 */
export function extractMetricsFromStandard(
  data: ExportMetricsServiceRequest,
  timestamp: string,
  minuteOfDay: number
): ApiServerMetrics[] {
  const serverMap = new Map<string, ApiServerMetrics>();

  // ResourceMetrics(Host) 단위 순회
  for (const resMetric of data.resourceMetrics) {
    // 1. Hostname 식별 & ServerID 추출
    const hostnameAttr = resMetric.resource.attributes.find(
      (a) => a.key === 'host.name'
    );
    const hostname = hostnameAttr?.value.stringValue;
    if (!hostname) {
      logger.debug(
        '[metric-transformers] Skipping resource without host.name attribute'
      );
      continue;
    }

    // Server ID 규칙: 도메인 제거 (web-nginx-icn-01.openmanager.kr -> web-nginx-icn-01)
    const serverId = hostname.split('.')[0];
    if (!serverId) continue;

    // 2. 서버 객체 초기화 (없으면 생성)
    if (!serverMap.has(serverId)) {
      // Resource Attributes에서 메타데이터 추출
      const getAttr = (k: string) =>
        resMetric.resource.attributes.find((a) => a.key === k)?.value
          .stringValue;

      // Resource Catalog에서 전체 메타데이터 보강
      const catalog = getOTelResourceCatalog();
      const catalogEntry = catalog.resources[serverId];

      serverMap.set(serverId, {
        serverId,
        serverType:
          getAttr('host.type') ?? catalogEntry?.['host.type'] ?? 'unknown',
        location:
          getAttr('cloud.availability_zone') ??
          catalogEntry?.['cloud.availability_zone'] ??
          'unknown',
        timestamp,
        minuteOfDay,
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
        logs: [],
        status: 'online',
        hostname: hostname,
        environment:
          getAttr('deployment.environment') ??
          catalogEntry?.['deployment.environment'],
        os: getAttr('os.type') ?? catalogEntry?.['os.type'],
        otelResource:
          catalogEntry ??
          (Object.fromEntries(
            resMetric.resource.attributes.map((a) => [
              a.key,
              a.value.stringValue,
            ])
          ) as Partial<OTelResourceAttributes>),
      });
    }

    const server = serverMap.get(serverId)!;

    // 3. Metrics 순회 (CPU, Memory, etc.)
    for (const scopeMetric of resMetric.scopeMetrics) {
      for (const metric of scopeMetric.metrics) {
        // 해당 분(minute)에 대응하는 DataPoint 선택
        // 6개 슬롯(10분 간격) / 60개 슬롯(1분 간격) 모두 지원
        const dp =
          pickDataPoint(metric.gauge?.dataPoints, minuteOfDay) ??
          pickDataPoint(metric.sum?.dataPoints, minuteOfDay);

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
          case 'system.cpu.load_average.1m':
            server.loadAvg1 = value;
            break;
          case 'system.cpu.load_average.5m':
            server.loadAvg5 = value;
            break;
          case 'http.server.request.duration':
            server.responseTimeMs = value * 1000; // s → ms
            break;
          case 'system.process.count':
            server.procsRunning = value;
            break;
          case 'system.uptime':
            server.bootTimeSeconds = Math.floor(Date.now() / 1000) - value;
            break;
        }
      }
    }
  }

  // 4. 상태 결정 및 후처리
  return Array.from(serverMap.values()).map((server) => {
    // cpu+memory+disk 모두 0이면 오프라인 판별 (system.status 대체)
    if (server.cpu === 0 && server.memory === 0 && server.disk === 0) {
      server.status = 'offline';
    } else {
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
// Prometheus Data Transformation
// ============================================================================

/**
 * PrometheusTarget → ServerMetrics 변환
 */
export function targetToServerMetrics(
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
    status = 'offline';
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
