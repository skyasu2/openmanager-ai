/**
 * Analyze GraphRAG coverage and triplet-only hotspots in knowledge_base.
 *
 * Usage:
 *   npx tsx scripts/analyze-graphrag-coverage.ts
 *   npx tsx scripts/analyze-graphrag-coverage.ts --json
 *   npx tsx scripts/analyze-graphrag-coverage.ts --limit=10
 *
 * Notes:
 * - Automatically loads ENV_FILE, .env.local, .env (near scripts/cwd)
 * - Supabase credentials still required via env values
 */

import './_env';
import { createClient } from '@supabase/supabase-js';

type KnowledgeRow = {
  id: string | null;
  title: string | null;
  category: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

type RelationshipRow = {
  source_id: string | null;
  metadata: Record<string, unknown> | null;
};

const GRAPHRAG_EXTRACTION_SOURCES = new Set([
  'llamaindex-triplets',
  'title-anchor-fallback',
]);

type CoverageStatus =
  | 'materialized'
  | 'triplet_only'
  | 'indexed_no_triplets'
  | 'unprocessed'
  | 'edge_without_index';

type DocCoverage = {
  id: string;
  title: string;
  category: string;
  source: string;
  indexedBy: string;
  tripletCount: number;
  graphEdgeCount: number;
  metadataActionCount: number;
  metadataInsertCount: number;
  metadataUpdateCount: number;
  status: CoverageStatus;
};

type ActionDeltaKind =
  | 'aligned'
  | 'graph_exceeds_metadata_actions'
  | 'metadata_actions_exceed_graph'
  | 'no_signal';

type SummaryRecord = Record<string, unknown>;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseArgs(argv: string[]) {
  let json = false;
  let limit = 15;

  for (const arg of argv) {
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      limit = Math.max(1, Number.parseInt(arg.slice('--limit='.length), 10) || 15);
    }
  }

  return { json, limit };
}

function countBy<T>(items: T[], getKey: (item: T) => string): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.key.localeCompare(right.key);
    });
}

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function classifyDoc(row: KnowledgeRow, graphEdgeCount: number): DocCoverage {
  const metadata = asRecord(row.metadata);
  const indexedBy = typeof metadata?.indexed_by === 'string' ? metadata.indexed_by : '';
  const tripletCount = asArray(metadata?.triplets).length;
  const metadataActionCount = asNumber(metadata?.materialized_relationships);
  const metadataInsertCount = asNumber(metadata?.materialized_relationship_inserts);
  const metadataUpdateCount = asNumber(metadata?.materialized_relationship_updates);

  let status: CoverageStatus = 'unprocessed';
  if (graphEdgeCount > 0 && indexedBy !== 'llamaindex') {
    status = 'edge_without_index';
  } else if (indexedBy === 'llamaindex' && graphEdgeCount > 0) {
    status = 'materialized';
  } else if (indexedBy === 'llamaindex' && tripletCount > 0) {
    status = 'triplet_only';
  } else if (indexedBy === 'llamaindex') {
    status = 'indexed_no_triplets';
  }

  return {
    id: String(row.id || ''),
    title: String(row.title || '').trim(),
    category: String(row.category || 'unknown').trim(),
    source: String(row.source || 'unknown').trim(),
    indexedBy,
    tripletCount,
    graphEdgeCount,
    metadataActionCount,
    metadataInsertCount,
    metadataUpdateCount,
    status,
  };
}

function getActionDeltaKind(doc: DocCoverage): ActionDeltaKind {
  if (doc.graphEdgeCount === doc.metadataActionCount) {
    return 'aligned';
  }

  if (doc.graphEdgeCount === 0 && doc.metadataActionCount === 0) {
    return 'no_signal';
  }

  if (doc.graphEdgeCount > doc.metadataActionCount) {
    return 'graph_exceeds_metadata_actions';
  }

  return 'metadata_actions_exceed_graph';
}

function describeActionDelta(kind: ActionDeltaKind): string {
  switch (kind) {
    case 'aligned':
      return 'metadata action count matches current live extraction edge count';
    case 'graph_exceeds_metadata_actions':
      return 'live graph has more extraction edges than this doc metadata recorded; reverse-direction inserts or external updates can cause this';
    case 'metadata_actions_exceed_graph':
      return 'doc metadata recorded more materialization actions than the current live outgoing extraction edges; cleanup, dedupe, or bidirectional writes can cause this';
    case 'no_signal':
    default:
      return 'no extraction action or live graph edge recorded';
  }
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printRows(rows: SummaryRecord[]) {
  if (!rows.length) {
    console.log('(no rows)');
    return;
  }
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}

async function main() {
  const { json, limit } = parseArgs(process.argv.slice(2));
  const { url, key } = getSupabaseEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [{ data: knowledgeData, error: knowledgeError }, { data: relationshipData, error: relationshipError }] =
    await Promise.all([
      supabase.from('knowledge_base').select('id, title, category, source, metadata').order('title'),
      supabase
        .from('knowledge_relationships')
        .select('source_id, metadata')
        .eq('source_table', 'knowledge_base')
        .eq('target_table', 'knowledge_base'),
    ]);

  if (knowledgeError) {
    throw new Error(`knowledge_base fetch failed: ${knowledgeError.message}`);
  }
  if (relationshipError) {
    throw new Error(`knowledge_relationships fetch failed: ${relationshipError.message}`);
  }

  const knowledgeRows = Array.isArray(knowledgeData) ? (knowledgeData as KnowledgeRow[]) : [];
  const relationshipRows = Array.isArray(relationshipData)
    ? (relationshipData as RelationshipRow[])
    : [];

  const graphEdgeCountBySourceId = new Map<string, number>();
  for (const row of relationshipRows) {
    const sourceId = typeof row.source_id === 'string' ? row.source_id : '';
    const metadata = asRecord(row.metadata);
    if (
      !sourceId ||
      !GRAPHRAG_EXTRACTION_SOURCES.has(String(metadata?.extraction_source || ''))
    ) {
      continue;
    }
    graphEdgeCountBySourceId.set(sourceId, (graphEdgeCountBySourceId.get(sourceId) || 0) + 1);
  }

  const docs = knowledgeRows.map((row) =>
    classifyDoc(row, graphEdgeCountBySourceId.get(String(row.id || '')) || 0)
  );

  const indexedDocs = docs.filter((doc) => doc.indexedBy === 'llamaindex');
  const materializedDocs = docs.filter((doc) => doc.status === 'materialized');
  const tripletOnlyDocs = docs.filter((doc) => doc.status === 'triplet_only');
  const indexedNoTripletsDocs = docs.filter((doc) => doc.status === 'indexed_no_triplets');
  const unprocessedDocs = docs.filter((doc) => doc.status === 'unprocessed');
  const edgeWithoutIndexDocs = docs.filter((doc) => doc.status === 'edge_without_index');
  const docsWithTriplets = docs.filter((doc) => doc.tripletCount > 0);
  const metadataActionDeltaDocs = docs.filter((doc) => {
    const kind = getActionDeltaKind(doc);
    return kind !== 'aligned' && kind !== 'no_signal';
  });

  const categoryHotspots = countBy(tripletOnlyDocs, (doc) => doc.category).map(({ key, count }) => ({
    category: key,
    count,
  }));
  const sourceHotspots = countBy(tripletOnlyDocs, (doc) => doc.source).map(({ key, count }) => ({
    source: key,
    count,
  }));
  const statusSummary = countBy(docs, (doc) => doc.status).map(({ key, count }) => ({
    status: key,
    count,
  }));

  const topTripletOnlyDocs = [...tripletOnlyDocs]
    .sort((left, right) => {
      if (right.tripletCount !== left.tripletCount) {
        return right.tripletCount - left.tripletCount;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, limit)
    .map((doc) => ({
      title: doc.title,
      category: doc.category,
      source: doc.source,
      tripletCount: doc.tripletCount,
      graphEdgeCount: doc.graphEdgeCount,
      metadataActionCount: doc.metadataActionCount,
    }));

  const topMaterializedDocs = [...materializedDocs]
    .sort((left, right) => {
      if (right.graphEdgeCount !== left.graphEdgeCount) {
        return right.graphEdgeCount - left.graphEdgeCount;
      }
      if (right.tripletCount !== left.tripletCount) {
        return right.tripletCount - left.tripletCount;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, limit)
    .map((doc) => ({
      title: doc.title,
      category: doc.category,
      source: doc.source,
      tripletCount: doc.tripletCount,
      graphEdgeCount: doc.graphEdgeCount,
      metadataActionCount: doc.metadataActionCount,
    }));

  const metadataActionDeltas = metadataActionDeltaDocs
    .sort((left, right) => {
      const leftDelta = Math.abs(left.graphEdgeCount - left.metadataActionCount);
      const rightDelta = Math.abs(right.graphEdgeCount - right.metadataActionCount);
      if (rightDelta !== leftDelta) return rightDelta - leftDelta;
      return left.title.localeCompare(right.title);
    })
    .slice(0, limit)
    .map((doc) => ({
      title: doc.title,
      indexedBy: doc.indexedBy || 'none',
      graphEdgeCount: doc.graphEdgeCount,
      metadataActionCount: doc.metadataActionCount,
      metadataInsertCount: doc.metadataInsertCount,
      metadataUpdateCount: doc.metadataUpdateCount,
      tripletCount: doc.tripletCount,
      deltaKind: getActionDeltaKind(doc),
      explanation: describeActionDelta(getActionDeltaKind(doc)),
    }));

  const summary = {
    semantics: {
      metadataActionCount:
        'knowledge_base.metadata.materialized_relationships is the number of materialization actions recorded when this document was processed, not an authoritative live outgoing edge count.',
      graphEdgeCount:
        'Current live outgoing knowledge_relationships rows for extraction-generated edges only.',
    },
    totals: {
      totalDocs: docs.length,
      indexedDocs: indexedDocs.length,
      materializedDocs: materializedDocs.length,
      tripletOnlyDocs: tripletOnlyDocs.length,
      indexedNoTripletsDocs: indexedNoTripletsDocs.length,
      unprocessedDocs: unprocessedDocs.length,
      edgeWithoutIndexDocs: edgeWithoutIndexDocs.length,
      graphEdgesFromExtraction: relationshipRows.filter((row) => {
        const metadata = asRecord(row.metadata);
        return GRAPHRAG_EXTRACTION_SOURCES.has(String(metadata?.extraction_source || ''));
      }).length,
    },
    coverage: {
      materializedPctOfTotal: toPercent(materializedDocs.length, docs.length),
      materializedPctOfIndexed: toPercent(materializedDocs.length, indexedDocs.length),
      tripletOnlyPctOfIndexed: toPercent(tripletOnlyDocs.length, indexedDocs.length),
      tripletOnlyPctOfTripletDocs: toPercent(tripletOnlyDocs.length, docsWithTriplets.length),
      unprocessedPctOfTotal: toPercent(unprocessedDocs.length, docs.length),
      avgTripletsPerIndexedDoc: indexedDocs.length
        ? Number(
            (
              indexedDocs.reduce((sum, doc) => sum + doc.tripletCount, 0) / indexedDocs.length
            ).toFixed(2)
          )
        : 0,
      avgEdgesPerMaterializedDoc: materializedDocs.length
        ? Number(
            (
              materializedDocs.reduce((sum, doc) => sum + doc.graphEdgeCount, 0) /
              materializedDocs.length
            ).toFixed(2)
          )
        : 0,
    },
    hotspots: {
      tripletOnlyByCategory: categoryHotspots,
      tripletOnlyBySource: sourceHotspots,
    },
    statusSummary,
    topTripletOnlyDocs,
    topMaterializedDocs,
    metadataActionDeltas,
  };

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  printSection('Coverage Summary');
  printRows([
    {
      total_docs: summary.totals.totalDocs,
      indexed_docs: summary.totals.indexedDocs,
      materialized_docs: summary.totals.materializedDocs,
      triplet_only_docs: summary.totals.tripletOnlyDocs,
      indexed_no_triplets_docs: summary.totals.indexedNoTripletsDocs,
      unprocessed_docs: summary.totals.unprocessedDocs,
      edge_without_index_docs: summary.totals.edgeWithoutIndexDocs,
      graph_edges_from_extraction: summary.totals.graphEdgesFromExtraction,
    },
    {
      materialized_pct_of_total: `${summary.coverage.materializedPctOfTotal}%`,
      materialized_pct_of_indexed: `${summary.coverage.materializedPctOfIndexed}%`,
      triplet_only_pct_of_indexed: `${summary.coverage.tripletOnlyPctOfIndexed}%`,
      triplet_only_pct_of_triplet_docs: `${summary.coverage.tripletOnlyPctOfTripletDocs}%`,
      unprocessed_pct_of_total: `${summary.coverage.unprocessedPctOfTotal}%`,
      avg_triplets_per_indexed_doc: summary.coverage.avgTripletsPerIndexedDoc,
      avg_edges_per_materialized_doc: summary.coverage.avgEdgesPerMaterializedDoc,
    },
  ]);

  printSection('Status Breakdown');
  printRows(summary.statusSummary);

  printSection('Triplet-only Hotspots By Category');
  printRows(summary.hotspots.tripletOnlyByCategory);

  printSection('Triplet-only Hotspots By Source');
  printRows(summary.hotspots.tripletOnlyBySource);

  printSection(`Top Triplet-only Docs (limit=${limit})`);
  printRows(summary.topTripletOnlyDocs);

  printSection(`Top Materialized Docs (limit=${limit})`);
  printRows(summary.topMaterializedDocs);

  printSection('Semantics');
  printRows([summary.semantics]);

  printSection(`Metadata Action Deltas (limit=${limit})`);
  printRows(summary.metadataActionDeltas);
}

main().catch((error) => {
  console.error('[analyze-graphrag-coverage] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
