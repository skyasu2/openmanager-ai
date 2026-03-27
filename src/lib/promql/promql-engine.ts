/**
 * Lightweight PromQL Engine (OTel-native)
 *
 * Prometheus 호환 내부 쿼리 레이어. 사용자 UI 없음 — 내부 데이터 처리 전용.
 * OTel 데이터를 직접 소비하며, Prometheus 메트릭 이름은 별칭으로 지원.
 *
 * 지원 쿼리 패턴:
 *   node_cpu_utilization_ratio                            → 전체 서버 CPU
 *   node_cpu_utilization_ratio{server_type="web"}         → 라벨 필터링
 *   avg(node_cpu_utilization_ratio)                       → 집계 (avg, max, min, sum, count)
 *   max(node_cpu_utilization_ratio) by (server_type)      → 그룹 집계
 *   up == 0                                               → 비교 연산
 *   rate(node_cpu_utilization_ratio[1h])                  → 변화율 (시뮬레이션)
 *
 * 향후 실제 Prometheus 연결 시 HTTP API adapter로 교체 가능.
 *
 * @created 2026-02-04
 * @updated 2026-02-15 - OTel-native SSOT 전환
 */

import { getResourceCatalog } from '@/data/otel-data';
import { logger } from '@/lib/logging';
import type { OTelHourlyFile } from '@/types/otel-metrics';
import type { PromQLResult, PromQLSample } from '@/types/processed-metrics';
import {
  applyAggregation,
  applyComparison,
  matchLabels,
  type ParsedQuery,
  parsePromQL,
  resolveOTelMetricName,
  validateQuery,
} from './promql-engine-core';

// ============================================================================
// Resource Catalog → Label Lookup
// ============================================================================

// hostname → labels 캐시 (일괄 구축, 동기 조회)
let labelsCache: Map<string, Record<string, string>> | null = null;
let labelsCachePromise: Promise<Map<string, Record<string, string>>> | null =
  null;

async function ensureLabelsCache(): Promise<
  Map<string, Record<string, string>>
> {
  if (labelsCache) return labelsCache;
  if (labelsCachePromise) return labelsCachePromise;

  labelsCachePromise = (async () => {
    const cache = new Map<string, Record<string, string>>();
    const catalog = await getResourceCatalog();
    if (!catalog) {
      // catalog null은 일시적 실패 — labelsCache에 고정하지 않아 다음 호출 시 재시도
      return cache;
    }

    for (const [_serverId, attrs] of Object.entries(catalog.resources)) {
      const hostname = attrs['host.name'];
      cache.set(hostname, {
        instance: attrs['host.id'],
        job: 'node-exporter',
        hostname: attrs['host.name'],
        server_type: attrs['server.role'],
        datacenter: attrs['cloud.availability_zone'],
        environment: attrs['deployment.environment.name'],
        os: attrs['os.type'],
        os_version: attrs['os.description'],
      });
    }

    labelsCache = cache;
    return cache;
  })().finally(() => {
    // resolve/reject 이후 in-flight 참조 정리 (성공 시 labelsCache가 SSOT)
    labelsCachePromise = null;
  });

  return labelsCachePromise;
}

function getResourceLabelsSync(
  hostname: string,
  cache: Map<string, Record<string, string>>
): Record<string, string> {
  return cache.get(hostname) ?? {};
}

// ============================================================================
// Data Extraction (OTel-native)
// ============================================================================

/**
 * OTel 슬롯에서 PromQL 샘플 추출
 *
 * 메트릭 이름 → OTel 슬롯에서 해당 metric 검색 → dataPoints를 순회하며 labels 매칭
 */
async function extractSamplesFromOTel(
  hourlyFile: OTelHourlyFile,
  parsed: ParsedQuery,
  slotIndex?: number
): Promise<PromQLSample[]> {
  const slot = hourlyFile.slots[slotIndex ?? 0] ?? hourlyFile.slots[0];
  if (!slot) return [];

  const isUpQuery = parsed.metricName === 'up';
  const otelName = resolveOTelMetricName(parsed.metricName);

  if (!otelName) {
    logger.debug(`[PromQL] Unknown metric name: "${parsed.metricName}"`);
    return [];
  }

  // up 메트릭은 system.uptime 기반으로 계산 (uptime > 0 → up=1)
  const targetOTelName = isUpQuery ? 'system.uptime' : otelName;
  const otelMetric = slot.metrics.find((m) => m.name === targetOTelName);
  if (!otelMetric) {
    logger.debug(`[PromQL] OTel metric not found in slot: "${targetOTelName}"`);
    return [];
  }

  // labels Map 일괄 구축 (N+1 async 방지)
  const labelMap = await ensureLabelsCache();
  const samples: PromQLSample[] = [];

  for (const dp of otelMetric.dataPoints) {
    const hostname = dp.attributes['host.name'];
    const labels = getResourceLabelsSync(hostname, labelMap);

    if (!matchLabels(labels, parsed.matchers)) continue;

    // up 메트릭: system.uptime > 0 → 1, else → 0
    const value = isUpQuery ? (dp.asDouble > 0 ? 1 : 0) : dp.asDouble;

    samples.push({
      labels,
      value,
    });
  }

  return samples;
}

// ============================================================================
// Rate (Simulated)
// ============================================================================

async function computeRate(
  hourlyDataMap: Map<number, OTelHourlyFile>,
  parsed: ParsedQuery,
  currentHour: number,
  slotIndex?: number
): Promise<PromQLSample[]> {
  // Parse window (e.g., "1h" -> 1 hour)
  const windowMatch = parsed.rangeWindow?.match(/^(\d+)h$/);
  const windowHours = windowMatch ? Number.parseInt(windowMatch[1]!, 10) : 1;

  const prevHour = (((currentHour - windowHours) % 24) + 24) % 24;
  const currentData = hourlyDataMap.get(currentHour);
  const prevData = hourlyDataMap.get(prevHour);

  if (!currentData || !prevData) return [];

  const currentSamples = await extractSamplesFromOTel(
    currentData,
    parsed,
    slotIndex
  );
  const prevSamples = await extractSamplesFromOTel(prevData, parsed, slotIndex);

  const prevMap = new Map<string, number>();
  for (const s of prevSamples) {
    prevMap.set(s.labels.instance ?? '', s.value);
  }

  return currentSamples.map((s) => {
    const prevValue = prevMap.get(s.labels.instance ?? '') ?? s.value;
    const delta = s.value - prevValue;
    return {
      labels: s.labels,
      value: Math.round(delta * 100) / 100,
    };
  });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * PromQL 쿼리 실행 (OTel-native)
 *
 * @param query - PromQL 쿼리 문자열 (Prometheus 이름, OTel 이름 모두 지원)
 * @param hourlyFile - 현재 시간대 OTel hourly file
 * @param hourlyFileMap - 전체 시간대 데이터 맵 (rate 계산용, optional)
 * @param currentHour - 현재 시 (0-23)
 * @param slotIndex - 현재 슬롯 인덱스 (0-5)
 */
export async function executePromQL(
  query: string,
  hourlyFile: OTelHourlyFile,
  hourlyFileMap?: Map<number, OTelHourlyFile>,
  currentHour?: number,
  slotIndex?: number
): Promise<PromQLResult> {
  const validationError = validateQuery(query);
  if (validationError) {
    logger.warn(`[PromQL] Query rejected: ${validationError}`);
    return { resultType: 'vector', result: [] };
  }

  const parsed = parsePromQL(query);

  switch (parsed.type) {
    case 'rate': {
      const samples =
        hourlyFileMap && currentHour !== undefined
          ? await computeRate(hourlyFileMap, parsed, currentHour, slotIndex)
          : [];
      return { resultType: 'vector', result: samples };
    }

    case 'aggregate': {
      const samples = await extractSamplesFromOTel(
        hourlyFile,
        parsed,
        slotIndex
      );
      const aggregated = applyAggregation(
        samples,
        parsed.aggregateFunc!,
        parsed.groupBy
      );
      return { resultType: 'vector', result: aggregated };
    }

    case 'comparison': {
      const samples = await extractSamplesFromOTel(
        hourlyFile,
        parsed,
        slotIndex
      );
      const filtered = applyComparison(
        samples,
        parsed.comparisonOp!,
        parsed.comparisonValue!
      );
      return { resultType: 'vector', result: filtered };
    }

    default: {
      const samples = await extractSamplesFromOTel(
        hourlyFile,
        parsed,
        slotIndex
      );
      return { resultType: 'vector', result: samples };
    }
  }
}

/**
 * PromQL 쿼리 파싱 (테스트/디버그용)
 */
export function debugParsePromQL(query: string): ParsedQuery | null {
  const validationError = validateQuery(query);
  if (validationError) {
    logger.warn(`[PromQL] Query rejected: ${validationError}`);
    return null;
  }
  return parsePromQL(query);
}
