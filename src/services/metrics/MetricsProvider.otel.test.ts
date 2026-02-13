import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MetricsProvider, metricsProvider } from './MetricsProvider';
import * as OTelData from '@/data/otel-metrics';
import type { ExportMetricsServiceRequest } from '@/types/otel-standard';

// Mock the OTel data loader
vi.mock('@/data/otel-metrics', () => ({
  getOTelHourlyData: vi.fn(),
}));

describe('MetricsProvider OTel Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton state
    MetricsProvider.resetForTesting();
  });

  it('should prioritize OTel data as Primary source', () => {
    const mockOTelData: ExportMetricsServiceRequest = {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'host.name', value: { stringValue: 'test-host.local' } },
              { key: 'host.type', value: { stringValue: 'web' } },
            ],
          },
          scopeMetrics: [
            {
              scope: { name: 'test', version: '1.0' },
              metrics: [
                {
                  name: 'system.cpu.utilization',
                  gauge: {
                    dataPoints: [
                      { asDouble: 0.45, timeUnixNano: '0', attributes: [] },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    vi.mocked(OTelData.getOTelHourlyData).mockReturnValue(mockOTelData);

    const provider = MetricsProvider.getInstance();
    const metrics = provider.getServerMetrics('test-host');

    expect(metrics).not.toBeNull();
    expect(metrics?.cpu).toBe(45); // 0.45 * 100
    expect(OTelData.getOTelHourlyData).toHaveBeenCalled();
  });

  it('should fallback to bundled hourly-data if OTel is missing', () => {
    vi.mocked(OTelData.getOTelHourlyData).mockReturnValue(null);

    const provider = MetricsProvider.getInstance();
    const metrics = provider.getAllServerMetrics();

    expect(metrics.length).toBeGreaterThan(0);
    expect(OTelData.getOTelHourlyData).toHaveBeenCalled();
  });

  it('should correctly map all OTel standard metrics', () => {
    // We need to provide enough data points if it indexes by minute,
    // OR we just rely on the fallback to the last element logic in extractMetricsFromStandard
    const mockOTelData: ExportMetricsServiceRequest = {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'host.name', value: { stringValue: 'full-host.local' } },
            ],
          },
          scopeMetrics: [
            {
              scope: { name: 'test', version: '1.0' },
              metrics: [
                {
                  name: 'system.cpu.utilization',
                  gauge: { dataPoints: [{ asDouble: 0.1 }] },
                },
                {
                  name: 'system.memory.utilization',
                  gauge: { dataPoints: [{ asDouble: 0.2 }] },
                },
                {
                  name: 'system.filesystem.utilization',
                  gauge: { dataPoints: [{ asDouble: 0.3 }] },
                },
                {
                  name: 'system.network.io',
                  sum: { dataPoints: [{ asDouble: 50 }] },
                },
                {
                  name: 'system.status',
                  gauge: { dataPoints: [{ asDouble: 1 }] },
                },
              ],
            },
          ],
        },
      ],
    };

    vi.mocked(OTelData.getOTelHourlyData).mockReturnValue(mockOTelData);

    const provider = MetricsProvider.getInstance();
    const metrics = provider.getServerMetrics('full-host');

    expect(metrics).toBeDefined();
    expect(metrics?.cpu).toBe(10);
    expect(metrics?.memory).toBe(20);
    expect(metrics?.disk).toBe(30);
    expect(metrics?.network).toBe(50);
    expect(metrics?.status).toBe('online');
  });
});
