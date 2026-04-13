import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';
import type { KnowledgeTriplet } from './graphrag-types';

type KnowledgeRelationshipType =
  | 'causes'
  | 'solves'
  | 'related_to'
  | 'prerequisite'
  | 'part_of'
  | 'similar_to'
  | 'contradicts'
  | 'follows'
  | 'depends_on';

type KnowledgeBaseRow = {
  id: string;
  title: string;
  category?: string;
  content: string;
  metadata?: Record<string, unknown> | null;
};

type RelationshipRow = {
  id: string;
};

type PlannedRelationship = {
  sourceId: string;
  targetId: string;
  relationshipType: KnowledgeRelationshipType;
  weight: number;
  description: string;
  bidirectional: boolean;
  metadata: Record<string, unknown>;
};

type TextMatch = {
  entryId: string;
  score: number;
};

const TITLE_ANCHOR_STOPWORDS = new Set([
  '가이드',
  '장애',
  '대응',
  '해결',
  '원인',
  '분석',
  '예방',
  '운영',
  '기준',
  '초기',
  '긴급',
  '점검',
  '순서',
  '체크리스트',
  '대응법',
  '정리',
]);

const PHRASE_MATCH_STOPWORDS = new Set([
  ...TITLE_ANCHOR_STOPWORDS,
  '절차',
  '작업',
  '처리',
  '흐름',
  '단계',
  '방법',
  '문제',
  '이슈',
  '상태',
  '상황',
]);

const TITLE_FALLBACK_SOURCE_CATEGORIES = new Set(['incident', 'troubleshooting']);
const TITLE_FALLBACK_TARGET_CATEGORIES = new Set([
  'incident',
  'troubleshooting',
  'best_practice',
  'architecture',
]);

export interface ExtractionResult {
  entryId: string;
  relationships: KnowledgeTriplet[];
  materializedCount: number;
  insertedCount: number;
  updatedCount: number;
}

const RELATIONSHIP_PATTERNS: Array<{
  type: KnowledgeRelationshipType;
  patterns: RegExp[];
}> = [
  { type: 'causes', patterns: [/cause/i, /lead/i, /trigger/i, /result/i, /induce/i] },
  { type: 'solves', patterns: [/solve/i, /fix/i, /mitigat/i, /reduce/i, /recover/i] },
  { type: 'depends_on', patterns: [/depend/i, /rely/i, /require/i, /need/i] },
  { type: 'prerequisite', patterns: [/prerequisite/i, /before/i, /prior/i, /precondition/i] },
  { type: 'follows', patterns: [/follow/i, /after/i, /next/i, /sequence/i, /step/i] },
  { type: 'part_of', patterns: [/part/i, /component/i, /include/i, /contain/i, /consist/i] },
  { type: 'similar_to', patterns: [/similar/i, /like/i, /same/i, /equivalent/i] },
  { type: 'contradicts', patterns: [/contradict/i, /conflict/i, /oppose/i, /incompatible/i] },
  { type: 'related_to', patterns: [/relat/i, /associate/i, /connect/i, /link/i] },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function tokenizeTitleAnchor(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !TITLE_ANCHOR_STOPWORDS.has(token));
}

function tokenizePhraseAnchor(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !PHRASE_MATCH_STOPWORDS.has(token));
}

function getSharedTokens(leftTokens: string[], rightTokens: string[]): string[] {
  const rightSet = new Set(rightTokens);
  return Array.from(new Set(leftTokens.filter((token) => rightSet.has(token))));
}

function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  const union = leftTokens.size + rightTokens.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function jaccardSimilarityFromTokens(leftTokens: string[], rightTokens: string[]): number {
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }

  const union = leftSet.size + rightSet.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function computeEntryMatch(entry: KnowledgeBaseRow, phrase: string): number {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return 0;

  const normalizedTitle = normalizeText(entry.title);
  if (normalizedTitle.includes(normalizedPhrase)) {
    return 1;
  }

  const phraseTokens = tokenizePhraseAnchor(phrase);
  if (phraseTokens.length === 0) {
    return 0;
  }

  const titleTokens = tokenizeTitleAnchor(entry.title);
  const sharedTitleTokens = getSharedTokens(phraseTokens, titleTokens);
  if (sharedTitleTokens.length === 0) {
    return 0;
  }

  const normalizedContent = normalizeText(entry.content);
  const exactContent = normalizedContent.includes(normalizedPhrase) ? 0.8 : 0;
  const titleSimilarity = jaccardSimilarityFromTokens(titleTokens, phraseTokens);
  const contentSimilarity = jaccardSimilarity(entry.content.slice(0, 320), phrase);

  return Math.max(
    exactContent,
    Number((titleSimilarity * 0.8 + contentSimilarity * 0.2).toFixed(4))
  );
}

function findBestEntryMatch(entries: KnowledgeBaseRow[], phrase: string): TextMatch | null {
  let best: TextMatch | null = null;

  for (const entry of entries) {
    const score = computeEntryMatch(entry, phrase);
    if (score < 0.35) continue;
    if (!best || score > best.score) {
      best = { entryId: entry.id, score };
    }
  }

  return best;
}

export function normalizeRelationshipType(predicate: string): KnowledgeRelationshipType {
  const normalized = predicate.trim();
  if (!normalized) return 'related_to';

  for (const candidate of RELATIONSHIP_PATTERNS) {
    if (candidate.patterns.some((pattern) => pattern.test(normalized))) {
      return candidate.type;
    }
  }

  return 'related_to';
}

function isBidirectionalRelationship(type: KnowledgeRelationshipType): boolean {
  return type === 'related_to' || type === 'similar_to';
}

function buildRelationshipDescription(
  sourceTitle: string,
  targetTitle: string,
  triplet: KnowledgeTriplet,
  relationshipType: KnowledgeRelationshipType
): string {
  return `${sourceTitle} -> ${targetTitle} (${relationshipType} | ${triplet.subject} / ${triplet.object})`;
}

function buildFallbackRelationshipDescription(sourceTitle: string, targetTitle: string): string {
  return `${sourceTitle} -> ${targetTitle} (related_to | title-anchor-fallback)`;
}

function computeTitleAnchorFallbackScore(
  sourceEntry: KnowledgeBaseRow,
  candidateEntry: KnowledgeBaseRow
): { score: number; titleScore: number; contentScore: number; sharedTokens: string[] } {
  const sourceTitleTokens = tokenizeTitleAnchor(sourceEntry.title);
  const candidateTitleTokens = tokenizeTitleAnchor(candidateEntry.title);
  const sharedTokens = sourceTitleTokens.filter((token) => candidateTitleTokens.includes(token));

  if (sharedTokens.length === 0) {
    return {
      score: 0,
      titleScore: 0,
      contentScore: 0,
      sharedTokens: [],
    };
  }

  const titleScore = jaccardSimilarityFromTokens(sourceTitleTokens, candidateTitleTokens);
  const contentScore = jaccardSimilarity(
    sourceEntry.content.slice(0, 480),
    candidateEntry.content.slice(0, 480)
  );

  let categoryBoost = 0;
  if (
    sourceEntry.category === 'incident' &&
    candidateEntry.category === 'troubleshooting'
  ) {
    categoryBoost = 0.08;
  } else if (
    sourceEntry.category === 'incident' &&
    candidateEntry.category === 'best_practice'
  ) {
    categoryBoost = 0.05;
  } else if (sourceEntry.category === candidateEntry.category) {
    categoryBoost = 0.02;
  }

  const score = Number((titleScore * 0.55 + contentScore * 0.35 + categoryBoost).toFixed(4));
  return {
    score,
    titleScore: Number(titleScore.toFixed(4)),
    contentScore: Number(contentScore.toFixed(4)),
    sharedTokens,
  };
}

function planTitleAnchorFallbackRelationship(
  sourceEntry: KnowledgeBaseRow,
  otherEntries: KnowledgeBaseRow[]
): PlannedRelationship | null {
  if (!TITLE_FALLBACK_SOURCE_CATEGORIES.has(String(sourceEntry.category || '').trim())) {
    return null;
  }

  let bestCandidate:
    | {
        entry: KnowledgeBaseRow;
        score: number;
        titleScore: number;
        contentScore: number;
        sharedTokens: string[];
      }
    | null = null;

  for (const entry of otherEntries) {
    if (!TITLE_FALLBACK_TARGET_CATEGORIES.has(String(entry.category || '').trim())) {
      continue;
    }

    const scored = computeTitleAnchorFallbackScore(sourceEntry, entry);
    if (scored.score < 0.24) {
      continue;
    }

    if (
      !bestCandidate ||
      scored.score > bestCandidate.score ||
      (
        scored.score === bestCandidate.score &&
        scored.titleScore > bestCandidate.titleScore
      )
    ) {
      bestCandidate = {
        entry,
        score: scored.score,
        titleScore: scored.titleScore,
        contentScore: scored.contentScore,
        sharedTokens: scored.sharedTokens,
      };
    }
  }

  if (!bestCandidate) {
    return null;
  }

  return {
    sourceId: sourceEntry.id,
    targetId: bestCandidate.entry.id,
    relationshipType: 'related_to',
    weight: Math.min(0.82, Math.max(0.35, bestCandidate.score)),
    description: buildFallbackRelationshipDescription(
      sourceEntry.title,
      bestCandidate.entry.title
    ),
    bidirectional: true,
    metadata: {
      source_entry_id: sourceEntry.id,
      extraction_source: 'title-anchor-fallback',
      title_anchor_score: bestCandidate.score,
      title_similarity: bestCandidate.titleScore,
      content_similarity: bestCandidate.contentScore,
      shared_title_tokens: bestCandidate.sharedTokens,
    },
  };
}

export function planKnowledgeRelationships(
  sourceEntry: KnowledgeBaseRow,
  allEntries: KnowledgeBaseRow[],
  triplets: KnowledgeTriplet[]
): PlannedRelationship[] {
  const otherEntries = allEntries.filter((entry) => entry.id !== sourceEntry.id);
  const planned = new Map<string, PlannedRelationship>();

  for (const triplet of triplets) {
    const relationshipType = normalizeRelationshipType(triplet.predicate);
    const subjectSourceScore = computeEntryMatch(sourceEntry, triplet.subject);
    const objectSourceScore = computeEntryMatch(sourceEntry, triplet.object);

    let sourceId = '';
    let targetId = '';
    let sourceTitle = sourceEntry.title;
    let targetTitle = '';
    let targetMatch: TextMatch | null = null;

    if (subjectSourceScore >= 0.45) {
      targetMatch = findBestEntryMatch(otherEntries, triplet.object);
      sourceId = sourceEntry.id;
      targetId = targetMatch?.entryId || '';
      targetTitle =
        otherEntries.find((entry) => entry.id === targetId)?.title || '';
    } else if (objectSourceScore >= 0.45) {
      targetMatch = findBestEntryMatch(otherEntries, triplet.subject);
      sourceId = targetMatch?.entryId || '';
      targetId = sourceEntry.id;
      sourceTitle =
        otherEntries.find((entry) => entry.id === sourceId)?.title || sourceTitle;
      targetTitle = sourceEntry.title;
    } else {
      continue;
    }

    if (!targetMatch || !sourceId || !targetId || sourceId === targetId) {
      continue;
    }

    const matchScore = Number(((subjectSourceScore >= 0.45 ? subjectSourceScore : objectSourceScore) + targetMatch.score).toFixed(4));
    const weight = Math.min(
      1,
      Math.max(0.35, Number((triplet.confidence * 0.6 + (matchScore / 2) * 0.4).toFixed(4)))
    );
    const key = `${sourceId}|||${targetId}|||${relationshipType}`;

    planned.set(key, {
      sourceId,
      targetId,
      relationshipType,
      weight,
      description: buildRelationshipDescription(sourceTitle, targetTitle, triplet, relationshipType),
      bidirectional: isBidirectionalRelationship(relationshipType),
      metadata: {
        source_entry_id: sourceEntry.id,
        extraction_source: 'llamaindex-triplets',
        subject: triplet.subject,
        predicate: triplet.predicate,
        object: triplet.object,
        confidence: triplet.confidence,
      },
    });
  }

  if (planned.size === 0) {
    const fallback = planTitleAnchorFallbackRelationship(sourceEntry, otherEntries);
    if (fallback) {
      const key = `${fallback.sourceId}|||${fallback.targetId}|||${fallback.relationshipType}`;
      planned.set(key, fallback);
    }
  }

  return Array.from(planned.values());
}

async function upsertKnowledgeRelationships(
  client: SupabaseClient,
  relationships: PlannedRelationship[]
): Promise<{ insertedCount: number; updatedCount: number }> {
  let insertedCount = 0;
  let updatedCount = 0;

  for (const relationship of relationships) {
    const { data: existing, error: existingError } = await client
      .from('knowledge_relationships')
      .select('id')
      .eq('source_id', relationship.sourceId)
      .eq('target_id', relationship.targetId)
      .eq('source_table', 'knowledge_base')
      .eq('target_table', 'knowledge_base')
      .eq('relationship_type', relationship.relationshipType)
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    const payload = {
      source_id: relationship.sourceId,
      target_id: relationship.targetId,
      source_table: 'knowledge_base',
      target_table: 'knowledge_base',
      relationship_type: relationship.relationshipType,
      weight: relationship.weight,
      description: relationship.description,
      bidirectional: relationship.bidirectional,
      metadata: relationship.metadata,
    };

    const existingId = (existing as RelationshipRow[] | null)?.[0]?.id;
    if (existingId) {
      const { error: updateError } = await client
        .from('knowledge_relationships')
        .update(payload)
        .eq('id', existingId);
      if (updateError) throw updateError;
      updatedCount += 1;
      continue;
    }

    const { error: insertError } = await client.from('knowledge_relationships').insert(payload);
    if (insertError) throw insertError;
    insertedCount += 1;
  }

  return { insertedCount, updatedCount };
}

export async function extractRelationshipsFromKnowledgeBase(
  client: SupabaseClient,
  extractTriplets: (text: string, maxTriplets?: number) => Promise<KnowledgeTriplet[]>,
  options: {
    batchSize?: number;
    onlyUnprocessed?: boolean;
    titles?: string[];
  } = {}
): Promise<ExtractionResult[]> {
  const { batchSize = 50, onlyUnprocessed = true, titles = [] } = options;

  try {
    let query = client
      .from('knowledge_base')
      .select('id, title, category, content, metadata')
      .limit(batchSize);

    if (titles.length > 0) {
      query = query.in('title', titles);
    }

    if (onlyUnprocessed && titles.length === 0) {
      query = query.or('metadata->indexed_by.is.null,metadata->triplets.is.null');
    }

    const { data: entries, error } = await query;

    if (error) {
      throw error;
    }
    if (!entries || entries.length === 0) {
      logger.info('[GraphRAG] No unprocessed entries found');
      return [];
    }

    const { data: allKnowledgeRows, error: allRowsError } = await client
      .from('knowledge_base')
      .select('id, title, category, content, metadata');

    if (allRowsError) {
      throw allRowsError;
    }

    const allEntries = (allKnowledgeRows || []) as KnowledgeBaseRow[];
    const results: ExtractionResult[] = [];

    for (const entry of entries as KnowledgeBaseRow[]) {
      const triplets = await extractTriplets(entry.content, 5);
      const plannedRelationships = planKnowledgeRelationships(entry, allEntries, triplets);
      const upsertResult = await upsertKnowledgeRelationships(client, plannedRelationships);
      const materializedCount = upsertResult.insertedCount + upsertResult.updatedCount;

      await client
        .from('knowledge_base')
        .update({
          metadata: {
            ...asRecord(entry.metadata),
            triplets,
            indexed_by: 'llamaindex',
            indexed_at: new Date().toISOString(),
            materialized_relationships: materializedCount,
            materialized_relationship_inserts: upsertResult.insertedCount,
            materialized_relationship_updates: upsertResult.updatedCount,
          },
        })
        .eq('id', entry.id);

      if (triplets.length > 0 || materializedCount > 0) {
        results.push({
          entryId: entry.id,
          relationships: triplets,
          materializedCount,
          insertedCount: upsertResult.insertedCount,
          updatedCount: upsertResult.updatedCount,
        });
      }
    }

    const totalMaterialized = results.reduce((sum, result) => sum + result.materializedCount, 0);
    const totalInserted = results.reduce((sum, result) => sum + result.insertedCount, 0);
    const totalUpdated = results.reduce((sum, result) => sum + result.updatedCount, 0);
    logger.info(
      `[GraphRAG] Extracted relationships from ${results.length} entries (materialized=${totalMaterialized}, inserted=${totalInserted}, updated=${totalUpdated})`
    );
    return results;
  } catch (error) {
    logger.error('[GraphRAG] Relationship extraction failed:', error);
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
    logger.error('[GraphRAG] Related knowledge fetch error:', error);
    return [];
  }
}
