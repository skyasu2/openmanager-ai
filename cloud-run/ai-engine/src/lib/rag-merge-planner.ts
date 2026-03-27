import {
  CATEGORY_MIN_COUNTS,
  DEFAULT_TARGET_TOTAL_DOCS,
  HARD_DOC_CHAR_MAX,
  MERGE_SIMILARITY_THRESHOLD,
  SOURCE_PRIORITY,
  TARGET_DOC_CHAR_MAX,
  TARGET_DOC_CHAR_MIN,
  computeContentSimilarity,
  computeDocumentSimilarity,
  computeTitleSimilarity,
  jaccardSimilarity,
  severityRank,
  trimToHardLimit,
} from './rag-doc-policy';
import type {
  BuildMergePlanOptions,
  KnowledgeBaseDoc,
  MergeCluster,
  MergePlanItem,
  MergePlanResult,
  MergeSkippedCluster,
} from './rag-merge-plan-types';
export type {
  BuildMergePlanOptions,
  KnowledgeBaseDoc,
  MergeCluster,
  MergePlanItem,
  MergePlanResult,
  MergeSkippedCluster,
} from './rag-merge-plan-types';

interface Edge {
  left: number;
  right: number;
  score: number;
}

const GENERIC_TAGS = new Set([
  'from_command_vectors',
  'monitoring_context_enriched',
  'monitoring',
  'debugging',
  'system',
]);

function normalizeTagsForSimilarity(tags: string[]): string[] {
  return tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .filter((tag) => !GENERIC_TAGS.has(tag))
    .filter((tag) => !tag.startsWith('cv:'));
}

function getSourceRank(source: string): number {
  return SOURCE_PRIORITY[source] ?? SOURCE_PRIORITY.unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDoc(doc: KnowledgeBaseDoc): KnowledgeBaseDoc {
  return {
    id: String(doc.id),
    title: String(doc.title || '').trim(),
    content: String(doc.content || '').trim(),
    category: String(doc.category || 'unknown').trim(),
    source: String(doc.source || 'unknown').trim(),
    severity: String(doc.severity || 'info').trim(),
    tags: Array.isArray(doc.tags)
      ? doc.tags.map((value) => String(value).trim()).filter((value) => value.length > 0)
      : [],
    related_server_types: Array.isArray(doc.related_server_types)
      ? doc.related_server_types
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0)
      : [],
    metadata: isRecord(doc.metadata) ? doc.metadata : null,
  };
}

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Array(size).fill(0);
  }

  find(value: number): number {
    if (this.parent[value] !== value) {
      this.parent[value] = this.find(this.parent[value] as number);
    }
    return this.parent[value] as number;
  }

  union(left: number, right: number): void {
    const rootLeft = this.find(left);
    const rootRight = this.find(right);

    if (rootLeft === rootRight) return;

    const rankLeft = this.rank[rootLeft] as number;
    const rankRight = this.rank[rootRight] as number;

    if (rankLeft < rankRight) {
      this.parent[rootLeft] = rootRight;
      return;
    }

    if (rankLeft > rankRight) {
      this.parent[rootRight] = rootLeft;
      return;
    }

    this.parent[rootRight] = rootLeft;
    this.rank[rootLeft] = rankLeft + 1;
  }
}

function buildCategoryEdges(docs: KnowledgeBaseDoc[], threshold: number): Edge[] {
  const edges: Edge[] = [];

  for (let left = 0; left < docs.length; left += 1) {
    for (let right = left + 1; right < docs.length; right += 1) {
      const leftDoc = docs[left];
      const rightDoc = docs[right];
      if (!leftDoc || !rightDoc) continue;

      const titleScore = computeTitleSimilarity(leftDoc.title, rightDoc.title);
      const contentScore = computeContentSimilarity(leftDoc.content, rightDoc.content);
      const score = computeDocumentSimilarity(
        docs[left]?.title || '',
        docs[left]?.content || '',
        docs[right]?.title || '',
        docs[right]?.content || ''
      );

      if (leftDoc.category === 'command') {
        const tagScore = jaccardSimilarity(
          normalizeTagsForSimilarity(leftDoc.tags).join(' '),
          normalizeTagsForSimilarity(rightDoc.tags).join(' ')
        );
        // Prevent command over-merge caused by shared template text + generic tags.
        if (titleScore < 0.35 && tagScore < 0.5) {
          continue;
        }
      }

      if (leftDoc.category === 'incident') {
        const tagScore = jaccardSimilarity(
          normalizeTagsForSimilarity(leftDoc.tags).join(' '),
          normalizeTagsForSimilarity(rightDoc.tags).join(' ')
        );
        if (titleScore < 0.45 && tagScore < 0.45) {
          continue;
        }
      }

      if (titleScore < 0.08 && contentScore < threshold) {
        continue;
      }
      if (score >= threshold) {
        edges.push({ left, right, score });
      }
    }
  }

  return edges;
}

function chooseRepresentative(docs: KnowledgeBaseDoc[]): KnowledgeBaseDoc {
  const scored = docs.map((doc) => {
    const sourceScore = 20 - getSourceRank(doc.source) * 3;
    const metadataScore = doc.metadata ? 6 : 0;
    const lengthDistance = Math.abs(doc.content.length - TARGET_DOC_CHAR_MAX);
    const lengthScore = Math.max(0, 12 - Math.round(lengthDistance / 50));
    const severityScore = severityRank(doc.severity);
    const totalScore = sourceScore + metadataScore + lengthScore + severityScore;
    return { doc, totalScore };
  });

  scored.sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }
    return right.doc.content.length - left.doc.content.length;
  });

  return scored[0]?.doc || docs[0]!;
}

function deduplicateSentences(value: string): string[] {
  const rawPieces = value
    .split(/\n{2,}|[.!?]\s+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
  const dedup = new Set<string>();
  const result: string[] = [];

  for (const piece of rawPieces) {
    const key = piece.toLowerCase().replace(/\s+/g, ' ').trim();
    if (key.length === 0 || dedup.has(key)) continue;
    dedup.add(key);
    result.push(piece);
  }

  return result;
}

function buildMergedContent(
  representative: KnowledgeBaseDoc,
  members: KnowledgeBaseDoc[],
  targetMergedCharLength: number,
  hardMaxMergedCharLength: number
): string {
  const segments: string[] = [];
  for (const doc of [representative, ...members]) {
    const dedup = deduplicateSentences(doc.content);
    for (const segment of dedup) {
      if (!segments.includes(segment)) {
        segments.push(segment);
      }
    }
  }

  const picked: string[] = [];
  let length = 0;
  for (const segment of segments) {
    const nextLength = length + segment.length + (picked.length > 0 ? 2 : 0);
    if (nextLength > targetMergedCharLength && length >= TARGET_DOC_CHAR_MIN) {
      break;
    }
    if (nextLength > hardMaxMergedCharLength) {
      break;
    }
    picked.push(segment);
    length = nextLength;
  }

  if (picked.length === 0) {
    return trimToHardLimit(representative.content, hardMaxMergedCharLength);
  }

  return trimToHardLimit(picked.join('. '), hardMaxMergedCharLength);
}

function mergeRiskLevel(docs: KnowledgeBaseDoc[]): string | null {
  const riskOrder: Record<string, number> = {
    destructive: 5,
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  let best: string | null = null;
  let bestScore = 0;
  for (const doc of docs) {
    const value = doc.metadata?.risk_level;
    if (typeof value !== 'string') continue;
    const score = riskOrder[value] ?? 0;
    if (score > bestScore) {
      best = value;
      bestScore = score;
    }
  }
  return best;
}

function buildClusterCandidate(
  clusterId: string,
  category: string,
  docs: KnowledgeBaseDoc[],
  pairScores: number[],
  targetMergedCharLength: number,
  hardMaxMergedCharLength: number
): MergePlanItem {
  const representative = chooseRepresentative(docs);
  const members = docs.filter((doc) => doc.id !== representative.id);
  const mergedSeverity = docs
    .map((doc) => doc.severity)
    .sort((left, right) => severityRank(right) - severityRank(left))[0] || 'info';
  const mergedTags = Array.from(new Set(docs.flatMap((doc) => doc.tags))).sort();
  const mergedRelatedServerTypes = Array.from(
    new Set(docs.flatMap((doc) => doc.related_server_types))
  ).sort();
  const requiresConfirmation = docs.some((doc) => doc.metadata?.requires_confirmation === true);
  const riskLevel = mergeRiskLevel(docs);

  const mergedMetadata: Record<string, unknown> = {
    ...(representative.metadata || {}),
    merged_from_ids: members.map((doc) => doc.id),
    merged_from_titles: members.map((doc) => doc.title),
    merge_cluster_size: docs.length,
    merged_at: new Date().toISOString(),
    merged_by: 'rag-merge-apply',
  };
  if (requiresConfirmation) {
    mergedMetadata.requires_confirmation = true;
  }
  if (riskLevel) {
    mergedMetadata.risk_level = riskLevel;
  }

  return {
    clusterId,
    category,
    keepId: representative.id,
    keepTitle: representative.title,
    mergeIds: members.map((doc) => doc.id),
    mergeTitles: members.map((doc) => doc.title),
    avgSimilarity:
      pairScores.length > 0
        ? Number((pairScores.reduce((sum, value) => sum + value, 0) / pairScores.length).toFixed(4))
        : 1,
    maxSimilarity:
      pairScores.length > 0 ? Number(Math.max(...pairScores).toFixed(4)) : 1,
    estimatedReduction: Math.max(0, docs.length - 1),
    mergedTitle: representative.title,
    mergedContent: buildMergedContent(
      representative,
      members,
      targetMergedCharLength,
      hardMaxMergedCharLength
    ),
    mergedTags,
    mergedRelatedServerTypes,
    mergedSeverity,
    mergedSource: representative.source,
    mergedMetadata,
  };
}

export function buildMergePlan(
  inputDocs: KnowledgeBaseDoc[],
  options: BuildMergePlanOptions = {}
): MergePlanResult {
  const docs = inputDocs.map(normalizeDoc).filter((doc) => doc.id.length > 0);
  const threshold = options.similarityThreshold ?? MERGE_SIMILARITY_THRESHOLD;
  const targetTotalDocs = options.targetTotalDocs ?? DEFAULT_TARGET_TOTAL_DOCS;
  const minCounts = { ...CATEGORY_MIN_COUNTS, ...(options.categoryMinCounts || {}) };
  const targetMergedCharLength = options.targetMergedCharLength ?? TARGET_DOC_CHAR_MAX;
  const hardMaxMergedCharLength = options.hardMaxMergedCharLength ?? HARD_DOC_CHAR_MAX;

  const byCategory = new Map<string, KnowledgeBaseDoc[]>();
  for (const doc of docs) {
    const list = byCategory.get(doc.category) || [];
    list.push(doc);
    byCategory.set(doc.category, list);
  }

  const clusters: MergeCluster[] = [];
  const candidates: MergePlanItem[] = [];

  for (const [category, categoryDocs] of byCategory.entries()) {
    if (categoryDocs.length < 2) continue;

    const edges = buildCategoryEdges(categoryDocs, threshold);
    if (edges.length === 0) continue;

    const uf = new UnionFind(categoryDocs.length);
    for (const edge of edges) {
      uf.union(edge.left, edge.right);
    }

    const grouped = new Map<number, number[]>();
    for (let index = 0; index < categoryDocs.length; index += 1) {
      const root = uf.find(index);
      const group = grouped.get(root) || [];
      group.push(index);
      grouped.set(root, group);
    }

    let localClusterIndex = 0;
    for (const memberIndexes of grouped.values()) {
      if (memberIndexes.length < 2) continue;

      const memberDocs = memberIndexes.map((index) => categoryDocs[index]!).filter(Boolean);
      const pairScores: number[] = [];
      for (let left = 0; left < memberDocs.length; left += 1) {
        for (let right = left + 1; right < memberDocs.length; right += 1) {
          pairScores.push(
            computeDocumentSimilarity(
              memberDocs[left]?.title || '',
              memberDocs[left]?.content || '',
              memberDocs[right]?.title || '',
              memberDocs[right]?.content || ''
            )
          );
        }
      }

      localClusterIndex += 1;
      const clusterId = `${category}-${localClusterIndex}`;
      const reduction = memberDocs.length - 1;
      const avgSimilarity =
        pairScores.length > 0
          ? Number((pairScores.reduce((sum, score) => sum + score, 0) / pairScores.length).toFixed(4))
          : 1;
      const maxSimilarity = pairScores.length > 0 ? Number(Math.max(...pairScores).toFixed(4)) : 1;
      clusters.push({
        clusterId,
        category,
        docIds: memberDocs.map((doc) => doc.id),
        avgSimilarity,
        maxSimilarity,
        reduction,
      });

      const candidate = buildClusterCandidate(
        clusterId,
        category,
        memberDocs,
        pairScores,
        targetMergedCharLength,
        hardMaxMergedCharLength
      );
      candidates.push(candidate);
    }
  }

  candidates.sort((left, right) => {
    if (right.avgSimilarity !== left.avgSimilarity) {
      return right.avgSimilarity - left.avgSimilarity;
    }
    return right.estimatedReduction - left.estimatedReduction;
  });

  const categoryCountsBefore: Record<string, number> = {};
  for (const doc of docs) {
    categoryCountsBefore[doc.category] = (categoryCountsBefore[doc.category] || 0) + 1;
  }

  const selected: MergePlanItem[] = [];
  const skippedClusters: MergeSkippedCluster[] = [];
  const categoryCountsAfter: Record<string, number> = { ...categoryCountsBefore };
  let remainingReductionNeeded = Math.max(0, docs.length - targetTotalDocs);
  for (const candidate of candidates) {
    const currentCount = categoryCountsAfter[candidate.category] || 0;
    const minCount = minCounts[candidate.category] ?? 0;
    if (currentCount - candidate.estimatedReduction < minCount) {
      skippedClusters.push({
        clusterId: candidate.clusterId,
        category: candidate.category,
        reduction: candidate.estimatedReduction,
        reason: `category guard (${currentCount} -> ${
          currentCount - candidate.estimatedReduction
        } < min ${minCount})`,
      });
      continue;
    }

    if (remainingReductionNeeded <= 0) {
      skippedClusters.push({
        clusterId: candidate.clusterId,
        category: candidate.category,
        reduction: candidate.estimatedReduction,
        reason: 'target already satisfied',
      });
      continue;
    }

    selected.push(candidate);
    categoryCountsAfter[candidate.category] = currentCount - candidate.estimatedReduction;
    remainingReductionNeeded -= candidate.estimatedReduction;
  }

  const selectedReduction = selected.reduce(
    (sum, candidate) => sum + candidate.estimatedReduction,
    0
  );
  const estimatedTotalAfterMerge = Math.max(0, docs.length - selectedReduction);
  const coverageGuardOk = Object.entries(minCounts).every(
    ([category, minCount]) => (categoryCountsAfter[category] || 0) >= minCount
  );

  return {
    summary: {
      totalDocs: docs.length,
      targetTotalDocs,
      neededReduction: Math.max(0, docs.length - targetTotalDocs),
      candidateClusters: candidates.length,
      selectedClusters: selected.length,
      selectedReduction,
      estimatedTotalAfterMerge,
      categoryCountsBefore,
      categoryCountsAfter,
      coverageGuardOk,
    },
    candidates,
    items: selected,
    clusters,
    skippedClusters,
  };
}
