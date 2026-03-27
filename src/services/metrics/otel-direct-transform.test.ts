/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

// Mock external dependencies
vi.mock('@/config/server-registry', () => ({
  getServerIP: vi.fn((id: string) => `10.0.0.${id.length}`),
}));

vi.mock('@/config/server-services-map', () => ({
  getServicesForServer: vi.fn(() => []),
}));

vi.mock('@/constants/otel-metric-names', () => ({
  OTEL_METRIC: {
    CPU: 'system.cpu.utilization',
    MEMORY: 'system.memory.utilization',
    DISK: 'system.filesystem.utilization',
    NETWORK: 'system.network.io',
    LOAD_1M: 'system.linux.cpu.load_1m',
    LOAD_5M: 'system.linux.cpu.load_5m',
    PROCESSES: 'system.process.count',
    UPTIME: 'system.uptime',
    HTTP_DURATION: 'http.server.request.duration',
  },
}));

vi.mock('@/data/otel-data', () => ({
  getOTelHourlyData: vi.fn(),
  getOTelResourceCatalog: vi.fn(),
  getOTelTimeSeries: vi.fn(),
}));

vi.mock('@/lib/logging', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/metrics/kst-time', () => ({
  getKSTMinuteOfDay: vi.fn(() => 600),
}));

vi.mock('@/services/server-data/server-data-transformer', () => ({
  deriveNetworkSplit: vi.fn((net: number) => ({
    networkIn: Math.round(net * 0.6),
    networkOut: Math.round(net * 0.4),
  })),
  deriveNetworkErrors: vi.fn(() => ({
    receivedErrors: 0,
    sentErrors: 0,
  })),
  deriveZombieProcesses: vi.fn(() => 0),
  estimateLoad15: vi.fn((l1: number, l5: number) =>
    Number((l5 * 0.8 + l1 * 0.2).toFixed(2))
  ),
}));

vi.mock('./metric-transformers', () => ({
  determineStatus: vi.fn(
    (cpu: number, memory: number, _disk: number, _net: number) => {
      if (cpu > 90 || memory > 90) return 'critical';
      if (cpu > 70 || memory > 70) return 'warning';
      return 'healthy';
    }
  ),
}));

import type { OTelHourlySlot, OTelResourceCatalog } from '@/types/otel-metrics';
import { otelSlotToServers } from './otel-direct-transform';

// ── Test Data Helpers ──────────────────────────────────

function makeSlot(
  servers: Record<
    string,
    { cpu: number; memory: number; disk: number; network: number }
  >,
  options?: {
    networkUnit?: string;
  }
): OTelHourlySlot {
  const metrics = [
    buildMetric('system.cpu.utilization', '1', servers, 'cpu'),
    buildMetric('system.memory.utilization', '1', servers, 'memory'),
    buildMetric('system.filesystem.utilization', '1', servers, 'disk'),
    buildMetric(
      'system.network.io',
      options?.networkUnit ?? 'By',
      servers,
      'network'
    ),
  ];

  return {
    startTimeUnixNano: 1_000_000_000,
    endTimeUnixNano: 2_000_000_000,
    metrics,
    logs: [],
  };
}

function buildMetric(
  name: string,
  unit: string,
  servers: Record<string, Record<string, number>>,
  key: string
) {
  return {
    name,
    unit,
    type: 'gauge' as const,
    dataPoints: Object.entries(servers).map(([id, vals]) => ({
      asDouble: vals[key] ?? 0,
      attributes: { 'host.name': `${id}.openmanager.kr` },
    })),
  };
}

function makeCatalog(serverIds: string[]): OTelResourceCatalog {
  const resources: Record<string, Record<string, unknown>> = {};
  for (const id of serverIds) {
    resources[id] = {
      'host.name': `${id}.openmanager.kr`,
      'server.role': 'web',
      'os.type': 'linux',
      'cloud.availability_zone': 'ap-northeast-2a',
      'deployment.environment.name': 'production',
      'host.cpu.count': 4,
      'host.memory.size': 8 * 1024 * 1024 * 1024,
      'host.disk.size': 100 * 1024 * 1024 * 1024,
    };
  }
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-01-01T00:00:00Z',
    resources,
  } as OTelResourceCatalog;
}

// ── Tests ──────────────────────────────────────────────

describe('otelSlotToServers', () => {
  it('converts OTel slot to EnhancedServerMetrics array', () => {
    const slot = makeSlot({
      'web-nginx-kr-01': {
        cpu: 0.45,
        memory: 0.6,
        disk: 0.3,
        network: 25_000_000,
      },
    });
    const catalog = makeCatalog(['web-nginx-kr-01']);
    const ts = '2026-01-01T10:00:00Z';

    const result = otelSlotToServers(slot, catalog, ts);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('web-nginx-kr-01');
    expect(result[0].cpu).toBe(45);
    expect(result[0].memory).toBe(60);
    expect(result[0].disk).toBe(30);
    expect(result[0].network).toBe(20);
    expect(result[0].status).toBe('healthy');
    expect(result[0].provider).toBe('OTel-Direct');
  });

  it('marks server as offline when all metrics are zero', () => {
    const slot = makeSlot({
      'web-offline-01': { cpu: 0, memory: 0, disk: 0, network: 0 },
    });
    const catalog = makeCatalog(['web-offline-01']);

    const result = otelSlotToServers(slot, catalog, '2026-01-01T10:00:00Z');

    expect(result[0].status).toBe('offline');
  });

  it('handles multiple servers in single slot', () => {
    const slot = makeSlot({
      'web-01': { cpu: 0.3, memory: 0.4, disk: 0.25, network: 12_500_000 },
      'db-01': { cpu: 0.85, memory: 0.7, disk: 0.6, network: 6_250_000 },
    });
    const catalog = makeCatalog(['web-01', 'db-01']);

    const result = otelSlotToServers(slot, catalog, '2026-01-01T10:00:00Z');

    expect(result).toHaveLength(2);
    const ids = result.map((s) => s.id).sort();
    expect(ids).toEqual(['db-01', 'web-01']);
  });

  it('converts OTel values to percent (0-100) correctly', () => {
    const slot = makeSlot({
      srv: { cpu: 0.123, memory: 0.999, disk: 0.001, network: 62_500_000 },
    });
    const catalog = makeCatalog(['srv']);

    const result = otelSlotToServers(slot, catalog, '2026-01-01T10:00:00Z');

    expect(result[0].cpu).toBe(12.3);
    expect(result[0].memory).toBe(99.9);
    expect(result[0].disk).toBe(0.1);
    expect(result[0].network).toBe(50);
  });

  it('keeps legacy percent-scale value when network unit is By/s', () => {
    const slot = makeSlot(
      {
        srv: { cpu: 0.2, memory: 0.2, disk: 0.2, network: 78 },
      },
      { networkUnit: 'By/s' }
    );
    const catalog = makeCatalog(['srv']);

    const result = otelSlotToServers(slot, catalog, '2026-01-01T10:00:00Z');

    expect(result[0].network).toBe(78);
  });

  it('converts bytes/s to utilization percent when network unit is By/s', () => {
    const slot = makeSlot(
      {
        srv: { cpu: 0.2, memory: 0.2, disk: 0.2, network: 62_500_000 },
      },
      { networkUnit: 'By/s' }
    );
    const catalog = makeCatalog(['srv']);

    const result = otelSlotToServers(slot, catalog, '2026-01-01T10:00:00Z');

    expect(result[0].network).toBe(50);
  });

  it('attaches structured logs to matching servers', () => {
    const slot = makeSlot({
      'web-01': { cpu: 0.5, memory: 0.5, disk: 0.3, network: 12_500_000 },
    });
    slot.logs = [
      {
        timeUnixNano: 1_500_000_000,
        severityNumber: 9,
        severityText: 'INFO',
        body: 'Request handled',
        attributes: {},
        resource: 'web-01',
      },
    ];
    const catalog = makeCatalog(['web-01']);

    const result = otelSlotToServers(slot, catalog, '2026-01-01T10:00:00Z');

    expect(result[0].structuredLogs).toHaveLength(1);
    expect(result[0].structuredLogs![0].body).toBe('Request handled');
  });

  it('returns empty array when slot has no metrics', () => {
    const emptySlot: OTelHourlySlot = {
      startTimeUnixNano: 1_000_000_000,
      endTimeUnixNano: 2_000_000_000,
      metrics: [],
      logs: [],
    };
    const catalog = makeCatalog([]);

    const result = otelSlotToServers(
      emptySlot,
      catalog,
      '2026-01-01T10:00:00Z'
    );

    expect(result).toEqual([]);
  });

  it('populates systemInfo and networkInfo correctly', () => {
    const slot = makeSlot({
      'web-01': { cpu: 0.5, memory: 0.5, disk: 0.3, network: 25_000_000 },
    });
    const catalog = makeCatalog(['web-01']);

    const result = otelSlotToServers(slot, catalog, '2026-01-01T10:00:00Z');

    expect(result[0].systemInfo).toBeDefined();
    expect(result[0].systemInfo.os).toBe('linux');
    expect(result[0].networkInfo).toBeDefined();
    expect(result[0].networkInfo.interface).toBe('eth0');
    expect(result[0].networkInfo.receivedBytes).toMatch(/\/s$/);
    expect(result[0].networkInfo.sentBytes).toMatch(/\/s$/);
    expect(result[0].networkInfo.receivedUtilizationPercent).toBe(
      result[0].network_in
    );
    expect(result[0].networkInfo.sentUtilizationPercent).toBe(
      result[0].network_out
    );
    expect(result[0].specs.cpu_cores).toBe(4);
    expect(result[0].specs.memory_gb).toBe(8);
    expect(result[0].specs.disk_gb).toBe(100);
  });
});
