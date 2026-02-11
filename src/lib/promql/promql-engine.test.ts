/**
 * PromQL Engine 단위 테스트
 *
 * 파싱, 라벨 필터링, 집계, 비교 연산, rate 계산, edge cases 포함
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';
import type { HourlyData, PrometheusTarget } from '@/data/hourly-data';
import { debugParsePromQL, executePromQL } from './promql-engine';

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ============================================================================
// Test Fixtures
// ============================================================================

function makeTarget(
  overrides: Partial<PrometheusTarget> & {
    instance: string;
    labels: PrometheusTarget['labels'];
    metrics: Partial<PrometheusTarget['metrics']>;
  }
): PrometheusTarget {
  return {
    job: 'node-exporter',
    instance: overrides.instance,
    labels: overrides.labels,
    metrics: {
      up: 1,
      node_cpu_usage_percent: 50,
      node_memory_usage_percent: 60,
      node_filesystem_usage_percent: 40,
      node_network_transmit_bytes_rate: 30,
      node_load1: 1.5,
      node_load5: 1.2,
      node_boot_time_seconds: 1700000000,
      node_procs_running: 5,
      node_http_request_duration_milliseconds: 120,
      ...overrides.metrics,
    },
    nodeInfo: {
      cpu_cores: 4,
      memory_total_bytes: 8e9,
      disk_total_bytes: 100e9,
    },
    logs: [],
  };
}

function makeHourlyData(
  targets: Record<string, PrometheusTarget>,
  hour = 10
): HourlyData {
  return {
    hour,
    scrapeConfig: {
      scrapeInterval: '10m',
      evaluationInterval: '10m',
      source: 'test',
    },
    dataPoints: [
      { timestampMs: Date.now(), targets },
      { timestampMs: Date.now() + 600000, targets },
      { timestampMs: Date.now() + 1200000, targets },
      { timestampMs: Date.now() + 1800000, targets },
      { timestampMs: Date.now() + 2400000, targets },
      { timestampMs: Date.now() + 3000000, targets },
    ],
  };
}

const WEB_SERVER_1 = makeTarget({
  instance: '192.168.1.1:9100',
  labels: {
    hostname: 'web-01',
    datacenter: 'icn',
    environment: 'production',
    server_type: 'web',
    os: 'linux',
    os_version: 'ubuntu-22.04',
  },
  metrics: { node_cpu_usage_percent: 75, node_memory_usage_percent: 60 },
});

const WEB_SERVER_2 = makeTarget({
  instance: '192.168.1.2:9100',
  labels: {
    hostname: 'web-02',
    datacenter: 'icn',
    environment: 'production',
    server_type: 'web',
    os: 'linux',
    os_version: 'ubuntu-22.04',
  },
  metrics: { node_cpu_usage_percent: 85, node_memory_usage_percent: 70 },
});

const DB_SERVER = makeTarget({
  instance: '192.168.1.10:9100',
  labels: {
    hostname: 'db-01',
    datacenter: 'icn',
    environment: 'production',
    server_type: 'database',
    os: 'linux',
    os_version: 'ubuntu-22.04',
  },
  metrics: { node_cpu_usage_percent: 45, node_memory_usage_percent: 80 },
});

const OFFLINE_SERVER = makeTarget({
  instance: '192.168.1.20:9100',
  labels: {
    hostname: 'cache-01',
    datacenter: 'busan',
    environment: 'staging',
    server_type: 'cache',
    os: 'linux',
    os_version: 'ubuntu-22.04',
  },
  metrics: { up: 0, node_cpu_usage_percent: 0, node_memory_usage_percent: 0 },
});

const TEST_TARGETS: Record<string, PrometheusTarget> = {
  '192.168.1.1:9100': WEB_SERVER_1,
  '192.168.1.2:9100': WEB_SERVER_2,
  '192.168.1.10:9100': DB_SERVER,
  '192.168.1.20:9100': OFFLINE_SERVER,
};

const TEST_HOURLY_DATA = makeHourlyData(TEST_TARGETS);

// ============================================================================
// Tests: Parser (debugParsePromQL)
// ============================================================================

describe('PromQL Parser (debugParsePromQL)', () => {
  it('simple metric name을 instant 쿼리로 파싱', () => {
    const result = debugParsePromQL('node_cpu_usage_percent');
    expect(result.type).toBe('instant');
    expect(result.metricName).toBe('node_cpu_usage_percent');
    expect(result.matchers).toEqual([]);
  });

  it('라벨 필터가 있는 instant 쿼리 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_usage_percent{server_type="web"}'
    );
    expect(result.type).toBe('instant');
    expect(result.metricName).toBe('node_cpu_usage_percent');
    expect(result.matchers).toEqual([
      { name: 'server_type', op: '=', value: 'web' },
    ]);
  });

  it('복수 라벨 필터 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_usage_percent{server_type="web",datacenter="icn"}'
    );
    expect(result.type).toBe('instant');
    expect(result.matchers).toHaveLength(2);
    expect(result.matchers[0]).toEqual({
      name: 'server_type',
      op: '=',
      value: 'web',
    });
    expect(result.matchers[1]).toEqual({
      name: 'datacenter',
      op: '=',
      value: 'icn',
    });
  });

  it('!= 라벨 연산자 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_usage_percent{server_type!="cache"}'
    );
    expect(result.matchers[0]!.op).toBe('!=');
  });

  it('=~ 정규식 라벨 연산자 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_usage_percent{server_type=~"web|api"}'
    );
    expect(result.matchers[0]!.op).toBe('=~');
    expect(result.matchers[0]!.value).toBe('web|api');
  });

  it('!~ 부정 정규식 라벨 연산자 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_usage_percent{server_type!~"cache"}'
    );
    expect(result.matchers[0]!.op).toBe('!~');
  });

  it('aggregate 함수 파싱 (avg)', () => {
    const result = debugParsePromQL('avg(node_cpu_usage_percent)');
    expect(result.type).toBe('aggregate');
    expect(result.aggregateFunc).toBe('avg');
    expect(result.metricName).toBe('node_cpu_usage_percent');
    expect(result.groupBy).toBeUndefined();
  });

  it('aggregate 함수 + by 절 파싱', () => {
    const result = debugParsePromQL(
      'max(node_cpu_usage_percent) by (server_type)'
    );
    expect(result.type).toBe('aggregate');
    expect(result.aggregateFunc).toBe('max');
    expect(result.groupBy).toEqual(['server_type']);
  });

  it('aggregate 함수 + 라벨 필터 + by 절 파싱', () => {
    const result = debugParsePromQL(
      'avg(node_cpu_usage_percent{datacenter="icn"}) by (server_type)'
    );
    expect(result.type).toBe('aggregate');
    expect(result.aggregateFunc).toBe('avg');
    expect(result.matchers).toEqual([
      { name: 'datacenter', op: '=', value: 'icn' },
    ]);
    expect(result.groupBy).toEqual(['server_type']);
  });

  it('comparison 쿼리 파싱', () => {
    const result = debugParsePromQL('up == 0');
    expect(result.type).toBe('comparison');
    expect(result.metricName).toBe('up');
    expect(result.comparisonOp).toBe('==');
    expect(result.comparisonValue).toBe(0);
  });

  it('comparison 쿼리 (>, <, >=, <=, !=)', () => {
    for (const op of ['>', '<', '>=', '<=', '!='] as const) {
      const result = debugParsePromQL(`node_cpu_usage_percent ${op} 80`);
      expect(result.type).toBe('comparison');
      expect(result.comparisonOp).toBe(op);
      expect(result.comparisonValue).toBe(80);
    }
  });

  it('소수점 비교값 파싱', () => {
    const result = debugParsePromQL('node_load1 > 1.5');
    expect(result.comparisonValue).toBe(1.5);
  });

  it('rate 쿼리 파싱', () => {
    const result = debugParsePromQL('rate(node_cpu_usage_percent[1h])');
    expect(result.type).toBe('rate');
    expect(result.metricName).toBe('node_cpu_usage_percent');
    expect(result.rangeWindow).toBe('1h');
  });

  it('rate 쿼리 + 라벨 필터 파싱', () => {
    const result = debugParsePromQL(
      'rate(node_cpu_usage_percent{server_type="web"}[2h])'
    );
    expect(result.type).toBe('rate');
    expect(result.matchers).toEqual([
      { name: 'server_type', op: '=', value: 'web' },
    ]);
    expect(result.rangeWindow).toBe('2h');
  });

  it('지원하는 모든 aggregate 함수', () => {
    for (const func of ['avg', 'max', 'min', 'sum', 'count'] as const) {
      const result = debugParsePromQL(`${func}(node_cpu_usage_percent)`);
      expect(result.type).toBe('aggregate');
      expect(result.aggregateFunc).toBe(func);
    }
  });

  it('인식할 수 없는 쿼리는 instant fallback', () => {
    const result = debugParsePromQL('something_weird_123');
    expect(result.type).toBe('instant');
    expect(result.metricName).toBe('something_weird_123');
  });

  it('공백이 있는 쿼리 trim 처리', () => {
    const result = debugParsePromQL('  node_cpu_usage_percent  ');
    expect(result.type).toBe('instant');
    expect(result.metricName).toBe('node_cpu_usage_percent');
  });
});

// ============================================================================
// Tests: executePromQL - Instant Selectors
// ============================================================================

describe('executePromQL - Instant Selectors', () => {
  it('전체 서버 CPU 메트릭 조회', () => {
    const result = executePromQL('node_cpu_usage_percent', TEST_HOURLY_DATA);
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(4);
  });

  it('라벨 필터링 (server_type="web")', () => {
    const result = executePromQL(
      'node_cpu_usage_percent{server_type="web"}',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(2);
    expect(result.result.every((s) => s.labels.server_type === 'web')).toBe(
      true
    );
  });

  it('라벨 부정 필터링 (server_type!="web")', () => {
    const result = executePromQL(
      'node_cpu_usage_percent{server_type!="web"}',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(2);
    expect(result.result.every((s) => s.labels.server_type !== 'web')).toBe(
      true
    );
  });

  it('정규식 라벨 필터링 (server_type=~"web|database")', () => {
    const result = executePromQL(
      'node_cpu_usage_percent{server_type=~"web|database"}',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(3);
  });

  it('부정 정규식 라벨 필터링 (server_type!~"cache")', () => {
    const result = executePromQL(
      'node_cpu_usage_percent{server_type!~"cache"}',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(3);
  });

  it('복수 라벨 필터 AND 조건', () => {
    const result = executePromQL(
      'node_cpu_usage_percent{server_type="web",datacenter="icn"}',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(2);
  });

  it('매칭되지 않는 라벨 필터 → 빈 결과', () => {
    const result = executePromQL(
      'node_cpu_usage_percent{server_type="nonexistent"}',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(0);
  });

  it('결과에 instance, job, labels 포함', () => {
    const result = executePromQL(
      'node_cpu_usage_percent{server_type="database"}',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    const sample = result.result[0]!;
    expect(sample.labels.instance).toBe('192.168.1.10:9100');
    expect(sample.labels.job).toBe('node-exporter');
    expect(sample.labels.server_type).toBe('database');
    expect(sample.value).toBe(45);
  });

  it('up 메트릭 조회', () => {
    const result = executePromQL('up', TEST_HOURLY_DATA);
    expect(result.result).toHaveLength(4);
    const offlineServer = result.result.find(
      (s) => s.labels.instance === '192.168.1.20:9100'
    );
    expect(offlineServer?.value).toBe(0);
  });

  it('존재하지 않는 메트릭 → 빈 결과', () => {
    const result = executePromQL('nonexistent_metric', TEST_HOURLY_DATA);
    expect(result.result).toHaveLength(0);
  });

  it('slotIndex를 지정하여 특정 dataPoint 조회', () => {
    const result = executePromQL(
      'node_cpu_usage_percent',
      TEST_HOURLY_DATA,
      undefined,
      undefined,
      3
    );
    expect(result.result).toHaveLength(4);
  });
});

// ============================================================================
// Tests: executePromQL - Aggregation
// ============================================================================

describe('executePromQL - Aggregation', () => {
  it('avg() 전역 집계', () => {
    const result = executePromQL(
      'avg(node_cpu_usage_percent)',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    // (75 + 85 + 45 + 0) / 4 = 51.25
    expect(result.result[0]!.value).toBe(51.25);
  });

  it('max() 전역 집계', () => {
    const result = executePromQL(
      'max(node_cpu_usage_percent)',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(85);
  });

  it('min() 전역 집계', () => {
    const result = executePromQL(
      'min(node_cpu_usage_percent)',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0);
  });

  it('sum() 전역 집계', () => {
    const result = executePromQL(
      'sum(node_cpu_usage_percent)',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(75 + 85 + 45 + 0);
  });

  it('count() 전역 집계', () => {
    const result = executePromQL(
      'count(node_cpu_usage_percent)',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(4);
  });

  it('avg() by (server_type) 그룹 집계', () => {
    const result = executePromQL(
      'avg(node_cpu_usage_percent) by (server_type)',
      TEST_HOURLY_DATA
    );
    // 3 groups: web, database, cache
    expect(result.result).toHaveLength(3);

    const webGroup = result.result.find((s) => s.labels.server_type === 'web');
    expect(webGroup?.value).toBe(80); // (75 + 85) / 2 = 80

    const dbGroup = result.result.find(
      (s) => s.labels.server_type === 'database'
    );
    expect(dbGroup?.value).toBe(45);

    const cacheGroup = result.result.find(
      (s) => s.labels.server_type === 'cache'
    );
    expect(cacheGroup?.value).toBe(0);
  });

  it('max() by (datacenter) 그룹 집계', () => {
    const result = executePromQL(
      'max(node_cpu_usage_percent) by (datacenter)',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(2); // icn, busan

    const icnGroup = result.result.find((s) => s.labels.datacenter === 'icn');
    expect(icnGroup?.value).toBe(85);

    const busanGroup = result.result.find(
      (s) => s.labels.datacenter === 'busan'
    );
    expect(busanGroup?.value).toBe(0);
  });

  it('라벨 필터 + aggregate', () => {
    const result = executePromQL(
      'avg(node_cpu_usage_percent{server_type="web"})',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(80); // (75 + 85) / 2
  });

  it('빈 데이터에 대한 aggregate → 빈 결과', () => {
    const emptyData = makeHourlyData({});
    const result = executePromQL('avg(node_cpu_usage_percent)', emptyData);
    expect(result.result).toHaveLength(0);
  });
});

// ============================================================================
// Tests: executePromQL - Comparison
// ============================================================================

describe('executePromQL - Comparison', () => {
  it('up == 0 (오프라인 서버)', () => {
    const result = executePromQL('up == 0', TEST_HOURLY_DATA);
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.labels.instance).toBe('192.168.1.20:9100');
  });

  it('up == 1 (온라인 서버)', () => {
    const result = executePromQL('up == 1', TEST_HOURLY_DATA);
    expect(result.result).toHaveLength(3);
  });

  it('node_cpu_usage_percent > 80', () => {
    const result = executePromQL(
      'node_cpu_usage_percent > 80',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(85);
  });

  it('node_cpu_usage_percent >= 75', () => {
    const result = executePromQL(
      'node_cpu_usage_percent >= 75',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(2); // 75, 85
  });

  it('node_cpu_usage_percent < 50', () => {
    const result = executePromQL(
      'node_cpu_usage_percent < 50',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(2); // 45, 0
  });

  it('node_cpu_usage_percent <= 45', () => {
    const result = executePromQL(
      'node_cpu_usage_percent <= 45',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(2); // 45, 0
  });

  it('node_cpu_usage_percent != 75', () => {
    const result = executePromQL(
      'node_cpu_usage_percent != 75',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(3); // 85, 45, 0
  });

  it('라벨 필터 + comparison', () => {
    const result = executePromQL(
      'node_cpu_usage_percent{server_type="web"} > 80',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(85);
  });
});

// ============================================================================
// Tests: executePromQL - Rate
// ============================================================================

describe('executePromQL - Rate', () => {
  it('rate 쿼리 (hourlyDataMap 제공 시)', () => {
    const prevTargets: Record<string, PrometheusTarget> = {
      '192.168.1.1:9100': makeTarget({
        instance: '192.168.1.1:9100',
        labels: WEB_SERVER_1.labels,
        metrics: { node_cpu_usage_percent: 70 },
      }),
    };

    const currentHour = 10;
    const prevHour = 9;
    const hourlyDataMap = new Map<number, HourlyData>();
    hourlyDataMap.set(currentHour, TEST_HOURLY_DATA);
    hourlyDataMap.set(prevHour, makeHourlyData(prevTargets, prevHour));

    const result = executePromQL(
      'rate(node_cpu_usage_percent[1h])',
      TEST_HOURLY_DATA,
      hourlyDataMap,
      currentHour
    );

    expect(result.resultType).toBe('vector');
    // 현재 시간대 서버가 이전 시간대에도 존재해야 rate 계산
    expect(result.result.length).toBeGreaterThan(0);
  });

  it('rate 쿼리 (hourlyDataMap 없으면 빈 결과)', () => {
    const result = executePromQL(
      'rate(node_cpu_usage_percent[1h])',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(0);
  });

  it('rate 쿼리 (이전 시간대 데이터 없으면 빈 결과)', () => {
    const hourlyDataMap = new Map<number, HourlyData>();
    hourlyDataMap.set(10, TEST_HOURLY_DATA);
    // prevHour (9) 데이터 없음

    const result = executePromQL(
      'rate(node_cpu_usage_percent[1h])',
      TEST_HOURLY_DATA,
      hourlyDataMap,
      10
    );
    expect(result.result).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('executePromQL - Edge Cases', () => {
  it('빈 targets → 빈 결과', () => {
    const emptyData = makeHourlyData({});
    const result = executePromQL('node_cpu_usage_percent', emptyData);
    expect(result.result).toHaveLength(0);
  });

  it('빈 dataPoints → 빈 결과', () => {
    const noDataPoints: HourlyData = {
      hour: 0,
      scrapeConfig: {
        scrapeInterval: '10m',
        evaluationInterval: '10m',
        source: 'test',
      },
      dataPoints: [],
    };
    const result = executePromQL('node_cpu_usage_percent', noDataPoints);
    expect(result.result).toHaveLength(0);
  });

  it('slotIndex가 범위를 벗어나면 첫 번째 dataPoint 사용', () => {
    const result = executePromQL(
      'node_cpu_usage_percent',
      TEST_HOURLY_DATA,
      undefined,
      undefined,
      99
    );
    // dataPoints[99]가 없으므로 dataPoints[0] fallback
    expect(result.result).toHaveLength(4);
  });

  it('여러 메트릭 종류 조회 가능', () => {
    const metrics = [
      'node_cpu_usage_percent',
      'node_memory_usage_percent',
      'node_filesystem_usage_percent',
      'node_network_transmit_bytes_rate',
      'node_load1',
      'up',
    ];

    for (const metric of metrics) {
      const result = executePromQL(metric, TEST_HOURLY_DATA);
      expect(result.result.length).toBeGreaterThan(0);
    }
  });

  it('aggregate 결과의 labels는 빈 객체 (전역)', () => {
    const result = executePromQL(
      'avg(node_cpu_usage_percent)',
      TEST_HOURLY_DATA
    );
    expect(result.result[0]!.labels).toEqual({});
  });

  it('group by 결과의 labels에 그룹 키만 포함', () => {
    const result = executePromQL(
      'avg(node_cpu_usage_percent) by (server_type)',
      TEST_HOURLY_DATA
    );
    for (const sample of result.result) {
      expect(Object.keys(sample.labels)).toEqual(['server_type']);
    }
  });
});

// ============================================================================
// Tests: OTel Metric Name Aliases
// ============================================================================

describe('executePromQL - OTel Metric Name Aliases', () => {
  it('OTel 이름 system.cpu.utilization → Prometheus node_cpu_usage_percent 조회', () => {
    const result = executePromQL('system.cpu.utilization', TEST_HOURLY_DATA);
    expect(result.result).toHaveLength(4);
    // web-01: 75, web-02: 85, db-01: 45, cache-01: 0
    expect(result.result[0]!.value).toBe(75);
  });

  it('OTel 이름 + 라벨 필터', () => {
    const result = executePromQL(
      'system.cpu.utilization{server_type="web"}',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(2);
  });

  it('OTel 이름 + aggregate', () => {
    const result = executePromQL(
      'avg(system.cpu.utilization)',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(51.25);
  });

  it('OTel 이름 + aggregate + by', () => {
    const result = executePromQL(
      'avg(system.cpu.utilization) by (server_type)',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(3);
    const webGroup = result.result.find((s) => s.labels.server_type === 'web');
    expect(webGroup?.value).toBe(80);
  });

  it('OTel 이름 + comparison', () => {
    const result = executePromQL(
      'system.cpu.utilization > 80',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(85);
  });

  it('system.status == 0 (up == 0 동등)', () => {
    const result = executePromQL('system.status == 0', TEST_HOURLY_DATA);
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.labels.instance).toBe('192.168.1.20:9100');
  });

  it('system.memory.utilization 조회', () => {
    const result = executePromQL('system.memory.utilization', TEST_HOURLY_DATA);
    expect(result.result).toHaveLength(4);
  });

  it('http.server.request.duration 조회', () => {
    const result = executePromQL(
      'http.server.request.duration',
      TEST_HOURLY_DATA
    );
    expect(result.result).toHaveLength(4);
    // 모든 서버의 기본값: 120ms
    expect(result.result[0]!.value).toBe(120);
  });

  it('OTel 이름 파서 검증 (debugParsePromQL)', () => {
    const result = debugParsePromQL(
      'system.cpu.utilization{server_type="web"}'
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('system.cpu.utilization');
    expect(result!.matchers).toHaveLength(1);
  });

  it('OTel 이름 rate 쿼리 파싱', () => {
    const result = debugParsePromQL('rate(system.cpu.utilization[1h])');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('rate');
    expect(result!.metricName).toBe('system.cpu.utilization');
  });
});

// ============================================================================
// Tests: Query Validation
// ============================================================================

describe('Query Validation', () => {
  it('빈 쿼리 → executePromQL 빈 결과 반환', () => {
    const result = executePromQL('', TEST_HOURLY_DATA);
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('512자 초과 쿼리 → 빈 결과 반환', () => {
    const longQuery = `node_cpu_usage_percent{hostname="${'a'.repeat(513)}"}`;
    const result = executePromQL(longQuery, TEST_HOURLY_DATA);
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('정상 길이 쿼리 → 정상 동작', () => {
    const result = executePromQL('node_cpu_usage_percent', TEST_HOURLY_DATA);
    expect(result.result.length).toBeGreaterThan(0);
  });

  it('matcher 10개 초과 → 10개까지만 파싱', () => {
    // 12개 matcher를 가진 쿼리 생성
    const matchers = Array.from(
      { length: 12 },
      (_, i) => `key${i}="val${i}"`
    ).join(',');
    const query = `node_cpu_usage_percent{${matchers}}`;
    const parsed = debugParsePromQL(query);
    expect(parsed).not.toBeNull();
    expect(parsed!.matchers.length).toBeLessThanOrEqual(10);
  });

  it('잘못된 정규식 (=~) → 매칭 실패 (예외 안 남)', () => {
    // "((" 는 잘못된 정규식
    const result = executePromQL(
      'node_cpu_usage_percent{server_type=~"(("}',
      TEST_HOURLY_DATA
    );
    // 잘못된 정규식이므로 모든 서버가 매칭 실패 → 빈 결과
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('라벨 값 128자 초과 → 해당 matcher 무시', () => {
    const longValue = 'x'.repeat(129);
    const query = `node_cpu_usage_percent{server_type="${longValue}"}`;
    const parsed = debugParsePromQL(query);
    expect(parsed).not.toBeNull();
    // 128자 초과 라벨 값은 무시되므로 matchers가 비어있음
    expect(parsed!.matchers).toHaveLength(0);
  });

  it('debugParsePromQL 빈 쿼리 → null 반환', () => {
    const result = debugParsePromQL('');
    expect(result).toBeNull();
  });

  it('debugParsePromQL 512자 초과 쿼리 → null 반환', () => {
    const longQuery = 'a'.repeat(513);
    const result = debugParsePromQL(longQuery);
    expect(result).toBeNull();
  });
});
