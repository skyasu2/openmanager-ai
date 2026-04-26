import { describe, expect, it } from 'vitest';

import {
  buildGraphRuntimeGonePayload,
  getExpiredLegacyContracts,
  GRAPH_RUNTIME_GONE_STATUS,
  LEGACY_CONTRACTS,
} from './legacy-contracts';

describe('legacy compatibility contracts', () => {
  it('keeps GraphRAG endpoints as explicit gone shims, not runtime routes', () => {
    expect(LEGACY_CONTRACTS.graphRuntimeRoutes).toMatchObject({
      status: 'gone-shim',
      replacement: 'Knowledge Retrieval Lite',
      removeAfter: '2026-05-31',
    });
    expect(LEGACY_CONTRACTS.graphRuntimeRoutes.endpoints).toEqual([
      'POST /api/ai/graphrag/extract',
      'GET /api/ai/graphrag/stats',
      'GET /api/ai/graphrag/related/:nodeId',
    ]);
    expect(GRAPH_RUNTIME_GONE_STATUS).toBe(410);
    expect(buildGraphRuntimeGonePayload()).toMatchObject({
      error: 'gone',
      replacement: 'searchKnowledgeBase',
      retrievalMode: 'lite',
      deprecated: true,
    });
  });

  it('keeps useGraphRAG as input compatibility only', () => {
    expect(LEGACY_CONTRACTS.searchKnowledgeBaseUseGraphRAG).toMatchObject({
      status: 'compat-only',
      inputName: 'useGraphRAG',
      replacement: 'Knowledge Retrieval Lite',
    });
  });

  it('reports expired legacy contracts from a controlled date', () => {
    expect(getExpiredLegacyContracts(new Date('2026-04-26T00:00:00Z'))).toEqual(
      []
    );
    expect(
      getExpiredLegacyContracts(new Date('2026-06-01T00:00:00Z')).map(
        (contract) => contract.id
      )
    ).toEqual(['graph-runtime-routes', 'searchKnowledgeBase.useGraphRAG']);
  });
});
