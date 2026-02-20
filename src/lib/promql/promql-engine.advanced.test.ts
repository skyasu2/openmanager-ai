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
import { executePromQL } from './promql-engine';

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

describe('executePromQL - Aggregation', () => {
  it('avg() 전역 집계', async () => {
    const result = await executePromQL(
      'avg(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    // (0.75 + 0.85 + 0.45 + 0) / 4 = 0.51...
    expect(result.result[0]!.value).toBe(0.51);
  });

  it('max() 전역 집계', async () => {
    const result = await executePromQL(
      'max(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.85);
  });

  it('min() 전역 집계', async () => {
    const result = await executePromQL(
      'min(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0);
  });

  it('sum() 전역 집계', async () => {
    const result = await executePromQL(
      'sum(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBeCloseTo(0.75 + 0.85 + 0.45 + 0, 10);
  });

  it('count() 전역 집계', async () => {
    const result = await executePromQL(
      'count(node_cpu_utilization_ratio)',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(4);
  });

  it('avg() by (server_type) 그룹 집계', async () => {
    const result = await executePromQL(
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

  it('max() by (datacenter) 그룹 집계', async () => {
    const result = await executePromQL(
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

  it('라벨 필터 + aggregate', async () => {
    const result = await executePromQL(
      'avg(node_cpu_utilization_ratio{server_type="web"})',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.8); // (0.75 + 0.85) / 2
  });

  it('빈 데이터에 대한 aggregate -> 빈 결과', async () => {
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
    const result = await executePromQL(
      'avg(node_cpu_utilization_ratio)',
      emptyData
    );
    expect(result.result).toHaveLength(0);
  });
});

// ============================================================================
// Tests: executePromQL - Comparison
// ============================================================================

describe('executePromQL - Comparison', () => {
  it('up == 0 (오프라인 서버)', async () => {
    const result = await executePromQL('up == 0', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.labels.instance).toBe('cache-01');
  });

  it('up == 1 (온라인 서버)', async () => {
    const result = await executePromQL('up == 1', TEST_OTEL_DATA);
    expect(result.result).toHaveLength(3);
  });

  it('node_cpu_utilization_ratio > 0.80', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio > 0.80',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.value).toBe(0.85);
  });

  it('node_cpu_utilization_ratio >= 0.75', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio >= 0.75',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2); // 0.75, 0.85
  });

  it('node_cpu_utilization_ratio < 0.50', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio < 0.50',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2); // 0.45, 0
  });

  it('node_cpu_utilization_ratio <= 0.45', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio <= 0.45',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(2); // 0.45, 0
  });

  it('node_cpu_utilization_ratio != 0.75', async () => {
    const result = await executePromQL(
      'node_cpu_utilization_ratio != 0.75',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(3); // 0.85, 0.45, 0
  });

  it('라벨 필터 + comparison', async () => {
    const result = await executePromQL(
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
  it('rate 쿼리 (hourlyFileMap 제공 시)', async () => {
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

    const result = await executePromQL(
      'rate(node_cpu_utilization_ratio[1h])',
      TEST_OTEL_DATA,
      hourlyFileMap,
      currentHour
    );

    expect(result.resultType).toBe('vector');
    expect(result.result.length).toBeGreaterThan(0);
  });

  it('rate 쿼리 (hourlyFileMap 없으면 빈 결과)', async () => {
    const result = await executePromQL(
      'rate(node_cpu_utilization_ratio[1h])',
      TEST_OTEL_DATA
    );
    expect(result.result).toHaveLength(0);
  });

  it('rate 쿼리 (이전 시간대 데이터 없으면 빈 결과)', async () => {
    const hourlyFileMap = new Map<number, OTelHourlyFile>();
    hourlyFileMap.set(10, TEST_OTEL_DATA);
    // prevHour (9) 데이터 없음

    const result = await executePromQL(
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
