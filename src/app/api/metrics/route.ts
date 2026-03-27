/**
 * Infrastructure Layer - 서버 메트릭 API
 *
 * PromQL 쿼리 API (POST)
 * - Single Source of Truth: MetricsProvider
 *
 * @version 2.0.0 - 레지스트리 기반 PromQL 파서 (2026-02-14)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { metricsProvider } from '@/services/metrics/MetricsProvider';
import type { ApiServerMetrics } from '@/services/metrics/types';

const PromQLRequestSchema = z.object({
  query: z.string().min(1, 'query is required').max(1000, 'query too long'),
  time: z.number().optional(),
  timeout: z.number().optional(),
});

interface PrometheusMetricResult {
  metric: {
    __name__: string;
    instance: string;
    job: string;
    environment: string;
    status?: string;
  };
  value: [number, string];
}

// PromQL 메트릭 이름 → 서버 데이터 필드 매핑 레지스트리
type MetricExtractor = (m: ApiServerMetrics) => string;

const METRIC_REGISTRY: Record<string, MetricExtractor> = {
  // Utilization metrics: percent(0-100) → ratio(0-1), fixed precision to avoid round-trip loss
  node_cpu_utilization_ratio: (m) => (m.cpu / 100).toFixed(4),
  node_memory_utilization_ratio: (m) => (m.memory / 100).toFixed(4),
  node_filesystem_utilization_ratio: (m) => (m.disk / 100).toFixed(4),
  node_network_utilization_ratio: (m) => (m.network / 100).toFixed(4),
  // Status: custom prefix for project-specific metric
  openmanager_server_status: (m) => {
    if (m.status === 'offline') return '3';
    if (m.status === 'critical') return '2';
    if (m.status === 'warning') return '1';
    return '0'; // online/healthy
  },
  // Load & process: node_exporter compatible names
  node_load1: (m) => (m.loadAvg1 ?? 0).toString(),
  node_load5: (m) => (m.loadAvg5 ?? 0).toString(),
  node_procs_running: (m) => (m.procsRunning ?? 0).toString(),
  // Duration: base unit = seconds (Prometheus convention)
  http_server_request_duration_seconds: (m) =>
    ((m.responseTimeMs ?? 0) / 1000).toString(),
  // Static node info
  node_boot_time_seconds: (m) => (m.bootTimeSeconds ?? 0).toString(),
  node_cpu_cores: (m) => (m.nodeInfo?.cpuCores ?? 0).toString(),
  node_memory_total_bytes: (m) =>
    (m.nodeInfo?.memoryTotalBytes ?? 0).toString(),
  node_disk_total_bytes: (m) => (m.nodeInfo?.diskTotalBytes ?? 0).toString(),
};

/** 쿼리에서 메트릭 이름을 추출 (간이 PromQL 파서) */
function extractMetricName(query: string): string | null {
  // 함수 래핑 제거: avg(node_cpu_utilization_ratio) → node_cpu_utilization_ratio
  const unwrapped = query
    .replace(/^(avg|sum|min|max|count|rate|irate|increase)\s*\(/i, '')
    .replace(/\)\s*$/, '');

  // 레이블 셀렉터 제거: node_cpu_utilization_ratio{instance="web-01"} → node_cpu_utilization_ratio
  const metricName = unwrapped.replace(/\{[^}]*\}/, '').trim();

  // 레지스트리에서 정확 매칭
  if (METRIC_REGISTRY[metricName]) return metricName;

  // Prefix matching only (node_cpu → node_cpu_utilization_ratio)
  const lowerMetric = metricName.toLowerCase();
  for (const key of Object.keys(METRIC_REGISTRY)) {
    if (key.startsWith(lowerMetric) || lowerMetric.startsWith(key)) return key;
  }

  return null;
}

/** 쿼리에서 레이블 필터 추출: {instance="web-01"} */
function extractLabelFilters(query: string): Record<string, string> {
  const match = query.match(/\{([^}]+)\}/);
  if (!match) return {};

  const filters: Record<string, string> = {};
  const pairs = (match[1] ?? '').split(',');
  for (const pair of pairs) {
    const [key, val] = pair.split('=').map((s) => s.trim().replace(/"/g, ''));
    if (key && val) filters[key] = val;
  }
  return filters;
}

/**
 * PromQL 쿼리 실행
 */
async function executePromQLQuery(
  query: string,
  time?: number
): Promise<PrometheusMetricResult[]> {
  await metricsProvider.ensureDataLoaded();
  const metrics = await metricsProvider.getAllServerMetrics();
  const ts = time || Math.floor(Date.now() / 1000);

  const metricName = extractMetricName(query);
  if (!metricName) {
    // 지원되지 않는 메트릭: 사용 가능한 메트릭 목록 반환하지 않고 빈 결과
    logger.warn(`Unsupported PromQL metric: ${query}`);
    return [];
  }

  const extractor = METRIC_REGISTRY[metricName]!;
  const filters = extractLabelFilters(query);

  let filtered = metrics;

  // 레이블 필터 적용
  if (filters.instance) {
    filtered = filtered.filter((m) => m.serverId === filters.instance);
  }
  if (filters.job) {
    filtered = filtered.filter((m) => m.serverType === filters.job);
  }
  if (filters.status) {
    filtered = filtered.filter((m) => m.status === filters.status);
  }

  return filtered.map((m) => ({
    metric: {
      __name__: metricName,
      instance: m.serverId,
      job: m.serverType,
      environment: m.environment ?? 'production',
      ...(metricName === 'server_status' ? { status: m.status } : {}),
    },
    value: [ts, extractor(m)],
  }));
}

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = PromQLRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Invalid request body',
          errorType: 'bad_data',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { query, time } = parsed.data;
    const result = await executePromQLQuery(query, time);

    return NextResponse.json({
      status: 'success',
      data: {
        resultType: 'vector',
        result,
      },
    });
  } catch (error) {
    logger.error('PromQL 쿼리 실행 실패:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Query execution failed',
        errorType: 'internal',
      },
      { status: 500 }
    );
  }
});

/** GET: 지원 메트릭 목록 조회 */
export const GET = withAuth(async () => {
  return NextResponse.json({
    status: 'success',
    metrics: Object.keys(METRIC_REGISTRY),
    count: Object.keys(METRIC_REGISTRY).length,
  });
});
