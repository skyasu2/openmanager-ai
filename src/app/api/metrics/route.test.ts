import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWithAuth, mockEnsureDataLoaded, mockGetAllServerMetrics } =
  vi.hoisted(() => ({
    mockWithAuth: vi.fn((handler: (...args: never[]) => unknown) => handler),
    mockEnsureDataLoaded: vi.fn(),
    mockGetAllServerMetrics: vi.fn(),
  }));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: mockWithAuth,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/services/metrics/MetricsProvider', () => ({
  metricsProvider: {
    ensureDataLoaded: mockEnsureDataLoaded,
    getAllServerMetrics: mockGetAllServerMetrics,
  },
}));

import { GET, POST } from './route';

describe('/api/metrics route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDataLoaded.mockResolvedValue(true);
    mockGetAllServerMetrics.mockResolvedValue([
      {
        serverId: 'web-01',
        serverType: 'web',
        location: 'ap-northeast-2a',
        timestamp: '2026-05-11T00:00:00.000Z',
        minuteOfDay: 600,
        cpu: 45,
        memory: 60,
        disk: 30,
        network: 10,
        logs: [],
        status: 'warning',
        environment: 'production',
      },
    ]);
  });

  it('GET returns the supported PromQL metric registry', async () => {
    const response = await GET(new NextRequest('http://localhost/api/metrics'));
    const payload = (await response.json()) as {
      status: string;
      metrics: string[];
      count: number;
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe('success');
    expect(payload.metrics).toContain('openmanager_server_status');
    expect(payload.count).toBe(payload.metrics.length);
  });

  it('preserves server status as a PromQL label for openmanager_server_status', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'openmanager_server_status',
          time: 1_800_000_000,
        }),
      })
    );
    const payload = (await response.json()) as {
      data: {
        result: Array<{
          metric: { __name__: string; instance: string; status?: string };
          value: [number, string];
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.result).toHaveLength(1);
    expect(payload.data.result[0]?.metric).toMatchObject({
      __name__: 'openmanager_server_status',
      instance: 'web-01',
      status: 'warning',
    });
    expect(payload.data.result[0]?.value).toEqual([1_800_000_000, '1']);
  });
});
