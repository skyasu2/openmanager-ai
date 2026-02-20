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

describe('getServerByGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should return database servers for "db" input', async () => {
      const result = await getServerByGroup.execute({ group: 'db' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('database');
      expect(result.servers).toHaveLength(2);
      expect(result.servers[0].type).toBe('database');
      expect(result.summary.total).toBe(2);
      expect(result.summary.online).toBe(2);
    });

    it('should return database servers for "database" input', async () => {
      const result = await getServerByGroup.execute({ group: 'database' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('database');
      expect(result.servers).toHaveLength(2);
    });

    it('should return loadbalancer servers for "lb" input', async () => {
      const result = await getServerByGroup.execute({ group: 'lb' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('loadbalancer');
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].id).toBe('lb-haproxy-dc1-01');
    });

    it('should return web servers for "web" input', async () => {
      const result = await getServerByGroup.execute({ group: 'web' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('web');
      expect(result.servers).toHaveLength(2);
      expect(result.summary.online).toBe(1);
      expect(result.summary.warning).toBe(1);
    });

    it('should return cache servers for "cache" input', async () => {
      const result = await getServerByGroup.execute({ group: 'cache' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('cache');
      expect(result.servers).toHaveLength(2);
    });

    it('should return application servers for "api" input', async () => {
      const result = await getServerByGroup.execute({ group: 'api' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('application');
      expect(result.servers).toHaveLength(1);
    });

    it('should return application servers for "app" input', async () => {
      const result = await getServerByGroup.execute({ group: 'app' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('application');
      expect(result.servers).toHaveLength(1);
    });

    it('should return storage servers for "storage" input', async () => {
      const result = await getServerByGroup.execute({ group: 'storage' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('storage');
      expect(result.servers).toHaveLength(1);
      expect(result.summary.critical).toBe(1);
    });
  });

  describe('Abbreviation Mapping', () => {
    it('should map "db" to "database"', async () => {
      const result = await getServerByGroup.execute({ group: 'db' }, {} as never);
      expect(result.group).toBe('database');
    });

    it('should map "lb" to "loadbalancer"', async () => {
      const result = await getServerByGroup.execute({ group: 'lb' }, {} as never);
      expect(result.group).toBe('loadbalancer');
    });

    it('should map "api" to "application"', async () => {
      const result = await getServerByGroup.execute({ group: 'api' }, {} as never);
      expect(result.group).toBe('application');
    });

    it('should map "app" to "application"', async () => {
      const result = await getServerByGroup.execute({ group: 'app' }, {} as never);
      expect(result.group).toBe('application');
    });
  });

  describe('Technology Stack Mapping', () => {
    // Database technology stacks
    it('should map "mysql" to "database"', async () => {
      const result = await getServerByGroup.execute({ group: 'mysql' }, {} as never);
      expect(result.group).toBe('database');
    });

    it('should map "postgres" to "database"', async () => {
      const result = await getServerByGroup.execute({ group: 'postgres' }, {} as never);
      expect(result.group).toBe('database');
    });

    it('should map "mongodb" to "database"', async () => {
      const result = await getServerByGroup.execute({ group: 'mongodb' }, {} as never);
      expect(result.group).toBe('database');
    });

    it('should map "oracle" to "database"', async () => {
      const result = await getServerByGroup.execute({ group: 'oracle' }, {} as never);
      expect(result.group).toBe('database');
    });

    // Load Balancer technology stacks
    it('should map "haproxy" to "loadbalancer"', async () => {
      const result = await getServerByGroup.execute({ group: 'haproxy' }, {} as never);
      expect(result.group).toBe('loadbalancer');
    });

    it('should map "f5" to "loadbalancer"', async () => {
      const result = await getServerByGroup.execute({ group: 'f5' }, {} as never);
      expect(result.group).toBe('loadbalancer');
    });

    // Web server technology stacks
    it('should map "nginx" to "web"', async () => {
      const result = await getServerByGroup.execute({ group: 'nginx' }, {} as never);
      expect(result.group).toBe('web');
    });

    it('should map "apache" to "web"', async () => {
      const result = await getServerByGroup.execute({ group: 'apache' }, {} as never);
      expect(result.group).toBe('web');
    });

    it('should map "frontend" to "web"', async () => {
      const result = await getServerByGroup.execute({ group: 'frontend' }, {} as never);
      expect(result.group).toBe('web');
    });

    // Cache technology stacks
    it('should map "redis" to "cache"', async () => {
      const result = await getServerByGroup.execute({ group: 'redis' }, {} as never);
      expect(result.group).toBe('cache');
    });

    it('should map "memcached" to "cache"', async () => {
      const result = await getServerByGroup.execute({ group: 'memcached' }, {} as never);
      expect(result.group).toBe('cache');
    });

    // Storage technology stacks
    it('should map "s3" to "storage"', async () => {
      const result = await getServerByGroup.execute({ group: 's3' }, {} as never);
      expect(result.group).toBe('storage');
    });

    it('should map "nas" to "storage"', async () => {
      const result = await getServerByGroup.execute({ group: 'nas' }, {} as never);
      expect(result.group).toBe('storage');
    });

    // Application technology stacks
    it('should map "backend" to "application"', async () => {
      const result = await getServerByGroup.execute({ group: 'backend' }, {} as never);
      expect(result.group).toBe('application');
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase input "DB"', async () => {
      const result = await getServerByGroup.execute({ group: 'DB' }, {} as never);
      expect(result.success).toBe(true);
      expect(result.group).toBe('database');
    });

    it('should handle mixed case "DataBase"', async () => {
      const result = await getServerByGroup.execute({ group: 'DataBase' }, {} as never);
      expect(result.success).toBe(true);
      expect(result.group).toBe('database');
    });

    it('should handle uppercase "WEB"', async () => {
      const result = await getServerByGroup.execute({ group: 'WEB' }, {} as never);
      expect(result.success).toBe(true);
      expect(result.group).toBe('web');
    });
  });

  describe('Summary Calculation', () => {
    it('should correctly count online servers', async () => {
      const result = await getServerByGroup.execute({ group: 'database' }, {} as never);
      expect(result.summary.online).toBe(2);
      expect(result.summary.warning).toBe(0);
      expect(result.summary.critical).toBe(0);
    });

    it('should correctly count warning servers', async () => {
      const result = await getServerByGroup.execute({ group: 'web' }, {} as never);
      expect(result.summary.online).toBe(1);
      expect(result.summary.warning).toBe(1);
      expect(result.summary.critical).toBe(0);
    });

    it('should correctly count critical servers', async () => {
      const result = await getServerByGroup.execute({ group: 'storage' }, {} as never);
      expect(result.summary.online).toBe(0);
      expect(result.summary.warning).toBe(0);
      expect(result.summary.critical).toBe(1);
    });

    it('should have total equal to sum of status counts', async () => {
      const result = await getServerByGroup.execute({ group: 'cache' }, {} as never);
      const { total, online, warning, critical } = result.summary;
      expect(total).toBe(online + warning + critical);
    });
  });

  describe('Response Structure', () => {
    it('should include all required fields in response', async () => {
      const result = await getServerByGroup.execute({ group: 'db' }, {} as never);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('group');
      expect(result).toHaveProperty('servers');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('timestamp');
    });

    it('should include all required fields in server objects', async () => {
      const result = await getServerByGroup.execute({ group: 'db' }, {} as never);

      expect(result.servers[0]).toHaveProperty('id');
      expect(result.servers[0]).toHaveProperty('name');
      expect(result.servers[0]).toHaveProperty('type');
      expect(result.servers[0]).toHaveProperty('status');
      expect(result.servers[0]).toHaveProperty('cpu');
      expect(result.servers[0]).toHaveProperty('memory');
      expect(result.servers[0]).toHaveProperty('disk');
    });

    it('should return valid timestamp', async () => {
      const result = await getServerByGroup.execute({ group: 'db' }, {} as never);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array for unknown group type', async () => {
      const result = await getServerByGroup.execute({ group: 'unknown-type' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('unknown-type');
      expect(result.servers).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });

    it('should handle whitespace in input', async () => {
      const result = await getServerByGroup.execute({ group: '  db  ' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.group).toBe('database');
    });

    it('should NOT false match partial type names', async () => {
      // This tests that "database" doesn't match "databaseX" or similar
      const result = await getServerByGroup.execute({ group: 'data' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.servers).toHaveLength(0); // "data" is not a valid type
    });

    it('should handle empty string input', async () => {
      const result = await getServerByGroup.execute({ group: '' }, {} as never);

      expect(result.success).toBe(true);
      expect(result.servers).toHaveLength(0);
    });
  });

  describe('Type Normalization', () => {
    it('should normalize "db" to "database" in response', async () => {
      const result = await getServerByGroup.execute({ group: 'db' }, {} as never);

      expect(result.group).toBe('database');
      result.servers.forEach((server: { type: string }) => {
        expect(server.type).toBe('database');
      });
    });

    it('should normalize "lb" to "loadbalancer" in response', async () => {
      const result = await getServerByGroup.execute({ group: 'lb' }, {} as never);

      expect(result.group).toBe('loadbalancer');
    });

    it('should normalize "api" to "application" in response', async () => {
      const result = await getServerByGroup.execute({ group: 'api' }, {} as never);

      expect(result.group).toBe('application');
    });

    it('should normalize "app" to "application" in response', async () => {
      const result = await getServerByGroup.execute({ group: 'app' }, {} as never);

      expect(result.group).toBe('application');
    });

    it('should keep non-aliased types as-is', async () => {
      const result = await getServerByGroup.execute({ group: 'cache' }, {} as never);

      expect(result.group).toBe('cache');
    });
  });

  describe('Summary Validation', () => {
    it('should have summary.total equal to servers array length', async () => {
      const result = await getServerByGroup.execute({ group: 'web' }, {} as never);

      expect(result.summary.total).toBe(result.servers.length);
    });

    it('should have status counts sum equal to total', async () => {
      const result = await getServerByGroup.execute({ group: 'database' }, {} as never);
      const { total, online, warning, critical } = result.summary;

      expect(online + warning + critical).toBe(total);
    });

    it('should return zero counts for empty group', async () => {
      const result = await getServerByGroup.execute({ group: 'nonexistent' }, {} as never);

      expect(result.summary.total).toBe(0);
      expect(result.summary.online).toBe(0);
      expect(result.summary.warning).toBe(0);
      expect(result.summary.critical).toBe(0);
    });
  });
});

// ============================================================================
// getServerByGroupAdvanced Tests
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
