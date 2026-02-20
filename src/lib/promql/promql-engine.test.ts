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
      'deployment.environment.name': 'production',
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
      'deployment.environment.name': 'production',
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
      'deployment.environment.name': 'production',
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
      'deployment.environment.name': 'staging',
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
      'system.network.io': 30,
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
      'system.network.io': 30,
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
      'system.network.io': 30,
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
      'system.network.io': 30,
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
    'system.network.io',
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
  it('simple metric name을 instant 쿼리로 파싱', async () => {
    const result = debugParsePromQL('node_cpu_utilization_ratio');
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
    expect(result!.matchers).toEqual([]);
  });

  it('라벨 필터가 있는 instant 쿼리 파싱', async () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type="web"}'
    );
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
    expect(result!.matchers).toEqual([
      { name: 'server_type', op: '=', value: 'web' },
    ]);
  });

  it('복수 라벨 필터 파싱', async () => {
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

  it('!= 라벨 연산자 파싱', async () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type!="cache"}'
    );
    expect(result!.matchers[0]!.op).toBe('!=');
  });

  it('=~ 정규식 라벨 연산자 파싱', async () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type=~"web|api"}'
    );
    expect(result!.matchers[0]!.op).toBe('=~');
    expect(result!.matchers[0]!.value).toBe('web|api');
  });

  it('!~ 부정 정규식 라벨 연산자 파싱', async () => {
    const result = debugParsePromQL(
      'node_cpu_utilization_ratio{server_type!~"cache"}'
    );
    expect(result!.matchers[0]!.op).toBe('!~');
  });

  it('aggregate 함수 파싱 (avg)', async () => {
    const result = debugParsePromQL('avg(node_cpu_utilization_ratio)');
    expect(result!.type).toBe('aggregate');
    expect(result!.aggregateFunc).toBe('avg');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
    expect(result!.groupBy).toBeUndefined();
  });

  it('aggregate 함수 + by 절 파싱', async () => {
    const result = debugParsePromQL(
      'max(node_cpu_utilization_ratio) by (server_type)'
    );
    expect(result!.type).toBe('aggregate');
    expect(result!.aggregateFunc).toBe('max');
    expect(result!.groupBy).toEqual(['server_type']);
  });

  it('aggregate 함수 + 라벨 필터 + by 절 파싱', async () => {
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

  it('comparison 쿼리 파싱', async () => {
    const result = debugParsePromQL('up == 0');
    expect(result!.type).toBe('comparison');
    expect(result!.metricName).toBe('up');
    expect(result!.comparisonOp).toBe('==');
    expect(result!.comparisonValue).toBe(0);
  });

  it('comparison 쿼리 (>, <, >=, <=, !=)', async () => {
    for (const op of ['>', '<', '>=', '<=', '!='] as const) {
      const result = debugParsePromQL(`node_cpu_utilization_ratio ${op} 80`);
      expect(result!.type).toBe('comparison');
      expect(result!.comparisonOp).toBe(op);
      expect(result!.comparisonValue).toBe(80);
    }
  });

  it('소수점 비교값 파싱', async () => {
    const result = debugParsePromQL('node_load1 > 1.5');
    expect(result!.comparisonValue).toBe(1.5);
  });

  it('rate 쿼리 파싱', async () => {
    const result = debugParsePromQL('rate(node_cpu_utilization_ratio[1h])');
    expect(result!.type).toBe('rate');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
    expect(result!.rangeWindow).toBe('1h');
  });

  it('rate 쿼리 + 라벨 필터 파싱', async () => {
    const result = debugParsePromQL(
      'rate(node_cpu_utilization_ratio{server_type="web"}[2h])'
    );
    expect(result!.type).toBe('rate');
    expect(result!.matchers).toEqual([
      { name: 'server_type', op: '=', value: 'web' },
    ]);
    expect(result!.rangeWindow).toBe('2h');
  });

  it('지원하는 모든 aggregate 함수', async () => {
    for (const func of ['avg', 'max', 'min', 'sum', 'count'] as const) {
      const result = debugParsePromQL(`${func}(node_cpu_utilization_ratio)`);
      expect(result!.type).toBe('aggregate');
      expect(result!.aggregateFunc).toBe(func);
    }
  });

  it('인식할 수 없는 쿼리는 instant fallback', async () => {
    const result = debugParsePromQL('something_weird_123');
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('something_weird_123');
  });

  it('공백이 있는 쿼리 trim 처리', async () => {
    const result = debugParsePromQL('  node_cpu_utilization_ratio  ');
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('node_cpu_utilization_ratio');
  });
});

// ============================================================================
// Tests: executePromQL - Instant Selectors
// ============================================================================

describe('executePromQL - Instant Selectors', () => {
  it('전체 서버 CPU 메트릭 조회 (Prometheus 이름)', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio',
      TEST_OTEL_DATA
    );
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(4);
  });

  it('라벨 필터링 (server_type="web")', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio{server_type="web"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2);
    expect(result.result.every((s) => s.labels.server_type === 'web')).toBe(
      true
    );
  });

  it('라벨 부정 필터링 (server_type!="web")', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio{server_type!="web"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2);
    expect(result.result.every((s) => s.labels.server_type !== 'web')).toBe(
      true
    );
  });

  it('정규식 라벨 필터링 (server_type=~"web|database")', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio{server_type=~"web|database"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(3);
  });

  it('부정 정규식 라벨 필터링 (server_type!~"cache")', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio{server_type!~"cache"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(3);
  });

  it('복수 라벨 필터 AND 조건', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio{server_type="web",datacenter="onprem-dc1"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2);
  });

  it('매칭되지 않는 라벨 필터 -> 빈 결과', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio{server_type="nonexistent"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(0);
  });

  it('결과에 instance, job, labels 포함', async () => {
    const result = await executePromQL(
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

  it('up 메트릭 조회 (system.uptime 기반)', async () => {
    const result = await executePromQL('up', TEST_OTEL_DATA);
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

  it('존재하지 않는 메트릭 -> 빈 결과', async () => {
    const result = await executePromQL('nonexistent_metric', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(0);
  });

  it('slotIndex를 지정하여 특정 slot 조회', async () => {
    const result = await executePromQL(
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
