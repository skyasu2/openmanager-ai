import { describe, expect, it } from 'vitest';

import type { MonitoringSnapshot } from './monitoring-types';
import {
  buildMonitoringFactPack,
  MONITORING_FACT_PACK_VERSION,
} from './monitoring-fact-pack';

const thresholds = {
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 80, critical: 90 },
  disk: { warning: 80, critical: 90 },
  network: { warning: 70, critical: 85 },
};

const snapshot = {
  sourceMode: 'replay-json',
  queryAsOf: '2026-04-30T00:00:00.000Z',
  slot: {
    slotIndex: 42,
    hour: 7,
    slotInHour: 0,
    minuteOfDay: 420,
    timeLabel: '07:00 KST',
    startTime: '2026-04-29T22:00:00.000Z',
    endTime: '2026-04-29T22:10:00.000Z',
  },
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
      id: 'db-postgres-dc1-01',
      name: 'db-postgres-dc1-01',
      type: 'database',
      status: 'critical',
      cpu: 91.1,
      memory: 92.2,
      disk: 93.3,
      network: 86.4,
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
  topology: {
    totalServers: 3,
    statusCounts: {
      online: 1,
      warning: 1,
      critical: 1,
      offline: 0,
    },
    roleCounts: {
      application: 1,
      database: 1,
      web: 1,
    },
  },
  riskSignals: [
    {
      id: 'llm-tainted-risk',
      serverId: 'api-was-dc1-01',
      serverName: 'api-was-dc1-01',
      serverType: 'application',
      metric: 'cpu',
      value: 87.3,
      threshold: 90,
      trend: 'stable',
      severity: 'critical',
      evidenceRefId: 'evidence-risk-api-was-dc1-01-cpu',
    },
  ],
  evidenceRefs: [
    {
      id: 'evidence-risk-api-was-dc1-01-cpu',
      kind: 'metric',
      serverId: 'api-was-dc1-01',
      metric: 'cpu',
      timeRange: {
        from: '2026-04-29T22:00:00.000Z',
        to: '2026-04-29T22:10:00.000Z',
      },
      summary: 'api-was-dc1-01 cpu warning threshold exceeded',
      value: 87.3,
      threshold: 80,
      severity: 'warning',
    },
  ],
  dataFreshness: {
    generatedAt: '2026-02-15T03:56:41.821Z',
    sourceUpdatedAt: '2026-02-15T03:56:41.821Z',
    stale: false,
  },
} satisfies MonitoringSnapshot;

describe('MonitoringFactPack', () => {
  it('builds the same fact pack for the same data slot and query scope', () => {
    const input = {
      snapshot,
      thresholds,
      scope: {
        serverIds: ['db-postgres-dc1-01', 'api-was-dc1-01'],
        metrics: ['cpu', 'memory'] as const,
      },
    };

    expect(buildMonitoringFactPack(input)).toEqual(
      buildMonitoringFactPack(input)
    );
  });

  it('derives CPU, memory, disk, and network severity from thresholds instead of riskSignals', () => {
    const factPack = buildMonitoringFactPack({ snapshot, thresholds });

    expect(factPack.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serverId: 'api-was-dc1-01',
          metric: 'cpu',
          severity: 'warning',
          threshold: 80,
        }),
        expect.objectContaining({
          serverId: 'db-postgres-dc1-01',
          metric: 'cpu',
          severity: 'critical',
          threshold: 90,
        }),
        expect.objectContaining({
          serverId: 'db-postgres-dc1-01',
          metric: 'memory',
          severity: 'critical',
          threshold: 90,
        }),
        expect.objectContaining({
          serverId: 'db-postgres-dc1-01',
          metric: 'disk',
          severity: 'critical',
          threshold: 90,
        }),
        expect.objectContaining({
          serverId: 'db-postgres-dc1-01',
          metric: 'network',
          severity: 'critical',
          threshold: 85,
        }),
      ])
    );
    expect(
      factPack.signals.find(
        (signal) =>
          signal.serverId === 'api-was-dc1-01' && signal.metric === 'cpu'
      )?.severity
    ).toBe('warning');
  });

  it('preserves sourceMode, queryAsOf, thresholds, summary, and evidenceRefs from the monitoring tool result', () => {
    const factPack = buildMonitoringFactPack({ snapshot, thresholds });

    expect(factPack).toMatchObject({
      factPackVersion: MONITORING_FACT_PACK_VERSION,
      dataSlot: '07:00 KST',
      sourceMode: 'replay-json',
      queryAsOf: '2026-04-30T00:00:00.000Z',
      thresholds,
      summary: {
        total: 3,
        online: 1,
        warning: 1,
        critical: 1,
        offline: 0,
      },
    });
    expect(factPack.evidenceRefs).toEqual(snapshot.evidenceRefs);
  });
});
