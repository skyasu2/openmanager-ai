export type LegacyContractStatus =
  | 'compat-only'
  | 'gone-shim'
  | 'migration-bridge';

export type GraphRuntimeReplacement =
  | 'searchKnowledgeBase'
  | 'Knowledge Retrieval Lite';

export interface LegacyContract {
  id: string;
  status: LegacyContractStatus;
  owner: 'ai-retrieval';
  replacement: string;
  removeAfter: string;
  description: string;
}

export const LEGACY_CONTRACTS = {
  graphRuntimeRoutes: {
    id: 'graph-runtime-routes',
    status: 'gone-shim',
    owner: 'ai-retrieval',
    replacement: 'Knowledge Retrieval Lite',
    removeAfter: '2026-05-31',
    description:
      'Legacy /api/ai/graphrag/* endpoints return 410 with a replacement hint; graph traversal runtime stays removed.',
    endpoints: [
      'POST /api/ai/graphrag/extract',
      'GET /api/ai/graphrag/stats',
      'GET /api/ai/graphrag/related/:nodeId',
    ],
  },
  searchKnowledgeBaseUseGraphRAG: {
    id: 'searchKnowledgeBase.useGraphRAG',
    status: 'compat-only',
    owner: 'ai-retrieval',
    replacement: 'Knowledge Retrieval Lite',
    removeAfter: '2026-05-31',
    description:
      'Deprecated compatibility flag. Lite retrieval ignores graph traversal.',
    inputName: 'useGraphRAG',
  },
  legacyRagSources: {
    id: 'legacy-rag-sources',
    status: 'migration-bridge',
    owner: 'ai-retrieval',
    replacement: 'evidenceCards + metadata.retrieval',
    removeAfter: '2026-06-30',
    description:
      'Legacy ragSources may be read at response boundaries while EvidenceCard remains the canonical retrieval contract.',
  },
} as const satisfies Record<string, LegacyContract & Record<string, unknown>>;

export const GRAPH_RUNTIME_GONE_STATUS = 410;
export const GRAPH_RUNTIME_GONE_MESSAGE =
  'Legacy graph retrieval runtime was removed. Use Knowledge Retrieval Lite instead.';

export function buildGraphRuntimeGonePayload(
  replacement: GraphRuntimeReplacement = 'searchKnowledgeBase'
) {
  return {
    error: 'gone',
    message: GRAPH_RUNTIME_GONE_MESSAGE,
    replacement,
    retrievalMode: 'lite',
    deprecated: true,
  };
}

function isPastRemoveAfter(removeAfter: string, asOf: Date): boolean {
  const nextDayUtc = new Date(`${removeAfter}T00:00:00Z`);
  nextDayUtc.setUTCDate(nextDayUtc.getUTCDate() + 1);
  return asOf >= nextDayUtc;
}

export function getExpiredLegacyContracts(asOf: Date = new Date()) {
  return Object.values(LEGACY_CONTRACTS).filter((contract) =>
    isPastRemoveAfter(contract.removeAfter, asOf)
  );
}
