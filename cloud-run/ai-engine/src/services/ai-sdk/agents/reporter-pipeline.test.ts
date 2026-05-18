/**
 * Reporter Pipeline Tests
 *
 * Unit tests for the Evaluator-Optimizer pattern implementation.
 * Tests report generation, evaluation, and optimization loops.
 *
 * @version 1.0.0
 * @created 2026-01-18
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPredictEnhanced } = vi.hoisted(() => ({
  mockPredictEnhanced: vi.fn(() => ({
    prediction: 87.5,
    trend: 'increasing' as const,
    confidence: 0.72,
    thresholdBreach: {
      willBreachCritical: false,
      willBreachWarning: true,
      humanReadable: '19분 후 warning 임계값 도달 예상',
    },
  })),
}));

// Mock status-thresholds
vi.mock('../../../config/status-thresholds', () => ({
  STATUS_THRESHOLDS: {
    cpu: { warning: 80, critical: 90, recovery: 65 },
    memory: { warning: 80, critical: 90, recovery: 75 },
    disk: { warning: 80, critical: 90, recovery: 75 },
    network: { warning: 70, critical: 85, recovery: 60 },
    responseTime: { warning: 2000, critical: 5000, recovery: 1500 },
  },
}));

// Mock TrendPredictor
vi.mock('../../../lib/ai/monitoring/TrendPredictor', () => ({
  getTrendPredictor: vi.fn(() => ({
    predictEnhanced: mockPredictEnhanced,
  })),
}));

// Mock analyst-tools-shared
vi.mock('../../../tools-ai-sdk/analyst-tools-shared', () => ({
  getCurrentSlotIndex: vi.fn(() => 42),
  getHistoryForMetric: vi.fn((_serverId: string, _metric: string, currentValue: number) =>
    Array.from({ length: 36 }, (_, i) => ({
      timestamp: Date.now() - (35 - i) * 600000,
      value: currentValue + (i - 18) * 0.2,
    }))
  ),
  toTrendDataPoints: vi.fn((points: Array<{ timestamp: number; value: number }>) =>
    points.map((p) => ({ timestamp: p.timestamp, value: p.value }))
  ),
}));

// Mock precomputed-state
vi.mock('../../../data/precomputed-state', () => ({
  getCurrentState: vi.fn(() => ({
    timestamp: new Date().toISOString(),
    servers: [
      {
        id: 'web-server-01',
        name: 'Web Server 01',
        type: 'web',
        status: 'warning',
        cpu: 85,
        memory: 72,
        disk: 45,
        network: 120,
      },
      {
        id: 'db-server-01',
        name: 'Database Server 01',
        type: 'database',
        status: 'critical',
        cpu: 92,
        memory: 88,
        disk: 78,
        network: 200,
      },
      {
        id: 'api-server-01',
        name: 'API Server 01',
        type: 'application',
        status: 'online',
        cpu: 45,
        memory: 55,
        disk: 30,
        network: 80,
      },
    ],
    systemHealth: {
      overall: 'warning',
      onlineCount: 1,
      warningCount: 1,
      criticalCount: 1,
    },
  })),
  getRecentHistory: vi.fn((count = 6) =>
    Array.from({ length: count }, (_, idx) => ({
      timestamp: new Date(Date.now() - idx * 10 * 60 * 1000).toISOString(),
      servers: [
        { id: 'web-server-01', cpu: 86 },
        { id: 'db-server-01', cpu: 91 },
        { id: 'api-server-01', cpu: 47 },
      ],
    }))
  ),
}));


import {
  executeReporterPipeline,
  type PipelineConfig,
  type PipelineResult,
} from './reporter-pipeline';

const sampleState = {
  timestamp: new Date().toISOString(),
  servers: [
    {
      id: 'web-server-01',
      name: 'Web Server 01',
      type: 'web',
      status: 'warning',
      cpu: 85,
      memory: 72,
      disk: 45,
      network: 120,
    },
    {
      id: 'db-server-01',
      name: 'Database Server 01',
      type: 'database',
      status: 'critical',
      cpu: 92,
      memory: 88,
      disk: 78,
      network: 200,
    },
    {
      id: 'api-server-01',
      name: 'API Server 01',
      type: 'application',
      status: 'online',
      cpu: 45,
      memory: 55,
      disk: 30,
      network: 80,
    },
  ],
  systemHealth: {
    overall: 'warning',
    onlineCount: 1,
    warningCount: 1,
    criticalCount: 1,
  },
};

function createTestDataSource() {
  return {
    async snapshot() {
      return {
        timestamp: new Date().toISOString(),
        data: sampleState,
      };
    },
    async history(count = 6) {
      return Array.from({ length: count }, (_, idx) => ({
        timestamp: new Date(Date.now() - idx * 10 * 60 * 1000).toISOString(),
        data: {
          timestamp: new Date(Date.now() - idx * 10 * 60 * 1000).toISOString(),
          servers: [
            { id: 'web-server-01', cpu: 86 },
            { id: 'db-server-01', cpu: 91 },
            { id: 'api-server-01', cpu: 47 },
          ],
        },
      }));
    },
  };
}

function executeReporterPipelineWithDataSource(
  query: string,
  config: Partial<PipelineConfig> = {}
): Promise<PipelineResult> {
  return executeReporterPipeline(query, {
    dataSource: createTestDataSource(),
    ...config,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('Reporter Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeReporterPipeline', () => {
    it('should generate a report successfully', async () => {
      const result = await executeReporterPipelineWithDataSource('서버 상태 보고서 생성');

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report?.title).toBeDefined();
      expect(result.report?.summary).toBeDefined();
    });

    it('should include affected servers in report', async () => {
      const result = await executeReporterPipelineWithDataSource('장애 서버 보고서');

      expect(result.success).toBe(true);
      expect(result.report?.affectedServers).toBeDefined();
      expect(result.report?.affectedServers?.length).toBeGreaterThan(0);
    });

    it('should include quality metrics', async () => {
      const result = await executeReporterPipelineWithDataSource('상태 분석 보고서');

      expect(result.success).toBe(true);
      expect(result.quality).toBeDefined();
      expect(result.quality.initialScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.iterations).toBeGreaterThanOrEqual(1);
    });

    it('should include metadata with duration', async () => {
      const result = await executeReporterPipelineWithDataSource('빠른 보고서');

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.agentsUsed).toBeDefined();
      expect(result.metadata.agentsUsed.length).toBeGreaterThan(0);
    });

    it('labels deterministic evaluator and optimizer as Reporter Pipeline stages', async () => {
      const result = await executeReporterPipelineWithDataSource('파이프라인 단계 명칭 확인', {
        qualityThreshold: 0.95,
        maxIterations: 3,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.agentsUsed).not.toEqual(
        expect.arrayContaining(['Evaluator Agent', 'Optimizer Agent'])
      );
      expect(result.metadata.agentsUsed).toEqual(
        expect.arrayContaining(['Reporter Pipeline: evaluator stage'])
      );
      expect(result.metadata.pipelineStages).toEqual(
        expect.arrayContaining([
          {
            stage: 'evaluator',
            label: 'Reporter Pipeline: evaluator stage',
            execution: 'deterministic',
          },
        ])
      );
    });

    it('should respect custom quality threshold', async () => {
      const config: Partial<PipelineConfig> = {
        qualityThreshold: 0.9,
        maxIterations: 2,
      };

      const result = await executeReporterPipelineWithDataSource('고품질 보고서', config);

      expect(result.success).toBe(true);
      // With high threshold and limited iterations, final score may be below threshold
      expect(result.quality.iterations).toBeLessThanOrEqual(2);
    });

    it('should respect timeout configuration', async () => {
      const config: Partial<PipelineConfig> = {
        timeout: 5000, // 5 seconds
      };

      const result = await executeReporterPipelineWithDataSource('타임아웃 테스트', config);

      expect(result.success).toBe(true);
      expect(result.metadata.durationMs).toBeLessThan(5000);
    });

    it('should include timeline events', async () => {
      const result = await executeReporterPipelineWithDataSource('타임라인 포함 보고서');

      expect(result.success).toBe(true);
      expect(result.report?.timeline).toBeDefined();
      // Timeline may be empty if no threshold breaches
      expect(Array.isArray(result.report?.timeline)).toBe(true);
    });

    it('should include root cause analysis when issues exist', async () => {
      const result = await executeReporterPipelineWithDataSource('근본원인 분석 보고서');

      expect(result.success).toBe(true);
      // Root cause should exist when there are affected servers
      if (result.report?.affectedServers && result.report.affectedServers.length > 0) {
        expect(result.report?.rootCause).toBeDefined();
        expect(result.report?.rootCause?.confidence).toBeGreaterThan(0);
      }
    });

    it('should include suggested actions', async () => {
      const result = await executeReporterPipelineWithDataSource('권장 조치 포함');

      expect(result.success).toBe(true);
      expect(result.report?.suggestedActions).toBeDefined();
      expect(Array.isArray(result.report?.suggestedActions)).toBe(true);
    });

    it('passes runtime domain id to the domain data source context', async () => {
      const snapshot = vi.fn(async () => ({
        timestamp: '2026-05-06T00:00:00+09:00',
        data: sampleState,
      }));
      const history = vi.fn(async () => []);

      const result = await executeReporterPipeline('도메인 컨텍스트 확인', {
        dataSource: { snapshot, history },
        domainId: 'sample-support',
      });

      expect(result.success).toBe(true);
      expect(snapshot.mock.calls[0]?.[0]).toMatchObject({
        domainId: 'sample-support',
        message: '도메인 컨텍스트 확인',
      });
      expect(history.mock.calls[0]?.[1]).toMatchObject({
        domainId: 'sample-support',
        message: '도메인 컨텍스트 확인',
      });
    });

    it('requests twelve history slots for two-hour reporter context', async () => {
      const snapshot = vi.fn(async () => ({
        timestamp: '2026-05-06T00:00:00+09:00',
        data: sampleState,
      }));
      const history = vi.fn(async () => []);

      const result = await executeReporterPipeline('히스토리 슬롯 수 확인', {
        dataSource: { snapshot, history },
        domainId: 'sample-support',
      });

      expect(result.success).toBe(true);
      expect(history.mock.calls[0]?.[0]).toBe(12);
    });

    it('passes no-incident preventive reports once they meet the relaxed score threshold', async () => {
      const baseTime = Date.parse('2026-05-18T00:00:00.000Z');
      const dataSource = {
        async snapshot() {
          return {
            timestamp: new Date(baseTime + 3 * 10 * 60 * 1000).toISOString(),
            data: {
              servers: [
                {
                  id: 'web-server-01',
                  name: 'Web Server 01',
                  type: 'web',
                  status: 'online',
                  cpu: 76,
                  memory: 52,
                  disk: 40,
                  network: 30,
                },
              ],
            },
          };
        },
        async history(count = 12) {
          return Array.from({ length: count }, (_, index) => ({
            timestamp: new Date(baseTime + index * 10 * 60 * 1000).toISOString(),
            data: {
              servers: [
                {
                  id: 'web-server-01',
                  cpu: 70 + index,
                  memory: 52,
                },
              ],
            },
          }));
        },
      };

      const result = await executeReporterPipeline('예방 점검 보고서', {
        dataSource,
        domainId: 'sample-support',
      });

      expect(result.success).toBe(true);
      expect(result.report?.affectedServers).toEqual([]);
      expect(result.report?.warnings?.length).toBeGreaterThan(0);
      expect(result.report?.predictions?.length).toBeGreaterThan(0);
      expect(result.quality.finalScore).toBeGreaterThanOrEqual(0.65);
      expect(result.metadata.pipelineStages).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stage: 'optimizer' }),
        ])
      );
    });

    it('normalizes domain history oldest-to-newest before trend prediction', async () => {
      const baseTime = Date.parse('2026-05-06T00:30:00+09:00');
      const dataSource = {
        async snapshot() {
          return {
            timestamp: new Date(baseTime).toISOString(),
            data: {
              servers: [
                {
                  id: 'db-server-01',
                  name: 'Database Server 01',
                  type: 'database',
                  status: 'critical',
                  cpu: 95,
                  memory: 50,
                  disk: 40,
                  network: 100,
                },
              ],
            },
          };
        },
        async history() {
          return [
            {
              timestamp: new Date(baseTime).toISOString(),
              data: { servers: [{ id: 'db-server-01', cpu: 95 }] },
            },
            {
              timestamp: new Date(baseTime - 10 * 60 * 1000).toISOString(),
              data: { servers: [{ id: 'db-server-01', cpu: 85 }] },
            },
            {
              timestamp: new Date(baseTime - 20 * 60 * 1000).toISOString(),
              data: { servers: [{ id: 'db-server-01', cpu: 75 }] },
            },
          ];
        },
      };

      const result = await executeReporterPipeline('히스토리 순서 확인', {
        dataSource,
        domainId: 'sample-support',
      });

      expect(result.success).toBe(true);
      expect(mockPredictEnhanced).toHaveBeenCalled();
      const trendInput = mockPredictEnhanced.mock.calls[0]?.[0] as Array<{
        value: number;
      }>;
      expect(trendInput.map((point) => point.value)).toEqual([75, 85, 95]);
    });
  });

  describe('Quality Improvement', () => {
    it('should improve quality score through optimization', async () => {
      const config: Partial<PipelineConfig> = {
        qualityThreshold: 0.5, // Low threshold to ensure at least one pass
        maxIterations: 3,
      };

      const result = await executeReporterPipelineWithDataSource('최적화 테스트', config);

      expect(result.success).toBe(true);
      // Final score should be >= initial (optimization should not decrease quality)
      expect(result.quality.finalScore).toBeGreaterThanOrEqual(result.quality.initialScore);
    });

    it('should track optimizations applied', async () => {
      const config: Partial<PipelineConfig> = {
        qualityThreshold: 0.95, // Very high to force optimizations
        maxIterations: 3,
      };

      const result = await executeReporterPipelineWithDataSource('최적화 추적', config);

      expect(result.success).toBe(true);
      expect(result.metadata.optimizationsApplied).toBeDefined();
      expect(Array.isArray(result.metadata.optimizationsApplied)).toBe(true);
    });

    it('applies no-incident preventive optimization when forced below threshold', async () => {
      const baseTime = Date.parse('2026-05-18T00:00:00.000Z');
      const dataSource = {
        async snapshot() {
          return {
            timestamp: new Date(baseTime + 3 * 10 * 60 * 1000).toISOString(),
            data: {
              servers: [
                {
                  id: 'web-server-01',
                  name: 'Web Server 01',
                  type: 'web',
                  status: 'online',
                  cpu: 76,
                  memory: 52,
                  disk: 40,
                  network: 30,
                },
              ],
            },
          };
        },
        async history(count = 12) {
          return Array.from({ length: count }, (_, index) => ({
            timestamp: new Date(baseTime + index * 10 * 60 * 1000).toISOString(),
            data: {
              servers: [
                {
                  id: 'web-server-01',
                  cpu: 70 + index,
                  memory: 52,
                },
              ],
            },
          }));
        },
      };

      const result = await executeReporterPipeline('예방 점검 최적화', {
        dataSource,
        domainId: 'sample-support',
        qualityThreshold: 0.95,
        maxIterations: 2,
      });

      expect(result.success).toBe(true);
      expect(result.report?.affectedServers).toEqual([]);
      expect(result.report?.predictions?.length).toBeGreaterThan(0);
      expect(result.metadata.optimizationsApplied).toContain(
        '예방 점검 예측 강화'
      );
      expect(result.report?.suggestedActions.join('\n')).toContain('예측 추세');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query gracefully', async () => {
      const result = await executeReporterPipelineWithDataSource('');

      // Should still generate a report based on current state
      expect(result.success).toBe(true);
    });

    it('should handle very long query', async () => {
      const longQuery = '서버 상태 분석 '.repeat(100);
      const result = await executeReporterPipelineWithDataSource(longQuery);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in query', async () => {
      const result = await executeReporterPipelineWithDataSource('서버 상태 <script>alert(1)</script>');

      expect(result.success).toBe(true);
    });
  });
});

describe('Pipeline Configuration', () => {
  it('should use default config when not provided', async () => {
    const result = await executeReporterPipelineWithDataSource('기본 설정 테스트');

    expect(result.success).toBe(true);
    // Default maxIterations is 2 (allows one optimization pass)
    expect(result.quality.iterations).toBeLessThanOrEqual(2);
  });

  it('should merge custom config with defaults', async () => {
    const config: Partial<PipelineConfig> = {
      maxIterations: 1, // Only override maxIterations
    };

    const result = await executeReporterPipelineWithDataSource('부분 설정', config);

    expect(result.success).toBe(true);
    expect(result.quality.iterations).toBeLessThanOrEqual(1);
  });
});
