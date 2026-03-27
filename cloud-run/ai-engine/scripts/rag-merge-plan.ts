/**
 * Build RAG merge plan from knowledge_base.
 *
 * Usage:
 *   npx tsx scripts/rag-merge-plan.ts
 *   npx tsx scripts/rag-merge-plan.ts --target-total=42 --threshold=0.82
 *   npx tsx scripts/rag-merge-plan.ts --json
 */

import './_env';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_TARGET_TOTAL_DOCS,
  MERGE_SIMILARITY_THRESHOLD,
} from '../src/lib/rag-doc-policy';
import {
  buildMergePlan,
  type KnowledgeBaseDoc,
} from '../src/lib/rag-merge-planner';

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
  const asJson = hasFlag('--json');
  const targetTotal = getNumberArg('target-total', DEFAULT_TARGET_TOTAL_DOCS);
  const threshold = getNumberArg('threshold', MERGE_SIMILARITY_THRESHOLD);
  const maxItems = getNumberArg('max-items', 25);

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

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          config: {
            targetTotal,
            threshold,
            maxItems,
          },
          ...mergePlan,
        },
        null,
        2
      )
    );
    return;
  }

  console.log('=== RAG Merge Plan ===');
  console.log(
    JSON.stringify(
      {
        target_total: targetTotal,
        threshold,
        total_docs: mergePlan.summary.totalDocs,
        needed_reduction: mergePlan.summary.neededReduction,
        candidate_clusters: mergePlan.summary.candidateClusters,
        selected_clusters: mergePlan.summary.selectedClusters,
        selected_reduction: mergePlan.summary.selectedReduction,
        estimated_total_after_merge: mergePlan.summary.estimatedTotalAfterMerge,
        coverage_guard_ok: mergePlan.summary.coverageGuardOk,
      },
      null,
      2
    )
  );

  console.log('\n=== Selected Merge Items ===');
  if (mergePlan.items.length === 0) {
    console.log('(no selected items)');
  } else {
    const rows = mergePlan.items.slice(0, maxItems).map((item) => ({
      cluster_id: item.clusterId,
      category: item.category,
      avg_similarity: item.avgSimilarity,
      keep_title: item.keepTitle,
      merge_titles: item.mergeTitles,
      estimated_reduction: item.estimatedReduction,
      merged_content_len: item.mergedContent.length,
    }));
    for (const row of rows) {
      console.log(JSON.stringify(row));
    }
  }

  if (mergePlan.skippedClusters.length > 0) {
    console.log('\n=== Skipped Clusters ===');
    for (const skipped of mergePlan.skippedClusters.slice(0, maxItems)) {
      console.log(JSON.stringify(skipped));
    }
  }
}

main().catch((error) => {
  console.error('[FATAL] rag-merge-plan failed:', error);
  process.exit(1);
});

