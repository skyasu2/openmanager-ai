export interface SupabaseClientLike {
  rpc: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}

export interface RAGResultItem {
  id: string;
  title: string;
  content: string;
  category: string;
  similarity: number;
  sourceType: 'vector' | 'graph' | 'web' | 'fallback';
  hopDistance: number;
  url?: string;
}

export interface CommandRecommendation {
  command: string;
  description: string;
  keywords: string[];
}

export type ToolSeverityFilter =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'info'
  | 'warning';
