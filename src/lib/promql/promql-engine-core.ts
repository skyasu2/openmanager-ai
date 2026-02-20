import { logger } from '@/lib/logging';
import type { PromQLSample } from '@/types/processed-metrics';

export type LabelMatcher = {
  name: string;
  value: string;
  op: '=' | '!=' | '=~' | '!~';
};

export type AggregateFunc = 'avg' | 'max' | 'min' | 'sum' | 'count';

export type ParsedQuery = {
  type: 'instant' | 'aggregate' | 'comparison' | 'rate';
  metricName: string;
  matchers: LabelMatcher[];
  aggregateFunc?: AggregateFunc;
  groupBy?: string[];
  comparisonOp?: '==' | '!=' | '>' | '<' | '>=' | '<=';
  comparisonValue?: number;
  rangeWindow?: string;
};

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

// OTel Semantic Convention → Prometheus 이름 (reverse alias)
export const OTEL_ALIAS_MAP: Record<string, string> = {
  'system.cpu.utilization': 'node_cpu_utilization_ratio',
  'system.memory.utilization': 'node_memory_utilization_ratio',
  'system.filesystem.utilization': 'node_filesystem_utilization_ratio',
  'system.network.io': 'node_network_io_bytes',
  'system.linux.cpu.load_1m': 'node_load1',
  'system.linux.cpu.load_5m': 'node_load5',
  'system.process.count': 'node_procs_running',
  'system.uptime': 'node_boot_time_seconds',
  'http.server.request.duration': 'http_server_request_duration_seconds',
};

// Prometheus 이름 → OTel Semantic Convention
export const PROM_TO_OTEL_MAP: Record<string, string> = {
  node_cpu_utilization_ratio: 'system.cpu.utilization',
  node_memory_utilization_ratio: 'system.memory.utilization',
  node_filesystem_utilization_ratio: 'system.filesystem.utilization',
  node_network_io_bytes: 'system.network.io',
  node_network_utilization_ratio: 'system.network.io',
  node_load1: 'system.linux.cpu.load_1m',
  node_load5: 'system.linux.cpu.load_5m',
  node_procs_running: 'system.process.count',
  node_boot_time_seconds: 'system.uptime',
  http_server_request_duration_seconds: 'http.server.request.duration',
  up: 'system.uptime',
};

export function validateQuery(query: string): string | null {
  if (!query || typeof query !== 'string') {
    return 'Query must be a non-empty string';
  }
  if (query.length > QUERY_MAX_LENGTH) {
    return `Query exceeds maximum length of ${QUERY_MAX_LENGTH} characters`;
  }
  return null;
}

function parseLabelMatchers(matcherStr: string): LabelMatcher[] {
  const matchers: LabelMatcher[] = [];
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

export function parsePromQL(query: string): ParsedQuery {
  const trimmed = query.trim();

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

  const simpleMatch = trimmed.match(/^([\w.]+)(?:\{([^}]*)\})?$/);
  if (simpleMatch) {
    return {
      type: 'instant',
      metricName: simpleMatch[1]!,
      matchers: simpleMatch[2] ? parseLabelMatchers(simpleMatch[2]) : [],
    };
  }

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

export function resolveOTelMetricName(metricName: string): string | null {
  if (OTEL_ALIAS_MAP[metricName] !== undefined) {
    return metricName;
  }
  const otelName = PROM_TO_OTEL_MAP[metricName];
  if (otelName) {
    return otelName;
  }
  return null;
}

export function matchLabels(
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

export function applyAggregation(
  samples: PromQLSample[],
  func: AggregateFunc,
  groupBy?: string[]
): PromQLSample[] {
  if (!groupBy || groupBy.length === 0) {
    if (samples.length === 0) return [];
    const values = samples.map((s) => s.value);
    const result = computeAgg(func, values);
    return [{ labels: {}, value: result }];
  }

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

export function applyComparison(
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
