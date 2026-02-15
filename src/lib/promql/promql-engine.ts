/**
 * Lightweight PromQL Engine (OTel-native)
 *
 * Prometheus 호환 내부 쿼리 레이어. 사용자 UI 없음 — 내부 데이터 처리 전용.
 * OTel 데이터를 직접 소비하며, Prometheus 메트릭 이름은 별칭으로 지원.
 *
 * 지원 쿼리 패턴:
 *   node_cpu_usage_percent                          → 전체 서버 CPU
 *   node_cpu_usage_percent{server_type="web"}        → 라벨 필터링
 *   avg(node_cpu_usage_percent)                      → 집계 (avg, max, min, sum, count)
 *   max(node_cpu_usage_percent) by (server_type)     → 그룹 집계
 *   up == 0                                          → 비교 연산
 *   rate(node_cpu_usage_percent[1h])                 → 변화율 (시뮬레이션)
 *
 * 향후 실제 Prometheus 연결 시 HTTP API adapter로 교체 가능.
 *
 * @created 2026-02-04
 * @updated 2026-02-15 - OTel-native SSOT 전환
 */

import { getResourceCatalog } from '@/data/otel-data';
import { logger } from '@/lib/logging';
import type {
  OTelHourlyFile,
  OTelResourceAttributes,
} from '@/types/otel-metrics';
import type { PromQLResult, PromQLSample } from '@/types/processed-metrics';

// ============================================================================
// Types
// ============================================================================

type LabelMatcher = {
  name: string;
  value: string;
  op: '=' | '!=' | '=~' | '!~';
};

type AggregateFunc = 'avg' | 'max' | 'min' | 'sum' | 'count';

type ParsedQuery = {
  type: 'instant' | 'aggregate' | 'comparison' | 'rate';
  metricName: string;
  matchers: LabelMatcher[];
  aggregateFunc?: AggregateFunc;
  groupBy?: string[];
  comparisonOp?: '==' | '!=' | '>' | '<' | '>=' | '<=';
  comparisonValue?: number;
  rangeWindow?: string;
};

// ============================================================================
// Query Limits (DoS 방어)
// ============================================================================

const QUERY_MAX_LENGTH = 512;
const QUERY_MAX_MATCHERS = 10;
const LABEL_VALUE_MAX_LENGTH = 128;

const regexCache = new Map<string, RegExp>();

function getCachedRegex(pattern: string): RegExp | null {
  const cached = regexCache.get(pattern);
  if (cached) return cached;
  try {
    const re = new RegExp(pattern);
    if (regexCache.size > 100) regexCache.clear();
    regexCache.set(pattern, re);
    return re;
  } catch {
    return null;
  }
}

// ============================================================================
// OTel ↔ Prometheus Metric Name Mapping
// ============================================================================

// OTel Semantic Convention → Prometheus 이름 (reverse alias)
const OTEL_ALIAS_MAP: Record<string, string> = {
  'system.cpu.utilization': 'node_cpu_usage_percent',
  'system.memory.utilization': 'node_memory_usage_percent',
  'system.filesystem.utilization': 'node_filesystem_usage_percent',
  'system.network.io': 'node_network_transmit_bytes_rate',
  'system.linux.cpu.load_1m': 'node_load1',
  'system.linux.cpu.load_5m': 'node_load5',
  'system.process.count': 'node_procs_running',
  'system.uptime': 'node_boot_time_seconds',
  'http.server.request.duration': 'node_http_request_duration_milliseconds',
};

// Prometheus 이름 → OTel Semantic Convention (forward map for OTel slot lookup)
const PROM_TO_OTEL_MAP: Record<string, string> = {
  node_cpu_usage_percent: 'system.cpu.utilization',
  node_memory_usage_percent: 'system.memory.utilization',
  node_filesystem_usage_percent: 'system.filesystem.utilization',
  node_network_transmit_bytes_rate: 'system.network.io',
  node_load1: 'system.linux.cpu.load_1m',
  node_load5: 'system.linux.cpu.load_5m',
  node_procs_running: 'system.process.count',
  node_boot_time_seconds: 'system.uptime',
  node_http_request_duration_milliseconds: 'http.server.request.duration',
  up: 'system.uptime', // up은 system.uptime 존재 여부로 판단 (>0 → 1, 없으면 0)
};

// PromQL 라벨 → OTel Resource 속성 이름 매핑 (타입 가드용 참조)
const _LABEL_TO_OTEL_ATTR: Record<string, keyof OTelResourceAttributes> = {
  server_type: 'host.type',
  hostname: 'host.name',
  datacenter: 'cloud.availability_zone',
  environment: 'deployment.environment',
  os: 'os.type',
  os_version: 'os.description',
};
// 정적 참조 유지 (tree-shaking 방지)
void _LABEL_TO_OTEL_ATTR;

// ============================================================================
// Query Validation
// ============================================================================

function validateQuery(query: string): string | null {
  if (!query || typeof query !== 'string') {
    return 'Query must be a non-empty string';
  }
  if (query.length > QUERY_MAX_LENGTH) {
    return `Query exceeds maximum length of ${QUERY_MAX_LENGTH} characters`;
  }
  return null;
}

// ============================================================================
// Parser
// ============================================================================

function parseLabelMatchers(matcherStr: string): LabelMatcher[] {
  const matchers: LabelMatcher[] = [];
  // Match: key="value" or key!="value" or key=~"value" or key!~"value"
  const re = /(\w+)\s*(=~|!~|!=|=)\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(matcherStr)) !== null) {
    if (matchers.length >= QUERY_MAX_MATCHERS) break;
    const name = match[1];
    const op = match[2] as LabelMatcher['op'];
    const value = match[3];
    if (name && value !== undefined && value.length <= LABEL_VALUE_MAX_LENGTH) {
      matchers.push({ name, op, value });
    }
  }
  return matchers;
}

function parsePromQL(query: string): ParsedQuery {
  const trimmed = query.trim();

  // rate(metric[window]) — [\w.]+ allows OTel dotted names
  const rateMatch = trimmed.match(
    /^rate\(\s*([\w.]+)(?:\{([^}]*)\})?\s*\[(\w+)\]\s*\)$/
  );
  if (rateMatch) {
    return {
      type: 'rate',
      metricName: rateMatch[1]!,
      matchers: rateMatch[2] ? parseLabelMatchers(rateMatch[2]) : [],
      rangeWindow: rateMatch[3],
    };
  }

  // aggregate(metric{labels}) by (groupLabels) — [\w.]+ allows OTel dotted names
  const aggMatch = trimmed.match(
    /^(avg|max|min|sum|count)\(\s*([\w.]+)(?:\{([^}]*)\})?\s*\)(?:\s+by\s+\(([^)]+)\))?$/
  );
  if (aggMatch) {
    const groupBy = aggMatch[4]
      ? aggMatch[4].split(',').map((s) => s.trim())
      : undefined;
    return {
      type: 'aggregate',
      aggregateFunc: aggMatch[1] as AggregateFunc,
      metricName: aggMatch[2]!,
      matchers: aggMatch[3] ? parseLabelMatchers(aggMatch[3]) : [],
      groupBy,
    };
  }

  // metric{labels} op value (comparison) — [\w.]+ allows OTel dotted names
  const compMatch = trimmed.match(
    /^([\w.]+)(?:\{([^}]*)\})?\s*(==|!=|>=|<=|>|<)\s*(\d+(?:\.\d+)?)$/
  );
  if (compMatch) {
    return {
      type: 'comparison',
      metricName: compMatch[1]!,
      matchers: compMatch[2] ? parseLabelMatchers(compMatch[2]) : [],
      comparisonOp: compMatch[3] as ParsedQuery['comparisonOp'],
      comparisonValue: Number.parseFloat(compMatch[4]!),
    };
  }

  // Simple metric selector: metric or metric{labels} — [\w.]+ allows OTel dotted names
  const simpleMatch = trimmed.match(/^([\w.]+)(?:\{([^}]*)\})?$/);
  if (simpleMatch) {
    return {
      type: 'instant',
      metricName: simpleMatch[1]!,
      matchers: simpleMatch[2] ? parseLabelMatchers(simpleMatch[2]) : [],
    };
  }

  // Fallback: treat as metric name — log unrecognized pattern
  if (trimmed.includes('(') || trimmed.includes('[') || trimmed.includes('{')) {
    logger.warn(
      `[PromQL] Unrecognized query pattern, falling back to instant selector: "${trimmed}"`
    );
  }
  return {
    type: 'instant',
    metricName: trimmed,
    matchers: [],
  };
}

// ============================================================================
// OTel Metric Name Resolution
// ============================================================================

/**
 * 메트릭 이름을 OTel 이름으로 정규화.
 * Prometheus 이름이 입력되면 OTel 이름으로 변환, 이미 OTel이면 그대로 반환.
 */
function resolveOTelMetricName(metricName: string): string | null {
  // 이미 OTel 이름인지 확인 (OTEL_ALIAS_MAP에 키로 존재)
  if (OTEL_ALIAS_MAP[metricName] !== undefined) {
    return metricName;
  }
  // Prometheus 이름 → OTel 이름
  const otelName = PROM_TO_OTEL_MAP[metricName];
  if (otelName) {
    return otelName;
  }
  return null;
}

// ============================================================================
// Resource Catalog → Label Lookup
// ============================================================================

// hostname → serverId reverse lookup cache
let hostnameLookupCache: Map<string, string> | null = null;

function getServerIdFromHostname(hostname: string): string | null {
  if (!hostnameLookupCache) {
    hostnameLookupCache = new Map();
    const catalog = getResourceCatalog();
    for (const [serverId, attrs] of Object.entries(catalog.resources)) {
      hostnameLookupCache.set(attrs['host.name'], serverId);
    }
  }
  return hostnameLookupCache.get(hostname) ?? null;
}

function getResourceLabels(hostname: string): Record<string, string> {
  const serverId = getServerIdFromHostname(hostname);
  if (!serverId) return {};

  const catalog = getResourceCatalog();
  const attrs = catalog.resources[serverId];
  if (!attrs) return {};

  // OTel resource attributes → PromQL-compatible labels
  return {
    instance: attrs['host.id'],
    job: 'node-exporter',
    hostname: attrs['host.name'],
    server_type: attrs['host.type'],
    datacenter: attrs['cloud.availability_zone'],
    environment: attrs['deployment.environment'],
    os: attrs['os.type'],
    os_version: attrs['os.description'],
  };
}

// ============================================================================
// Label Matching
// ============================================================================

function matchLabels(
  labels: Record<string, string>,
  matchers: LabelMatcher[]
): boolean {
  for (const m of matchers) {
    const labelValue = labels[m.name] ?? '';
    switch (m.op) {
      case '=':
        if (labelValue !== m.value) return false;
        break;
      case '!=':
        if (labelValue === m.value) return false;
        break;
      case '=~': {
        const reMatch = getCachedRegex(m.value);
        if (!reMatch || !reMatch.test(labelValue)) return false;
        break;
      }
      case '!~': {
        const reNeg = getCachedRegex(m.value);
        if (!reNeg || reNeg.test(labelValue)) return false;
        break;
      }
    }
  }
  return true;
}

// ============================================================================
// Data Extraction (OTel-native)
// ============================================================================

/**
 * OTel 슬롯에서 PromQL 샘플 추출
 *
 * 메트릭 이름 → OTel 슬롯에서 해당 metric 검색 → dataPoints를 순회하며 labels 매칭
 */
function extractSamplesFromOTel(
  hourlyFile: OTelHourlyFile,
  parsed: ParsedQuery,
  slotIndex?: number
): PromQLSample[] {
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

  const samples: PromQLSample[] = [];

  for (const dp of otelMetric.dataPoints) {
    const hostname = dp.attributes['host.name'];
    const labels = getResourceLabels(hostname);

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
// Aggregation
// ============================================================================

function applyAggregation(
  samples: PromQLSample[],
  func: AggregateFunc,
  groupBy?: string[]
): PromQLSample[] {
  if (!groupBy || groupBy.length === 0) {
    // Global aggregation
    if (samples.length === 0) return [];
    const values = samples.map((s) => s.value);
    const result = computeAgg(func, values);
    return [{ labels: {}, value: result }];
  }

  // Group by labels
  const groups = new Map<string, number[]>();
  const groupLabelsMap = new Map<string, Record<string, string>>();

  for (const sample of samples) {
    const key = groupBy.map((g) => sample.labels[g] ?? '').join('|');
    const existing = groups.get(key) ?? [];
    existing.push(sample.value);
    groups.set(key, existing);

    if (!groupLabelsMap.has(key)) {
      const labels: Record<string, string> = {};
      for (const g of groupBy) {
        labels[g] = sample.labels[g] ?? '';
      }
      groupLabelsMap.set(key, labels);
    }
  }

  const results: PromQLSample[] = [];
  for (const [key, values] of groups) {
    results.push({
      labels: groupLabelsMap.get(key) ?? {},
      value: computeAgg(func, values),
    });
  }

  return results;
}

function computeAgg(func: AggregateFunc, values: number[]): number {
  if (values.length === 0) return 0;
  switch (func) {
    case 'avg':
      return (
        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
        100
      );
    case 'max':
      return Math.max(...values);
    case 'min':
      return Math.min(...values);
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'count':
      return values.length;
  }
}

// ============================================================================
// Comparison
// ============================================================================

function applyComparison(
  samples: PromQLSample[],
  op: string,
  threshold: number
): PromQLSample[] {
  return samples.filter((s) => {
    switch (op) {
      case '==':
        return s.value === threshold;
      case '!=':
        return s.value !== threshold;
      case '>':
        return s.value > threshold;
      case '<':
        return s.value < threshold;
      case '>=':
        return s.value >= threshold;
      case '<=':
        return s.value <= threshold;
      default:
        return false;
    }
  });
}

// ============================================================================
// Rate (Simulated)
// ============================================================================

function computeRate(
  hourlyDataMap: Map<number, OTelHourlyFile>,
  parsed: ParsedQuery,
  currentHour: number
): PromQLSample[] {
  // Parse window (e.g., "1h" -> 1 hour)
  const windowMatch = parsed.rangeWindow?.match(/^(\d+)h$/);
  const windowHours = windowMatch ? Number.parseInt(windowMatch[1]!, 10) : 1;

  const prevHour = (((currentHour - windowHours) % 24) + 24) % 24;
  const currentData = hourlyDataMap.get(currentHour);
  const prevData = hourlyDataMap.get(prevHour);

  if (!currentData || !prevData) return [];

  const currentSamples = extractSamplesFromOTel(currentData, parsed, 3);
  const prevSamples = extractSamplesFromOTel(prevData, parsed, 3);

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
export function executePromQL(
  query: string,
  hourlyFile: OTelHourlyFile,
  hourlyFileMap?: Map<number, OTelHourlyFile>,
  currentHour?: number,
  slotIndex?: number
): PromQLResult {
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
          ? computeRate(hourlyFileMap, parsed, currentHour)
          : [];
      return { resultType: 'vector', result: samples };
    }

    case 'aggregate': {
      const samples = extractSamplesFromOTel(hourlyFile, parsed, slotIndex);
      const aggregated = applyAggregation(
        samples,
        parsed.aggregateFunc!,
        parsed.groupBy
      );
      return { resultType: 'vector', result: aggregated };
    }

    case 'comparison': {
      const samples = extractSamplesFromOTel(hourlyFile, parsed, slotIndex);
      const filtered = applyComparison(
        samples,
        parsed.comparisonOp!,
        parsed.comparisonValue!
      );
      return { resultType: 'vector', result: filtered };
    }

    default: {
      const samples = extractSamplesFromOTel(hourlyFile, parsed, slotIndex);
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

// Export maps for external use (e.g., MonitoringContext OTel resource context)
export { OTEL_ALIAS_MAP, PROM_TO_OTEL_MAP };
