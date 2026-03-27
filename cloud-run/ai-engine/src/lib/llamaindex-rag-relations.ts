import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';
import type { KnowledgeTriplet } from './llamaindex-rag-types';

export interface ExtractionResult {
  entryId: string;
  relationships: KnowledgeTriplet[];
}

export async function extractRelationshipsFromKnowledgeBase(
  client: SupabaseClient,
  extractTriplets: (text: string, maxTriplets?: number) => Promise<KnowledgeTriplet[]>,
  options: {
    batchSize?: number;
    onlyUnprocessed?: boolean;
  } = {}
): Promise<ExtractionResult[]> {
  const { batchSize = 50, onlyUnprocessed = true } = options;

  try {
    let query = client.from('knowledge_base').select('id, content, metadata').limit(batchSize);

    if (onlyUnprocessed) {
      query = query.or('metadata->indexed_by.is.null,metadata->triplets.is.null');
    }

    const { data: entries, error } = await query;

    if (error) {
      throw error;
    }
    if (!entries || entries.length === 0) {
      logger.info('[LlamaIndex] No unprocessed entries found');
      return [];
    }

    const results: ExtractionResult[] = [];

    for (const entry of entries) {
      const triplets = await extractTriplets(entry.content, 5);

      if (triplets.length > 0) {
        await client
          .from('knowledge_base')
          .update({
            metadata: {
              ...entry.metadata,
              triplets,
              indexed_by: 'llamaindex',
              indexed_at: new Date().toISOString(),
            },
          })
          .eq('id', entry.id);

        results.push({
          entryId: entry.id,
          relationships: triplets,
        });
      }
    }

    logger.info(`[LlamaIndex] Extracted relationships from ${results.length} entries`);
    return results;
  } catch (error) {
    logger.error('[LlamaIndex] Relationship extraction failed:', error);
    return [];
  }
}

export async function fetchRelatedKnowledgeFromGraph(
  client: SupabaseClient,
  nodeId: string,
  options: { maxHops?: number; maxResults?: number } = {}
): Promise<
  Array<{
    id: string;
    title: string;
    content: string;
    hopDistance: number;
    pathWeight: number;
    relationshipPath: string[];
  }>
> {
  const { maxHops = 2, maxResults = 10 } = options;

  try {
    const { data } = await client.rpc('traverse_knowledge_graph', {
      p_start_id: nodeId,
      p_start_table: 'knowledge_base',
      p_max_hops: maxHops,
      p_relationship_types: null,
      p_max_results: maxResults,
    });

    if (!data) {
      return [];
    }

    const nodeIds = data.map((row: Record<string, unknown>) => row.node_id);
    const { data: entries } = await client
      .from('knowledge_base')
      .select('id, title, content')
      .in('id', nodeIds);

    const entryMap = new Map((entries || []).map((entry) => [entry.id, entry]));

    return data.map((row: Record<string, unknown>) => {
      const entry = entryMap.get(row.node_id as string);
      return {
        id: String(row.node_id),
        title: entry?.title || '',
        content: entry?.content || '',
        hopDistance: Number(row.hop_distance),
        pathWeight: Number(row.path_weight),
        relationshipPath: (row.relationship_path as string[]) || [],
      };
    });
  } catch (error) {
    logger.error('[LlamaIndex] Related knowledge fetch error:', error);
    return [];
  }
}
