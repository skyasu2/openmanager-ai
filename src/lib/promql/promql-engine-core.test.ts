import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { PromQLSample } from '@/types/processed-metrics';
import {
  applyAggregation,
  applyComparison,
  matchLabels,
  parsePromQL,
  resolveOTelMetricName,
  validateQuery,
} from './promql-engine-core';

// ---------------------------------------------------------------------------
// validateQuery
// ---------------------------------------------------------------------------
describe('validateQuery', () => {
  it('returns error for empty string', () => {
    expect(validateQuery('')).toBe('Query must be a non-empty string');
  });

  it('returns error for null cast as string', () => {
    expect(validateQuery(null as unknown as string)).toBe(
      'Query must be a non-empty string'
    );
  });

  it('returns error for string exceeding 512 chars', () => {
    const long = 'a'.repeat(513);
    expect(validateQuery(long)).toContain('exceeds maximum length');
  });

  it('returns null for valid query', () => {
    expect(validateQuery('up{job="api"}')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parsePromQL
// ---------------------------------------------------------------------------
describe('parsePromQL', () => {
  it('parses instant query: bare metric name', () => {
    const result = parsePromQL('node_cpu_utilization_ratio');
    expect(result).toEqual({
      type: 'instant',
      metricName: 'node_cpu_utilization_ratio',
      matchers: [],
    });
  });

  it('parses instant with labels', () => {
    const result = parsePromQL('up{instance="web-01"}');
    expect(result.type).toBe('instant');
    expect(result.metricName).toBe('up');
    expect(result.matchers).toEqual([
      { name: 'instance', op: '=', value: 'web-01' },
    ]);
  });

  it('parses rate query', () => {
    const result = parsePromQL('rate(http_requests_total{method="GET"}[5m])');
    expect(result.type).toBe('rate');
    expect(result.metricName).toBe('http_requests_total');
    expect(result.rangeWindow).toBe('5m');
    expect(result.matchers).toEqual([
      { name: 'method', op: '=', value: 'GET' },
    ]);
  });

  it('parses aggregate without by', () => {
    const result = parsePromQL('avg(node_cpu_utilization_ratio)');
    expect(result.type).toBe('aggregate');
    expect(result.aggregateFunc).toBe('avg');
    expect(result.metricName).toBe('node_cpu_utilization_ratio');
    expect(result.groupBy).toBeUndefined();
  });

  it('parses aggregate with by clause', () => {
    const result = parsePromQL('sum(requests_total) by (method,status)');
    expect(result.type).toBe('aggregate');
    expect(result.aggregateFunc).toBe('sum');
    expect(result.metricName).toBe('requests_total');
    expect(result.groupBy).toEqual(['method', 'status']);
  });

  it('parses aggregate with labels and by', () => {
    const result = parsePromQL(
      'avg(node_cpu_utilization_ratio{env="prod"}) by (host)'
    );
    expect(result.type).toBe('aggregate');
    expect(result.aggregateFunc).toBe('avg');
    expect(result.matchers).toEqual([{ name: 'env', op: '=', value: 'prod' }]);
    expect(result.groupBy).toEqual(['host']);
  });

  it('parses comparison: >', () => {
    const result = parsePromQL('node_cpu_utilization_ratio > 80');
    expect(result.type).toBe('comparison');
    expect(result.metricName).toBe('node_cpu_utilization_ratio');
    expect(result.comparisonOp).toBe('>');
    expect(result.comparisonValue).toBe(80);
  });

  it('parses comparison with labels: ==', () => {
    const result = parsePromQL('up{job="api"} == 1');
    expect(result.type).toBe('comparison');
    expect(result.metricName).toBe('up');
    expect(result.comparisonOp).toBe('==');
    expect(result.comparisonValue).toBe(1);
    expect(result.matchers).toEqual([{ name: 'job', op: '=', value: 'api' }]);
  });

  it('parses comparison with decimal value: >=', () => {
    const result = parsePromQL('error_rate >= 0.5');
    expect(result.type).toBe('comparison');
    expect(result.comparisonOp).toBe('>=');
    expect(result.comparisonValue).toBe(0.5);
  });

  it('falls back to instant for unrecognized pattern', () => {
    const result = parsePromQL('some_complex(query{foo="bar"} + other)');
    expect(result.type).toBe('instant');
    expect(result.matchers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseLabelMatchers (tested via parsePromQL)
// ---------------------------------------------------------------------------
describe('parseLabelMatchers (via parsePromQL)', () => {
  it('parses = matcher', () => {
    const { matchers } = parsePromQL('metric{key="value"}');
    expect(matchers).toEqual([{ name: 'key', op: '=', value: 'value' }]);
  });

  it('parses != matcher', () => {
    const { matchers } = parsePromQL('metric{env!="staging"}');
    expect(matchers).toEqual([{ name: 'env', op: '!=', value: 'staging' }]);
  });

  it('parses =~ regex matcher', () => {
    const { matchers } = parsePromQL('metric{host=~"web-.*"}');
    expect(matchers).toEqual([{ name: 'host', op: '=~', value: 'web-.*' }]);
  });

  it('parses !~ negative regex matcher', () => {
    const { matchers } = parsePromQL('metric{dc!~"us-east-.*"}');
    expect(matchers).toEqual([{ name: 'dc', op: '!~', value: 'us-east-.*' }]);
  });

  it('parses multiple matchers', () => {
    const { matchers } = parsePromQL(
      'metric{env="prod",region="kr",tier!="free"}'
    );
    expect(matchers).toHaveLength(3);
    expect(matchers[0]).toEqual({ name: 'env', op: '=', value: 'prod' });
    expect(matchers[1]).toEqual({ name: 'region', op: '=', value: 'kr' });
    expect(matchers[2]).toEqual({ name: 'tier', op: '!=', value: 'free' });
  });
});

// ---------------------------------------------------------------------------
// resolveOTelMetricName
// ---------------------------------------------------------------------------
describe('resolveOTelMetricName', () => {
  it('returns OTel name for known OTel metric', () => {
    expect(resolveOTelMetricName('system.cpu.utilization')).toBe(
      'system.cpu.utilization'
    );
  });

  it('returns OTel name for Prometheus metric', () => {
    expect(resolveOTelMetricName('node_cpu_utilization_ratio')).toBe(
      'system.cpu.utilization'
    );
  });

  it('returns null for unknown metric', () => {
    expect(resolveOTelMetricName('totally_unknown_metric')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// matchLabels
// ---------------------------------------------------------------------------
describe('matchLabels', () => {
  it('returns true with no matchers', () => {
    expect(matchLabels({ foo: 'bar' }, [])).toBe(true);
  });

  it('= match succeeds', () => {
    expect(
      matchLabels({ env: 'prod' }, [{ name: 'env', op: '=', value: 'prod' }])
    ).toBe(true);
  });

  it('= match fails', () => {
    expect(
      matchLabels({ env: 'staging' }, [{ name: 'env', op: '=', value: 'prod' }])
    ).toBe(false);
  });

  it('!= match', () => {
    expect(
      matchLabels({ env: 'staging' }, [
        { name: 'env', op: '!=', value: 'prod' },
      ])
    ).toBe(true);
    expect(
      matchLabels({ env: 'prod' }, [{ name: 'env', op: '!=', value: 'prod' }])
    ).toBe(false);
  });

  it('=~ regex match', () => {
    expect(
      matchLabels({ host: 'web-03' }, [
        { name: 'host', op: '=~', value: 'web-\\d+' },
      ])
    ).toBe(true);
    expect(
      matchLabels({ host: 'db-01' }, [
        { name: 'host', op: '=~', value: 'web-\\d+' },
      ])
    ).toBe(false);
  });

  it('!~ regex not match', () => {
    expect(
      matchLabels({ host: 'db-01' }, [
        { name: 'host', op: '!~', value: 'web-.*' },
      ])
    ).toBe(true);
    expect(
      matchLabels({ host: 'web-01' }, [
        { name: 'host', op: '!~', value: 'web-.*' },
      ])
    ).toBe(false);
  });

  it('missing label treated as empty string', () => {
    expect(matchLabels({}, [{ name: 'env', op: '=', value: '' }])).toBe(true);
    expect(matchLabels({}, [{ name: 'env', op: '=', value: 'prod' }])).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// applyAggregation
// ---------------------------------------------------------------------------
describe('applyAggregation', () => {
  const samples: PromQLSample[] = [
    { labels: { host: 'a', env: 'prod' }, value: 10 },
    { labels: { host: 'b', env: 'prod' }, value: 20 },
    { labels: { host: 'c', env: 'staging' }, value: 30 },
  ];

  it('avg with rounding', () => {
    const result = applyAggregation(
      [
        { labels: {}, value: 1 },
        { labels: {}, value: 2 },
        { labels: {}, value: 3 },
      ],
      'avg'
    );
    expect(result).toEqual([{ labels: {}, value: 2 }]);
  });

  it('avg rounds to 2 decimals', () => {
    const result = applyAggregation(
      [
        { labels: {}, value: 1 },
        { labels: {}, value: 2 },
      ],
      'avg'
    );
    // (1+2)/2 = 1.5
    expect(result[0]!.value).toBe(1.5);
  });

  it('max', () => {
    const result = applyAggregation(samples, 'max');
    expect(result).toEqual([{ labels: {}, value: 30 }]);
  });

  it('min', () => {
    const result = applyAggregation(samples, 'min');
    expect(result).toEqual([{ labels: {}, value: 10 }]);
  });

  it('sum', () => {
    const result = applyAggregation(samples, 'sum');
    expect(result).toEqual([{ labels: {}, value: 60 }]);
  });

  it('count', () => {
    const result = applyAggregation(samples, 'count');
    expect(result).toEqual([{ labels: {}, value: 3 }]);
  });

  it('empty samples returns empty', () => {
    const result = applyAggregation([], 'avg');
    expect(result).toEqual([]);
  });

  it('groupBy groups correctly', () => {
    const result = applyAggregation(samples, 'sum', ['env']);
    expect(result).toHaveLength(2);

    const prodGroup = result.find((r) => r.labels['env'] === 'prod');
    const stagingGroup = result.find((r) => r.labels['env'] === 'staging');
    expect(prodGroup?.value).toBe(30); // 10 + 20
    expect(stagingGroup?.value).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// applyComparison
// ---------------------------------------------------------------------------
describe('applyComparison', () => {
  const samples: PromQLSample[] = [
    { labels: { host: 'a' }, value: 50 },
    { labels: { host: 'b' }, value: 80 },
    { labels: { host: 'c' }, value: 90 },
    { labels: { host: 'd' }, value: 100 },
  ];

  it('> filters correctly', () => {
    const result = applyComparison(samples, '>', 80);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.value)).toEqual([90, 100]);
  });

  it('< filters', () => {
    const result = applyComparison(samples, '<', 80);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe(50);
  });

  it('== filters', () => {
    const result = applyComparison(samples, '==', 80);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe(80);
  });

  it('>= filters', () => {
    const result = applyComparison(samples, '>=', 90);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.value)).toEqual([90, 100]);
  });

  it('unknown op returns empty', () => {
    const result = applyComparison(samples, '???', 80);
    expect(result).toEqual([]);
  });
});
