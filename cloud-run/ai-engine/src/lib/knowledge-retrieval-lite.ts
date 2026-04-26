import type { EvidenceCard, RetrievalMetadata } from './retrieval-contract';

export interface KnowledgeRetrievalLiteInput {
  query: string;
  category?: string;
  severity?: string;
  limit?: number;
  context?: Record<string, string | undefined>;
}

export interface KnowledgeRetrievalLiteResult {
  success: boolean;
  evidenceCards: EvidenceCard[];
  totalFound: number;
  metadata: RetrievalMetadata;
  _source: string;
  error?: string;
}

export interface KnowledgeRetrievalLiteDependencies {
  client?: {
    rpc: (
      fn: string,
      params: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>;
  };
}

export async function retrieveKnowledgeEvidence(
  _input: KnowledgeRetrievalLiteInput,
  _deps: KnowledgeRetrievalLiteDependencies = {}
): Promise<KnowledgeRetrievalLiteResult> {
  throw new Error('Knowledge Retrieval Lite is not implemented yet');
}
