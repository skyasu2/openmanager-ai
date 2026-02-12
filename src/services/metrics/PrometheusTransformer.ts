import type {
  MatrixData,
  MetricSample,
  MetricSeries,
  PrometheusResponse,
  VectorData,
} from '@/types/prometheus-standard';
import { PROMETHEUS_METRIC_NAMES } from '@/types/prometheus-standard';
import type { ApiServerMetrics } from './types';

/**
 * Prometheus Transformer Functions
 * VIBE 내부 포맷(ApiServerMetrics)을 Prometheus API 응답 규격으로 변환
 */

function extractValue(
  server: ApiServerMetrics,
  metricName: string
): number | null {
  switch (metricName) {
    case 'cpu':
      return server.cpu;
    case 'memory':
      return server.memory;
    case 'disk':
      return server.disk;
    case 'network':
      return server.network;
    case 'up':
      return server.status === 'offline' ? 0 : 1;
  }

  if (metricName === PROMETHEUS_METRIC_NAMES.CPU_USAGE) {
    return server.cpu;
  }
  if (metricName === 'node_memory_MemTotal_bytes') {
    const total = server.nodeInfo?.memoryTotalBytes || 16 * 1024 * 1024 * 1024;
    return total;
  }
  if (metricName === 'node_memory_MemAvailable_bytes') {
    const total = server.nodeInfo?.memoryTotalBytes || 16 * 1024 * 1024 * 1024;
    return total * (1 - server.memory / 100);
  }

  return null;
}

/**
 * 단일 시점 메트릭 조회 (Instant Vector)
 * 예: query?query=up
 */
export function transformToVector(
  metrics: ApiServerMetrics[],
  metricName: string
): PrometheusResponse<VectorData> {
  const timestamp = Math.floor(Date.now() / 1000);
  const result: MetricSample[] = [];

  for (const server of metrics) {
    if (!server) continue;

    const value = extractValue(server, metricName);
    if (value === null) continue;

    result.push({
      metric: {
        __name__: metricName,
        instance: `${server.hostname}:9100`,
        job: 'node-exporter',
        cluster: server.location,
        env: server.environment || 'production',
      },
      value: [timestamp, value.toString()],
    });
  }

  return {
    status: 'success',
    data: {
      resultType: 'vector',
      result,
    },
  };
}

/**
 * 시계열 데이터 (Range Vector)
 * 실제 구현 시에는 start, end, step 받아서 여러 시점 데이터 로드 필요
 */
export function transformToMatrix(
  metricsSeries: Array<{ timestamp: number; metrics: ApiServerMetrics[] }>,
  metricName: string
): PrometheusResponse<MatrixData> {
  const seriesMap = new Map<string, MetricSeries>();

  for (const point of metricsSeries) {
    for (const server of point.metrics) {
      const instance = `${server.hostname}:9100`;
      const value = extractValue(server, metricName);
      if (value === null) continue;

      if (!seriesMap.has(instance)) {
        seriesMap.set(instance, {
          metric: {
            __name__: metricName,
            instance,
            job: 'node-exporter',
            cluster: server.location,
            env: server.environment || 'production',
          },
          values: [],
        });
      }

      seriesMap.get(instance)!.values.push([point.timestamp, value.toString()]);
    }
  }

  return {
    status: 'success',
    data: {
      resultType: 'matrix',
      result: Array.from(seriesMap.values()),
    },
  };
}
