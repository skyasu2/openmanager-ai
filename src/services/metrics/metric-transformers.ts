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
          ) as unknown as OTelResourceAttributes),
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
          case 'system.uptime':
            server.bootTimeSeconds = Math.floor(Date.now() / 1000) - value;
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
