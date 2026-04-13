export interface GraphRAGSearchResult {
  id: string;
  title: string;
  content: string;
  category?: string;
  score: number;
  sourceType: 'vector' | 'knowledge_graph' | 'graph';
  hopDistance: number;
  metadata?: Record<string, unknown>;
}

export interface GraphRAGStats {
  totalDocuments: number;
  totalTriplets: number;
  totalExtractionEdges: number;
  lastIndexed: string | null;
}
