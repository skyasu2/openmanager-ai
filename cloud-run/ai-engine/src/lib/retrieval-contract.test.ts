import { describe, expect, expectTypeOf, it } from 'vitest';

import type { MultiAgentResponse } from '../services/ai-sdk/agents/orchestrator-types';
import type { SupervisorResponse } from '../services/ai-sdk/supervisor-types';
import {
  createRetrievalMetadata,
  evaluateRetrievalRecallGuard,
  legacyRagSourcesToEvidenceCards,
  RETRIEVAL_MODES,
  RETRIEVAL_SUPPRESSED_REASONS,
  type EvidenceCard,
  type RetrievalMetadata,
  type RetrievalMode,
  type RetrievalSuppressedReason,
} from './retrieval-contract';

describe('retrieval contract', () => {
  it('keeps a narrow retrieval mode union for free-tier runtime paths', () => {
    const modes = [
      'off',
      'lite',
      'text-only',
    ] as const satisfies readonly RetrievalMode[];

    expect(RETRIEVAL_MODES).toEqual(modes);
    expectTypeOf<RetrievalMode>().toEqualTypeOf<(typeof modes)[number]>();
  });

  it('keeps suppressed reasons explicit for UI and Langfuse metadata', () => {
    const reasons = [
      'disabled',
      'not_needed',
      'no_results',
      'budget_guard',
      'unavailable',
    ] as const satisfies readonly RetrievalSuppressedReason[];

    expect(RETRIEVAL_SUPPRESSED_REASONS).toEqual(reasons);
    expectTypeOf<RetrievalSuppressedReason>().toEqualTypeOf<(typeof reasons)[number]>();
  });

  it('builds disabled metadata without pretending retrieval was used', () => {
    expect(createRetrievalMetadata({ retrievalEnabled: false })).toEqual({
      retrievalEnabled: false,
      retrievalUsed: false,
      retrievalMode: 'off',
      suppressedReason: 'disabled',
      evidenceCount: 0,
      webUsed: false,
    } satisfies RetrievalMetadata);
  });

  it('builds used metadata without a suppressed reason', () => {
    expect(
      createRetrievalMetadata({
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 3,
        webUsed: false,
        suppressedReason: 'budget_guard',
      })
    ).toEqual({
      retrievalEnabled: true,
      retrievalUsed: true,
      retrievalMode: 'lite',
      evidenceCount: 3,
      webUsed: false,
    } satisfies RetrievalMetadata);
  });

  it('maps legacy ragSources into stable EvidenceCard objects', () => {
    const evidence = legacyRagSourcesToEvidenceCards([
      {
        title: 'Redis OOM incident',
        similarity: 0.91,
        sourceType: 'incident',
        category: 'incident',
      },
      {
        title: 'Vendor rate limit update',
        similarity: 1.4,
        sourceType: 'web',
        category: 'web-search',
        url: 'https://example.com/rate-limit',
      },
    ]);

    expect(evidence).toEqual([
      {
        id: 'legacy-rag-0-redis-oom-incident',
        title: 'Redis OOM incident',
        summary: 'Redis OOM incident',
        sourceType: 'incident',
        score: 0.91,
        category: 'incident',
        reason: 'legacy-rag-source:incident',
      },
      {
        id: 'legacy-rag-1-vendor-rate-limit-update',
        title: 'Vendor rate limit update',
        summary: 'Vendor rate limit update',
        sourceType: 'web',
        score: 1,
        category: 'web-search',
        reason: 'legacy-rag-source:web',
        url: 'https://example.com/rate-limit',
      },
    ] satisfies EvidenceCard[]);
  });

  it('allows backend responses to carry evidenceCards and retrieval metadata alongside legacy ragSources', () => {
    const retrieval = createRetrievalMetadata({
      retrievalEnabled: true,
      retrievalUsed: true,
      retrievalMode: 'lite',
      evidenceCount: 1,
      webUsed: false,
    });
    const evidenceCards = legacyRagSourcesToEvidenceCards([
      {
        title: 'Redis OOM incident',
        similarity: 0.91,
        sourceType: 'incident',
        category: 'incident',
      },
    ]);

    const supervisorResponse = {
      success: true,
      response: 'ok',
      toolsCalled: ['searchKnowledgeBase'],
      toolResults: [],
      ragSources: [
        {
          title: 'Redis OOM incident',
          similarity: 0.91,
          sourceType: 'incident',
          category: 'incident',
        },
      ],
      evidenceCards,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      metadata: {
        provider: 'groq',
        modelId: 'groq-model',
        stepsExecuted: 1,
        durationMs: 10,
        retrieval,
      },
    } satisfies SupervisorResponse;

    const multiAgentResponse = {
      success: true,
      response: 'ok',
      handoffs: [],
      finalAgent: 'advisor',
      toolsCalled: ['searchKnowledgeBase'],
      ragSources: supervisorResponse.ragSources,
      evidenceCards,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      metadata: {
        provider: 'groq',
        modelId: 'groq-model',
        totalRounds: 1,
        handoffCount: 0,
        durationMs: 10,
        retrieval,
      },
    } satisfies MultiAgentResponse;

    expect(supervisorResponse.metadata.retrieval.retrievalUsed).toBe(true);
    expect(multiAgentResponse.evidenceCards).toHaveLength(1);
  });

  it('exposes a deterministic fallback reason when lite retrieval recall is below the minimum evidence threshold', () => {
    const guard = evaluateRetrievalRecallGuard(
      createRetrievalMetadata({
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 1,
        webUsed: false,
      }),
      { minEvidenceCount: 2 }
    );

    expect(guard).toEqual({
      ok: false,
      retrievalMode: 'lite',
      evidenceCount: 1,
      minEvidenceCount: 2,
      fallbackReason: 'insufficient_evidence',
    });
  });
});
