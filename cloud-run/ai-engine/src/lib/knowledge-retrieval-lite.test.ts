import { describe, expect, it, vi } from 'vitest';

import {
  retrieveKnowledgeEvidence,
  type KnowledgeRetrievalLiteDependencies,
} from './knowledge-retrieval-lite';

function createClient(
  rpc: ReturnType<typeof vi.fn>
): NonNullable<KnowledgeRetrievalLiteDependencies['client']> {
  return { rpc };
}

describe('retrieveKnowledgeEvidence', () => {
  it('uses BM25 text search and metadata boosts without embedding or graph RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'kb-generic-db',
          title: 'PostgreSQL generic overload note',
          content: 'Generic DB overload troubleshooting notes',
          category: 'incident',
          tags: ['postgres', 'database'],
          text_rank: 0.44,
          metadata: { serverRole: 'database', docType: 'incident' },
        },
        {
          id: 'kb-cache-runbook',
          title: 'Redis OOM runbook',
          content: 'Redis cache memory pressure runbook for cache-01',
          category: 'troubleshooting',
          tags: ['redis', 'cache', 'cache-01', 'oom'],
          text_rank: 0.35,
          severity: 'critical',
          metadata: {
            serverRole: 'cache',
            serverId: 'cache-01',
            docType: 'runbook',
          },
        },
      ],
      error: null,
    });

    const result = await retrieveKnowledgeEvidence(
      {
        query: 'Redis OOM cache-01 장애 원인',
        category: 'incident',
        severity: 'critical',
        limit: 5,
        context: {
          serverRole: 'cache',
          serverId: 'cache-01',
        },
      },
      { client: createClient(rpc) }
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('search_knowledge_text', {
      p_query_text: 'Redis OOM cache-01 장애 원인',
      p_max_results: 10,
      p_filter_category: 'incident',
    });
    expect(result).toMatchObject({
      success: true,
      _source: 'Knowledge Retrieval Lite',
      totalFound: 2,
      metadata: {
        retrievalEnabled: true,
        retrievalUsed: true,
        retrievalMode: 'lite',
        evidenceCount: 2,
        webUsed: false,
      },
    });
    expect(result.evidenceCards[0]).toMatchObject({
      id: 'kb-cache-runbook',
      title: 'Redis OOM runbook',
      sourceType: 'runbook',
      category: 'troubleshooting',
    });
    expect(result.evidenceCards[0]?.score).toBeGreaterThan(
      result.evidenceCards[1]?.score ?? 0
    );
    expect(result.evidenceCards[0]?.reason).toContain('metadata-boost');
  });

  it('returns explicit no-results metadata when the text RPC returns no rows', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    const result = await retrieveKnowledgeEvidence(
      { query: '없는 런북', limit: 5 },
      { client: createClient(rpc) }
    );

    expect(result).toMatchObject({
      success: true,
      evidenceCards: [],
      totalFound: 0,
      _source: 'Knowledge Retrieval Lite (No Results)',
      metadata: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        suppressedReason: 'no_results',
        evidenceCount: 0,
        webUsed: false,
      },
    });
  });

  it('returns unavailable metadata instead of falling back to external AI providers', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'function search_knowledge_text unavailable' },
    });

    const result = await retrieveKnowledgeEvidence(
      { query: 'Redis 장애 대응', limit: 5 },
      { client: createClient(rpc) }
    );

    expect(result).toMatchObject({
      success: false,
      evidenceCards: [],
      totalFound: 0,
      _source: 'Knowledge Retrieval Lite (Unavailable)',
      metadata: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        suppressedReason: 'unavailable',
        evidenceCount: 0,
        webUsed: false,
      },
      error: 'function search_knowledge_text unavailable',
    });
  });
});
