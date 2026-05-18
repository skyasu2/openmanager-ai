/**
 * Analytics Routes Tests
 *
 * POST /analyze-server, POST /incident-report 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockMonitoringSource, MockMonitoringDataSourceError } = vi.hoisted(() => {
  class MockMonitoringDataSourceError extends Error {
    readonly code: string;
    readonly recoverable: boolean;
    readonly sourceMode: 'replay-json' | 'live-otel';
    readonly queryAsOf?: string;

    constructor(
      code: string,
      message: string,
      options: {
        sourceMode: 'replay-json' | 'live-otel';
        recoverable?: boolean;
        queryAsOf?: string;
      }
    ) {
      super(message);
      this.name = 'MonitoringDataSourceError';
      this.code = code;
      this.recoverable = options.recoverable ?? true;
      this.sourceMode = options.sourceMode;
      this.queryAsOf = options.queryAsOf;
    }
  }

  const snapshot = {
    sourceMode: 'replay-json',
    queryAsOf: '2026-04-30T00:00:00.000Z',
    slot: {
      slotIndex: 42,
      hour: 7,
      slotInHour: 0,
      minuteOfDay: 420,
      timeLabel: '07:00',
      startTime: '2026-04-30T00:00:00.000Z',
      endTime: '2026-04-30T00:10:00.000Z',
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
    ],
    topology: {
      totalServers: 1,
      statusCounts: { online: 0, warning: 1, critical: 0, offline: 0 },
      roleCounts: { application: 1 },
    },
    riskSignals: [
      {
        id: 'risk-api-was-dc1-01-cpu',
        serverId: 'api-was-dc1-01',
        serverName: 'api-was-dc1-01',
        serverType: 'application',
        metric: 'cpu',
        value: 87.3,
        threshold: 80,
        trend: 'up',
        severity: 'warning',
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
          from: '2026-04-30T00:00:00.000Z',
          to: '2026-04-30T00:10:00.000Z',
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
  };

  const buildMetricPoints = (metric: string) => {
    const values =
      metric === 'cpu'
        ? [70, 72, 74, 76, 78, 80, 82, 84, 85, 86, 87, 87.3]
        : Array.from({ length: 12 }, () =>
            metric === 'memory' ? 72.4 : metric === 'disk' ? 61.1 : 18.2
          );

    return values.map((value, index) => ({
      timestamp: new Date(
        Date.UTC(2026, 3, 29, 22, 10 + index * 10, 0, 0)
      ).toISOString(),
      value,
      slotIndex: 31 + index,
    }));
  };

  return {
    mockMonitoringSource: {
      getSnapshot: vi.fn(async () => snapshot),
      rankRiskSignals: vi.fn(async () => snapshot.riskSignals),
      getMetricSeries: vi.fn(
        async ({ serverId, metric }: { serverId: string; metric: string }) => ({
          sourceMode: 'replay-json',
          serverId,
          metric,
          points: buildMetricPoints(metric),
          evidenceRefs: [],
        })
      ),
      getRelatedLogs: vi.fn(),
      buildIncidentTimeline: vi.fn(async () => ({
        sourceMode: 'replay-json',
        events: [
          {
            timestamp: '2026-04-30T00:00:00.000Z',
            serverId: 'api-was-dc1-01',
            severity: 'warning',
            eventType: 'metric',
            description: 'api-was-dc1-01 cpu 87.3% >= 80%',
            evidenceRefId: 'evidence-risk-api-was-dc1-01-cpu',
          },
        ],
        evidenceRefs: snapshot.evidenceRefs,
      })),
    },
    MockMonitoringDataSourceError,
  };
});

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
  sanitizeJsonStrings: vi.fn(<T,>(value: T) => value),
}));

vi.mock('../tools-ai-sdk', () => ({
  detectAnomalies: {
    execute: vi.fn(async () => ({
      hasAnomalies: true,
      anomalyCount: 2,
      anomalies: [
        { server_id: 'web-01', metric: 'cpu', value: 95, severity: 'critical' },
      ],
    })),
  },
  detectAnomaliesAllServers: {
    execute: vi.fn(async () => ({
      success: true,
      totalServers: 15,
      hasAnomalies: true,
      anomalyCount: 3,
      anomalies: [
        { server_id: 'web-01', server_name: 'web-server-01', metric: 'cpu', value: 95, severity: 'critical' },
      ],
      affectedServers: ['web-01'],
      summary: { totalServers: 15, onlineCount: 12, warningCount: 2, criticalCount: 1 },
    })),
  },
  predictTrends: {
    execute: vi.fn(async () => ({
      summary: { hasRisingTrends: false },
    })),
  },
  analyzePattern: {
    execute: vi.fn(async () => ({
      patterns: ['정상 패턴'],
    })),
  },
  buildIncidentTimeline: {
    execute: vi.fn(async () => ({
      events: [
        { timestamp: '2026-03-03T00:00:00Z', description: 'CPU spike', severity: 'warning' },
      ],
    })),
  },
}));

vi.mock('ai', () => ({
  Output: {
    object: vi.fn((config) => config),
  },
  generateText: vi.fn(async () => ({
    output: {
      title: '시스템 정상',
      severity: 'info',
      description: '정상',
      affected_servers: [],
      root_cause: '',
      recommendations: [],
      pattern: '정상',
    },
    usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
  })),
}));

vi.mock('../services/ai-sdk/agents/config', () => ({
  AGENT_NAMES: ['Analyst Agent', 'Reporter Agent'],
  AGENT_CONFIGS: {
    'Analyst Agent': {
      instructions: 'Analyst Agent',
      getModel: () => ({ model: { modelId: 'test-model' }, provider: 'test' }),
      tools: {},
    },
    'Reporter Agent': {
      instructions: 'Reporter Agent',
      getModel: () => ({ model: { modelId: 'test-model' }, provider: 'test' }),
      tools: {},
    },
  },
  getAgentConfig: (name: string) =>
    ({
      'Analyst Agent': {
        instructions: 'Analyst Agent',
        getModel: () => ({ model: { modelId: 'test-model' }, provider: 'test' }),
        tools: {},
      },
      'Reporter Agent': {
        instructions: 'Reporter Agent',
        getModel: () => ({ model: { modelId: 'test-model' }, provider: 'test' }),
        tools: {},
      },
    } as Record<string, { instructions: string; getModel: () => { model: { modelId: string }; provider: string }; tools: Record<string, never> } | undefined>)[name],
  isAgentName: (name: string) =>
    name === 'Analyst Agent' || name === 'Reporter Agent',
}));

vi.mock('../services/ai-sdk/agents/agent-factory', () => ({
  AgentFactory: {
    isAvailable: vi.fn(() => true),
  },
}));

vi.mock('../services/monitoring/monitoring-data-source', () => ({
  createMonitoringDataSource: vi.fn(() => mockMonitoringSource),
  MonitoringDataSourceError: MockMonitoringDataSourceError,
}));

import { analyticsRouter } from './analytics';
import { AgentFactory } from '../services/ai-sdk/agents/agent-factory';
import { MonitoringDataSourceError } from '../services/monitoring/monitoring-data-source';
import { generateText } from 'ai';

const app = new Hono();
app.route('/analytics', analyticsRouter);

describe('Analytics Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /analytics/monitoring/snapshot', () => {
    it('공통 monitoring snapshot 계약을 반환한다', async () => {
      const res = await app.request('/analytics/monitoring/snapshot', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.sourceMode).toBe('replay-json');
      expect(json.slot.slotIndex).toBe(42);
      expect(json.riskSignals).toHaveLength(1);
      expect(json.evidenceRefs[0]).toMatchObject({
        kind: 'metric',
        serverId: 'api-was-dc1-01',
      });
      expect(mockMonitoringSource.getSnapshot).toHaveBeenCalledTimes(1);
    });

    it('live-otel disabled 오류를 monitoring error contract로 반환한다', async () => {
      mockMonitoringSource.getSnapshot.mockRejectedValueOnce(
        new MonitoringDataSourceError(
          'LIVE_SOURCE_DISABLED',
          'Live OTel monitoring source is disabled.',
          { sourceMode: 'live-otel', recoverable: true }
        )
      );

      const res = await app.request('/analytics/monitoring/snapshot', {
        method: 'POST',
        body: JSON.stringify({
          sourceMode: 'live-otel',
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
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-monitoring-live-disabled',
        },
      });

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json).toMatchObject({
        success: false,
        code: 'LIVE_SOURCE_DISABLED',
        sourceMode: 'live-otel',
        queryAsOf: '2026-04-30T00:00:00.000Z',
        requestId: 'req-monitoring-live-disabled',
        recoverable: true,
      });
    });
  });

  describe('POST /analytics/monitoring/analyze-batch', () => {
    it('Analyst batch 응답을 deterministic snapshot 기반으로 반환한다', async () => {
      const res = await app.request('/analytics/monitoring/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.sourceMode).toBe('replay-json');
      expect(json.summary).toContain('1대');
      expect(json.servers).toHaveLength(1);
      expect(json.riskSignals).toHaveLength(1);
      expect(json.capacityAlerts).toHaveLength(1);
      expect(json.capacityAlerts[0]).toMatchObject({
        serverId: 'api-was-dc1-01',
        metric: 'cpu',
        severity: 'critical',
        willBreachCritical: true,
      });
      expect(json.capacityAlerts[0].timeToCriticalMinutes).toBeGreaterThan(0);
      expect(json.evidenceRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'evidence-capacity-api-was-dc1-01-cpu',
            kind: 'prediction',
            serverId: 'api-was-dc1-01',
            metric: 'cpu',
          }),
        ])
      );
      expect(generateText).not.toHaveBeenCalled();
    });

    it('monitoring source 오류를 batch endpoint에서도 같은 계약으로 반환한다', async () => {
      mockMonitoringSource.getSnapshot.mockRejectedValueOnce(
        new MonitoringDataSourceError(
          'LIVE_SOURCE_DISABLED',
          'Live OTel monitoring source is disabled.',
          { sourceMode: 'live-otel', recoverable: true }
        )
      );

      const res = await app.request('/analytics/monitoring/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          sourceMode: 'live-otel',
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
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-monitoring-batch-disabled',
        },
      });

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json).toMatchObject({
        success: false,
        code: 'LIVE_SOURCE_DISABLED',
        sourceMode: 'live-otel',
        queryAsOf: '2026-04-30T00:00:00.000Z',
        requestId: 'req-monitoring-batch-disabled',
        recoverable: true,
      });
    });
  });

  describe('POST /analytics/analyze-server', () => {
    it('full 분석을 수행하고 결과를 반환한다', async () => {
      const res = await app.request('/analytics/analyze-server', {
        method: 'POST',
        body: JSON.stringify({ serverId: 'web-01', analysisType: 'full' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.serverId).toBe('web-01');
      expect(json.analysisType).toBe('full');
      expect(json.anomalyDetection).toBeDefined();
      expect(json.trendPrediction).toBeDefined();
      expect(json.patternAnalysis).toBeDefined();
    });

    it('anomaly 분석만 수행한다', async () => {
      const res = await app.request('/analytics/analyze-server', {
        method: 'POST',
        body: JSON.stringify({ serverId: 'db-01', analysisType: 'anomaly' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.anomalyDetection).toBeDefined();
      expect(json.trendPrediction).toBeUndefined();
    });

    it('Analyst Agent 사용 불가 시에도 tool 결과와 deterministic insight를 반환한다', async () => {
      vi.mocked(AgentFactory.isAvailable).mockImplementationOnce((type) => type !== 'analyst');

      const res = await app.request('/analytics/analyze-server', {
        method: 'POST',
        body: JSON.stringify({ analysisType: 'full' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.aiInsights).toBeDefined();
      expect(json.aiInsights.summary).toContain('2개 항목');
      expect(generateText).not.toHaveBeenCalled();
    });

    it('AI insights를 LLM 호출 없이 deterministic하게 포함한다', async () => {
      const res = await app.request('/analytics/analyze-server', {
        method: 'POST',
        body: JSON.stringify({ analysisType: 'full' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.aiInsights).toBeDefined();
      expect(json.aiInsights.summary).toContain('2개 항목');
      expect(json.aiInsights.recommendations).toHaveLength(2);
      expect(generateText).not.toHaveBeenCalled();
    });
  });

  describe('POST /analytics/incident-report', () => {
    it('인시던트 보고서를 생성한다', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        output: {
          title: 'CPU 과부하',
          severity: 'critical',
          description: '웹서버 CPU 95%',
          affected_servers: ['web-01'],
          root_cause: '트래픽 급증',
          recommendations: [
            {
              action: '스케일아웃',
              priority: 'high',
              expected_impact: '부하 분산',
            },
          ],
          pattern: '스파이크 패턴',
          postmortem: {
            timeline: ['10:00 - CPU spike'],
            hypotheses: ['트래픽 급증'],
            prevention: ['오토스케일 정책 재검토'],
          },
        },
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
      } as Awaited<ReturnType<typeof generateText>>);

      const res = await app.request('/analytics/incident-report', {
        method: 'POST',
        body: JSON.stringify({ serverId: 'web-01', query: 'CPU 높음' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.title).toBe('CPU 과부하');
      expect(json._source).toContain('Reporter Agent');
      expect(json.affectedServers).toEqual([
        {
          id: 'web-01',
          name: 'web-server-01',
          severity: 'critical',
          metric: 'cpu',
          value: 95,
        },
      ]);
      expect(json.postmortem).toBeDefined();
      expect(json.postmortem.timeline).toContain('10:00 - CPU spike');
    });

    it('Reporter 응답에 monitoring snapshot evidence refs를 포함한다', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        output: {
          title: 'API WAS CPU 경고',
          severity: 'warning',
          description: 'API WAS CPU가 임계값을 초과했습니다.',
          affected_servers: ['api-was-dc1-01'],
          root_cause: 'CPU 부하 상승',
          recommendations: [],
          pattern: 'CPU warning',
        },
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
      } as Awaited<ReturnType<typeof generateText>>);

      const res = await app.request('/analytics/incident-report', {
        method: 'POST',
        body: JSON.stringify({
          serverId: 'api-was-dc1-01',
          query: 'CPU 경고 보고서 생성',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.sourceMode).toBe('replay-json');
      expect(json.evidenceRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'evidence-risk-api-was-dc1-01-cpu',
            kind: 'metric',
            serverId: 'api-was-dc1-01',
          }),
        ])
      );
      expect(mockMonitoringSource.getSnapshot).toHaveBeenCalledTimes(1);
      expect(mockMonitoringSource.buildIncidentTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ serverId: 'api-was-dc1-01' })
      );
      const generateTextInput = vi.mocked(generateText).mock.calls[0]?.[0];
      const prompt = generateTextInput?.messages?.[0]?.content;
      expect(generateTextInput?.system).toBeTypeOf('string');
      expect(generateTextInput?.output).toMatchObject({
        name: 'incident_report',
        schema: expect.any(Object),
      });
      expect(prompt).toContain('Monitoring evidenceRefs');
      expect(prompt).toContain('작성 필드');
      expect(prompt).not.toContain('```json');
    });

    it('Reporter Agent 사용 불가 시 fallback을 반환한다', async () => {
      vi.mocked(AgentFactory.isAvailable).mockImplementationOnce((type) => type !== 'reporter');

      const res = await app.request('/analytics/incident-report', {
        method: 'POST',
        body: JSON.stringify({ serverId: 'web-01' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json._source).toContain('Fallback');
    });

    it('Reporter Agent rate limit 에러 시 tool-based fallback을 반환한다', async () => {
      vi.mocked(generateText).mockRejectedValueOnce(new Error('rate limit exceeded'));

      const res = await app.request('/analytics/incident-report', {
        method: 'POST',
        body: JSON.stringify({ serverId: 'web-01' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json._source).toContain('Fallback');
      expect(json._fallbackReason).toContain('rate limit');
    });

    it('Reporter structured output schema drift 시 tool-based fallback을 반환한다', async () => {
      vi.mocked(generateText).mockRejectedValueOnce(
        new Error(
          "Generated JSON does not match the expected schema. Error: jsonschema: '/postmortem/timeline/0' expected string, but got object"
        )
      );

      const res = await app.request('/analytics/incident-report', {
        method: 'POST',
        body: JSON.stringify({ serverId: 'web-01' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json._source).toContain('Fallback');
      expect(json._fallbackReason).toContain('expected schema');
    });

    it('복구 불가능한 에러 시 에러 응답을 반환한다', async () => {
      vi.mocked(generateText).mockRejectedValueOnce(new Error('unexpected error'));

      const res = await app.request('/analytics/incident-report', {
        method: 'POST',
        body: JSON.stringify({ serverId: 'web-01' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(500);
    });

    it('serverId 없이 전체 서버 분석을 수행한다', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        output: {
          title: '전체 점검',
          severity: 'info',
          description: '정상',
          affected_servers: [],
          root_cause: '',
          recommendations: [],
          pattern: '정상',
        },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      } as Awaited<ReturnType<typeof generateText>>);

      const res = await app.request('/analytics/incident-report', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
