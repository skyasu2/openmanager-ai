import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoadCurrentOTelServers, mockLogger } = vi.hoisted(() => ({
  mockLoadCurrentOTelServers: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/services/metrics/otel-direct-transform', () => ({
  loadCurrentOTelServers: mockLoadCurrentOTelServers,
}));
vi.mock('@/lib/logging', () => ({ logger: mockLogger }));

import { getOTelDashboardData } from './server-data';

function createMockServer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'srv-1', name: 'Test Server', hostname: 'test-01',
    status: 'online', cpu: 45, memory: 60, disk: 30, network: 10,
    responseTime: 100, uptime: 86400, location: 'Seoul',
    ip: '10.0.0.1', os: 'Ubuntu', type: 'web', role: 'web',
    environment: 'production', provider: 'aws',
    specs: { cpu: '4 vCPU', memory: '8GB' },
    lastUpdate: '2026-01-01T00:00:00Z',
    services: [], systemInfo: {}, networkInfo: {},
    structuredLogs: [],
    ...overrides,
  };
}

describe('getOTelDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('success', () => {
    it('returns converted servers with correct fields', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [createMockServer()],
        hour: 10, slotIndex: 3, minuteOfDay: 630,
      });

      const result = await getOTelDashboardData();

      expect(result.servers).toHaveLength(1);
      const server = result.servers[0];
      expect(server.id).toBe('srv-1');
      expect(server.name).toBe('Test Server');
      expect(server.hostname).toBe('test-01');
      expect(server.status).toBe('online');
      expect(server.cpu).toBe(45);
      expect(server.memory).toBe(60);
      expect(server.disk).toBe(30);
      expect(server.network).toBe(10);
      expect(server.responseTime).toBe(100);
      expect(server.uptime).toBe(86400);
      expect(server.location).toBe('Seoul');
      expect(server.ip).toBe('10.0.0.1');
      expect(server.os).toBe('Ubuntu');
      expect(server.type).toBe('web');
      expect(server.role).toBe('web');
      expect(server.environment).toBe('production');
      expect(server.provider).toBe('aws');
    });

    it('maps maintenance status to offline', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [createMockServer({ id: 'srv-m', status: 'maintenance' })],
        hour: 0, slotIndex: 0, minuteOfDay: 0,
      });

      const result = await getOTelDashboardData();

      expect(result.servers[0].status).toBe('offline');
      expect(result.stats.offline).toBe(1);
    });

    it('maps unknown status to offline', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [createMockServer({ id: 'srv-u', status: 'unknown' })],
        hour: 0, slotIndex: 0, minuteOfDay: 0,
      });

      const result = await getOTelDashboardData();

      expect(result.servers[0].status).toBe('offline');
      expect(result.stats.offline).toBe(1);
    });

    it('sorts servers by status priority (critical/offline first, then warning, then online)', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [
          createMockServer({ id: 'srv-online', status: 'online' }),
          createMockServer({ id: 'srv-critical', status: 'critical' }),
          createMockServer({ id: 'srv-warning', status: 'warning' }),
          createMockServer({ id: 'srv-offline', status: 'offline' }),
        ],
        hour: 5, slotIndex: 1, minuteOfDay: 300,
      });

      const result = await getOTelDashboardData();

      const ids = result.servers.map(s => s.id);
      // critical (0) and offline (0) come first, then warning (1), then online (2)
      expect(ids.indexOf('srv-critical')).toBeLessThan(ids.indexOf('srv-warning'));
      expect(ids.indexOf('srv-offline')).toBeLessThan(ids.indexOf('srv-warning'));
      expect(ids.indexOf('srv-warning')).toBeLessThan(ids.indexOf('srv-online'));
    });

    it('calculates stats counts correctly', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [
          createMockServer({ id: 'srv-1', status: 'online' }),
          createMockServer({ id: 'srv-2', status: 'online' }),
          createMockServer({ id: 'srv-3', status: 'warning' }),
          createMockServer({ id: 'srv-4', status: 'critical' }),
          createMockServer({ id: 'srv-5', status: 'offline' }),
        ],
        hour: 12, slotIndex: 2, minuteOfDay: 720,
      });

      const result = await getOTelDashboardData();

      expect(result.stats).toEqual({
        total: 5,
        online: 2,
        warning: 1,
        critical: 1,
        offline: 1,
      });
    });

    it('passes through timeInfo correctly', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [],
        hour: 14, slotIndex: 5, minuteOfDay: 870,
      });

      const result = await getOTelDashboardData();

      expect(result.timeInfo).toEqual({
        hour: 14,
        slotIndex: 5,
        minuteOfDay: 870,
      });
    });

    it('converts lastUpdate to Date object', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [createMockServer({ lastUpdate: '2026-03-06T12:00:00Z' })],
        hour: 12, slotIndex: 0, minuteOfDay: 720,
      });

      const result = await getOTelDashboardData();

      expect(result.servers[0].lastUpdate).toBeInstanceOf(Date);
      expect((result.servers[0].lastUpdate as Date).toISOString()).toBe('2026-03-06T12:00:00.000Z');
    });

    it('always sets alerts to empty array', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [createMockServer()],
        hour: 0, slotIndex: 0, minuteOfDay: 0,
      });

      const result = await getOTelDashboardData();

      expect(result.servers[0].alerts).toEqual([]);
    });
  });

  describe('error', () => {
    it('returns empty data when loadCurrentOTelServers throws', async () => {
      mockLoadCurrentOTelServers.mockRejectedValue(new Error('Load failed'));

      const result = await getOTelDashboardData();

      expect(result).toEqual({
        servers: [],
        stats: { total: 0, online: 0, warning: 0, critical: 0, offline: 0 },
        timeInfo: { hour: 0, slotIndex: 0, minuteOfDay: 0 },
      });
    });

    it('logs error when loadCurrentOTelServers throws', async () => {
      const error = new Error('Connection timeout');
      mockLoadCurrentOTelServers.mockRejectedValue(error);

      await getOTelDashboardData();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[server-data] OTel dashboard data load failed:',
        error,
      );
    });
  });

  describe('edge cases', () => {
    it('returns zero stats for empty server list', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [],
        hour: 0, slotIndex: 0, minuteOfDay: 0,
      });

      const result = await getOTelDashboardData();

      expect(result.servers).toHaveLength(0);
      expect(result.stats).toEqual({
        total: 0, online: 0, warning: 0, critical: 0, offline: 0,
      });
    });

    it('handles multiple servers with mixed statuses including maintenance and unknown', async () => {
      mockLoadCurrentOTelServers.mockResolvedValue({
        servers: [
          createMockServer({ id: 'srv-1', status: 'online' }),
          createMockServer({ id: 'srv-2', status: 'warning' }),
          createMockServer({ id: 'srv-3', status: 'critical' }),
          createMockServer({ id: 'srv-4', status: 'maintenance' }),
          createMockServer({ id: 'srv-5', status: 'unknown' }),
          createMockServer({ id: 'srv-6', status: 'online' }),
        ],
        hour: 18, slotIndex: 4, minuteOfDay: 1080,
      });

      const result = await getOTelDashboardData();

      expect(result.stats).toEqual({
        total: 6,
        online: 2,
        warning: 1,
        critical: 1,
        offline: 2, // maintenance + unknown both map to offline
      });

      // Verify sorting: critical/offline before warning before online
      const statuses = result.servers.map(s => s.status);
      const firstWarningIdx = statuses.indexOf('warning');
      const firstOnlineIdx = statuses.indexOf('online');
      const criticalOfflineStatuses = statuses.filter(s => s === 'critical' || s === 'offline');
      expect(criticalOfflineStatuses).toHaveLength(3);
      expect(firstWarningIdx).toBeLessThan(firstOnlineIdx);
    });
  });
});
