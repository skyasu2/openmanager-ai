import { describe, expect, it, vi } from 'vitest';

vi.mock('../interfaces/SystemEventBus', () => ({}));
vi.mock('./process-types', () => ({}));

import {
  buildServiceStatuses,
  calculateProcessStartupOrder,
  calculateSystemUptime,
} from './ProcessManager.helpers';

type MinimalProcessConfig = { name: string; dependencies?: string[] };
type MinimalProcessState = {
  status: string;
  healthScore: number;
  restartCount: number;
  lastHealthCheck?: Date;
};

describe('calculateProcessStartupOrder', () => {
  it('should return insertion order when no dependencies exist', () => {
    const processes = new Map<string, MinimalProcessConfig>([
      ['a', { name: 'A' }],
      ['b', { name: 'B' }],
      ['c', { name: 'C' }],
    ]);
    const order = calculateProcessStartupOrder(
      processes as unknown as Map<string, never>,
    );
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('should place dependencies before dependents', () => {
    const processes = new Map<string, MinimalProcessConfig>([
      ['app', { name: 'App', dependencies: ['db'] }],
      ['db', { name: 'Database' }],
    ]);
    const order = calculateProcessStartupOrder(
      processes as unknown as Map<string, never>,
    );
    expect(order.indexOf('db')).toBeLessThan(order.indexOf('app'));
  });

  it('should handle chain dependencies (A→B→C)', () => {
    const processes = new Map<string, MinimalProcessConfig>([
      ['a', { name: 'A', dependencies: ['b'] }],
      ['b', { name: 'B', dependencies: ['c'] }],
      ['c', { name: 'C' }],
    ]);
    const order = calculateProcessStartupOrder(
      processes as unknown as Map<string, never>,
    );
    expect(order).toEqual(['c', 'b', 'a']);
  });

  it('should handle diamond dependencies (A→B,C; B→D; C→D)', () => {
    const processes = new Map<string, MinimalProcessConfig>([
      ['a', { name: 'A', dependencies: ['b', 'c'] }],
      ['b', { name: 'B', dependencies: ['d'] }],
      ['c', { name: 'C', dependencies: ['d'] }],
      ['d', { name: 'D' }],
    ]);
    const order = calculateProcessStartupOrder(
      processes as unknown as Map<string, never>,
    );
    expect(order.indexOf('d')).toBe(0);
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'));
  });
});

describe('calculateSystemUptime', () => {
  it('should return 0 when no start time is provided', () => {
    expect(calculateSystemUptime(undefined)).toBe(0);
  });

  it('should return positive elapsed milliseconds for a valid start time', () => {
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const startTime = new Date(now - 5000);
    const uptime = calculateSystemUptime(startTime);

    expect(uptime).toBe(5000);
    vi.restoreAllMocks();
  });
});

describe('buildServiceStatuses', () => {
  const makeProcesses = (
    entries: [string, MinimalProcessConfig][],
  ): Map<string, never> =>
    new Map(entries) as unknown as Map<string, never>;

  const makeStates = (
    entries: [string, MinimalProcessState][],
  ): Map<string, never> =>
    new Map(entries) as unknown as Map<string, never>;

  it('should return "up" for running process with healthScore >= 70', () => {
    const processes = makeProcesses([['svc', { name: 'Service' }]]);
    const states = makeStates([
      ['svc', { status: 'running', healthScore: 85, restartCount: 0 }],
    ]);
    const result = buildServiceStatuses(processes, states);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('up');
    expect(result[0].name).toBe('Service');
  });

  it('should return "degraded" for running process with healthScore < 70', () => {
    const processes = makeProcesses([['svc', { name: 'Service' }]]);
    const states = makeStates([
      ['svc', { status: 'running', healthScore: 50, restartCount: 0 }],
    ]);
    const result = buildServiceStatuses(processes, states);
    expect(result[0].status).toBe('degraded');
  });

  it('should return "down" when no state exists for a process', () => {
    const processes = makeProcesses([['svc', { name: 'Service' }]]);
    const states = makeStates([]);
    const result = buildServiceStatuses(processes, states);
    expect(result[0].status).toBe('down');
    expect(result[0].responseTime).toBeUndefined();
  });

  it('should handle mixed statuses across multiple processes', () => {
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const processes = makeProcesses([
      ['db', { name: 'Database' }],
      ['cache', { name: 'Cache' }],
      ['web', { name: 'Web' }],
    ]);
    const states = makeStates([
      [
        'db',
        {
          status: 'running',
          healthScore: 95,
          restartCount: 0,
          lastHealthCheck: new Date(now - 100),
        },
      ],
      [
        'cache',
        {
          status: 'running',
          healthScore: 40,
          restartCount: 2,
          lastHealthCheck: new Date(now - 500),
        },
      ],
      // web has no state → down
    ]);

    const result = buildServiceStatuses(processes, states);
    expect(result).toHaveLength(3);

    const db = result.find((s) => s.name === 'Database');
    const cache = result.find((s) => s.name === 'Cache');
    const web = result.find((s) => s.name === 'Web');

    expect(db?.status).toBe('up');
    expect(db?.responseTime).toBe(100);
    expect(cache?.status).toBe('degraded');
    expect(cache?.responseTime).toBe(500);
    expect(web?.status).toBe('down');
    expect(web?.responseTime).toBeUndefined();

    vi.restoreAllMocks();
  });
});
