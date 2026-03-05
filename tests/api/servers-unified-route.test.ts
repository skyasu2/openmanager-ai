import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockWithAuth,
  mockGetAllAsEnhancedMetrics,
  mockGetServerAsEnhanced,
  mockQueryOTelLogs,
  mockEnsureDataLoaded,
  mockLogger,
  mockDebug,
  mockGetErrorMessage,
} = vi.hoisted(() => ({
  mockWithAuth: vi.fn((handler: (...args: never) => unknown) => handler),
  mockGetAllAsEnhancedMetrics: vi.fn(),
  mockGetServerAsEnhanced: vi.fn(),
  mockQueryOTelLogs: vi.fn(),
  mockEnsureDataLoaded: vi.fn(),
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  mockDebug: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  mockGetErrorMessage: vi.fn(
    (e: unknown) => (e as { message?: string })?.message || 'Unknown'
  ),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: mockWithAuth,
}));

vi.mock('@/services/monitoring', () => ({
  getServerMonitoringService: () => ({
    getAllAsEnhancedMetrics: mockGetAllAsEnhancedMetrics,
    getServerAsEnhanced: mockGetServerAsEnhanced,
  }),
}));

vi.mock('@/services/monitoring/otel-log-search', () => ({
  queryOTelLogs: mockQueryOTelLogs,
}));

vi.mock('@/services/metrics/MetricsProvider', () => ({
  MetricsProvider: {
    getInstance: () => ({
      ensureDataLoaded: mockEnsureDataLoaded,
    }),
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: mockLogger,
}));

vi.mock('@/utils/debug', () => ({
  default: mockDebug,
}));

vi.mock('@/types/type-utils', () => ({
  getErrorMessage: mockGetErrorMessage,
}));

import { GET, POST } from '@/app/api/servers-unified/route';

// --- Mock data ---

const mockServers = [
  {
    id: 'srv-1',
    name: 'Web Server 1',
    hostname: 'web-01',
    status: 'online',
    cpu_usage: 45,
    memory_usage: 60,
    disk_usage: 30,
    network: 10,
    uptime: 86400,
    type: 'web',
  },
  {
    id: 'srv-2',
    name: 'DB Server 1',
    hostname: 'db-01',
    status: 'warning',
    cpu_usage: 80,
    memory_usage: 85,
    disk_usage: 70,
    network: 5,
    uptime: 172800,
    type: 'database',
  },
];

describe('Servers Unified Route (/api/servers-unified)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDataLoaded.mockResolvedValue(undefined);
    mockGetAllAsEnhancedMetrics.mockResolvedValue(
      mockServers.map((s) => ({ ...s }))
    );
    mockGetServerAsEnhanced.mockResolvedValue({ ...mockServers[0] });
  });

  // --- POST tests ---

  describe('POST', () => {
    function postRequest(body: unknown) {
      return new NextRequest('http://localhost/api/servers-unified', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    it('action: list returns paginated server list with success=true', async () => {
      const response = await POST(postRequest({ action: 'list' }));
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.action).toBe('list');
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data).toHaveLength(2);
      expect(payload.pagination).toBeDefined();
      expect(payload.pagination.total).toBe(2);
      expect(payload.pagination.page).toBe(1);
      expect(payload.summary).toBeDefined();
    });

    it('action: detail with serverId returns server details', async () => {
      const response = await POST(
        postRequest({ action: 'detail', serverId: 'srv-1' })
      );
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.action).toBe('detail');
      expect(payload.serverId).toBe('srv-1');
      expect(payload.data).toBeDefined();
      expect(payload.data.id).toBe('srv-1');
    });

    it('action: detail without serverId returns error', async () => {
      const response = await POST(postRequest({ action: 'detail' }));
      expect(response.status).toBe(400);

      const payload = await response.json();
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('serverId required');
    });

    it('invalid JSON body returns 400', async () => {
      const request = new NextRequest('http://localhost/api/servers-unified', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const payload = await response.json();
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('Invalid JSON body');
    });

    it('invalid action returns 400 validation error', async () => {
      const response = await POST(postRequest({ action: 'nonexistent' }));
      expect(response.status).toBe(400);

      const payload = await response.json();
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('validation failed');
    });
  });

  // --- GET tests ---

  describe('GET', () => {
    function getRequest(params = '') {
      return new NextRequest(
        `http://localhost/api/servers-unified${params ? `?${params}` : ''}`
      );
    }

    it('default GET (no params) returns list action', async () => {
      const response = await GET(getRequest());
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.action).toBe('list');
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data).toHaveLength(2);
      expect(payload.pagination).toBeDefined();
    });

    it('GET with action=detail&serverId=srv-1 returns detail', async () => {
      const response = await GET(getRequest('action=detail&serverId=srv-1'));
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.action).toBe('detail');
      expect(payload.data.id).toBe('srv-1');
    });

    it('GET with pagination params works correctly', async () => {
      const response = await GET(getRequest('page=1&limit=1'));
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.data).toHaveLength(1);
      expect(payload.pagination.page).toBe(1);
      expect(payload.pagination.limit).toBe(1);
      expect(payload.pagination.total).toBe(2);
      expect(payload.pagination.totalPages).toBe(2);
      expect(payload.pagination.hasNext).toBe(true);
    });
  });
});
