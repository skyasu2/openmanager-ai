import { describe, expect, it } from 'vitest';
import type { SemanticQueryTrace } from '@/lib/ai/semantic-intent-frame';
import type { ToolResultSummary } from '@/stores/useAISidebarStore';
import {
  buildAnalysisSourceGroups,
  findEvidenceCardsFromToolParts,
  findRetrievalMetadataFromToolParts,
  getSemanticEvidenceDataSource,
} from './evidence-source-helpers';
import type { ToolPartWithCallId } from './message-transform-internals';

function createKnowledgeToolPart(output: unknown): ToolPartWithCallId {
  return {
    type: 'tool-searchKnowledgeBase',
    toolCallId: 'call-kb-1',
    state: 'output-available',
    output,
  } as ToolPartWithCallId;
}

describe('evidence-source-helpers', () => {
  it('extracts normalized retrieval metadata from knowledge search tool output', () => {
    const retrieval = findRetrievalMetadataFromToolParts([
      {
        type: 'tool-getServerMetrics',
        toolCallId: 'call-metrics-1',
        state: 'output-available',
        output: { ok: true },
      } as ToolPartWithCallId,
      createKnowledgeToolPart({
        retrieval: {
          retrievalEnabled: true,
          retrievalUsed: false,
          retrievalMode: 'lite',
          suppressedReason: 'unavailable',
          evidenceCount: 0,
          webUsed: false,
        },
      }),
    ]);

    expect(retrieval).toEqual({
      retrievalEnabled: true,
      retrievalUsed: false,
      retrievalMode: 'lite',
      suppressedReason: 'unavailable',
      evidenceCount: 0,
      webUsed: false,
    });
  });

  it('extracts normalized evidence cards from knowledge search tool output', () => {
    const evidenceCards = findEvidenceCardsFromToolParts([
      createKnowledgeToolPart({
        evidenceCards: [
          {
            id: 'kb-1',
            title: 'CPU runbook',
            summary: 'CPU saturation handling',
            sourceType: 'runbook',
            score: 0.91,
            category: 'command',
          },
          {
            id: 'web-1',
            title: 'Vendor guide',
            summary: 'External tuning guide',
            sourceType: 'web',
            score: 1,
            url: 'https://example.com/guide',
          },
        ],
      }),
    ]);

    expect(evidenceCards).toHaveLength(2);
    expect(evidenceCards.map((card) => card.sourceType)).toEqual([
      'runbook',
      'web',
    ]);
  });

  it('groups semantic domain evidence, knowledge, web, and non-source tool results', () => {
    const semanticQueryTrace: SemanticQueryTrace = {
      originalQuery: 'load 피크 알려줘',
      selectedDomain: 'openmanager-monitoring',
      selectedCapability: 'monitoring.metric_peak',
      selectedEvidenceProvider: 'monitoring-peak-metric',
      evidenceAvailable: true,
      clarificationRequired: false,
      reasonCodes: ['semantic_frame_evidence_validated'],
    };
    const toolResultSummaries: ToolResultSummary[] = [
      {
        toolName: 'searchKnowledgeBase',
        label: '지식 검색',
        summary: '지식 검색 완료',
        status: 'completed',
      },
      {
        toolName: 'getServerMetrics',
        label: '서버 메트릭',
        summary: '18대 서버 메트릭 확인',
        status: 'completed',
      },
    ];

    expect(
      buildAnalysisSourceGroups({
        semanticQueryTrace,
        hasServerAnalysisEvidence: false,
        knowledgeEvidenceCount: 1,
        legacyKnowledgeSourceCount: 0,
        webEvidenceCount: 0,
        legacyWebSourceCount: 0,
        retrievalEvidenceCount: 2,
        retrievalIndicatesKnowledgeUse: true,
        retrievalIndicatesWebUse: true,
        toolResultSummaries,
        completedToolNames: ['searchKnowledgeBase', 'getServerMetrics'],
      })
    ).toEqual([
      {
        type: 'monitoring-data',
        label: 'monitoring-data',
        count: 1,
        detail: 'monitoring-peak-metric',
      },
      { type: 'knowledge-base', label: 'knowledge-base', count: 1 },
      { type: 'web-search', label: 'web-search', count: 2 },
      { type: 'tool-result', label: 'tool-result', count: 1 },
    ]);
  });

  it('labels semantic monitoring evidence data sources', () => {
    expect(
      getSemanticEvidenceDataSource({
        originalQuery: '피크',
        selectedDomain: 'openmanager-monitoring',
        selectedCapability: 'monitoring.metric_peak',
        evidenceAvailable: true,
        clarificationRequired: false,
        reasonCodes: [],
      })
    ).toBe('모니터링 피크 지표 근거');
  });
});
