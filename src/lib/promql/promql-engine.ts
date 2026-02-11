/**
 * Lightweight PromQL Engine
 *
 * Prometheus 호환 내부 쿼리 레이어. 사용자 UI 없음 — 내부 데이터 처리 전용.
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
 */

import type {
  HourlyData,
  PrometheusLabels,
  PrometheusTarget,
} from '@/data/hourly-data';
import { logger } from '@/lib/logging';
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
// Metric Name → Prometheus Target Field Mapping
// ============================================================================

const METRIC_FIELD_MAP: Record<string, keyof PrometheusTarget['metrics']> = {
  node_cpu_usage_percent: 'node_cpu_usage_percent',
  node_memory_usage_percent: 'node_memory_usage_percent',
  node_filesystem_usage_percent: 'node_filesystem_usage_percent',
  node_network_transmit_bytes_rate: 'node_network_transmit_bytes_rate',
  node_load1: 'node_load1',
  node_load5: 'node_load5',
  node_boot_time_seconds: 'node_boot_time_seconds',
  node_procs_running: 'node_procs_running',
  node_http_request_duration_milliseconds:
    'node_http_request_duration_milliseconds',
  up: 'up',
};

// OTel Semantic Convention 이름 → Prometheus 이름 별칭 맵
const OTEL_ALIAS_MAP: Record<string, string> = {
  'system.cpu.utilization': 'node_cpu_usage_percent',
  'system.memory.utilization': 'node_memory_usage_percent',
  'system.filesystem.utilization': 'node_filesystem_usage_percent',
  'system.network.io': 'node_network_transmit_bytes_rate',
  'system.cpu.load_average.1m': 'node_load1',
  'system.cpu.load_average.5m': 'node_load5',
  'system.processes.count': 'node_procs_running',
  'http.server.request.duration': 'node_http_request_duration_milliseconds',
  'system.status': 'up',
};

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
// Label Matching
// ============================================================================

function matchLabels(
  labels: PrometheusLabels,
  matchers: LabelMatcher[]
): boolean {
  for (const m of matchers) {
    const labelValue = labels[m.name as keyof PrometheusLabels] ?? '';
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
// Data Extraction
// ============================================================================

function extractSamples(
  hourlyData: HourlyData,
  parsed: ParsedQuery,
  slotIndex?: number
): PromQLSample[] {
  const dataPoint =
    hourlyData.dataPoints[slotIndex ?? 0] ?? hourlyData.dataPoints[0];
  if (!dataPoint) return [];

  // OTel 이름 → Prometheus 이름 정규화 (e.g. system.cpu.utilization → node_cpu_usage_percent)
  const normalizedName = OTEL_ALIAS_MAP[parsed.metricName] ?? parsed.metricName;
  const fieldKey = METRIC_FIELD_MAP[normalizedName];
  if (!fieldKey) {
    logger.debug(`[PromQL] Unknown metric name: "${parsed.metricName}"`);
    return [];
  }

  const samples: PromQLSample[] = [];

  for (const [, target] of Object.entries(dataPoint.targets)) {
    if (!matchLabels(target.labels, parsed.matchers)) continue;

    const value = target.metrics[fieldKey];
    if (value === undefined) continue;

    samples.push({
      labels: {
        instance: target.instance,
        job: target.job,
        ...target.labels,
      },
      value: Number(value),
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
  hourlyDataMap: Map<number, HourlyData>,
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

  const currentSamples = extractSamples(currentData, parsed, 3);
  const prevSamples = extractSamples(prevData, parsed, 3);

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
 * PromQL 쿼리 실행
 *
 * @param query - PromQL 쿼리 문자열
 * @param hourlyData - 현재 시간대 hourly data
 * @param hourlyDataMap - 전체 시간대 데이터 맵 (rate 계산용, optional)
 * @param currentHour - 현재 시 (0-23)
 * @param slotIndex - 현재 슬롯 인덱스 (0-5)
 */
export function executePromQL(
  query: string,
  hourlyData: HourlyData,
  hourlyDataMap?: Map<number, HourlyData>,
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
        hourlyDataMap && currentHour !== undefined
          ? computeRate(hourlyDataMap, parsed, currentHour)
          : [];
      return { resultType: 'vector', result: samples };
    }

    case 'aggregate': {
      const samples = extractSamples(hourlyData, parsed, slotIndex);
      const aggregated = applyAggregation(
        samples,
        parsed.aggregateFunc!,
        parsed.groupBy
      );
      return { resultType: 'vector', result: aggregated };
    }

    case 'comparison': {
      const samples = extractSamples(hourlyData, parsed, slotIndex);
      const filtered = applyComparison(
        samples,
        parsed.comparisonOp!,
        parsed.comparisonValue!
      );
      return { resultType: 'vector', result: filtered };
    }

    default: {
      const samples = extractSamples(hourlyData, parsed, slotIndex);
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
