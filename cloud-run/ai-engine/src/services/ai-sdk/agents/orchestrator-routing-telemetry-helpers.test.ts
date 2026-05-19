import { describe, expect, it } from 'vitest';

import { collectForcedRoutingToolObservations } from './orchestrator-routing-telemetry-helpers';

describe('orchestrator-routing-telemetry-helpers', () => {
  it('collects tools, final answers, KB evidence, web sources, and retrieval metadata under the evidence budget', () => {
    const observations = collectForcedRoutingToolObservations(
      [
        {
          toolCalls: [
            { toolName: 'searchKnowledgeBase' },
            { toolName: 'searchWeb' },
          ],
          toolResults: [
            {
              toolName: 'finalAnswer',
              result: { answer: '최종 답변' },
            },
            {
              toolName: 'searchKnowledgeBase',
              result: {
                evidenceCards: [
                  {
                    id: 'kb-1',
                    title: '토폴로지 SSOT',
                    summary: 'OTel data loader path',
                    sourceType: 'knowledge',
                    score: 0.92,
                  },
                ],
                retrieval: {
                  retrievalEnabled: true,
                  retrievalUsed: true,
                  retrievalMode: 'lite',
                  evidenceCount: 1,
                  webUsed: false,
                },
              },
            },
            {
              toolName: 'searchWeb',
              output: {
                results: [
                  {
                    title: '외부 점검 문서',
                    score: 0.7,
                    url: 'https://example.com/runbook',
                  },
                ],
              },
            },
          ],
        },
      ],
      2
    );

    expect(observations.toolsCalled).toEqual([
      'searchKnowledgeBase',
      'searchWeb',
    ]);
    expect(observations.collectedToolResults).toEqual([
      { toolName: 'finalAnswer', result: { answer: '최종 답변' } },
      {
        toolName: 'searchKnowledgeBase',
        result: expect.objectContaining({
          evidenceCards: expect.any(Array),
        }),
      },
      {
        toolName: 'searchWeb',
        result: expect.objectContaining({
          results: expect.any(Array),
        }),
      },
    ]);
    expect(observations.finalAnswerResult).toEqual({ answer: '최종 답변' });
    expect(observations.knowledgeRetrievalAttempted).toBe(true);
    expect(observations.retrievalMetadata).toMatchObject({
      retrievalEnabled: true,
      retrievalUsed: true,
      retrievalMode: 'lite',
      evidenceCount: 1,
      webUsed: false,
    });
    expect(observations.ragSources).toEqual([
      {
        title: '외부 점검 문서',
        similarity: 0.7,
        sourceType: 'web',
        category: 'web-search',
        url: 'https://example.com/runbook',
      },
    ]);
    expect(observations.evidenceCards).toHaveLength(2);
    expect(observations.evidenceCards.map((card) => card.sourceType)).toEqual([
      'knowledge',
      'web',
    ]);
  });
});
