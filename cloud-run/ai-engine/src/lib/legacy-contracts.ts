export type LegacyContractStatus =
  | 'compat-only'
  | 'migration-bridge';

export interface LegacyContract {
  id: string;
  status: LegacyContractStatus;
  owner: 'ai-retrieval';
  replacement: string;
  removeAfter: string;
  description: string;
}

export const LEGACY_CONTRACTS = {
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
