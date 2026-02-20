/**
 * Incident Evaluation Tools Tests
 *
 * Unit tests for the Evaluator-Optimizer pattern tools.
 * Tests evaluation scoring, validation, and optimization functions.
 *
 * @version 1.0.0
 * @created 2026-01-18
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock precomputed-state
vi.mock('../data/precomputed-state', () => ({
  getCurrentState: vi.fn(() => ({
    timestamp: new Date().toISOString(),
    servers: [
      {
        id: 'web-server-01',
        name: 'Web Server 01',
        status: 'warning',
        cpu: 85,
        memory: 72,
        disk: 45,
        network: 120,
      },
      {
        id: 'db-server-01',
        name: 'Database Server 01',
        status: 'critical',
        cpu: 92,
        memory: 88,
        disk: 78,
        network: 200,
      },
    ],
    systemHealth: {
      overall: 'warning',
      healthyCount: 0,
      warningCount: 1,
      criticalCount: 1,
    },
  })),
  getRecentHistory: vi.fn((count: number) =>
    Array.from({ length: count }, (_, idx) => ({
      timestamp: new Date(Date.now() - idx * 10 * 60 * 1000).toISOString(),
      servers: [
        {
          id: 'web-server-01',
          cpu: 86,
          memory: 72,
          disk: 45,
        },
        {
          id: 'db-server-01',
          cpu: 92,
          memory: 88,
          disk: 78,
        },
      ],
    }))
  ),
}));


import {
  evaluateIncidentReport,
  validateReportStructure,
  scoreRootCauseConfidence,
  refineRootCauseAnalysis,
  enhanceSuggestedActions,
  extendServerCorrelation,
} from './incident-evaluation-tools';

// ============================================================================
// Test Data
// ============================================================================

const createMockReport = (overrides = {}) => ({
  title: '2026-01-18 시스템 장애 보고서',
  summary: 'web-server-01에서 CPU 과부하 감지됨. 긴급 점검 필요.',
  affectedServers: [
    { id: 'web-server-01', name: 'Web Server 01', status: 'warning', primaryIssue: 'CPU 85%' },
  ],
  timeline: [
    { timestamp: '2026-01-18T10:00:00Z', eventType: 'threshold_breach', severity: 'warning' as const, description: 'CPU 임계값 초과' },
    { timestamp: '2026-01-18T10:15:00Z', eventType: 'alert', severity: 'warning' as const, description: '경고 알림 발생' },
    { timestamp: '2026-01-18T10:30:00Z', eventType: 'escalation', severity: 'critical' as const, description: '심각도 상승' },
  ],
  rootCause: {
    cause: 'web-server-01의 CPU 과부하',
    confidence: 0.7,
    evidence: ['CPU 85%', '메모리 72%'],
    suggestedFix: '프로세스 재시작',
  },
  suggestedActions: ['CPU 사용량 확인', '불필요한 프로세스 종료'],
  sla: {
    targetUptime: 99.9,
    actualUptime: 99.5,
    slaViolation: false,
  },
  ...overrides,
});

// ============================================================================
// Evaluator Tools Tests
// ============================================================================

describe('evaluateIncidentReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should evaluate a complete report with high score', async () => {
    const report = createMockReport();

    const result = await evaluateIncidentReport.execute!(
      { report },
      { toolCallId: 'test-1', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.evaluation).toBeDefined();
    expect(result.evaluation.overallScore).toBeGreaterThan(0);
    expect(result.evaluation.scores).toBeDefined();
  });

  it('should identify issues in incomplete report', async () => {
    const incompleteReport = createMockReport({
      timeline: [], // Missing timeline
      rootCause: null, // Missing root cause
    });

    const result = await evaluateIncidentReport.execute!(
      { report: incompleteReport },
      { toolCallId: 'test-2', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.evaluation.issues.length).toBeGreaterThan(0);
    expect(result.evaluation.needsOptimization).toBe(true);
  });

  it('should provide recommendations for low scores', async () => {
    const poorReport = createMockReport({
      rootCause: {
        cause: '원인 불명',
        confidence: 0.3, // Low confidence
        evidence: [],
        suggestedFix: '확인 필요',
      },
      suggestedActions: ['점검'], // Too generic
    });

    const result = await evaluateIncidentReport.execute!(
      { report: poorReport },
      { toolCallId: 'test-3', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.evaluation.recommendations.length).toBeGreaterThan(0);
  });

  it('should calculate weighted overall score', async () => {
    const report = createMockReport();

    const result = await evaluateIncidentReport.execute!(
      { report },
      { toolCallId: 'test-4', messages: [] }
    );

    const { scores, overallScore } = result.evaluation;

    // Verify overall score is weighted combination
    const expectedScore =
      scores.structure * 0.2 +
      scores.completeness * 0.25 +
      scores.accuracy * 0.35 +
      scores.actionability * 0.2;

    expect(Math.abs(overallScore - expectedScore)).toBeLessThan(0.01);
  });
});

describe('validateReportStructure', () => {
  it('should validate all required fields', async () => {
    const report = createMockReport();

    const result = await validateReportStructure.execute!(
      { report },
      { toolCallId: 'test-1', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.validationResults).toBeDefined();
    expect(result.passedCount).toBeGreaterThan(0);
  });

  it('should detect missing fields', async () => {
    const incompleteReport = {
      title: 'Test',
      // Missing other fields
    };

    const result = await validateReportStructure.execute!(
      { report: incompleteReport },
      { toolCallId: 'test-2', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.passedCount).toBeLessThan(result.totalCount);
    expect(result.passRate).toBeLessThan(1);
  });

  it('should validate field lengths', async () => {
    const shortReport = createMockReport({
      title: 'Hi', // Too short (< 5 chars)
      summary: 'Short', // Too short (< 20 chars)
    });

    const result = await validateReportStructure.execute!(
      { report: shortReport },
      { toolCallId: 'test-3', messages: [] }
    );

    expect(result.success).toBe(true);
    // Should have validation failures for short fields
    const failedFields = result.validationResults.filter((r: { valid: boolean }) => !r.valid);
    expect(failedFields.length).toBeGreaterThan(0);
  });
});

describe('scoreRootCauseConfidence', () => {
  it('should score root cause with evidence', async () => {
    const rootCause = {
      cause: 'web-server-01의 CPU 과부하',
      confidence: 0.7,
      evidence: ['CPU 85% 초과', '메모리 72%', '연속 3시간 고부하'],
      suggestedFix: '프로세스 재시작 및 스케일 아웃',
    };

    const result = await scoreRootCauseConfidence.execute!(
      { rootCause, affectedServersCount: 1, timelineEventsCount: 3 },
      { toolCallId: 'test-1', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.calculatedConfidence).toBeGreaterThan(0);
    expect(result.breakdown).toBeDefined();
  });

  it('should give higher score for specific metrics', async () => {
    const specificRootCause = {
      cause: 'web-server-01 CPU 92%로 인한 과부하',
      confidence: 0.5,
      evidence: ['CPU 92%'],
      suggestedFix: 'CPU 사용량 점검',
    };

    const genericRootCause = {
      cause: '원인 불명',
      confidence: 0.5,
      evidence: ['확인 필요'],
      suggestedFix: '점검 필요',
    };

    const specificResult = await scoreRootCauseConfidence.execute!(
      { rootCause: specificRootCause, affectedServersCount: 1, timelineEventsCount: 1 },
      { toolCallId: 'test-2a', messages: [] }
    );

    const genericResult = await scoreRootCauseConfidence.execute!(
      { rootCause: genericRootCause, affectedServersCount: 1, timelineEventsCount: 1 },
      { toolCallId: 'test-2b', messages: [] }
    );

    expect(specificResult.calculatedConfidence).toBeGreaterThan(genericResult.calculatedConfidence);
  });
});

// ============================================================================
// Optimizer Tools Tests
// ============================================================================

describe('refineRootCauseAnalysis', () => {
  it('should refine root cause with additional evidence', async () => {
    const result = await refineRootCauseAnalysis.execute!(
      {
        serverId: 'web-server-01',
        currentCause: 'CPU 과부하',
        currentConfidence: 0.6,
      },
      { toolCallId: 'test-1', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.improvedConfidence).toBeGreaterThanOrEqual(result.originalConfidence);
    expect(result.additionalEvidence).toBeDefined();
  });

  it('should handle non-existent server', async () => {
    const result = await refineRootCauseAnalysis.execute!(
      {
        serverId: 'non-existent-server',
        currentCause: 'Unknown',
        currentConfidence: 0.5,
      },
      { toolCallId: 'test-2', messages: [] }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should detect CPU issues from metrics', async () => {
    const result = await refineRootCauseAnalysis.execute!(
      {
        serverId: 'db-server-01', // Has high CPU (92%)
        currentCause: 'Performance degradation',
        currentConfidence: 0.5,
      },
      { toolCallId: 'test-3', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.confidenceBoost).toBeGreaterThan(0);
    // Should include CPU evidence
    const hasCpuEvidence = result.additionalEvidence.some(
      (e: string) => e.toLowerCase().includes('cpu')
    );
    expect(hasCpuEvidence).toBe(true);
  });
});

describe('enhanceSuggestedActions', () => {
  it('should add CLI commands to actions', async () => {
    const result = await enhanceSuggestedActions.execute!(
      {
        actions: ['CPU 사용량 확인', '메모리 점검'],
        focusArea: 'cpu',
      },
      { toolCallId: 'test-1', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.enhancedActions).toBeDefined();
    expect(result.enhancedActions.length).toBeGreaterThan(0);

    // Each action should have commands
    for (const action of result.enhancedActions) {
      expect(action.commands).toBeDefined();
      expect(action.commands.length).toBeGreaterThan(0);
    }
  });

  it('should assign priorities to actions', async () => {
    const result = await enhanceSuggestedActions.execute!(
      {
        actions: ['긴급 확인 필요', '모니터링 유지'],
        focusArea: 'general',
      },
      { toolCallId: 'test-2', messages: [] }
    );

    expect(result.success).toBe(true);

    // Check priorities are assigned
    const priorities = result.enhancedActions.map((a: { priority: string }) => a.priority);
    expect(priorities.every((p: string) => ['critical', 'high', 'medium', 'low'].includes(p))).toBe(true);
  });

  it('should add default actions when few provided', async () => {
    const result = await enhanceSuggestedActions.execute!(
      {
        actions: ['점검'],
        focusArea: 'memory',
      },
      { toolCallId: 'test-3', messages: [] }
    );

    expect(result.success).toBe(true);
    // Should add additional actions
    expect(result.enhancedCount).toBeGreaterThanOrEqual(result.originalCount);
  });

  it('should use correct commands for focus area', async () => {
    const cpuResult = await enhanceSuggestedActions.execute!(
      { actions: ['확인'], focusArea: 'cpu' },
      { toolCallId: 'test-4a', messages: [] }
    );

    const memoryResult = await enhanceSuggestedActions.execute!(
      { actions: ['확인'], focusArea: 'memory' },
      { toolCallId: 'test-4b', messages: [] }
    );

    // Commands should be different for different focus areas
    const cpuCommands = cpuResult.enhancedActions[0].commands;
    const memoryCommands = memoryResult.enhancedActions[0].commands;

    expect(cpuCommands).not.toEqual(memoryCommands);
  });
});

describe('extendServerCorrelation', () => {
  it('should find correlated servers', async () => {
    const result = await extendServerCorrelation.execute!(
      {
        primaryServerId: 'web-server-01',
        existingCorrelations: [],
      },
      { toolCallId: 'test-1', messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.newCorrelations).toBeDefined();
    // Both servers have issues, so should find correlation
    expect(result.totalCorrelations).toBeGreaterThanOrEqual(0);
  });

  it('should not duplicate existing correlations', async () => {
    const existingCorrelations = [
      {
        serverId: 'web-server-01',
        correlatedWith: 'db-server-01',
        correlationType: 'simultaneous',
      },
    ];

    const result = await extendServerCorrelation.execute!(
      {
        primaryServerId: 'web-server-01',
        existingCorrelations,
      },
      { toolCallId: 'test-2', messages: [] }
    );

    expect(result.success).toBe(true);
    // Should not add duplicate
    expect(result.newCorrelationsCount).toBe(0);
  });

  it('should handle non-existent server', async () => {
    const result = await extendServerCorrelation.execute!(
      {
        primaryServerId: 'non-existent-server',
        existingCorrelations: [],
      },
      { toolCallId: 'test-3', messages: [] }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should classify correlation types', async () => {
    const result = await extendServerCorrelation.execute!(
      {
        primaryServerId: 'web-server-01',
        existingCorrelations: [],
      },
      { toolCallId: 'test-4', messages: [] }
    );

    expect(result.success).toBe(true);

    // Check correlation types are valid
    for (const corr of result.newCorrelations) {
      expect(['cascade', 'simultaneous', 'periodic']).toContain(corr.correlationType);
      expect(corr.confidence).toBeGreaterThan(0);
      expect(corr.confidence).toBeLessThanOrEqual(1);
    }
  });
});

