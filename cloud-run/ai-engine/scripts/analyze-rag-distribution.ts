/**
 * Analyze RAG knowledge_base distribution for monitoring assistant quality.
 *
 * Usage:
 *   npx tsx scripts/analyze-rag-distribution.ts
 *
 * Notes:
 * - Automatically loads ENV_FILE, .env.local, .env (near scripts/cwd)
 * - Supabase credentials still required via env values
 */

import './_env';
import { createClient } from '@supabase/supabase-js';
import {
  HARD_DOC_CHAR_MAX,
  TARGET_DOC_CHAR_MAX,
  TARGET_DOC_CHAR_MIN,
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

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printRows(rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    console.log('(no rows)');
    return;
  }
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}

function classifyLegacyLength(length: number): string {
  if (length < 120) return 'lt_120';
  if (length < 300) return '120_299';
  if (length < 800) return '300_799';
  if (length < 1500) return '800_1499';
  return 'ge_1500';
}

function classifyTargetLength(length: number): string {
  if (length < TARGET_DOC_CHAR_MIN) return 'below_target';
  if (length <= TARGET_DOC_CHAR_MAX) return 'target_band';
  if (length <= HARD_DOC_CHAR_MAX) return 'near_limit';
  return 'over_limit';
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

  const rawRows = Array.isArray(data) ? (data as KnowledgeRow[]) : [];
  const rows = toKnowledgeDocs(rawRows);
  const mergePlan = buildMergePlan(rows);

  printSection('Source x Category');
  const sourceCategoryMap = new Map<string, number>();
  for (const row of rows) {
    const source = row.source || 'unknown';
    const category = row.category || 'unknown';
    const key = `${source}|||${category}`;
    sourceCategoryMap.set(key, (sourceCategoryMap.get(key) || 0) + 1);
  }
  printRows(
    Array.from(sourceCategoryMap.entries())
      .map(([key, cnt]) => {
        const [source, category] = key.split('|||');
        return { source, category, cnt };
      })
      .sort((a, b) => Number(b.cnt) - Number(a.cnt))
  );

  printSection('Severity Distribution');
  const severityMap = new Map<string, number>();
  for (const row of rows) {
    const source = row.source || 'unknown';
    const category = row.category || 'unknown';
    const severity = row.severity || 'unknown';
    const key = `${source}|||${category}|||${severity}`;
    severityMap.set(key, (severityMap.get(key) || 0) + 1);
  }
  printRows(
    Array.from(severityMap.entries())
      .map(([key, cnt]) => {
        const [source, category, severity] = key.split('|||');
        return { source, category, severity, cnt };
      })
      .sort((a, b) => {
        if (a.source !== b.source) return a.source.localeCompare(b.source);
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.severity.localeCompare(b.severity);
      })
  );

  printSection('Length Distribution (Target)');
  const targetLengthMap = new Map<string, number>();
  for (const row of rows) {
    const bucket = classifyTargetLength(row.content.length);
    targetLengthMap.set(bucket, (targetLengthMap.get(bucket) || 0) + 1);
  }
  printRows(
    Array.from(targetLengthMap.entries())
      .map(([bucket, cnt]) => ({ bucket, cnt }))
      .sort((a, b) => Number(b.cnt) - Number(a.cnt))
  );

  printSection('Length Distribution (Legacy Buckets)');
  const legacyLengthMap = new Map<string, number>();
  for (const row of rows) {
    const bucket = classifyLegacyLength(row.content.length);
    legacyLengthMap.set(bucket, (legacyLengthMap.get(bucket) || 0) + 1);
  }
  printRows(
    Array.from(legacyLengthMap.entries())
      .map(([bucket, cnt]) => ({ bucket, cnt }))
      .sort((a, b) => Number(b.cnt) - Number(a.cnt))
  );

  printSection('Potentially Short Command Docs');
  const commandRows = rows.filter(
    (row) => row.category === 'command' && row.source === 'command_vectors_migration'
  );
  const shortCommandRows = commandRows
    .filter((row) => row.content.length < 120)
    .map((row) => ({
      title: row.title,
      source: row.source,
      category: row.category,
      content_len: row.content.length,
    }))
    .sort((a, b) => Number(a.content_len) - Number(b.content_len))
    .slice(0, 30);
  printRows(shortCommandRows);

  printSection('Command Length Stats');
  const commandLengths = commandRows.map((row) => row.content.length);
  const totalCommandDocs = commandLengths.length;
  const shortLt120 = commandLengths.filter((len) => len < 120).length;
  const shortLt180 = commandLengths.filter((len) => len < 180).length;
  const avgLength = totalCommandDocs
    ? Math.round(commandLengths.reduce((acc, len) => acc + len, 0) / totalCommandDocs)
    : 0;
  printRows([
    {
      total_command_docs: totalCommandDocs,
      avg_content_len: avgLength,
      short_lt_120: shortLt120,
      short_lt_180: shortLt180,
    },
  ]);

  printSection('Duplicate Titles');
  const duplicateMap = new Map<string, number>();
  for (const row of rows) {
    const title = row.title.trim().toLowerCase().replace(/\s+/g, ' ');
    const category = row.category || 'unknown';
    const source = row.source || 'unknown';
    const key = `${category}|||${source}|||${title}`;
    duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
  }
  printRows(
    Array.from(duplicateMap.entries())
      .filter(([, cnt]) => cnt > 1)
      .map(([key, dup_count]) => {
        const [category, source, normalized_title] = key.split('|||');
        return { category, source, normalized_title, dup_count };
      })
      .sort((a, b) => Number(b.dup_count) - Number(a.dup_count))
  );

  printSection('Destructive Command Flags');
  printRows(
    rows
      .filter(
        (row) =>
          row.category === 'command' &&
          ['docker system prune'].includes(row.title.trim().toLowerCase())
      )
      .map((row) => ({
        title: row.title,
        tags: row.tags || [],
        risk_level:
          row.metadata && typeof row.metadata.risk_level === 'string'
            ? row.metadata.risk_level
            : null,
        requires_confirmation:
          row.metadata && typeof row.metadata.requires_confirmation !== 'undefined'
            ? String(row.metadata.requires_confirmation)
            : null,
      }))
  );

  printSection('Merge Candidate Summary');
  printRows([
    {
      total_docs: mergePlan.summary.totalDocs,
      target_total_docs: mergePlan.summary.targetTotalDocs,
      needed_reduction: mergePlan.summary.neededReduction,
      candidate_clusters: mergePlan.summary.candidateClusters,
      selected_clusters: mergePlan.summary.selectedClusters,
      selected_reduction: mergePlan.summary.selectedReduction,
      estimated_total_after_merge: mergePlan.summary.estimatedTotalAfterMerge,
      coverage_guard_ok: mergePlan.summary.coverageGuardOk,
    },
  ]);

  printSection('Top Merge Candidates');
  printRows(
    mergePlan.candidates.slice(0, 20).map((candidate) => ({
      cluster_id: candidate.clusterId,
      category: candidate.category,
      avg_similarity: candidate.avgSimilarity,
      keep_title: candidate.keepTitle,
      merge_titles: candidate.mergeTitles,
      estimated_reduction: candidate.estimatedReduction,
      merged_content_len: candidate.mergedContent.length,
    }))
  );

  printSection('Coverage Guard');
  const categories = new Set([
    ...Object.keys(mergePlan.summary.categoryCountsBefore),
    ...Object.keys(mergePlan.summary.categoryCountsAfter),
  ]);
  printRows(
    Array.from(categories)
      .sort()
      .map((category) => ({
        category,
        before: mergePlan.summary.categoryCountsBefore[category] || 0,
        after: mergePlan.summary.categoryCountsAfter[category] || 0,
      }))
  );

  printSection('Summary');
  console.log(`total_docs=${rows.length}`);
  console.log(
    `target_length_band=${TARGET_DOC_CHAR_MIN}-${TARGET_DOC_CHAR_MAX}, hard_limit=${HARD_DOC_CHAR_MAX}`
  );
  console.log(
    'Review command ratio, merge candidates, and coverage guard before applying RAG merge.'
  );
}

main().catch((error) => {
  console.error('[FATAL] analyze-rag-distribution failed:', error);
  process.exit(1);
});

