/**
 * /api/servers/[id] Unit Tests
 *
 * 서버 상세 API 라우트의 핵심 시나리오 테스트:
 * - enhanced/legacy 포맷 응답
 * - 서버 검색 (ID, hostname 폴백)
 * - 404 응답 (미존재 서버)
 * - history 포함/미포함
 * - range 파라미터 파싱
 * - 500 에러 핸들링
 * - 캐시 헤더 검증
 *
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OTEL_METRIC } from '@/constants/otel-metric-names';

// --- Hoisted mocks ---

const {
  mockGetServerMetrics,
  mockGetAllServerMetrics,
  mockGetProcessedServer,
  mockEnsureDataLoaded,
  mockGetOTelTimeSeries,
} = vi.hoisted(() => ({
  mockGetServerMetrics: vi.fn(),
  mockGetAllServerMetrics: vi.fn(),
  mockGetProcessedServer: vi.fn(),
  mockEnsureDataLoaded: vi.fn(),
  mockGetOTelTimeSeries: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
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
  default: { log: vi.fn(), error: vi.fn() },
}));

import { GET } from '@/app/api/servers/[id]/route';

// --- Test data ---

const BASE_METRIC = {
  serverId: 'web-01',
  hostname: 'web-01.openmanager.local',
  environment: 'onpremise',
  serverType: 'web',
  status: 'online',
  cpu: 65.2,
  memory: 50.1,
  disk: 40.4,
  timestamp: '2026-03-07T00:00:00.000Z',
};

const BASE_PROCESSED = {
  specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 100 },
  uptimeSeconds: 7200,
  ip: '10.0.0.11',
  services: [{ name: 'nginx', port: 80, status: 'running' }],
  networkIn: 30,
  networkOut: 20,
  responseTimeMs: 123,
  alerts: [],
  osLabel: 'Ubuntu 22.04',
};

const TIMESERIES_DATA = {
  timestamps: [1706000000, 1706000600, 1706001200],
  serverIds: ['web-01', 'db-01'],
  metrics: {
    [OTEL_METRIC.CPU]: [[0.5, 0.6, 0.7], [0.3, 0.4, 0.5]],
    [OTEL_METRIC.MEMORY]: [[0.4, 0.5, 0.6], [0.6, 0.7, 0.8]],
    [OTEL_METRIC.DISK]: [[0.3, 0.3, 0.3], [0.5, 0.5, 0.5]],
    [OTEL_METRIC.NETWORK]: [[0.5, 0.4, 0.6], [0.2, 0.3, 0.1]],
    [OTEL_METRIC.HTTP_DURATION]: [[0.123, 0.150, 0.100], [0.200, 0.250, 0.180]],
  },
};

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

function callGET(request: NextRequest, id: string) {
  return GET(request, { params: Promise.resolve({ id }) });
}

// --- Tests ---

describe('/api/servers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDataLoaded.mockResolvedValue(true);
    mockGetServerMetrics.mockReturnValue(BASE_METRIC);
    mockGetAllServerMetrics.mockReturnValue([]);
    mockGetProcessedServer.mockReturnValue(BASE_PROCESSED);
    mockGetOTelTimeSeries.mockResolvedValue(TIMESERIES_DATA);
  });

  describe('Enhanced format (default)', () => {
    it('should return enhanced response with server info and metrics', async () => {
      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.server_info.id).toBe('web-01');
      expect(data.data.server_info.hostname).toBe('web-01.openmanager.local');
      expect(data.data.server_info.status).toBe('online');
      expect(data.data.current_metrics.cpu_usage).toBe(65.2);
      expect(data.data.current_metrics.memory_usage).toBe(50.1);
      expect(data.data.current_metrics.network_in).toBe(30);
      expect(data.data.current_metrics.response_time).toBe(123);
    });

    it('should include resources and services', async () => {
      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');
      const data = await res.json();

      expect(data.data.resources.cpu_cores).toBe(4);
      expect(data.data.resources.memory_gb).toBe(8);
      expect(data.data.services).toHaveLength(1);
      expect(data.data.services[0].name).toBe('nginx');
    });

    it('should set custom response headers', async () => {
      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');

      expect(res.headers.get('X-Server-Id')).toBe('web-01');
      expect(res.headers.get('X-Hostname')).toBe('web-01.openmanager.local');
      expect(res.headers.get('X-Server-Status')).toBe('online');
      expect(res.headers.get('X-Processing-Time-Ms')).toBeTruthy();
    });

    it('should set private cache headers', async () => {
      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');

      expect(res.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
      expect(res.headers.get('Pragma')).toBe('no-cache');
    });

    it('should not include history by default', async () => {
      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');
      const data = await res.json();

      expect(data.data.history).toBeUndefined();
    });

    it('should include meta with request info', async () => {
      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');
      const data = await res.json();

      expect(data.meta.request_info.server_id).toBe('web-01');
      expect(data.meta.request_info.format).toBe('enhanced');
      expect(data.meta.request_info.processing_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Legacy format', () => {
    it('should return legacy response when format=legacy', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?format=legacy'),
        'web-01'
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.server.id).toBe('web-01');
      expect(data.server.hostname).toBe('web-01.openmanager.local');
      expect(data.server.type).toBe('web');
      expect(data.server.cpu).toBe(65);
      expect(data.server.memory).toBe(50);
      expect(data.server.disk).toBe(40);
      expect(data.server.metrics.cpu).toBe(65);
      expect(data.meta.format).toBe('legacy');
    });

    it('should include location and provider based on environment', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?format=legacy'),
        'web-01'
      );
      const data = await res.json();

      expect(data.server.location).toBe('On-Premise Seoul DC1');
      expect(data.server.provider).toBe('On-Premise');
    });

    it('should include uptime in legacy format', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?format=legacy'),
        'web-01'
      );
      const data = await res.json();

      expect(data.server.uptime).toBeTruthy();
      expect(typeof data.server.uptime).toBe('string');
    });
  });

  describe('History', () => {
    it('should include history data when history=true', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?history=true'),
        'web-01'
      );
      const data = await res.json();

      expect(data.data.history).toBeDefined();
      expect(data.data.history.time_range).toBe('24h');
      expect(data.data.history.data_points.length).toBeGreaterThan(0);
      expect(data.data.history.interval_ms).toBe(600000);
    });

    it('should include history in legacy format', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?format=legacy&history=true'),
        'web-01'
      );
      const data = await res.json();

      expect(data.history).toBeDefined();
      expect(data.history.data_points.length).toBeGreaterThan(0);
    });

    it('should normalize metrics to percent in history', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?history=true'),
        'web-01'
      );
      const data = await res.json();
      const point = data.data.history.data_points[0].metrics;

      // OTel ratios (0-1) should be normalized to percent (0-100)
      expect(point.cpu_usage).toBeGreaterThanOrEqual(0);
      expect(point.cpu_usage).toBeLessThanOrEqual(100);
      expect(point.memory_usage).toBeGreaterThanOrEqual(0);
      expect(point.memory_usage).toBeLessThanOrEqual(100);
    });

    it('should return empty history when timeseries data is null', async () => {
      mockGetOTelTimeSeries.mockResolvedValue(null);

      const res = await callGET(
        makeRequest('/api/servers/web-01?history=true'),
        'web-01'
      );
      const data = await res.json();

      expect(data.data.history.data_points).toEqual([]);
    });

    it('should return empty history when server not in timeseries', async () => {
      mockGetOTelTimeSeries.mockResolvedValue({
        ...TIMESERIES_DATA,
        serverIds: ['other-server'],
      });

      const res = await callGET(
        makeRequest('/api/servers/web-01?history=true'),
        'web-01'
      );
      const data = await res.json();

      expect(data.data.history.data_points).toEqual([]);
    });

    it('should support range parameter with hours', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?history=true&range=6h'),
        'web-01'
      );
      const data = await res.json();

      expect(data.data.history.time_range).toBe('6h');
      expect(data.meta.request_info.range).toBe('6h');
    });

    it('should support range parameter with minutes', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?history=true&range=30m'),
        'web-01'
      );
      const data = await res.json();

      expect(data.data.history.time_range).toBe('30m');
    });
  });

  describe('Server lookup', () => {
    it('should find server by hostname when ID lookup fails', async () => {
      mockGetServerMetrics.mockReturnValue(null);
      mockGetAllServerMetrics.mockReturnValue([BASE_METRIC]);

      const res = await callGET(
        makeRequest('/api/servers/web-01.openmanager.local'),
        'web-01.openmanager.local'
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when server not found', async () => {
      mockGetServerMetrics.mockReturnValue(null);
      mockGetAllServerMetrics.mockReturnValue([BASE_METRIC]);

      const res = await callGET(
        makeRequest('/api/servers/nonexistent'),
        'nonexistent'
      );
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Server not found');
      expect(data.available_servers).toBeDefined();
    });

    it('should include available servers in 404 response', async () => {
      mockGetServerMetrics.mockReturnValue(null);
      mockGetAllServerMetrics.mockReturnValue([
        { serverId: 'web-01', hostname: 'web-01.local' },
        { serverId: 'db-01', hostname: 'db-01.local' },
      ]);

      const res = await callGET(
        makeRequest('/api/servers/missing'),
        'missing'
      );
      const data = await res.json();

      expect(data.available_servers).toHaveLength(2);
      expect(data.available_servers[0].id).toBe('web-01');
    });
  });

  describe('Error handling', () => {
    it('should return 500 when metricsProvider throws', async () => {
      mockEnsureDataLoaded.mockRejectedValue(new Error('Data load failed'));

      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Server information retrieval failed');
    });

    it('should return 500 when getProcessedServer throws', async () => {
      mockGetProcessedServer.mockImplementation(() => {
        throw new Error('Processing failed');
      });

      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('Query parameters', () => {
    it('should handle include_metrics parameter', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?include_metrics=true'),
        'web-01'
      );
      const data = await res.json();

      expect(data.meta.request_info.include_metrics).toBe(true);
    });

    it('should handle include_patterns parameter', async () => {
      const res = await callGET(
        makeRequest('/api/servers/web-01?include_patterns=true'),
        'web-01'
      );
      const data = await res.json();

      expect(data.meta.request_info.include_patterns).toBe(true);
    });
  });

  describe('Environment mapping', () => {
    it.each([
      ['aws', 'AWS Seoul (ap-northeast-2)', 'Amazon Web Services'],
      ['azure', 'Azure Korea Central', 'Microsoft Azure'],
      ['gcp', 'GCP Seoul (asia-northeast3)', 'Google Cloud Platform'],
      ['idc', 'Seoul IDC', 'Internet Data Center'],
      ['onpremise', 'On-Premise Seoul DC1', 'On-Premise'],
    ])('should map %s environment correctly in legacy format', async (env, location, provider) => {
      mockGetServerMetrics.mockReturnValue({ ...BASE_METRIC, environment: env });

      const res = await callGET(
        makeRequest('/api/servers/web-01?format=legacy'),
        'web-01'
      );
      const data = await res.json();

      expect(data.server.location).toBe(location);
      expect(data.server.provider).toBe(provider);
    });

    it('should handle unknown environment gracefully', async () => {
      mockGetServerMetrics.mockReturnValue({ ...BASE_METRIC, environment: 'unknown-env' });

      const res = await callGET(
        makeRequest('/api/servers/web-01?format=legacy'),
        'web-01'
      );
      const data = await res.json();

      expect(data.server.location).toBe('Unknown Location');
      expect(data.server.provider).toBe('Unknown Provider');
    });
  });

  describe('Edge cases', () => {
    it('should handle server with null processed data', async () => {
      mockGetProcessedServer.mockReturnValue(null);

      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.current_metrics.network_in).toBe(0);
      expect(data.data.current_metrics.network_out).toBe(0);
      expect(data.data.services).toEqual([]);
    });

    it('should handle server with no hostname', async () => {
      mockGetServerMetrics.mockReturnValue({
        ...BASE_METRIC,
        hostname: undefined,
      });

      const res = await callGET(makeRequest('/api/servers/web-01'), 'web-01');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.server_info.hostname).toBe('web-01');
    });
  });
});
