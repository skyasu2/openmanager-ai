export interface SupabaseClientLike {
  rpc: (
    fn: string,
    params: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>;
}

export interface RAGResultItem {
  id: string;
  title: string;
  content: string;
  category: string;
  similarity: number;
  sourceType:
    | 'vector'
    | 'graph'
    | 'web'
    | 'fallback'
    | 'knowledge'
    | 'incident'
    | 'runbook';
  hopDistance: number;
  url?: string;
}

export type CommandSafety = 'read-only' | 'requires-approval' | 'mutating';
export type OperationalRisk = 'low' | 'medium' | 'high';
export type DiagnosticMetric = 'cpu' | 'memory' | 'disk' | 'network' | 'status';

export interface CommandRecommendation {
  command: string;
  description: string;
  keywords: string[];
  safety?: CommandSafety;
  operationalRisk?: OperationalRisk;
  category?: string;
  metric?: DiagnosticMetric;
  service?: string;
}

export type ToolSeverityFilter =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'info'
  | 'warning';
