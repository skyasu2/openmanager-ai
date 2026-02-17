import { getServerStatus as getRulesServerStatus } from '@/config/rules/loader';
import { OTEL_METRIC } from '@/constants/otel-metric-names';
import { getOTelResourceCatalog } from '@/data/otel-data';
import { logger } from '@/lib/logging';
import type { OTelResourceAttributes } from '@/types/otel-metrics';
import type { ExportMetricsServiceRequest } from '@/types/otel-standard';
import {
  normalizeNetworkUtilizationPercent,
  normalizeUtilizationPercent,
} from './metric-normalization';
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
// OTel Metric Name → Handler Map
// ============================================================================

const STANDARD_METRIC_HANDLERS = new Map<
  string,
  (server: ApiServerMetrics, value: number, unit?: string) => void
>([
  [
    OTEL_METRIC.CPU,
    (s, v, unit) => {
      s.cpu = normalizeUtilizationPercent(v, unit);
    },
  ],
  [
    OTEL_METRIC.MEMORY,
    (s, v, unit) => {
      s.memory = normalizeUtilizationPercent(v, unit);
    },
  ],
  [
    OTEL_METRIC.DISK,
    (s, v, unit) => {
      s.disk = normalizeUtilizationPercent(v, unit);
    },
  ],
  [
    OTEL_METRIC.NETWORK,
    (s, v, unit) => {
      s.network = normalizeNetworkUtilizationPercent(v, unit);
    },
  ],
  [
    OTEL_METRIC.LOAD_1M,
    (s, v) => {
      s.loadAvg1 = v;
    },
  ],
  [
    OTEL_METRIC.LOAD_1M_SEMCONV,
    (s, v) => {
      s.loadAvg1 = v;
    },
  ],
  [
    OTEL_METRIC.LOAD_5M,
    (s, v) => {
      s.loadAvg5 = v;
    },
  ],
  [
    OTEL_METRIC.LOAD_5M_SEMCONV,
    (s, v) => {
      s.loadAvg5 = v;
    },
  ],
  [
    OTEL_METRIC.HTTP_DURATION,
    (s, v, unit) => {
      // OTel standard unit is "s" (seconds); convert to ms
      s.responseTimeMs = unit === 'ms' ? v : v * 1000;
    },
  ],
  [
    OTEL_METRIC.PROCESSES,
    (s, v) => {
      s.procsRunning = v;
    },
  ],
  [
    OTEL_METRIC.UPTIME,
    (s, v) => {
      s.bootTimeSeconds = Math.floor(Date.now() / 1000) - v;
    },
  ],
]);

// ============================================================================
// OTel Data Transformation
// ============================================================================

/**
 * OTel Standard Data → ApiServerMetrics[] 변환
 * 특정 분(minute)에 해당하는 데이터 포인트를 추출하여 변환
 */
export async function extractMetricsFromStandard(
  data: ExportMetricsServiceRequest,
  timestamp: string,
  minuteOfDay: number
): Promise<ApiServerMetrics[]> {
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

    // Server ID 규칙: 도메인 제거 (web-nginx-dc1-01.openmanager.kr -> web-nginx-dc1-01)
    const serverId = hostname.split('.')[0];
    if (!serverId) continue;

    // 2. 서버 객체 초기화 (없으면 생성)
    if (!serverMap.has(serverId)) {
      // Resource Attributes에서 메타데이터 추출
      const getAttr = (k: string) =>
        resMetric.resource.attributes.find((a) => a.key === k)?.value
          .stringValue;

      // Resource Catalog에서 전체 메타데이터 보강
      const catalog = await getOTelResourceCatalog();
      const catalogEntry = catalog?.resources[serverId];

      serverMap.set(serverId, {
        serverId,
        serverType:
          getAttr('server.role') ?? catalogEntry?.['server.role'] ?? 'unknown',
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

        // Metric Name → Handler Map
        const handler = STANDARD_METRIC_HANDLERS.get(metric.name);
        if (handler) {
          handler(server, value, metric.unit);
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
