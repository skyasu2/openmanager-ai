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
      healthyCount: 1,
      warningCount: 1,
      criticalCount: 1,
    },
  })),
}));


import {
  executeReporterPipeline,
  type PipelineConfig,
  type PipelineResult,
} from './reporter-pipeline';

// ============================================================================
// Tests
// ============================================================================

describe('Reporter Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeReporterPipeline', () => {
    it('should generate a report successfully', async () => {
      const result = await executeReporterPipeline('서버 상태 보고서 생성');

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report?.title).toBeDefined();
      expect(result.report?.summary).toBeDefined();
    });

    it('should include affected servers in report', async () => {
      const result = await executeReporterPipeline('장애 서버 보고서');

      expect(result.success).toBe(true);
      expect(result.report?.affectedServers).toBeDefined();
      expect(result.report?.affectedServers?.length).toBeGreaterThan(0);
    });

    it('should include quality metrics', async () => {
      const result = await executeReporterPipeline('상태 분석 보고서');

      expect(result.success).toBe(true);
      expect(result.quality).toBeDefined();
      expect(result.quality.initialScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.iterations).toBeGreaterThanOrEqual(1);
    });

    it('should include metadata with duration', async () => {
      const result = await executeReporterPipeline('빠른 보고서');

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.agentsUsed).toBeDefined();
      expect(result.metadata.agentsUsed.length).toBeGreaterThan(0);
    });

    it('should respect custom quality threshold', async () => {
      const config: Partial<PipelineConfig> = {
        qualityThreshold: 0.9,
        maxIterations: 2,
      };

      const result = await executeReporterPipeline('고품질 보고서', config);

      expect(result.success).toBe(true);
      // With high threshold and limited iterations, final score may be below threshold
      expect(result.quality.iterations).toBeLessThanOrEqual(2);
    });

    it('should respect timeout configuration', async () => {
      const config: Partial<PipelineConfig> = {
        timeout: 5000, // 5 seconds
      };

      const result = await executeReporterPipeline('타임아웃 테스트', config);

      expect(result.success).toBe(true);
      expect(result.metadata.durationMs).toBeLessThan(5000);
    });

    it('should include timeline events', async () => {
      const result = await executeReporterPipeline('타임라인 포함 보고서');

      expect(result.success).toBe(true);
      expect(result.report?.timeline).toBeDefined();
      // Timeline may be empty if no threshold breaches
      expect(Array.isArray(result.report?.timeline)).toBe(true);
    });

    it('should include root cause analysis when issues exist', async () => {
      const result = await executeReporterPipeline('근본원인 분석 보고서');

      expect(result.success).toBe(true);
      // Root cause should exist when there are affected servers
      if (result.report?.affectedServers && result.report.affectedServers.length > 0) {
        expect(result.report?.rootCause).toBeDefined();
        expect(result.report?.rootCause?.confidence).toBeGreaterThan(0);
      }
    });

    it('should include suggested actions', async () => {
      const result = await executeReporterPipeline('권장 조치 포함');

      expect(result.success).toBe(true);
      expect(result.report?.suggestedActions).toBeDefined();
      expect(Array.isArray(result.report?.suggestedActions)).toBe(true);
    });
  });

  describe('Quality Improvement', () => {
    it('should improve quality score through optimization', async () => {
      const config: Partial<PipelineConfig> = {
        qualityThreshold: 0.5, // Low threshold to ensure at least one pass
        maxIterations: 3,
      };

      const result = await executeReporterPipeline('최적화 테스트', config);

      expect(result.success).toBe(true);
      // Final score should be >= initial (optimization should not decrease quality)
      expect(result.quality.finalScore).toBeGreaterThanOrEqual(result.quality.initialScore);
    });

    it('should track optimizations applied', async () => {
      const config: Partial<PipelineConfig> = {
        qualityThreshold: 0.95, // Very high to force optimizations
        maxIterations: 3,
      };

      const result = await executeReporterPipeline('최적화 추적', config);

      expect(result.success).toBe(true);
      expect(result.metadata.optimizationsApplied).toBeDefined();
      expect(Array.isArray(result.metadata.optimizationsApplied)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query gracefully', async () => {
      const result = await executeReporterPipeline('');

      // Should still generate a report based on current state
      expect(result.success).toBe(true);
    });

    it('should handle very long query', async () => {
      const longQuery = '서버 상태 분석 '.repeat(100);
      const result = await executeReporterPipeline(longQuery);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in query', async () => {
      const result = await executeReporterPipeline('서버 상태 <script>alert(1)</script>');

      expect(result.success).toBe(true);
    });
  });
});

describe('Pipeline Configuration', () => {
  it('should use default config when not provided', async () => {
    const result = await executeReporterPipeline('기본 설정 테스트');

    expect(result.success).toBe(true);
    // Default maxIterations is 2 (allows one optimization pass)
    expect(result.quality.iterations).toBeLessThanOrEqual(2);
  });

  it('should merge custom config with defaults', async () => {
    const config: Partial<PipelineConfig> = {
      maxIterations: 1, // Only override maxIterations
    };

    const result = await executeReporterPipeline('부분 설정', config);

    expect(result.success).toBe(true);
    expect(result.quality.iterations).toBeLessThanOrEqual(1);
  });
});
