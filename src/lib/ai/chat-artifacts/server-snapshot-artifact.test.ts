import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildServerSnapshotJson,
  buildServerSnapshotMarkdown,
  generateServerSnapshotArtifact,
} from './server-snapshot-artifact';
import type { ServerSnapshotArtifact } from './types';

const metricsMocks = vi.hoisted(() => ({
  getAllServerMetrics: vi.fn(),
  getSystemSummary: vi.fn(),
}));

vi.mock('@/services/metrics/MetricsProvider', () => ({
  metricsProvider: metricsMocks,
}));

const queryAsOfDataSlot = {
  slotIndex: 42,
  minuteOfDay: 420,
  timeLabel: '07:00 KST',
};

const serverMetrics = [
  {
    serverId: 'web-01',
    serverType: 'web',
    location: 'ap-northeast-2a',
    timestamp: '2026-05-02T22:00:00.000Z',
    minuteOfDay: 420,
    cpu: 92.4,
    memory: 71.2,
    disk: 62.1,
    network: 55.4,
    logs: [],
    status: 'critical' as const,
  },
  {
    serverId: 'db-01',
    serverType: 'database',
    location: 'ap-northeast-2b',
    timestamp: '2026-05-02T22:00:00.000Z',
    minuteOfDay: 420,
    cpu: 66.2,
    memory: 88.1,
    disk: 74.5,
    network: 38.3,
    logs: [],
    status: 'warning' as const,
  },
  {
    serverId: 'cache-01',
    serverType: 'cache',
    location: 'ap-northeast-2c',
    timestamp: '2026-05-02T22:00:00.000Z',
    minuteOfDay: 420,
    cpu: 21.5,
    memory: 44.2,
    disk: 33.7,
    network: 11.2,
    logs: [],
    status: 'online' as const,
  },
  {
    serverId: 'worker-01',
    serverType: 'worker',
    location: 'ap-northeast-2a',
    timestamp: '2026-05-02T22:00:00.000Z',
    minuteOfDay: 420,
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0,
    logs: [],
    status: 'offline' as const,
  },
];

const systemSummary = {
  timestamp: '2026-05-02T22:00:00.000Z',
  minuteOfDay: 420,
  totalServers: 4,
  onlineServers: 1,
  warningServers: 1,
  criticalServers: 1,
  offlineServers: 1,
  averageCpu: 60,
  averageMemory: 67.8,
  averageDisk: 56.8,
  averageNetwork: 35,
};

describe('generateServerSnapshotArtifact', () => {
  beforeEach(() => {
    metricsMocks.getAllServerMetrics.mockResolvedValue(serverMetrics);
    metricsMocks.getSystemSummary.mockResolvedValue(systemSummary);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('builds a read-only server snapshot from MetricsProvider without AI API calls', async () => {
    const artifact = await generateServerSnapshotArtifact({
      query: '서버 상태 스냅샷',
      queryAsOfDataSlot,
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(metricsMocks.getAllServerMetrics).toHaveBeenCalledTimes(1);
    expect(metricsMocks.getSystemSummary).toHaveBeenCalledTimes(1);
    expect(artifact).toMatchObject({
      kind: 'server-snapshot',
      title: '현재 서버 상태 스냅샷',
      source: 'otel-static',
      queryAsOfDataSlot,
      slot: queryAsOfDataSlot,
      totals: {
        total: 4,
        online: 1,
        warning: 1,
        critical: 1,
        offline: 1,
      },
      averages: {
        cpu: 60,
        memory: 67.8,
        disk: 56.8,
        network: 35,
      },
    });
    expect(artifact.summary).toContain('4대 서버');
    expect(artifact.topServers).toHaveLength(3);
    expect(artifact.topServers[0]).toMatchObject({
      id: 'web-01',
      status: 'critical',
      primaryRisk: 'cpu',
    });
    expect(artifact.alerts).toEqual([
      expect.objectContaining({
        serverId: 'web-01',
        metric: 'cpu',
        severity: 'critical',
      }),
      expect.objectContaining({
        serverId: 'db-01',
        metric: 'memory',
        severity: 'warning',
      }),
    ]);
  });

  it('serializes stable markdown and JSON download payloads', () => {
    const artifact: ServerSnapshotArtifact = {
      kind: 'server-snapshot',
      generatedAt: '2026-05-02T22:00:00.000Z',
      title: '현재 서버 상태 스냅샷',
      summary: '4대 서버 중 위험 1대, 주의 1대, 오프라인 1대입니다.',
      source: 'otel-static',
      queryAsOfDataSlot,
      slot: queryAsOfDataSlot,
      totals: {
        total: 4,
        online: 1,
        warning: 1,
        critical: 1,
        offline: 1,
      },
      averages: {
        cpu: 60,
        memory: 67.8,
        disk: 56.8,
        network: 35,
      },
      topServers: [
        {
          id: 'web-01',
          name: 'web-01',
          status: 'critical',
          cpu: 92.4,
          memory: 71.2,
          disk: 62.1,
          network: 55.4,
          primaryRisk: 'cpu',
        },
      ],
      alerts: [
        {
          serverId: 'web-01',
          metric: 'cpu',
          value: 92.4,
          severity: 'critical',
          summary: 'web-01 CPU 92.4%',
        },
      ],
    };

    expect(buildServerSnapshotMarkdown(artifact)).toContain(
      '# 현재 서버 상태 스냅샷'
    );
    expect(buildServerSnapshotMarkdown(artifact)).toContain('총 서버: 4대');
    expect(buildServerSnapshotMarkdown(artifact)).toContain('web-01');
    expect(JSON.parse(buildServerSnapshotJson(artifact))).toEqual(artifact);
  });
});
