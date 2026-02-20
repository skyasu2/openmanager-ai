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

describe('executePromQL - Edge Cases', () => {
  it('빈 slots -> 빈 결과', async () => {
    const emptyData: OTelHourlyFile = {
      schemaVersion: '1.0.0',
      hour: 0,
      scope: { name: 'test', version: '1.0.0' },
      slots: [],
    };
    const result = await executePromQL('node_cpu_utilization_ratio', emptyData);
    expect(result.result).toHaveLength(0);
  });

  it('slotIndex가 범위를 벗어나면 첫 번째 slot 사용', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio',
      TEST_OTEL_DATA,
      undefined,
      undefined,
      99
    );
    // slots[99]가 없으므로 slots[0] fallback
    expect(result.result).toHaveLength(4);
  });

  it('여러 메트릭 종류 조회 가능 (Prometheus 이름)', async () => {
    const metrics = [
      'node_cpu_utilization_ratio',
      'node_memory_utilization_ratio',
      'node_filesystem_utilization_ratio',
      'node_network_utilization_ratio',
      'node_load1',
      'up',
    ];

    for (const metric of metrics) {
      const result = await executePromQL(metric, TEST_OTEL_DATA);
      expect(result.result.length).toBeGreaterThan(0);
    }
  });

  it('aggregate 결과의 labels는 빈 객체 (전역)', async () => {
    const result = await executePromQL(
      'avg(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result[0]!.labels).toEqual({});
  });

  it('group by 결과의 labels에 그룹 키만 포함', async () => {
    const result = await executePromQL(
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
  it('OTel 이름 system.cpu.utilization 직접 조회', async () => {
    const result = await executePromQL(
      'system.cpu.utilization',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(4);
    // web-01: 0.75
    const web01 = result.result.find((s) => s.labels.instance === 'web-01');
    expect(web01?.value).toBe(0.75);
  });

  it('OTel 이름 + 라벨 필터', async () => {
    const result = await executePromQL(
      'system.cpu.utilization{server_type="web"}',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2);
  });

  it('OTel 이름 + aggregate', async () => {
    const result = await executePromQL(
      'avg(system.cpu.utilization)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.51);
  });

  it('OTel 이름 + aggregate + by', async () => {
    const result = await executePromQL(
      'avg(system.cpu.utilization) by (server_type)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(3);
    const webGroup = result.result.find((s) => s.labels.server_type === 'web');
    expect(webGroup?.value).toBe(0.8);
  });

  it('OTel 이름 + comparison', async () => {
    const result = await executePromQL(
      'system.cpu.utilization > 0.80',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.85);
  });

  it('up == 0 으로 오프라인 서버 조회', async () => {
    const result = await executePromQL('up == 0', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.labels.instance).toBe('cache-01');
  });

  it('system.memory.utilization 조회', async () => {
    const result = await executePromQL(
      'system.memory.utilization',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(4);
  });

  it('http.server.request.duration 조회', async () => {
    const result = await executePromQL(
      'http.server.request.duration',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(4);
    // 모든 서버의 기본값: 0.120 (seconds)
    expect(result.result[0]!.value).toBe(0.12);
  });

  it('OTel 이름 파서 검증 (debugParsePromQL)', async () => {
    const result = debugParsePromQL(
      'system.cpu.utilization{server_type="web"}'
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe('instant');
    expect(result!.metricName).toBe('system.cpu.utilization');
    expect(result!.matchers).toHaveLength(1);
  });

  it('OTel 이름 rate 쿼리 파싱', async () => {
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
  it('빈 쿼리 -> executePromQL 빈 결과 반환', async () => {
    const result = await executePromQL('', TEST_OTEL_DATA);
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('512자 초과 쿼리 -> 빈 결과 반환', async () => {
    const longQuery = `node_cpu_utilization_ratio{hostname="${'a'.repeat(513)}"}`;
    const result = await executePromQL(longQuery, TEST_OTEL_DATA);
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('정상 길이 쿼리 -> 정상 동작', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio',
      TEST_OTEL_DATA
    );
    expect(result.result.length).toBeGreaterThan(0);
  });

  it('matcher 10개 초과 -> 10개까지만 파싱', async () => {
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

  it('잘못된 정규식 (=~) -> 매칭 실패 (예외 안 남)', async () => {
    // "((" 는 잘못된 정규식
    const result = await executePromQL(
      'node_cpu_utilization_ratio{server_type=~"(("}',
      TEST_OTEL_DATA
    );
    // 잘못된 정규식이므로 모든 서버가 매칭 실패 -> 빈 결과
    expect(result.resultType).toBe('vector');
    expect(result.result).toHaveLength(0);
  });

  it('라벨 값 128자 초과 -> 해당 matcher 무시', async () => {
    const longValue = 'x'.repeat(129);
    const query = `node_cpu_utilization_ratio{server_type="${longValue}"}`;
    const parsed = debugParsePromQL(query);
    expect(parsed).not.toBeNull();
    // 128자 초과 라벨 값은 무시되므로 matchers가 비어있음
    expect(parsed!.matchers).toHaveLength(0);
  });

  it('debugParsePromQL 빈 쿼리 -> null 반환', async () => {
    const result = debugParsePromQL('');
    expect(result).toBeNull();
  });

  it('debugParsePromQL 512자 초과 쿼리 -> null 반환', async () => {
    const longQuery = 'a'.repeat(513);
    const result = debugParsePromQL(longQuery);
    expect(result).toBeNull();
  });
});
