/**
 * Apply RAG merge plan to knowledge_base.
 *
 * Usage:
 *   npx tsx scripts/rag-merge-apply.ts                  # dry-run (default)
 *   npx tsx scripts/rag-merge-apply.ts --execute        # apply changes
 *   npx tsx scripts/rag-merge-apply.ts --execute --max-items=5
 */

import './_env';
import { createClient } from '@supabase/supabase-js';
import { toVectorString } from '../src/lib/embedding';
import {
  DEFAULT_TARGET_TOTAL_DOCS,
  MERGE_SIMILARITY_THRESHOLD,
} from '../src/lib/rag-doc-policy';
import {
  buildMergePlan,
  type KnowledgeBaseDoc,
} from '../src/lib/rag-merge-planner';
import { embeddingService } from '../src/services/embedding/embedding-service';

type KnowledgeRow = {
  id: string | null;
  title: string | null;
  category: string | null;
  severity: string | null;
  source: string | null;
  content: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  related_server_types: string[] | null;
};

function getEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function getSupabaseEnv() {
  const url = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY');

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return { url, key };
}

function getNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  if (!value) return fallback;
  const parsed = Number(value.slice(prefix.length));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function toKnowledgeDocs(rows: KnowledgeRow[]): KnowledgeBaseDoc[] {
  return rows
    .filter((row) => typeof row.id === 'string' && row.id.length > 0)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title || '').trim(),
      content: String(row.content || '').trim(),
      category: String(row.category || 'unknown').trim(),
      source: String(row.source || 'unknown').trim(),
      severity: String(row.severity || 'info').trim(),
      tags: Array.isArray(row.tags)
        ? row.tags.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0)
        : [],
      related_server_types: Array.isArray(row.related_server_types)
        ? row.related_server_types
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0)
        : [],
      metadata: row.metadata,
    }));
}

async function main() {
  const shouldExecute = hasFlag('--execute');
  const targetTotal = getNumberArg('target-total', DEFAULT_TARGET_TOTAL_DOCS);
  const threshold = getNumberArg('threshold', MERGE_SIMILARITY_THRESHOLD);
  const maxItems = getNumberArg('max-items', 0);

  const { url, key } = getSupabaseEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('knowledge_base')
    .select(
      'id, title, category, severity, source, content, tags, metadata, related_server_types'
    );
  if (error) {
    throw new Error(`knowledge_base fetch failed: ${error.message}`);
  }

  const docs = toKnowledgeDocs((data || []) as KnowledgeRow[]);
  const mergePlan = buildMergePlan(docs, {
    targetTotalDocs: targetTotal,
    similarityThreshold: threshold,
  });
  const selectedItems =
    maxItems > 0 ? mergePlan.items.slice(0, maxItems) : mergePlan.items;

  console.log('=== RAG Merge Apply ===');
  console.log(
    JSON.stringify(
      {
        mode: shouldExecute ? 'execute' : 'dry-run',
        target_total: targetTotal,
        threshold,
        total_docs: mergePlan.summary.totalDocs,
        selected_clusters: selectedItems.length,
        selected_reduction: selectedItems.reduce(
          (sum, item) => sum + item.estimatedReduction,
          0
        ),
      },
      null,
      2
    )
  );

  if (selectedItems.length === 0) {
    console.log('No merge items selected. Nothing to do.');
    return;
  }

  if (!shouldExecute) {
    console.log('\n=== Dry Run Items ===');
    for (const item of selectedItems) {
      console.log(
        JSON.stringify({
          cluster_id: item.clusterId,
          category: item.category,
          keep_id: item.keepId,
          merge_ids: item.mergeIds,
          keep_title: item.keepTitle,
          merge_titles: item.mergeTitles,
          avg_similarity: item.avgSimilarity,
          merged_content_len: item.mergedContent.length,
        })
      );
    }
    console.log('\nDry-run complete. Re-run with --execute to apply.');
    return;
  }

  let appliedClusters = 0;
  let deletedDocs = 0;
  const errors: string[] = [];

  for (const item of selectedItems) {
    const mergedText = `${item.mergedTitle}\n\n${item.mergedContent}`;
    const embeddingResult = await embeddingService.createEmbedding(mergedText);
    if (!embeddingResult.success || !embeddingResult.embedding) {
      errors.push(
        `[${item.clusterId}] embedding generation failed: ${
          embeddingResult.error || 'unknown'
        }`
      );
      continue;
    }

    const updatePayload = {
      title: item.mergedTitle,
      content: item.mergedContent,
      embedding: toVectorString(embeddingResult.embedding),
      category: item.category,
      tags: item.mergedTags,
      severity: item.mergedSeverity,
      source: item.mergedSource,
      related_server_types: item.mergedRelatedServerTypes,
      metadata: item.mergedMetadata,
    };

    const { error: updateError } = await supabase
      .from('knowledge_base')
      .update(updatePayload)
      .eq('id', item.keepId);

    if (updateError) {
      errors.push(`[${item.clusterId}] update failed: ${updateError.message}`);
      continue;
    }

    if (item.mergeIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('knowledge_base')
        .delete()
        .in('id', item.mergeIds);
      if (deleteError) {
        errors.push(`[${item.clusterId}] delete failed: ${deleteError.message}`);
        continue;
      }
      deletedDocs += item.mergeIds.length;
    }

    appliedClusters += 1;
  }

  const { count: remainingCount, error: remainingError } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true });
  if (remainingError) {
    errors.push(`[summary] final count query failed: ${remainingError.message}`);
  }

  console.log('\n=== Apply Summary ===');
  console.log(
    JSON.stringify(
      {
        applied_clusters: appliedClusters,
        requested_clusters: selectedItems.length,
        deleted_docs: deletedDocs,
        remaining_docs: remainingCount ?? null,
        errors: errors.length,
      },
      null,
      2
    )
  );

  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    for (const errorMessage of errors) {
      console.log(errorMessage);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[FATAL] rag-merge-apply failed:', error);
  process.exit(1);
});

