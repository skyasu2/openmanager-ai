import { describe, expect, it } from 'vitest';
import {
  createRetrievalMetadata,
  evaluateRetrievalRecallGuard,
  legacyRagSourcesToEvidenceCards,
} from '../../lib/retrieval-contract';
import {
  buildSupervisorAssistantPlanForRequest,
  buildSupervisorRouteDecision,
  resolveSupervisorModeDecision,
} from './supervisor-mode';
import { createPrepareStep } from '../../domains/monitoring/routing-policy';
import type { SupervisorRequest } from './supervisor-types';

function buildRequest(query: string): SupervisorRequest {
  return {
    sessionId: `bench-${query.length}`,
    mode: 'auto',
    messages: [{ role: 'user', content: query }],
    traceId: `trace-${query.length}`,
  };
}

function normalizeToolChoice(value: unknown): unknown {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  return {
    type: record.type,
    toolName: record.toolName,
  };
}

describe('portable core route/tool trace replay benchmark', () => {
  it('pins deterministic route and first-step tool traces without provider calls', async () => {
    const cases = [
      {
        label: 'direct metric lookup',
        query: 'api-was-dc1-01 CPU 알려줘',
        options: {},
      },
      {
        label: 'metric ranking',
        query: 'CPU 높은 서버 3대 알려줘',
        options: {},
      },
      {
        label: 'knowledge route',
        query: '현재 인프라 토폴로지 알려줘',
        options: { enableRAG: true },
      },
      {
        label: 'incident report escalation',
        query: '전체 서버 장애 원인 분석 보고서 만들어줘',
        options: {},
      },
    ] as const;

    const traces = [];

    for (const item of cases) {
      const request = buildRequest(item.query);
      const modeDecision = resolveSupervisorModeDecision(request);
      const routeDecision = buildSupervisorRouteDecision(modeDecision, {
        traceId: request.traceId,
      });
      const assistantPlan = buildSupervisorAssistantPlanForRequest(
        request,
        routeDecision
      );
      const firstStep = await createPrepareStep(item.query, item.options)({
        stepNumber: 0,
      });

      traces.push({
        label: item.label,
        resolvedMode: modeDecision.resolvedMode,
        planExecutionMode: assistantPlan.executionMode,
        candidate: {
          kind: assistantPlan.plannerShadow?.candidate.kind,
          executionPath: assistantPlan.plannerShadow?.candidate.executionPath,
          executionMode: assistantPlan.plannerShadow?.candidate.executionMode,
          reasonCodes: assistantPlan.plannerShadow?.candidate.reasonCodes,
          escalationReasonCodes:
            assistantPlan.plannerShadow?.candidate.escalationReasonCodes,
        },
        activeTools: firstStep.activeTools,
        toolChoice: normalizeToolChoice(firstStep.toolChoice),
      });
    }

    expect(traces).toEqual([
      {
        label: 'direct metric lookup',
        resolvedMode: 'single',
        planExecutionMode: 'single-agent',
        candidate: {
          kind: 'chat',
          executionPath: 'stream',
          executionMode: 'deterministic',
          reasonCodes: ['metric_lookup'],
          escalationReasonCodes: undefined,
        },
        activeTools: ['getServerMetrics', 'finalAnswer'],
        toolChoice: { type: 'tool', toolName: 'getServerMetrics' },
      },
      {
        label: 'metric ranking',
        resolvedMode: 'single',
        planExecutionMode: 'single-agent',
        candidate: {
          kind: 'chat',
          executionPath: 'stream',
          executionMode: 'deterministic',
          reasonCodes: ['metric_lookup'],
          escalationReasonCodes: undefined,
        },
        activeTools: ['getServerMetricsAdvanced', 'finalAnswer'],
        toolChoice: {
          type: 'tool',
          toolName: 'getServerMetricsAdvanced',
        },
      },
      {
        label: 'knowledge route',
        resolvedMode: 'multi',
        planExecutionMode: 'multi-agent',
        candidate: {
          kind: 'chat',
          executionPath: 'stream',
          executionMode: 'single-agent',
          reasonCodes: ['single_agent_default'],
          escalationReasonCodes: undefined,
        },
        activeTools: ['recommendCommands', 'searchKnowledgeBase', 'finalAnswer'],
        toolChoice: {
          type: 'tool',
          toolName: 'searchKnowledgeBase',
        },
      },
      {
        label: 'incident report escalation',
        resolvedMode: 'multi',
        planExecutionMode: 'multi-agent',
        candidate: {
          kind: 'chat',
          executionPath: 'job',
          executionMode: 'multi-agent',
          reasonCodes: ['incident_report'],
          escalationReasonCodes: ['incident_report_requested'],
        },
        activeTools: [
          'detectAnomaliesAllServers',
          'findRootCause',
          'buildIncidentTimeline',
          'correlateMetrics',
          'getServerMetrics',
          'detectAnomalies',
          'finalAnswer',
        ],
        toolChoice: 'required',
      },
    ]);
  });
});

describe('portable core retrieval evidence recall benchmark', () => {
  it('pins evidence card normalization and insufficient evidence fallback', () => {
    const evidenceCards = legacyRagSourcesToEvidenceCards([
      {
        title: 'OpenManager OTel 데이터 SSOT 경로',
        similarity: 0.94,
        sourceType: 'knowledge_base',
        category: 'architecture',
        url: 'docs/guides/ai/ai-standards.md',
      },
      {
        title: 'MonitoringFactPack contract',
        similarity: 0.88,
        sourceType: 'knowledge_base',
        category: 'contract',
      },
    ]);

    const sufficient = evaluateRetrievalRecallGuard(
      createRetrievalMetadata({
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: evidenceCards.length,
        webUsed: false,
      }),
      { minEvidenceCount: 2 }
    );

    const insufficient = evaluateRetrievalRecallGuard(
      createRetrievalMetadata({
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 1,
        webUsed: false,
      }),
      { minEvidenceCount: 2 }
    );

    expect(evidenceCards.map((card) => card.id)).toEqual([
      'legacy-rag-0-openmanager-otel-ssot',
      'legacy-rag-1-monitoringfactpack-contract',
    ]);
    expect(sufficient).toEqual({
      ok: true,
      retrievalMode: 'lite',
      evidenceCount: 2,
      minEvidenceCount: 2,
    });
    expect(insufficient).toEqual({
      ok: false,
      retrievalMode: 'lite',
      evidenceCount: 1,
      minEvidenceCount: 2,
      fallbackReason: 'insufficient_evidence',
    });
  });
});
