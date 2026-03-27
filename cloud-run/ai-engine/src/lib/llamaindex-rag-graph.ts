import type { SupabaseClient } from '@supabase/supabase-js';
import type { LlamaIndexSearchResult } from './llamaindex-rag-types';

export async function traverseAndFetchGraphNodes(
  client: SupabaseClient,
  seedResults: Array<{ id: string }>,
  maxGraphHops: number,
  topN: number = 3
): Promise<LlamaIndexSearchResult[]> {
  const topSeedResults = seedResults.slice(0, topN);
  if (topSeedResults.length === 0) {
    return [];
  }

  const graphTraversalResults = await Promise.all(
    topSeedResults.map((result) =>
      client.rpc('traverse_knowledge_graph', {
        p_start_id: result.id,
        p_start_table: 'knowledge_base',
        p_max_hops: maxGraphHops,
        p_relationship_types: null,
        p_max_results: 5,
      })
    )
  );

  const nodeIds = new Set<string>();
  const nodeMetaMap = new Map<string, { pathWeight: number; hopDistance: number }>();

  for (const { data } of graphTraversalResults) {
    if (data && Array.isArray(data)) {
      for (const node of data) {
        const nodeId = String(node.node_id);
        if (!nodeIds.has(nodeId)) {
          nodeIds.add(nodeId);
          nodeMetaMap.set(nodeId, {
            pathWeight: Number(node.path_weight),
            hopDistance: Number(node.hop_distance || 1),
          });
        }
      }
    }
  }

  if (nodeIds.size === 0) {
    return [];
  }

  const { data: entries } = await client
    .from('knowledge_base')
    .select('id, title, content, category, metadata')
    .in('id', Array.from(nodeIds));

  if (!entries) {
    return [];
  }

  return entries.map((entry) => {
    const meta = nodeMetaMap.get(entry.id);
    return {
      id: entry.id,
      title: entry.title,
      content: entry.content,
      category: entry.category || 'auto',
      score: (meta?.pathWeight ?? 1) * 0.8,
      sourceType: 'graph' as const,
      hopDistance: meta?.hopDistance ?? 1,
      metadata: entry.metadata,
    };
  });
}

export function mergeDeduplicateAndRankResults(
  vectorResults: LlamaIndexSearchResult[],
  graphResults: LlamaIndexSearchResult[],
  maxTotalResults: number
): LlamaIndexSearchResult[] {
  const allResults = [...vectorResults, ...graphResults];
  const seen = new Set<string>();
  const deduplicated = allResults.filter((result) => {
    if (seen.has(result.id)) {
      return false;
    }
    seen.add(result.id);
    return true;
  });

  return deduplicated.sort((left, right) => right.score - left.score).slice(0, maxTotalResults);
}
