import { describe, expect, it, vi } from 'vitest';

import type { PrecomputedSlot } from '../../data/precomputed-state';
import {
  createMonitoringDataSource,
  MonitoringDataSourceError,
} from './monitoring-data-source';

const mockSlot: PrecomputedSlot = {
  slotIndex: 42,
  timeLabel: '07:00',
  minuteOfDay: 420,
  fullTimestamp: '2026-04-29T22:00:00.000Z',
  summary: {
    total: 2,
    online: 1,
    warning: 1,
    critical: 0,
    offline: 0,
  },
  alerts: [
    {
      serverId: 'api-was-dc1-01',
      serverName: 'api-was-dc1-01',
      serverType: 'application',
      metric: 'cpu',
      value: 87.3,
      threshold: 80,
      trend: 'up',
      severity: 'warning',
    },
  ],
  activePatterns: [],
  servers: [
    {
      id: 'api-was-dc1-01',
      name: 'api-was-dc1-01',
      type: 'application',
      status: 'warning',
      cpu: 87.3,
      memory: 72.4,
      disk: 61.1,
      network: 18.2,
    },
    {
      id: 'web-nginx-dc1-01',
      name: 'web-nginx-dc1-01',
      type: 'web',
      status: 'online',
      cpu: 34.1,
      memory: 45.2,
      disk: 55.3,
      network: 12.4,
    },
  ],
  serverLogs: {
    'api-was-dc1-01': [
      {
        level: 'warn',
        message: 'CPU usage exceeded warning threshold',
        source: 'application',
      },
    ],
  },
};

const mockPreviousSlot: PrecomputedSlot = {
  ...mockSlot,
  slotIndex: 41,
  timeLabel: '06:50',
  minuteOfDay: 410,
  fullTimestamp: '2026-04-29T21:50:00.000Z',
  alerts: [],
  servers: mockSlot.servers.map((server) =>
    server.id === 'api-was-dc1-01'
      ? { ...server, cpu: 70.1, status: 'online' }
      : server
  ),
};

vi.mock('../../data/precomputed-state', () => ({
  getCurrentDataSourceInfo: () => ({
    scopeName: 'openmanager-ai-otel-pipeline',
    scopeVersion: '1.0.0',
    catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
    hour: 7,
  }),
  getCurrentState: () => mockSlot,
  getRecentHistory: (count: number) =>
    [mockSlot, mockPreviousSlot].slice(0, count),
  getStateBySlot: (slotIndex: number) => {
    if (slotIndex === mockSlot.slotIndex) return mockSlot;
    if (slotIndex === mockPreviousSlot.slotIndex) return mockPreviousSlot;
    return undefined;
  },
}));

describe('MonitoringDataSource', () => {
  it('builds a replay-json snapshot with slot metadata and evidence refs', async () => {
    const source = createMonitoringDataSource({ mode: 'replay-json' });

    const snapshot = await source.getSnapshot({
      queryAsOf: {
        createdAt: '2026-04-30T00:00:00.000Z',
        source: 'vercel-static-otel',
        datasetVersion: '24h-rotating-v1.0.0',
        dataSlot: {
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        },
      },
    });

    expect(snapshot).toMatchObject({
      sourceMode: 'replay-json',
      queryAsOf: '2026-04-30T00:00:00.000Z',
      slot: {
        slotIndex: 42,
        hour: 7,
        slotInHour: 0,
        timeLabel: '07:00',
        startTime: '2026-04-29T22:00:00.000Z',
        endTime: '2026-04-29T22:10:00.000Z',
      },
      dataFreshness: {
        generatedAt: '2026-02-15T03:56:41.821Z',
        stale: false,
      },
    });
    expect(snapshot.servers).toHaveLength(2);
    expect(snapshot.riskSignals).toHaveLength(1);
    expect(snapshot.riskSignals[0]).toMatchObject({
      serverId: 'api-was-dc1-01',
      metric: 'cpu',
      severity: 'warning',
      value: 87.3,
      threshold: 80,
    });
    expect(snapshot.factPack).toMatchObject({
      factPackVersion: '2026-05-03-v1',
      dataSlot: '07:00 KST',
      sourceMode: 'replay-json',
      queryAsOf: '2026-04-30T00:00:00.000Z',
      summary: {
        total: 2,
        online: 1,
        warning: 1,
        critical: 0,
        offline: 0,
      },
      signals: [
        expect.objectContaining({
          serverId: 'api-was-dc1-01',
          metric: 'cpu',
          severity: 'warning',
          threshold: 80,
        }),
      ],
    });
    expect(snapshot.evidenceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'metric',
          serverId: 'api-was-dc1-01',
          metric: 'cpu',
          severity: 'warning',
        }),
        expect.objectContaining({
          kind: 'log',
          serverId: 'api-was-dc1-01',
          severity: 'warning',
        }),
      ])
    );
  });

  it('returns related logs for a server and time range', async () => {
    const source = createMonitoringDataSource({ mode: 'replay-json' });

    const result = await source.getRelatedLogs({
      serverId: 'api-was-dc1-01',
      from: '2026-04-29T21:50:00.000Z',
      to: '2026-04-29T22:10:00.000Z',
      severity: 'warning',
      queryAsOf: {
        createdAt: '2026-04-30T00:00:00.000Z',
        source: 'vercel-static-otel',
        datasetVersion: '24h-rotating-v1.0.0',
        dataSlot: {
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        },
      },
    });

    expect(result.logs).toHaveLength(1);
    expect(result.evidenceRefs[0]).toMatchObject({
      kind: 'log',
      serverId: 'api-was-dc1-01',
      severity: 'warning',
    });
  });

  it('anchors metric series to the requested queryAsOf slot', async () => {
    const source = createMonitoringDataSource({ mode: 'replay-json' });

    const result = await source.getMetricSeries({
      serverId: 'api-was-dc1-01',
      metric: 'cpu',
      points: 2,
      queryAsOf: {
        createdAt: '2026-04-30T00:00:00.000Z',
        source: 'vercel-static-otel',
        datasetVersion: '24h-rotating-v1.0.0',
        dataSlot: {
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        },
      },
    });

    expect(result.points).toEqual([
      {
        timestamp: '2026-04-29T21:50:00.000Z',
        value: 70.1,
        slotIndex: 41,
      },
      {
        timestamp: '2026-04-29T22:00:00.000Z',
        value: 87.3,
        slotIndex: 42,
      },
    ]);
  });

  it('fails explicitly when live-otel mode is requested without an endpoint', async () => {
    const source = createMonitoringDataSource({ mode: 'live-otel' });

    await expect(source.getSnapshot({})).rejects.toBeInstanceOf(
      MonitoringDataSourceError
    );
    await expect(source.getSnapshot({})).rejects.toMatchObject({
      code: 'LIVE_SOURCE_DISABLED',
      recoverable: true,
      sourceMode: 'live-otel',
    });
  });
});
