/**
 * RCA analysis tool cache tests.
 *
 * These tools read the rotating synthetic OTel slot buffer, so cache keys must
 * include the current slot index to avoid stale analysis after slot rollover.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const servers = [
    {
      id: 'db-1',
      name: 'Database 1',
      type: 'database',
      status: 'critical',
      cpu: 92,
      memory: 88,
      disk: 61,
      network: 42,
    },
    {
      id: 'web-1',
      name: 'Web 1',
      type: 'web',
      status: 'online',
      cpu: 42,
      memory: 55,
      disk: 45,
      network: 30,
    },
  ];

  return {
    servers,
    getAnalysis: vi.fn(
      (
        _type: string,
        _params: Record<string, unknown>,
        compute: () => Promise<unknown>
      ) => compute()
    ),
  };
});

vi.mock('../data/precomputed-state', () => ({
  calculateRelativeDateTime: vi.fn(() => ({
    slotIndex: 42,
  })),
  getRecentHistory: vi.fn(() =>
    Array.from({ length: 12 }, () => ({
      timestamp: new Date().toISOString(),
      servers: mocks.servers,
    }))
  ),
}));

vi.mock('../lib/cache-layer', () => ({
  getDataCache: vi.fn(() => ({
    getAnalysis: mocks.getAnalysis,
  })),
}));

import {
  buildIncidentTimeline,
  correlateMetrics,
  findRootCause,
} from './rca-analysis';

describe('rca-analysis cache keys', () => {
  beforeEach(() => {
    mocks.getAnalysis.mockClear();
  });

  it('keys incident timeline cache by server, range, and slot', async () => {
    await buildIncidentTimeline.execute(
      { serverId: 'db-1', timeRangeHours: 6 },
      {} as never
    );

    expect(mocks.getAnalysis).toHaveBeenCalledWith(
      'rca-timeline',
      { serverId: 'db-1', timeRangeHours: 6, slotIndex: 42 },
      expect.any(Function)
    );
  });

  it('keys metric correlation cache by server, target metric, and slot', async () => {
    await correlateMetrics.execute(
      { serverId: 'db-1', targetMetric: 'cpu' },
      {} as never
    );

    expect(mocks.getAnalysis).toHaveBeenCalledWith(
      'rca-correlation',
      { serverId: 'db-1', targetMetric: 'cpu', slotIndex: 42 },
      expect.any(Function)
    );
  });

  it('keys root cause cache by server, symptom, and slot', async () => {
    await findRootCause.execute(
      { serverId: 'db-1', symptom: 'CPU 급증' },
      {} as never
    );

    expect(mocks.getAnalysis).toHaveBeenCalledWith(
      'rca-root-cause',
      { serverId: 'db-1', symptom: 'CPU 급증', slotIndex: 42 },
      expect.any(Function)
    );
  });
});
