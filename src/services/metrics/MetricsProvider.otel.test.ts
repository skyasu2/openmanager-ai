import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as OTelData from '@/data/otel-data';
import type { OTelHourlyFile } from '@/types/otel-metrics';
import { MetricsProvider } from './MetricsProvider';

// Mock the OTel data loader
vi.mock('@/data/otel-data', () => ({
  getOTelHourlyData: vi.fn(),
  getResourceCatalog: vi.fn(() => null),
  getOTelResourceCatalog: vi.fn(() => null),
}));

function makeOTelHourlyFile(
  metrics: Array<{
    name: string;
    unit?: string;
    dataPoints: Array<{
      asDouble: number;
      attributes: { 'host.name': string };
    }>;
  }>
): OTelHourlyFile {
  return {
    schemaVersion: '1.0.0',
    hour: 0,
    scope: { name: 'test', version: '1.0' },
    slots: [
      {
        startTimeUnixNano: 0,
        endTimeUnixNano: 600000000000,
        metrics: metrics.map((m) => ({
          name: m.name,
          unit: m.unit ?? '1',
          type: 'gauge' as const,
          dataPoints: m.dataPoints,
        })),
        logs: [],
      },
    ],
  };
}

describe('MetricsProvider OTel Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MetricsProvider.resetForTesting();
  });

  it('should load OTel data as Primary source', async () => {
    const mockData = makeOTelHourlyFile([
      {
        name: 'system.cpu.utilization',
        dataPoints: [
          { asDouble: 0.45, attributes: { 'host.name': 'test-host.local' } },
        ],
      },
      {
        name: 'system.memory.utilization',
        dataPoints: [
          { asDouble: 0.1, attributes: { 'host.name': 'test-host.local' } },
        ],
      },
      {
        name: 'system.filesystem.utilization',
        dataPoints: [
          { asDouble: 0.1, attributes: { 'host.name': 'test-host.local' } },
        ],
      },
      {
        name: 'system.network.io',
        unit: 'By',
        dataPoints: [
          {
            asDouble: 12_500_000,
            attributes: { 'host.name': 'test-host.local' },
          },
        ],
      },
    ]);

    vi.mocked(OTelData.getOTelHourlyData).mockResolvedValue(mockData);

    const provider = MetricsProvider.getInstance();
    const metrics = await provider.getServerMetrics('test-host');

    expect(metrics).not.toBeNull();
    expect(metrics?.cpu).toBe(45); // 0.45 * 100
    expect(OTelData.getOTelHourlyData).toHaveBeenCalled();
  });

  it('should return empty array when OTel data is missing', async () => {
    vi.mocked(OTelData.getOTelHourlyData).mockResolvedValue(null);

    const provider = MetricsProvider.getInstance();
    const metrics = await provider.getAllServerMetrics();

    expect(metrics).toHaveLength(0);
    expect(OTelData.getOTelHourlyData).toHaveBeenCalled();
  });

  it('should correctly map all OTel hourly metrics', async () => {
    const mockData = makeOTelHourlyFile([
      {
        name: 'system.cpu.utilization',
        dataPoints: [
          { asDouble: 0.1, attributes: { 'host.name': 'full-host.local' } },
        ],
      },
      {
        name: 'system.memory.utilization',
        dataPoints: [
          { asDouble: 0.2, attributes: { 'host.name': 'full-host.local' } },
        ],
      },
      {
        name: 'system.filesystem.utilization',
        dataPoints: [
          { asDouble: 0.3, attributes: { 'host.name': 'full-host.local' } },
        ],
      },
      {
        name: 'system.network.io',
        unit: 'By',
        dataPoints: [
          {
            asDouble: 62_500_000,
            attributes: { 'host.name': 'full-host.local' },
          },
        ],
      },
    ]);

    vi.mocked(OTelData.getOTelHourlyData).mockResolvedValue(mockData);

    const provider = MetricsProvider.getInstance();
    const metrics = await provider.getServerMetrics('full-host');

    expect(metrics).toBeDefined();
    expect(metrics?.cpu).toBe(10);
    expect(metrics?.memory).toBe(20);
    expect(metrics?.disk).toBe(30);
    expect(metrics?.network).toBe(50);
    expect(metrics?.status).toBe('online');
  });
});
