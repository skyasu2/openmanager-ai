/**
 * Server Metrics Tools Tests
 *
 * Unit tests for server metrics tools including getServerByGroup.
 *
 * @version 1.0.0
 * @created 2026-01-19
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock precomputed-state
vi.mock('../data/precomputed-state', () => {
  const servers = [
    {
      id: 'web-nginx-dc1-01',
      name: 'Web Server 01',
      type: 'web',
      status: 'online',
      cpu: 45,
      memory: 62,
      disk: 55,
      network: 120,
    },
    {
      id: 'web-nginx-dc1-02',
      name: 'Web Server 02',
      type: 'web',
      status: 'warning',
      cpu: 78,
      memory: 82,
      disk: 60,
      network: 150,
    },
    {
      id: 'db-mysql-dc1-01',
      name: 'Database Primary',
      type: 'database',
      status: 'online',
      cpu: 55,
      memory: 70,
      disk: 65,
      network: 200,
    },
    {
      id: 'db-mysql-dc1-02',
      name: 'Database Replica',
      type: 'database',
      status: 'online',
      cpu: 35,
      memory: 55,
      disk: 60,
      network: 180,
    },
    {
      id: 'lb-haproxy-dc1-01',
      name: 'Load Balancer 01',
      type: 'loadbalancer',
      status: 'online',
      cpu: 25,
      memory: 40,
      disk: 30,
      network: 500,
    },
    {
      id: 'cache-redis-dc1-01',
      name: 'Cache Server 01',
      type: 'cache',
      status: 'online',
      cpu: 30,
      memory: 85,
      disk: 20,
      network: 300,
    },
    {
      id: 'cache-redis-dc1-02',
      name: 'Cache Server 02',
      type: 'cache',
      status: 'warning',
      cpu: 40,
      memory: 88,
      disk: 25,
      network: 280,
    },
    {
      id: 'api-node-dc1-01',
      name: 'API Server 01',
      type: 'application',
      status: 'online',
      cpu: 50,
      memory: 60,
      disk: 40,
      network: 150,
    },
    {
      id: 'storage-nfs-dc1-01',
      name: 'Storage Server 01',
      type: 'storage',
      status: 'critical',
      cpu: 20,
      memory: 30,
      disk: 92,
      network: 100,
    },
  ];

  const state = {
    timestamp: new Date().toISOString(),
    servers,
    systemHealth: {
      overall: 'warning',
      healthyCount: 6,
      warningCount: 2,
      criticalCount: 1,
    },
  };

  const slots = Array.from({ length: 144 }, (_, slotIndex) => ({
    slotIndex,
    timestamp: new Date(Date.now() - (143 - slotIndex) * 10 * 60 * 1000).toISOString(),
    timeLabel: `${String(Math.floor(slotIndex / 6)).padStart(2, '0')}:${String((slotIndex % 6) * 10).padStart(2, '0')}`,
    servers,
    summary: state.systemHealth,
  }));

  return {
    getCurrentState: vi.fn(() => state),
    getSlots: vi.fn(() => slots),
    getStateBySlot: vi.fn((slot: number) => slots[((slot % 144) + 144) % 144]),
  };
});

// Mock cache-layer
vi.mock('../lib/cache-layer', () => ({
  getDataCache: vi.fn(() => ({
    getMetrics: vi.fn((_key: string, compute: () => Promise<unknown>) => compute()),
    getOrCompute: vi.fn((_type: string, _key: string, compute: () => Promise<unknown>) => compute()),
  })),
}));

import { getServerByGroup, getServerByGroupAdvanced, getServerMetrics, filterServers } from './server-metrics';

// ============================================================================
// getServerByGroup Tests
// ============================================================================

describe('getServerByGroupAdvanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should return database servers without filters', async () => {
      const result = await getServerByGroupAdvanced.execute({ group: 'db' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('database');
      expect(result.servers).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.filtered).toBe(2);
    });

    it('should support technology stack abbreviations', async () => {
      const result = await getServerByGroupAdvanced.execute({ group: 'mysql' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('database');
    });
  });

  describe('CPU Filtering', () => {
    it('should filter by cpuMin', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'web', filters: { cpuMin: 70 } },
        {} as never
      );

      expect(result.success).toBe(true);
      expect(result.appliedFilters?.cpuMin).toBe(70);
      // All returned servers should have cpu >= 70
      result.servers.forEach((s: { cpu: number }) => {
        expect(s.cpu).toBeGreaterThanOrEqual(70);
      });
    });

    it('should filter by cpuMax', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'database', filters: { cpuMax: 50 } },
        {} as never
      );

      expect(result.success).toBe(true);
      // All returned servers should have cpu <= 50
      result.servers.forEach((s: { cpu: number }) => {
        expect(s.cpu).toBeLessThanOrEqual(50);
      });
    });

    it('should filter by CPU range', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'database', filters: { cpuMin: 30, cpuMax: 60 } },
        {} as never
      );

      expect(result.success).toBe(true);
      result.servers.forEach((s: { cpu: number }) => {
        expect(s.cpu).toBeGreaterThanOrEqual(30);
        expect(s.cpu).toBeLessThanOrEqual(60);
      });
    });
  });

  describe('Memory Filtering', () => {
    it('should filter by memoryMin', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'cache', filters: { memoryMin: 60 } },
        {} as never
      );

      expect(result.success).toBe(true);
      result.servers.forEach((s: { memory: number }) => {
        expect(s.memory).toBeGreaterThanOrEqual(60);
      });
    });
  });

  describe('Status Filtering', () => {
    it('should filter by status "warning"', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'web', filters: { status: 'warning' } },
        {} as never
      );

      expect(result.success).toBe(true);
      result.servers.forEach((s: { status: string }) => {
        expect(s.status).toBe('warning');
      });
    });

    it('should filter by status "critical"', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'storage', filters: { status: 'critical' } },
        {} as never
      );

      expect(result.success).toBe(true);
      result.servers.forEach((s: { status: string }) => {
        expect(s.status).toBe('critical');
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by CPU descending', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'database', sort: { by: 'cpu', order: 'desc' } },
        {} as never
      );

      expect(result.success).toBe(true);
      expect(result.appliedSort?.by).toBe('cpu');
      expect(result.appliedSort?.order).toBe('desc');

      // Verify descending order
      for (let i = 0; i < result.servers.length - 1; i++) {
        expect(result.servers[i].cpu).toBeGreaterThanOrEqual(result.servers[i + 1].cpu);
      }
    });

    it('should sort by memory ascending', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'cache', sort: { by: 'memory', order: 'asc' } },
        {} as never
      );

      expect(result.success).toBe(true);

      // Verify ascending order
      for (let i = 0; i < result.servers.length - 1; i++) {
        expect(result.servers[i].memory).toBeLessThanOrEqual(result.servers[i + 1].memory);
      }
    });

    it('should sort by name ascending', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'web', sort: { by: 'name', order: 'asc' } },
        {} as never
      );

      expect(result.success).toBe(true);

      // Verify alphabetical order
      for (let i = 0; i < result.servers.length - 1; i++) {
        expect(result.servers[i].name.localeCompare(result.servers[i + 1].name)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('Limit', () => {
    it('should limit results', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'database', limit: 1 },
        {} as never
      );

      expect(result.success).toBe(true);
      expect(result.servers).toHaveLength(1);
      expect(result.summary.total).toBe(2); // Total before filters
      expect(result.summary.filtered).toBe(2); // After filters (before limit)
      expect(result.summary.returned).toBe(1); // After limit
    });
  });

  describe('Combined Filters and Sort', () => {
    it('should filter and sort together', async () => {
      const result = await getServerByGroupAdvanced.execute(
        {
          group: 'web',
          filters: { cpuMin: 0 },
          sort: { by: 'cpu', order: 'desc' },
          limit: 2,
        },
        {} as never
      );

      expect(result.success).toBe(true);
      expect(result.servers.length).toBeLessThanOrEqual(2);
      expect(result.appliedFilters).toBeDefined();
      expect(result.appliedSort).toBeDefined();
    });
  });

  describe('Summary Calculation', () => {
    it('should calculate summary correctly after filtering', async () => {
      const result = await getServerByGroupAdvanced.execute(
        { group: 'web', filters: { status: 'online' } },
        {} as never
      );

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(2); // Total web servers
      expect(result.summary.filtered).toBe(result.summary.returned); // No limit, so equal
      expect(result.summary.online).toBe(result.servers.length); // All filtered are online
    });
  });
});

// ============================================================================
// getServerMetrics Tests (Sanity Check)
// ============================================================================

describe('getServerMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all servers when no serverId specified', async () => {
    const result = await getServerMetrics.execute({ metric: 'all' }, {} as never);

    expect(result.success).toBe(true);
    expect(result.servers).toHaveLength(9);
    expect(result.summary.total).toBe(9);
  });

  it('should return specific server when serverId specified', async () => {
    const result = await getServerMetrics.execute(
      { serverId: 'db-mysql-dc1-01', metric: 'all' },
      {} as never
    );

    expect(result.success).toBe(true);
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0].id).toBe('db-mysql-dc1-01');
  });
});

// ============================================================================
// filterServers Tests (Sanity Check)
// ============================================================================

describe('filterServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter servers by CPU threshold', async () => {
    const result = await filterServers.execute(
      { field: 'cpu', operator: '>', value: 70, limit: 10 },
      {} as never
    );

    expect(result.success).toBe(true);
    expect(result.condition).toBe('cpu > 70%');
    expect(result.servers.length).toBeGreaterThan(0);
    result.servers.forEach((server: { cpu: number }) => {
      expect(server.cpu).toBeGreaterThan(70);
    });
  });

  it('should filter servers by memory threshold', async () => {
    const result = await filterServers.execute(
      { field: 'memory', operator: '>=', value: 80, limit: 10 },
      {} as never
    );

    expect(result.success).toBe(true);
    expect(result.condition).toBe('memory >= 80%');
  });

  it('should respect limit parameter', async () => {
    const result = await filterServers.execute(
      { field: 'cpu', operator: '>', value: 0, limit: 3 },
      {} as never
    );

    expect(result.success).toBe(true);
    expect(result.servers.length).toBeLessThanOrEqual(3);
  });
});
