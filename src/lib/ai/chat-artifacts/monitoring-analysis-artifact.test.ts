import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OTelResourceCatalog } from '@/types/otel-metrics';
import {
  buildMonitoringRoleGroupSummary,
  generateMonitoringAnalysisArtifact,
  generateServerMonitoringArtifact,
  parseMonitoringBatchAnalysisResponse,
} from './monitoring-analysis-artifact';
import { ARTIFACT_CONTRACT_VERSION } from './types';

const validBatchResponse = {
  success: true,
  sourceMode: 'replay-json',
  queryAsOf: '2026-05-02T00:00:00.000Z',
  slot: {
    slotIndex: 143,
    hour: 23,
    slotInHour: 5,
    minuteOfDay: 1430,
    timeLabel: '23:50 KST',
    startTime: '2026-05-02T00:00:00.000Z',
    endTime: '2026-05-02T00:10:00.000Z',
  },
  summary: '18개 서버 분석 완료',
  servers: [],
  riskSignals: [],
  evidenceRefs: [],
  dataFreshness: {
    generatedAt: null,
    sourceUpdatedAt: null,
    stale: false,
  },
};

const validFactPack = {
  factPackVersion: '2026-05-03-v1',
  dataSlot: '23:50 KST',
  sourceMode: 'replay-json',
  queryAsOf: '2026-05-02T00:00:00.000Z',
  thresholds: {
    cpu: { warning: 80, critical: 90 },
    memory: { warning: 80, critical: 90 },
    disk: { warning: 80, critical: 90 },
    network: { warning: 80, critical: 90 },
  },
  summary: {
    total: 18,
    online: 17,
    warning: 0,
    critical: 1,
    offline: 0,
  },
  signals: [
    {
      id: 'fact-api-cpu',
      serverId: 'api-was-dc1-01',
      serverName: 'api-was-dc1-01',
      serverType: 'api',
      metric: 'cpu',
      value: 95,
      threshold: 90,
      thresholdLevel: 'critical',
      severity: 'critical',
      evidenceRefId: 'evidence-api-cpu',
    },
  ],
  evidenceRefs: [
    {
      id: 'evidence-api-cpu',
      kind: 'metric',
      serverId: 'api-was-dc1-01',
      metric: 'cpu',
      timeRange: {
        from: '2026-05-02T00:00:00.000Z',
        to: '2026-05-02T00:10:00.000Z',
      },
      summary:
        'FactPack 기준 api-was-dc1-01 CPU가 critical 임계치를 초과했습니다.',
      value: 95,
      threshold: 90,
      severity: 'critical',
    },
  ],
};

const validCapacityAlerts = [
  {
    id: 'capacity-cache-memory',
    serverId: 'cache-redis-dc1-01',
    serverName: 'cache-redis-dc1-01',
    serverType: 'cache',
    metric: 'memory',
    currentValue: 83,
    predictedValue: 91,
    warningThreshold: 80,
    criticalThreshold: 90,
    willBreachWarning: true,
    timeToWarningMinutes: 0,
    willBreachCritical: true,
    timeToCriticalMinutes: 42,
    severity: 'critical',
    humanReadable: '현재 경고 상태 → 42분 후 심각 상태 예상',
    evidenceRefId: 'evidence-capacity-cache-memory',
  },
] as const;

const validServerAnalysisResponse = {
  success: true,
  serverId: 'server-1',
  analysisType: 'full',
  timestamp: '2026-05-13T00:00:00.000Z',
  anomalyDetection: {
    success: true,
    serverId: 'server-1',
    serverName: '웹 서버 01',
    anomalyCount: 1,
    hasAnomalies: true,
    results: {
      cpu: {
        metric: 'cpu',
        value: 92,
        severity: 'critical',
        isAnomaly: true,
      },
    },
    timestamp: '2026-05-13T00:00:00.000Z',
  },
  trendPrediction: {
    success: true,
    serverId: 'server-1',
    serverName: '웹 서버 01',
    predictionHorizon: '1h',
    results: {},
    summary: {
      increasingMetrics: ['cpu'],
      hasRisingTrends: true,
    },
    timestamp: '2026-05-13T00:00:00.000Z',
  },
  patternAnalysis: {
    success: true,
    patterns: [],
    detectedIntent: 'analysis',
    analysisResults: [],
  },
} as const;

describe('parseMonitoringBatchAnalysisResponse', () => {
  it('accepts the full monitoring batch artifact contract', () => {
    expect(parseMonitoringBatchAnalysisResponse(validBatchResponse)).toEqual(
      validBatchResponse
    );
  });

  it('rejects partial success payloads that would crash the artifact card', () => {
    expect(
      parseMonitoringBatchAnalysisResponse({
        success: true,
        servers: [],
        riskSignals: [],
      })
    ).toBeNull();
  });

  it('preserves a valid MonitoringFactPack on the batch response', () => {
    const parsed = parseMonitoringBatchAnalysisResponse({
      ...validBatchResponse,
      factPack: validFactPack,
    }) as
      | (typeof validBatchResponse & { factPack?: typeof validFactPack })
      | null;

    expect(parsed?.factPack).toMatchObject({
      factPackVersion: '2026-05-03-v1',
      signals: [
        expect.objectContaining({
          id: 'fact-api-cpu',
          severity: 'critical',
          thresholdLevel: 'critical',
        }),
      ],
      evidenceRefs: [
        expect.objectContaining({
          id: 'evidence-api-cpu',
          severity: 'critical',
        }),
      ],
    });
  });

  it('preserves valid capacity alerts and strips unknown alert fields', () => {
    const parsed = parseMonitoringBatchAnalysisResponse({
      ...validBatchResponse,
      capacityAlerts: [
        {
          ...validCapacityAlerts[0],
          rawToolJson: '{"token":"should-not-survive"}',
        },
      ],
    });

    expect(parsed?.capacityAlerts).toEqual(validCapacityAlerts);
    expect(JSON.stringify(parsed?.capacityAlerts)).not.toContain(
      'should-not-survive'
    );
  });

  it('drops malformed capacity alerts without rejecting the batch response', () => {
    const parsed = parseMonitoringBatchAnalysisResponse({
      ...validBatchResponse,
      capacityAlerts: [
        {
          ...validCapacityAlerts[0],
          severity: 'info',
        },
      ],
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.capacityAlerts).toBeUndefined();
  });

  it('strips unknown fields from validated MonitoringFactPack payloads', () => {
    const parsed = parseMonitoringBatchAnalysisResponse({
      ...validBatchResponse,
      factPack: {
        ...validFactPack,
        rawToolJson: '{"token":"should-not-survive"}',
        signals: [
          {
            ...validFactPack.signals[0],
            rawProviderNote: 'should-not-survive',
          },
        ],
        evidenceRefs: [
          {
            ...validFactPack.evidenceRefs[0],
            rawErrorStack: 'should-not-survive',
            timeRange: {
              ...validFactPack.evidenceRefs[0].timeRange,
              rawTrace: 'should-not-survive',
            },
          },
        ],
      },
    }) as (typeof validBatchResponse & { factPack?: unknown }) | null;

    expect(parsed).not.toBeNull();
    expect(JSON.stringify(parsed?.factPack)).not.toContain(
      'should-not-survive'
    );
  });

  it('drops only malformed MonitoringFactPack payloads and keeps legacy risk/evidence fields parseable', () => {
    const parsed = parseMonitoringBatchAnalysisResponse({
      ...validBatchResponse,
      riskSignals: [
        {
          id: 'legacy-risk-api-cpu',
          serverId: 'api-was-dc1-01',
          serverName: 'api-was-dc1-01',
          serverType: 'api',
          metric: 'cpu',
          value: 92,
          threshold: 90,
          trend: 'up',
          severity: 'critical',
          evidenceRefId: 'legacy-evidence-api-cpu',
        },
      ],
      evidenceRefs: [
        {
          id: 'legacy-evidence-api-cpu',
          kind: 'metric',
          serverId: 'api-was-dc1-01',
          metric: 'cpu',
          timeRange: {
            from: '2026-05-02T00:00:00.000Z',
            to: '2026-05-02T00:10:00.000Z',
          },
          summary: 'Legacy risk signal evidence remains available.',
          value: 92,
          threshold: 90,
          severity: 'critical',
        },
      ],
      factPack: {
        ...validFactPack,
        signals: [
          {
            ...validFactPack.signals[0],
            severity: 'info',
          },
        ],
      },
    }) as
      | (typeof validBatchResponse & {
          factPack?: unknown;
          riskSignals: Array<{ id: string }>;
          evidenceRefs: Array<{ id: string }>;
        })
      | null;

    expect(parsed).not.toBeNull();
    expect(parsed?.riskSignals[0]?.id).toBe('legacy-risk-api-cpu');
    expect(parsed?.evidenceRefs[0]?.id).toBe('legacy-evidence-api-cpu');
    expect(parsed?.factPack).toBeUndefined();
  });
});

describe('buildMonitoringRoleGroupSummary', () => {
  it('groups monitoring servers by normalized resource role with rounded averages', () => {
    const parsed = parseMonitoringBatchAnalysisResponse({
      ...validBatchResponse,
      servers: [
        {
          id: 'api-was-dc1-01',
          name: 'api-was-dc1-01',
          type: 'api',
          status: 'warning',
          cpu: 80,
          memory: 70,
          disk: 60,
          network: 40,
        },
        {
          id: 'api-was-dc1-02',
          name: 'api-was-dc1-02',
          type: 'api',
          status: 'online',
          cpu: 60,
          memory: 50,
          disk: 40,
          network: 30,
        },
        {
          id: 'db-mysql-dc1-primary',
          name: 'db-mysql-dc1-primary',
          type: 'db',
          status: 'critical',
          cpu: 50,
          memory: 90,
          disk: 80,
          network: 20,
        },
        {
          id: 'cache-redis-dc1-01',
          name: 'cache-redis-dc1-01',
          type: 'redis',
          status: 'offline',
          cpu: 20,
          memory: 83,
          disk: 40,
          network: 10,
        },
      ],
    });

    expect(parsed).not.toBeNull();
    expect(
      buildMonitoringRoleGroupSummary(parsed!, {
        schemaVersion: '2026-05-03-v1',
        generatedAt: '2026-05-02T00:00:00.000Z',
        resources: {
          'api-was-dc1-01': {
            'server.role': 'application',
          },
          'api-was-dc1-02': {
            'server.role': 'application',
          },
          'db-mysql-dc1-primary': {
            'server.role': 'database',
          },
        },
      } as unknown as OTelResourceCatalog)
    ).toEqual([
      {
        role: 'application',
        count: 2,
        warningCount: 1,
        criticalCount: 0,
        avgCpu: 70,
        avgMemory: 60,
        avgDisk: 50,
      },
      {
        role: 'database',
        count: 1,
        warningCount: 0,
        criticalCount: 1,
        avgCpu: 50,
        avgMemory: 90,
        avgDisk: 80,
      },
      {
        role: 'cache',
        count: 1,
        warningCount: 0,
        criticalCount: 1,
        avgCpu: 20,
        avgMemory: 83,
        avgDisk: 40,
      },
    ]);
  });
});

describe('generateMonitoringAnalysisArtifact', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns an envelope-compatible versioned artifact payload', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: validBatchResponse,
      }),
    } as Response);

    const artifact = await generateMonitoringAnalysisArtifact({
      query: '전체 서버 추세 분석',
      sessionId: 'session-test',
      queryAsOfDataSlot: {
        slotIndex: 143,
        minuteOfDay: 1430,
        timeLabel: '23:50 KST',
      },
    });

    expect(artifact).toMatchObject({
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
      kind: 'monitoring-analysis',
      sourceMode: 'tool-result',
      dataSlot: '23:50 KST',
      serverCount: 0,
      riskSignalCount: 0,
    });
  });

  it('maps MonitoringFactPack evidence into public-safe artifact envelope metadata', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...validBatchResponse,
          factPack: validFactPack,
        },
      }),
    } as Response);

    const artifact = await generateMonitoringAnalysisArtifact({
      query: '전체 서버 추세 분석',
      sessionId: 'session-test',
    });

    expect(artifact.analysis).toMatchObject({
      factPack: {
        signals: [
          expect.objectContaining({
            id: 'fact-api-cpu',
            severity: 'critical',
          }),
        ],
      },
    });
    expect(artifact.evidence).toEqual([
      expect.objectContaining({
        id: 'evidence-api-cpu',
        kind: 'metric',
        serverId: 'api-was-dc1-01',
        metric: 'cpu',
        severity: 'critical',
        summary:
          'FactPack 기준 api-was-dc1-01 CPU가 critical 임계치를 초과했습니다.',
      }),
    ]);
  });

  it('attaches role group summary to monitoring analysis artifacts', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...validBatchResponse,
          servers: [
            {
              id: 'api-was-dc1-01',
              name: 'api-was-dc1-01',
              type: 'api',
              status: 'warning',
              cpu: 82,
              memory: 70,
              disk: 52,
              network: 35,
            },
            {
              id: 'db-mysql-dc1-primary',
              name: 'db-mysql-dc1-primary',
              type: 'database',
              status: 'online',
              cpu: 41,
              memory: 63,
              disk: 61,
              network: 20,
            },
          ],
        },
      }),
    } as Response);

    const artifact = await generateMonitoringAnalysisArtifact({
      query: '역할별 서버 현황',
      sessionId: 'session-test',
    });

    expect(artifact.roleGroupSummary).toEqual([
      expect.objectContaining({
        role: 'application',
        count: 1,
        warningCount: 1,
        avgCpu: 82,
      }),
      expect.objectContaining({
        role: 'database',
        count: 1,
        criticalCount: 0,
        avgMemory: 63,
      }),
    ]);
  });

  it('attaches capacity alerts to monitoring analysis artifacts', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...validBatchResponse,
          capacityAlerts: validCapacityAlerts,
        },
      }),
    } as Response);

    const artifact = await generateMonitoringAnalysisArtifact({
      query: '용량 소진 예측',
      sessionId: 'session-test',
    });

    expect(artifact.capacityAlerts).toEqual(validCapacityAlerts);
    expect(artifact.analysis.capacityAlerts).toEqual(validCapacityAlerts);
  });
});

describe('generateServerMonitoringArtifact', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('routes a selected server analysis through the typed artifact contract', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: validServerAnalysisResponse,
      }),
    } as Response);

    const artifact = await generateServerMonitoringArtifact({
      query: '웹 서버 01 이상감지/추세 분석',
      sessionId: 'session-test',
      serverId: 'server-1',
      serverName: '웹 서버 01',
      currentMetrics: {
        cpu: 92,
        memory: 51,
        disk: 33,
        network: 12,
      },
      queryAsOfDataSlot: {
        slotIndex: 42,
        minuteOfDay: 420,
        timeLabel: '07:00 KST',
      },
    });

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      action: 'analyze_server',
      serverId: 'server-1',
      analysisType: 'full',
      query: '웹 서버 01 이상감지/추세 분석',
      sessionId: 'session-test',
      currentMetrics: {
        cpu: 92,
        memory: 51,
        disk: 33,
        network: 12,
      },
      queryAsOf: {
        source: 'vercel-static-otel',
        datasetVersion: '24h-rotating-v1.0.0',
        dataSlot: {
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        },
      },
    });

    expect(artifact).toMatchObject({
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
      kind: 'server-monitoring-analysis',
      sourceMode: 'tool-result',
      dataSlot: '07:00 KST',
      serverId: 'server-1',
      serverName: '웹 서버 01',
      overallStatus: 'critical',
      server: {
        serverId: 'server-1',
        serverName: '웹 서버 01',
        overallStatus: 'critical',
      },
    });
    expect(artifact.evidence).toEqual([
      expect.objectContaining({
        id: 'server-1-cpu-anomaly',
        kind: 'metric',
        serverId: 'server-1',
        metric: 'cpu',
        severity: 'critical',
      }),
    ]);
  });

  it('keeps auth and malformed response failures user-facing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    await expect(
      generateServerMonitoringArtifact({
        query: '웹 서버 01 분석',
        serverId: 'server-1',
        serverName: '웹 서버 01',
      })
    ).rejects.toThrow('로그인이 필요합니다. 게스트 로그인 후 이용해주세요.');

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          success: true,
          serverId: 'server-1',
        },
      }),
    } as Response);

    await expect(
      generateServerMonitoringArtifact({
        query: '웹 서버 01 분석',
        serverId: 'server-1',
        serverName: '웹 서버 01',
      })
    ).rejects.toThrow('단일 서버 이상감지/추세 분석 데이터를 받지 못했습니다.');
  });
});
