import { describe, it, expect } from 'vitest';
import type { ServerMetrics } from '@/services/metrics/MetricsProvider';
import { MetricsAggregator } from './MetricsAggregator';

function createServer(overrides: Partial<ServerMetrics>): ServerMetrics {
  return {
    serverId: 'srv-1',
    serverType: 'web',
    status: 'online',
    cpu: 50,
    memory: 60,
    disk: 40,
    network: 20,
    ...overrides,
  } as ServerMetrics;
}

describe('MetricsAggregator', () => {
  const aggregator = new MetricsAggregator();

  // 1. Empty array
  it('returns zero counts and empty arrays for empty input', () => {
    const result = aggregator.aggregate([]);

    expect(result.statusCounts).toEqual({
      total: 0,
      online: 0,
      warning: 0,
      critical: 0,
      offline: 0,
    });
    expect(result.byServerType).toEqual([]);
    expect(result.topCpu).toEqual([]);
    expect(result.topMemory).toEqual([]);
    expect(result.avgCpu).toBe(0);
    expect(result.avgMemory).toBe(0);
    expect(result.avgDisk).toBe(0);
    expect(result.avgNetwork).toBe(0);
  });

  // 2. Single server
  it('returns correct counts and averages for a single server', () => {
    const server = createServer({
      serverId: 'web-01',
      serverType: 'web',
      status: 'online',
      cpu: 70,
      memory: 80,
      disk: 50,
      network: 30,
    });
    const result = aggregator.aggregate([server]);

    expect(result.statusCounts).toEqual({
      total: 1,
      online: 1,
      warning: 0,
      critical: 0,
      offline: 0,
    });
    expect(result.avgCpu).toBe(70);
    expect(result.avgMemory).toBe(80);
    expect(result.avgDisk).toBe(50);
    expect(result.avgNetwork).toBe(30);
    expect(result.byServerType).toHaveLength(1);
    expect(result.topCpu).toHaveLength(1);
    expect(result.topMemory).toHaveLength(1);
  });

  // 3. Mixed statuses
  it('counts mixed statuses correctly', () => {
    const servers = [
      createServer({ serverId: 's1', status: 'online' }),
      createServer({ serverId: 's2', status: 'online' }),
      createServer({ serverId: 's3', status: 'warning' }),
      createServer({ serverId: 's4', status: 'critical' }),
      createServer({ serverId: 's5', status: 'offline' }),
      createServer({ serverId: 's6', status: 'offline' }),
    ];
    const result = aggregator.aggregate(servers);

    expect(result.statusCounts).toEqual({
      total: 6,
      online: 2,
      warning: 1,
      critical: 1,
      offline: 2,
    });
  });

  // 4. byServerType grouping
  it('groups servers by serverType with correct averages', () => {
    const servers = [
      createServer({ serverId: 'w1', serverType: 'web', cpu: 60, memory: 70, disk: 30, network: 10, status: 'online' }),
      createServer({ serverId: 'w2', serverType: 'web', cpu: 80, memory: 90, disk: 50, network: 30, status: 'warning' }),
      createServer({ serverId: 'd1', serverType: 'db', cpu: 40, memory: 50, disk: 80, network: 5, status: 'online' }),
    ];
    const result = aggregator.aggregate(servers);

    expect(result.byServerType).toHaveLength(2);

    const webGroup = result.byServerType.find((g) => g.serverType === 'web');
    expect(webGroup).toBeDefined();
    expect(webGroup!.count).toBe(2);
    expect(webGroup!.avgCpu).toBe(Math.round((60 + 80) / 2));
    expect(webGroup!.avgMemory).toBe(Math.round((70 + 90) / 2));
    expect(webGroup!.avgDisk).toBe(Math.round((30 + 50) / 2));
    expect(webGroup!.avgNetwork).toBe(Math.round((10 + 30) / 2));
    expect(webGroup!.maxCpu).toBe(80);
    expect(webGroup!.maxMemory).toBe(90);
    expect(webGroup!.onlineCount).toBe(1);
    expect(webGroup!.warningCount).toBe(1);
    expect(webGroup!.criticalCount).toBe(0);

    const dbGroup = result.byServerType.find((g) => g.serverType === 'db');
    expect(dbGroup).toBeDefined();
    expect(dbGroup!.count).toBe(1);
    expect(dbGroup!.avgCpu).toBe(40);
    expect(dbGroup!.maxCpu).toBe(40);
  });

  // 5. topCpu returns top 5 by CPU descending
  it('returns top 5 servers by CPU descending', () => {
    const servers = Array.from({ length: 7 }, (_, i) =>
      createServer({ serverId: `srv-${i}`, cpu: (i + 1) * 10 }),
    );
    const result = aggregator.aggregate(servers);

    expect(result.topCpu).toHaveLength(5);
    expect(result.topCpu[0].value).toBe(70);
    expect(result.topCpu[1].value).toBe(60);
    expect(result.topCpu[2].value).toBe(50);
    expect(result.topCpu[3].value).toBe(40);
    expect(result.topCpu[4].value).toBe(30);
  });

  // 6. topMemory returns top 5 by memory descending
  it('returns top 5 servers by memory descending', () => {
    const servers = Array.from({ length: 7 }, (_, i) =>
      createServer({ serverId: `srv-${i}`, memory: (i + 1) * 10 }),
    );
    const result = aggregator.aggregate(servers);

    expect(result.topMemory).toHaveLength(5);
    expect(result.topMemory[0].value).toBe(70);
    expect(result.topMemory[1].value).toBe(60);
    expect(result.topMemory[2].value).toBe(50);
    expect(result.topMemory[3].value).toBe(40);
    expect(result.topMemory[4].value).toBe(30);
  });

  // 7. Top-N with fewer than 5 servers
  it('returns fewer items when fewer than 5 servers exist', () => {
    const servers = [
      createServer({ serverId: 'a', cpu: 90, memory: 30 }),
      createServer({ serverId: 'b', cpu: 80, memory: 40 }),
    ];
    const result = aggregator.aggregate(servers);

    expect(result.topCpu).toHaveLength(2);
    expect(result.topMemory).toHaveLength(2);
  });

  // 8. Averages are rounded to integers
  it('rounds averages to integers', () => {
    const servers = [
      createServer({ serverId: 's1', cpu: 33, memory: 66, disk: 11, network: 7 }),
      createServer({ serverId: 's2', cpu: 34, memory: 67, disk: 12, network: 8 }),
      createServer({ serverId: 's3', cpu: 35, memory: 68, disk: 13, network: 9 }),
    ];
    const result = aggregator.aggregate(servers);

    // (33+34+35)/3 = 34, (66+67+68)/3 = 67, (11+12+13)/3 = 12, (7+8+9)/3 = 8
    expect(result.avgCpu).toBe(Math.round((33 + 34 + 35) / 3));
    expect(result.avgMemory).toBe(Math.round((66 + 67 + 68) / 3));
    expect(result.avgDisk).toBe(Math.round((11 + 12 + 13) / 3));
    expect(result.avgNetwork).toBe(Math.round((7 + 8 + 9) / 3));

    // All results must be integers
    expect(Number.isInteger(result.avgCpu)).toBe(true);
    expect(Number.isInteger(result.avgMemory)).toBe(true);
    expect(Number.isInteger(result.avgDisk)).toBe(true);
    expect(Number.isInteger(result.avgNetwork)).toBe(true);
  });

  // 9. instance format is "{serverId}:9100"
  it('formats instance as "{serverId}:9100"', () => {
    const servers = [
      createServer({ serverId: 'web-prod-01', cpu: 90 }),
      createServer({ serverId: 'db-prod-02', cpu: 80 }),
    ];
    const result = aggregator.aggregate(servers);

    expect(result.topCpu[0].instance).toBe('web-prod-01:9100');
    expect(result.topCpu[1].instance).toBe('db-prod-02:9100');
    expect(result.topMemory[0].instance).toBe('web-prod-01:9100');
  });
});
