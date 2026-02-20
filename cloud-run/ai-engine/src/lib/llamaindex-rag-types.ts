export interface LlamaIndexSearchResult {
  id: string;
  title: string;
  content: string;
  category?: string;
  score: number;
  sourceType: 'vector' | 'knowledge_graph' | 'graph';
  hopDistance: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeTriplet {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

export interface LlamaIndexStats {
  totalDocuments: number;
  totalTriplets: number;
  lastIndexed: string | null;
}
