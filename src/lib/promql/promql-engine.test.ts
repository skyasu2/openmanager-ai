/**
 * PromQL Engine 단위 테스트 (OTel-native)
 *
 * 파싱, 라벨 필터링, 집계, 비교 연산, rate 계산, edge cases 포함
 * OTel 데이터 구조 기반 테스트
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  OTelHourlyFile,
  OTelHourlySlot,
  OTelMetric,
  OTelMetricDataPoint,
  OTelResourceCatalog,
} from '@/types/otel-metrics';
import { debugParsePromQL, executePromQL } from './promql-engine';

// ============================================================================
// Mock: Resource Catalog
// ============================================================================

const MOCK_RESOURCE_CATALOG: OTelResourceCatalog = {
  schemaVersion: '1.0.0',
  generatedAt: '2026-02-15T00:00:00Z',
  resources: {
    'web-01': {
      'service.name': 'openmanager-ai',
      'host.name': 'web-01.test.kr',
      'host.id': 'web-01',
      'server.role': 'web',
      'os.type': 'linux',
      'os.description': 'ubuntu-22.04',
      'cloud.region': 'onprem-dc1',
      'cloud.availability_zone': 'onprem-dc1',
      'deployment.environment': 'production',
    },
    'web-02': {
      'service.name': 'openmanager-ai',
      'host.name': 'web-02.test.kr',
      'host.id': 'web-02',
      'server.role': 'web',
      'os.type': 'linux',
      'os.description': 'ubuntu-22.04',
      'cloud.region': 'onprem-dc1',
      'cloud.availability_zone': 'onprem-dc1',
      'deployment.environment': 'production',
    },
    'db-01': {
      'service.name': 'openmanager-ai',
      'host.name': 'db-01.test.kr',
      'host.id': 'db-01',
      'server.role': 'database',
      'os.type': 'linux',
      'os.description': 'ubuntu-22.04',
      'cloud.region': 'onprem-dc1',
      'cloud.availability_zone': 'onprem-dc1',
      'deployment.environment': 'production',
    },
    'cache-01': {
      'service.name': 'openmanager-ai',
      'host.name': 'cache-01.test.kr',
      'host.id': 'cache-01',
      'server.role': 'cache',
      'os.type': 'linux',
      'os.description': 'ubuntu-22.04',
      'cloud.region': 'onprem-dc1',
      'cloud.availability_zone': 'onprem-dc2',
      'deployment.environment': 'staging',
    },
  },
};

vi.mock('@/data/otel-data', () => ({
  getResourceCatalog: () => MOCK_RESOURCE_CATALOG,
}));

// ============================================================================
// Test Fixture Helpers
// ============================================================================

function makeDataPoint(hostname: string, value: number): OTelMetricDataPoint {
  return {
    asDouble: value,
    attributes: { 'host.name': hostname },
  };
}

function makeMetric(
  name: string,
  dataPoints: OTelMetricDataPoint[],
  options?: { unit?: string; type?: 'gauge' | 'sum' }
): OTelMetric {
  return {
    name,
    unit: options?.unit ?? '1',
    type: options?.type ?? 'gauge',
    dataPoints,
  };
}

const ALL_HOSTS = [
  'web-01.test.kr',
  'web-02.test.kr',
  'db-01.test.kr',
  'cache-01.test.kr',
];

function makeSlot(
  metricOverrides?: Partial<Record<string, Record<string, number>>>
): OTelHourlySlot {
  // Default metric values per host
  const defaults: Record<string, Record<string, number>> = {
    'web-01.test.kr': {
      'system.cpu.utilization': 0.75,
      'system.memory.utilization': 0.6,
      'system.filesystem.utilization': 0.4,
      'system.network.utilization': 30,
      'system.linux.cpu.load_1m': 1.5,
      'system.linux.cpu.load_5m': 1.2,
      'system.process.count': 5,
      'system.uptime': 35000000,
      'http.server.request.duration': 0.12,
    },
    'web-02.test.kr': {
      'system.cpu.utilization': 0.85,
      'system.memory.utilization': 0.7,
      'system.filesystem.utilization': 0.4,
      'system.network.utilization': 30,
      'system.linux.cpu.load_1m': 1.5,
      'system.linux.cpu.load_5m': 1.2,
      'system.process.count': 5,
      'system.uptime': 35000000,
      'http.server.request.duration': 0.12,
    },
    'db-01.test.kr': {
      'system.cpu.utilization': 0.45,
      'system.memory.utilization': 0.8,
      'system.filesystem.utilization': 0.4,
      'system.network.utilization': 30,
      'system.linux.cpu.load_1m': 1.5,
      'system.linux.cpu.load_5m': 1.2,
      'system.process.count': 5,
      'system.uptime': 35000000,
      'http.server.request.duration': 0.12,
    },
    'cache-01.test.kr': {
      'system.cpu.utilization': 0,
      'system.memory.utilization': 0,
      'system.filesystem.utilization': 0.4,
      'system.network.utilization': 30,
      'system.linux.cpu.load_1m': 1.5,
      'system.linux.cpu.load_5m': 1.2,
      'system.process.count': 5,
      'system.uptime': 0, // offline: uptime=0
      'http.server.request.duration': 0.12,
    },
  };

  // Apply overrides
  if (metricOverrides) {
    for (const [host, overrides] of Object.entries(metricOverrides)) {
      if (defaults[host]) {
        for (const [metric, value] of Object.entries(overrides)) {
          defaults[host]![metric] = value;
        }
      }
    }
  }

  // Build metric list from the defaults
  const metricNames = [
    'system.cpu.utilization',
    'system.memory.utilization',
    'system.filesystem.utilization',
    'system.network.utilization',
    'system.linux.cpu.load_1m',
    'system.linux.cpu.load_5m',
    'system.process.count',
    'system.uptime',
    'http.server.request.duration',
  ];

  const metrics: OTelMetric[] = metricNames.map((name) =>
    makeMetric(
      name,
      ALL_HOSTS.map((host) => makeDataPoint(host, defaults[host]?.[name] ?? 0))
    )
  );

  return {
    startTimeUnixNano: Date.now() * 1_000_000,
    endTimeUnixNano: (Date.now() + 600_000) * 1_000_000,
    metrics,
    logs: [],
  };
}

function makeOTelHourlyFile(
  hour = 10,
  slotOverrides?: Array<
    Partial<Record<string, Record<string, number>>> | undefined
  >
): OTelHourlyFile {
  const slotCount = slotOverrides?.length ?? 6;
  const slots: OTelHourlySlot[] = [];
  for (let i = 0; i < slotCount; i++) {
    slots.push(makeSlot(slotOverrides?.[i]));
  }
  return {
    schemaVersion: '1.0.0',
    hour,
    scope: { name: 'test', version: '1.0.0' },
    slots,
  };
}

// ============================================================================
// Test Data
// ============================================================================

let TEST_OTEL_DATA: OTelHourlyFile;

beforeEach(() => {
  TEST_OTEL_DATA = makeOTelHourlyFile();
});

// ============================================================================
// Tests: Parser (debugParsePromQL)
// ============================================================================

describe('PromQL Parser (debugParsePromQL)', () => {
  it('simple metric name을 instant 쿼리로 파싱', () => {
    const result = debugParsePromQL('node_cpu_utilization_ratio');
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
    expect(result!.matchers).toEqual([]);
  });

  it('라벨 필터가 있는 instant 쿼리 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type="web"}'
    );
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
    expect(result!.matchers).toEqual([
      { name: 'server_type', op: '=', value: 'web' },
    ]);
  });

  it('복수 라벨 필터 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type="web",datacenter="onprem-dc1"}'
    );
    expect(result!.type).toBe('instant');
    expect(result!.matchers).toHaveLength(2);
    expect(result!.matchers[0]).toEqual({
      name: 'server_type',
      op: '=',
      value: 'web',
    });
    expect(result!.matchers[1]).toEqual({
      name: 'datacenter',
      op: '=',
      value: 'onprem-dc1',
    });
  });

  it('!= 라벨 연산자 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type!="cache"}'
    );
    expect(result!.matchers[0]!.op).toBe('!=');
  });

  it('=~ 정규식 라벨 연산자 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type=~"web|api"}'
    );
    expect(result!.matchers[0]!.op).toBe('=~');
    expect(result!.matchers[0]!.value).toBe('web|api');
  });

  it('!~ 부정 정규식 라벨 연산자 파싱', () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type!~"cache"}'
    );
    expect(result!.matchers[0]!.op).toBe('!~');
  });

  it('aggregate 함수 파싱 (avg)', () => {
    const result = debugParsePromQL('avg(node_cpu_utilization_ratio)');
    expect(result!.type).toBe('aggregate');
    expect(result!.aggregateFunc).toBe('avg');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
    expect(result!.groupBy).toBeUndefined();
  });

  it('aggregate 함수 + by 절 파싱', () => {
    const result = debugParsePromQL(
      'max(node_cpu_utilization_ratio) by (server_type)'
    );
    expect(result!.type).toBe('aggregate');
    expect(result!.aggregateFunc).toBe('max');
    expect(result!.groupBy).toEqual(['server_type']);
  });

  it('aggregate 함수 + 라벨 필터 + by 절 파싱', () => {
    const result = debugParsePromQL(
      'avg(node_cpu_utilization_ratio{datacenter="onprem-dc1"}) by (server_type)'
    );
    expect(result!.type).toBe('aggregate');
    expect(result!.aggregateFunc).toBe('avg');
    expect(result!.matchers).toEqual([
      { name: 'datacenter', op: '=', value: 'onprem-dc1' },
    ]);
    expect(result!.groupBy).toEqual(['server_type']);
  });

  it('comparison 쿼리 파싱', () => {
    const result = debugParsePromQL('up == 0');
    expect(result!.type).toBe('comparison');
    expect(result!.metricName).toBe('up');
    expect(result!.comparisonOp).toBe('==');
    expect(result!.comparisonValue).toBe(0);
  });

  it('comparison 쿼리 (>, <, >=, <=, !=)', () => {
    for (const op of ['>', '<', '>=', '<=', '!='] as const) {
      const result = debugParsePromQL(`node_cpu_utilization_ratio ${op} 80`);
      expect(result!.type).toBe('comparison');
      expect(result!.comparisonOp).toBe(op);
      expect(result!.comparisonValue).toBe(80);
    }
  });

  it('소수점 비교값 파싱', () => {
    const result = debugParsePromQL('node_load1 > 1.5');
    expect(result!.comparisonValue).toBe(1.5);
  });

  it('rate 쿼리 파싱', () => {
    const result = debugParsePromQL('rate(node_cpu_utilization_ratio[1h])');
    expect(result!.type).toBe('rate');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
    expect(result!.rangeWindow).toBe('1h');
  });

  it('rate 쿼리 + 라벨 필터 파싱', () => {
    const result = debugParsePromQL(
      'rate(node_cpu_utilization_ratio{server_type="web"}[2h])'
    );
    expect(result!.type).toBe('rate');
    expect(result!.matchers).toEqual([
      { name: 'server_type', op: '=', value: 'web' },
    ]);
    expect(result!.rangeWindow).toBe('2h');
  });

  it('지원하는 모든 aggregate 함수', () => {
    for (const func of ['avg', 'max', 'min', 'sum', 'count'] as const) {
      const result = debugParsePromQL(`${func}(node_cpu_utilization_ratio)`);
      expect(result!.type).toBe('aggregate');
      expect(result!.aggregateFunc).toBe(func);
    }
  });

  it('인식할 수 없는 쿼리는 instant fallback', () => {
    const result = debugParsePromQL('something_weird_123');
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('something_weird_123');
  });

  it('공백이 있는 쿼리 trim 처리', () => {
    const result = debugParsePromQL('  node_cpu_utilization_ratio  ');
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
  });
});

// ============================================================================
// Tests: executePromQL - Instant Selectors
// ============================================================================

describe('executePromQL - Instant Selectors', () => {
  it('전체 서버 CPU 메트릭 조회 (Prometheus 이름)', () => {
    const result = executePromQL('node_cpu_utilization_ratio', TEST_OTEL_DATA);
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(4);
  });

  it('라벨 필터링 (server_type="web")', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type="web"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2);
    expect(result.result.every((s) => s.labels.server_type === 'web')).toBe(
      true
    );
  });

  it('라벨 부정 필터링 (server_type!="web")', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type!="web"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2);
    expect(result.result.every((s) => s.labels.server_type !== 'web')).toBe(
      true
    );
  });

  it('정규식 라벨 필터링 (server_type=~"web|database")', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type=~"web|database"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(3);
  });

  it('부정 정규식 라벨 필터링 (server_type!~"cache")', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type!~"cache"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(3);
  });

  it('복수 라벨 필터 AND 조건', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type="web",datacenter="onprem-dc1"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2);
  });

  it('매칭되지 않는 라벨 필터 -> 빈 결과', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type="nonexistent"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(0);
  });

  it('결과에 instance, job, labels 포함', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type="database"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    const sample = result.result[0]!;
    expect(sample.labels.instance).toBe('db-01');
    expect(sample.labels.job).toBe('node-exporter');
    expect(sample.labels.server_type).toBe('database');
    expect(sample.value).toBe(0.45);
  });

  it('up 메트릭 조회 (system.uptime 기반)', () => {
    const result = executePromQL('up', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(4);
    // cache-01 has uptime=0, so up=0
    const offlineServer = result.result.find(
      (s) => s.labels.instance === 'cache-01'
    );
    expect(offlineServer?.value).toBe(0);
    // Others have uptime>0, so up=1
    const onlineServer = result.result.find(
      (s) => s.labels.instance === 'web-01'
    );
    expect(onlineServer?.value).toBe(1);
  });

  it('존재하지 않는 메트릭 -> 빈 결과', () => {
    const result = executePromQL('nonexistent_metric', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(0);
  });

  it('slotIndex를 지정하여 특정 slot 조회', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio',
      TEST_OTEL_DATA,
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
      'avg(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    // (0.75 + 0.85 + 0.45 + 0) / 4 = 0.51...
    expect(result.result[0]!.value).toBe(0.51);
  });

  it('max() 전역 집계', () => {
    const result = executePromQL(
      'max(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.85);
  });

  it('min() 전역 집계', () => {
    const result = executePromQL(
      'min(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0);
  });

  it('sum() 전역 집계', () => {
    const result = executePromQL(
      'sum(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBeCloseTo(0.75 + 0.85 + 0.45 + 0, 10);
  });

  it('count() 전역 집계', () => {
    const result = executePromQL(
      'count(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(4);
  });

  it('avg() by (server_type) 그룹 집계', () => {
    const result = executePromQL(
      'avg(node_cpu_utilization_ratio) by (server_type)',
      TEST_OTEL_DATA
    );
    // 3 groups: web, database, cache
    expect(result.result).toHaveLength(3);

    const webGroup = result.result.find((s) => s.labels.server_type === 'web');
    expect(webGroup?.value).toBe(0.8); // (0.75 + 0.85) / 2 = 0.80

    const dbGroup = result.result.find(
      (s) => s.labels.server_type === 'database'
    );
    expect(dbGroup?.value).toBe(0.45);

    const cacheGroup = result.result.find(
      (s) => s.labels.server_type === 'cache'
    );
    expect(cacheGroup?.value).toBe(0);
  });

  it('max() by (datacenter) 그룹 집계', () => {
    const result = executePromQL(
      'max(node_cpu_utilization_ratio) by (datacenter)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2); // onprem-dc1, onprem-dc2

    const dc1Group = result.result.find(
      (s) => s.labels.datacenter === 'onprem-dc1'
    );
    expect(dc1Group?.value).toBe(0.85);

    const dc2Group = result.result.find(
      (s) => s.labels.datacenter === 'onprem-dc2'
    );
    expect(dc2Group?.value).toBe(0);
  });

  it('라벨 필터 + aggregate', () => {
    const result = executePromQL(
      'avg(node_cpu_utilization_ratio{server_type="web"})',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.8); // (0.75 + 0.85) / 2
  });

  it('빈 데이터에 대한 aggregate -> 빈 결과', () => {
    const emptyData: OTelHourlyFile = {
      schemaVersion: '1.0.0',
      hour: 0,
      scope: { name: 'test', version: '1.0.0' },
      slots: [
        {
          startTimeUnixNano: 0,
          endTimeUnixNano: 0,
          metrics: [makeMetric('system.cpu.utilization', [])],
          logs: [],
        },
      ],
    };
    const result = executePromQL('avg(node_cpu_utilization_ratio)', emptyData);
    expect(result.result).toHaveLength(0);
  });
});

// ============================================================================
// Tests: executePromQL - Comparison
// ============================================================================

describe('executePromQL - Comparison', () => {
  it('up == 0 (오프라인 서버)', () => {
    const result = executePromQL('up == 0', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.labels.instance).toBe('cache-01');
  });

  it('up == 1 (온라인 서버)', () => {
    const result = executePromQL('up == 1', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(3);
  });

  it('node_cpu_utilization_ratio > 0.80', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio > 0.80',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.85);
  });

  it('node_cpu_utilization_ratio >= 0.75', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio >= 0.75',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2); // 0.75, 0.85
  });

  it('node_cpu_utilization_ratio < 0.50', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio < 0.50',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2); // 0.45, 0
  });

  it('node_cpu_utilization_ratio <= 0.45', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio <= 0.45',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2); // 0.45, 0
  });

  it('node_cpu_utilization_ratio != 0.75', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio != 0.75',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(3); // 0.85, 0.45, 0
  });

  it('라벨 필터 + comparison', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type="web"} > 0.80',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.85);
  });
});

// ============================================================================
// Tests: executePromQL - Rate
// ============================================================================

describe('executePromQL - Rate', () => {
  it('rate 쿼리 (hourlyFileMap 제공 시)', () => {
    const prevData = makeOTelHourlyFile(9, [
      {
        'web-01.test.kr': { 'system.cpu.utilization': 0.7 },
      },
    ]);

    const currentHour = 10;
    const prevHour = 9;
    const hourlyFileMap = new Map<number, OTelHourlyFile>();
    hourlyFileMap.set(currentHour, TEST_OTEL_DATA);
    hourlyFileMap.set(prevHour, prevData);

    const result = executePromQL(
      'rate(node_cpu_utilization_ratio[1h])',
      TEST_OTEL_DATA,
      hourlyFileMap,
      currentHour
    );

    expect(result.resultType).toBe('vector');
    expect(result.result.length).toBeGreaterThan(0);
  });

  it('rate 쿼리 (hourlyFileMap 없으면 빈 결과)', () => {
    const result = executePromQL(
      'rate(node_cpu_utilization_ratio[1h])',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(0);
  });

  it('rate 쿼리 (이전 시간대 데이터 없으면 빈 결과)', () => {
    const hourlyFileMap = new Map<number, OTelHourlyFile>();
    hourlyFileMap.set(10, TEST_OTEL_DATA);
    // prevHour (9) 데이터 없음

    const result = executePromQL(
      'rate(node_cpu_utilization_ratio[1h])',
      TEST_OTEL_DATA,
      hourlyFileMap,
      10
    );
    expect(result.result).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('executePromQL - Edge Cases', () => {
  it('빈 slots -> 빈 결과', () => {
    const emptyData: OTelHourlyFile = {
      schemaVersion: '1.0.0',
      hour: 0,
      scope: { name: 'test', version: '1.0.0' },
      slots: [],
    };
    const result = executePromQL('node_cpu_utilization_ratio', emptyData);
    expect(result.result).toHaveLength(0);
  });

  it('slotIndex가 범위를 벗어나면 첫 번째 slot 사용', () => {
    const result = executePromQL(
      'node_cpu_utilization_ratio',
      TEST_OTEL_DATA,
      undefined,
      undefined,
      99
    );
    // slots[99]가 없으므로 slots[0] fallback
    expect(result.result).toHaveLength(4);
  });

  it('여러 메트릭 종류 조회 가능 (Prometheus 이름)', () => {
    const metrics = [
      'node_cpu_utilization_ratio',
      'node_memory_utilization_ratio',
      'node_filesystem_utilization_ratio',
      'node_network_utilization_ratio',
      'node_load1',
      'up',
    ];

    for (const metric of metrics) {
      const result = executePromQL(metric, TEST_OTEL_DATA);
      expect(result.result.length).toBeGreaterThan(0);
    }
  });

  it('aggregate 결과의 labels는 빈 객체 (전역)', () => {
    const result = executePromQL(
      'avg(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result[0]!.labels).toEqual({});
  });

  it('group by 결과의 labels에 그룹 키만 포함', () => {
    const result = executePromQL(
      'avg(node_cpu_utilization_ratio) by (server_type)',
      TEST_OTEL_DATA
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
  it('OTel 이름 system.cpu.utilization 직접 조회', () => {
    const result = executePromQL('system.cpu.utilization', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(4);
    // web-01: 0.75
    const web01 = result.result.find((s) => s.labels.instance === 'web-01');
    expect(web01?.value).toBe(0.75);
  });

  it('OTel 이름 + 라벨 필터', () => {
    const result = executePromQL(
      'system.cpu.utilization{server_type="web"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2);
  });

  it('OTel 이름 + aggregate', () => {
    const result = executePromQL('avg(system.cpu.utilization)', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.51);
  });

  it('OTel 이름 + aggregate + by', () => {
    const result = executePromQL(
      'avg(system.cpu.utilization) by (server_type)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(3);
    const webGroup = result.result.find((s) => s.labels.server_type === 'web');
    expect(webGroup?.value).toBe(0.8);
  });

  it('OTel 이름 + comparison', () => {
    const result = executePromQL(
      'system.cpu.utilization > 0.80',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.85);
  });

  it('up == 0 으로 오프라인 서버 조회', () => {
    const result = executePromQL('up == 0', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.labels.instance).toBe('cache-01');
  });

  it('system.memory.utilization 조회', () => {
    const result = executePromQL('system.memory.utilization', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(4);
  });

  it('http.server.request.duration 조회', () => {
    const result = executePromQL(
      'http.server.request.duration',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(4);
    // 모든 서버의 기본값: 0.120 (seconds)
    expect(result.result[0]!.value).toBe(0.12);
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
  it('빈 쿼리 -> executePromQL 빈 결과 반환', () => {
    const result = executePromQL('', TEST_OTEL_DATA);
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('512자 초과 쿼리 -> 빈 결과 반환', () => {
    const longQuery = `node_cpu_utilization_ratio{hostname="${'a'.repeat(513)}"}`;
    const result = executePromQL(longQuery, TEST_OTEL_DATA);
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('정상 길이 쿼리 -> 정상 동작', () => {
    const result = executePromQL('node_cpu_utilization_ratio', TEST_OTEL_DATA);
    expect(result.result.length).toBeGreaterThan(0);
  });

  it('matcher 10개 초과 -> 10개까지만 파싱', () => {
    // 12개 matcher를 가진 쿼리 생성
    const matchers = Array.from(
      { length: 12 },
      (_, i) => `key${i}="val${i}"`
    ).join(',');
    const query = `node_cpu_utilization_ratio{${matchers}}`;
    const parsed = debugParsePromQL(query);
    expect(parsed).not.toBeNull();
    expect(parsed!.matchers.length).toBeLessThanOrEqual(10);
  });

  it('잘못된 정규식 (=~) -> 매칭 실패 (예외 안 남)', () => {
    // "((" 는 잘못된 정규식
    const result = executePromQL(
      'node_cpu_utilization_ratio{server_type=~"(("}',
      TEST_OTEL_DATA
    );
    // 잘못된 정규식이므로 모든 서버가 매칭 실패 -> 빈 결과
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('라벨 값 128자 초과 -> 해당 matcher 무시', () => {
    const longValue = 'x'.repeat(129);
    const query = `node_cpu_utilization_ratio{server_type="${longValue}"}`;
    const parsed = debugParsePromQL(query);
    expect(parsed).not.toBeNull();
    // 128자 초과 라벨 값은 무시되므로 matchers가 비어있음
    expect(parsed!.matchers).toHaveLength(0);
  });

  it('debugParsePromQL 빈 쿼리 -> null 반환', () => {
    const result = debugParsePromQL('');
    expect(result).toBeNull();
  });

  it('debugParsePromQL 512자 초과 쿼리 -> null 반환', () => {
    const longQuery = 'a'.repeat(513);
    const result = debugParsePromQL(longQuery);
    expect(result).toBeNull();
  });
});
