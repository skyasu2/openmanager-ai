/**
 * 🔗 /api/servers/[id] Integration Test
 *
 * 서버 상세 + 히스토리 응답 파이프라인 회귀 방지.
 *
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OTEL_METRIC } from '@/constants/otel-metric-names';

const {
  mockGetServerMetrics,
  mockGetAllServerMetrics,
  mockGetProcessedServer,
} = vi.hoisted(() => ({
  mockGetServerMetrics: vi.fn(),
  mockGetAllServerMetrics: vi.fn(),
  mockGetProcessedServer: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/services/metrics/MetricsProvider', () => ({
  metricsProvider: {
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
  getOTelTimeSeries: () => ({
    timestamps: [1_706_000_000],
    serverIds: ['web-01'],
    metrics: {
      [OTEL_METRIC.CPU]: [[0.5]],
      [OTEL_METRIC.MEMORY]: [[0.4]],
      [OTEL_METRIC.DISK]: [[0.3]],
      [OTEL_METRIC.NETWORK]: [[0.5]],
      [OTEL_METRIC.HTTP_DURATION]: [[0.123]],
    },
  }),
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from '@/app/api/servers/[id]/route';

describe('/api/servers/[id] Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerMetrics.mockReturnValue({
      serverId: 'web-01',
      hostname: 'web-01.openmanager.local',
      environment: 'production',
      serverType: 'web',
      status: 'online',
      cpu: 65.2,
      memory: 50.1,
      disk: 40.4,
      timestamp: new Date('2026-02-15T00:00:00.000Z').toISOString(),
    });
    mockGetAllServerMetrics.mockReturnValue([]);
    mockGetProcessedServer.mockReturnValue({
      specs: {
        cpu_cores: 4,
        memory_gb: 8,
        disk_gb: 100,
      },
      uptimeSeconds: 7200,
      ip: '10.0.0.11',
      services: [],
      networkIn: 30,
      networkOut: 20,
      responseTimeMs: 123,
      alerts: [],
      osLabel: 'linux',
    });
  });

  it('history=true 요청 시 네트워크 히스토리를 percent 단위로 정규화한다', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/servers/web-01?history=true&range=24h'
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'web-01' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.history.data_points).toHaveLength(1);
    expect(data.data.history.data_points[0].metrics.network_in).toBe(30);
    expect(data.data.history.data_points[0].metrics.network_out).toBe(20);
    expect(data.data.history.data_points[0].metrics.response_time).toBe(123);
  });

  it('서버 미존재 시 404 응답을 반환한다', async () => {
    mockGetServerMetrics.mockReturnValue(null);
    mockGetAllServerMetrics.mockReturnValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/servers/unknown-server?history=true'
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'unknown-server' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Server not found');
  });
});
