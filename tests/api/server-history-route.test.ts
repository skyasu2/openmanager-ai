import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OTEL_METRIC } from '@/constants/otel-metric-names';

const {
  mockEnsureDataLoaded,
  mockGetServerMetrics,
  mockGetAllServerMetrics,
  mockGetProcessedServer,
  mockGetOTelTimeSeries,
} = vi.hoisted(() => ({
  mockEnsureDataLoaded: vi.fn(),
  mockGetServerMetrics: vi.fn(),
  mockGetAllServerMetrics: vi.fn(),
  mockGetProcessedServer: vi.fn(),
  mockGetOTelTimeSeries: vi.fn(),
}));

vi.mock('@/services/metrics/MetricsProvider', () => ({
  metricsProvider: {
    ensureDataLoaded: mockEnsureDataLoaded,
    getServerMetrics: mockGetServerMetrics,
    getAllServerMetrics: mockGetAllServerMetrics,
  },
}));

vi.mock('@/services/monitoring', () => ({
  getServerMonitoringService: () => ({
    getProcessedServer: mockGetProcessedServer,
  }),
}));

vi.mock('@/data/otel-data', () => ({
  getOTelTimeSeries: mockGetOTelTimeSeries,
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from '@/app/api/servers/[id]/route';

describe('Server History Route Contract (/api/servers/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const now = Math.floor(Date.now() / 1000);

    mockEnsureDataLoaded.mockResolvedValue(undefined);
    mockGetServerMetrics.mockResolvedValue({
      serverId: 'server-1',
      hostname: 'web-01.internal',
      environment: 'production',
      serverType: 'web',
      status: 'healthy',
      cpu: 58,
      memory: 62,
      disk: 47,
      timestamp: new Date(now * 1000).toISOString(),
    });
    mockGetAllServerMetrics.mockResolvedValue([]);

    mockGetProcessedServer.mockResolvedValue({
      uptimeSeconds: 3600,
      networkIn: 22,
      networkOut: 13,
      responseTimeMs: 120,
      alerts: [],
      services: [],
      ip: '10.0.0.1',
      osLabel: 'Ubuntu',
      specs: {
        cpuCores: 4,
        memoryGb: 16,
        diskGb: 200,
      },
    });

    mockGetOTelTimeSeries.mockResolvedValue({
      serverIds: ['server-1'],
      timestamps: [now - 3600, now - 1800, now - 600],
      metrics: {
        [OTEL_METRIC.CPU]: [[0.45, 0.5, 0.55]],
        [OTEL_METRIC.MEMORY]: [[0.52, 0.56, 0.6]],
        [OTEL_METRIC.DISK]: [[0.31, 0.33, 0.37]],
        [OTEL_METRIC.NETWORK]: [[0.2, 0.25, 0.3]],
        [OTEL_METRIC.HTTP_DURATION]: [[0.11, 0.09, 0.1]],
      },
    });
  });

  it('history=true 요청 시 시계열 데이터가 포함된다', async () => {
    const request = new NextRequest(
      'http://localhost/api/servers/server-1?history=true&range=1h&format=enhanced'
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: 'server-1' }),
    });

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: {
        history?: {
          time_range: string;
          data_points: Array<{
            timestamp: string;
            metrics: {
              cpu_usage: number;
              memory_usage: number;
              disk_usage: number;
            };
          }>;
        };
      };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.history?.time_range).toBe('1h');
    expect(payload.data.history?.data_points.length).toBeGreaterThan(0);
    expect(payload.data.history?.data_points[0]?.metrics.cpu_usage).toBeTypeOf(
      'number'
    );
    expect(
      payload.data.history?.data_points[0]?.metrics.cpu_usage
    ).toBeGreaterThanOrEqual(0);
    expect(
      payload.data.history?.data_points[0]?.metrics.cpu_usage
    ).toBeLessThanOrEqual(100);
  });

  it('존재하지 않는 서버 ID 요청 시 404를 반환한다', async () => {
    mockGetServerMetrics.mockResolvedValueOnce(null);
    mockGetAllServerMetrics.mockResolvedValueOnce([]);

    const request = new NextRequest('http://localhost/api/servers/not-found');

    const response = await GET(request, {
      params: Promise.resolve({ id: 'not-found' }),
    });

    expect(response.status).toBe(404);

    const payload = (await response.json()) as {
      success: boolean;
      error: string;
    };

    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Server not found');
  });

  it('history 파라미터가 없으면 history 필드를 생략한다', async () => {
    const request = new NextRequest('http://localhost/api/servers/server-1');

    const response = await GET(request, {
      params: Promise.resolve({ id: 'server-1' }),
    });

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: { history?: unknown };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.history).toBeUndefined();
  });
});
