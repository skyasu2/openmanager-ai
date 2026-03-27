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
// Integration Tests
// ============================================================================

describe('Evaluator-Optimizer Integration', () => {
  it('should improve report quality through evaluation and optimization', async () => {
    // 1. Create initial report
    const initialReport = createMockReport({
      rootCause: {
        cause: '원인 분석 중',
        confidence: 0.5,
        evidence: ['확인 필요'],
        suggestedFix: '점검',
      },
      suggestedActions: ['확인'],
    });

    // 2. Evaluate initial report
    const evaluation = await evaluateIncidentReport.execute!(
      { report: initialReport },
      { toolCallId: 'int-1', messages: [] }
    );

    expect(evaluation.evaluation.needsOptimization).toBe(true);

    // 3. Refine root cause if needed
    if (evaluation.evaluation.scores.accuracy < 0.75) {
      const refinedRCA = await refineRootCauseAnalysis.execute!(
        {
          serverId: initialReport.affectedServers[0].id,
          currentCause: initialReport.rootCause!.cause,
          currentConfidence: initialReport.rootCause!.confidence,
        },
        { toolCallId: 'int-2', messages: [] }
      );

      expect(refinedRCA.improvedConfidence).toBeGreaterThan(initialReport.rootCause!.confidence);
    }

    // 4. Enhance actions if needed
    if (evaluation.evaluation.scores.actionability < 0.7) {
      const enhancedActions = await enhanceSuggestedActions.execute!(
        {
          actions: initialReport.suggestedActions,
          focusArea: 'cpu',
        },
        { toolCallId: 'int-3', messages: [] }
      );

      expect(enhancedActions.enhancedCount).toBeGreaterThanOrEqual(enhancedActions.originalCount);
    }
  });
});
