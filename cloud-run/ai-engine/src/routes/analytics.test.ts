/**
 * Analytics Routes Tests
 *
 * POST /analyze-server, POST /incident-report 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
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
  generateText: vi.fn(async () => ({
    text: '{"summary":"시스템 정상","recommendations":["모니터링 유지"],"confidence":0.9}',
    usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
  })),
}));

vi.mock('../services/ai-sdk/agents/analyst-agent', () => ({
  getAnalystAgentConfig: vi.fn(() => ({
    instructions: 'Analyst Agent',
    getModel: () => ({ model: { modelId: 'test-model' }, provider: 'test' }),
    tools: {},
  })),
  isAnalystAgentAvailable: vi.fn(() => true),
}));

vi.mock('../services/ai-sdk/agents/reporter-agent', () => ({
  getReporterAgentConfig: vi.fn(() => ({
    instructions: 'Reporter Agent',
    getModel: () => ({ model: { modelId: 'test-model' }, provider: 'test' }),
    tools: {},
  })),
  isReporterAgentAvailable: vi.fn(() => true),
}));

import { analyticsRouter } from './analytics';
import { isAnalystAgentAvailable } from '../services/ai-sdk/agents/analyst-agent';
import { isReporterAgentAvailable } from '../services/ai-sdk/agents/reporter-agent';
import { generateText } from 'ai';

const app = new Hono();
app.route('/analytics', analyticsRouter);

describe('Analytics Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('Agent 사용 불가 시에도 tool 결과를 반환한다', async () => {
      vi.mocked(isAnalystAgentAvailable).mockReturnValueOnce(false);

      const res = await app.request('/analytics/analyze-server', {
        method: 'POST',
        body: JSON.stringify({ analysisType: 'full' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.aiInsights).toBeUndefined();
    });

    it('AI insights를 포함한다 (Agent 사용 가능 시)', async () => {
      const res = await app.request('/analytics/analyze-server', {
        method: 'POST',
        body: JSON.stringify({ analysisType: 'full' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.aiInsights).toBeDefined();
      expect(json.aiInsights.summary).toBe('시스템 정상');
    });
  });

  describe('POST /analytics/incident-report', () => {
    it('인시던트 보고서를 생성한다', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: '```json\n{"title":"CPU 과부하","severity":"critical","description":"웹서버 CPU 95%","affected_servers":["web-01"],"root_cause":"트래픽 급증","recommendations":[{"action":"스케일아웃","priority":"high","expected_impact":"부하 분산"}],"pattern":"스파이크 패턴"}\n```',
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
    });

    it('Reporter Agent 사용 불가 시 fallback을 반환한다', async () => {
      vi.mocked(isReporterAgentAvailable).mockReturnValueOnce(false);

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
        text: '{"title":"전체 점검","severity":"info","description":"정상","affected_servers":[],"root_cause":"","recommendations":[],"pattern":"정상"}',
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
