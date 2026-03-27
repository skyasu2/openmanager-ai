export interface KnowledgeBaseDoc {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  severity: string;
  tags: string[];
  related_server_types: string[];
  metadata: Record<string, unknown> | null;
}

export interface MergeCluster {
  clusterId: string;
  category: string;
  docIds: string[];
  avgSimilarity: number;
  maxSimilarity: number;
  reduction: number;
}

export interface MergePlanItem {
  clusterId: string;
  category: string;
  keepId: string;
  keepTitle: string;
  mergeIds: string[];
  mergeTitles: string[];
  avgSimilarity: number;
  maxSimilarity: number;
  estimatedReduction: number;
  mergedTitle: string;
  mergedContent: string;
  mergedTags: string[];
  mergedRelatedServerTypes: string[];
  mergedSeverity: string;
  mergedSource: string;
  mergedMetadata: Record<string, unknown>;
}

export interface MergeSkippedCluster {
  clusterId: string;
  category: string;
  reduction: number;
  reason: string;
}

export interface MergePlanSummary {
  totalDocs: number;
  targetTotalDocs: number;
  neededReduction: number;
  candidateClusters: number;
  selectedClusters: number;
  selectedReduction: number;
  estimatedTotalAfterMerge: number;
  categoryCountsBefore: Record<string, number>;
  categoryCountsAfter: Record<string, number>;
  coverageGuardOk: boolean;
}

export interface BuildMergePlanOptions {
  similarityThreshold?: number;
  targetTotalDocs?: number;
  categoryMinCounts?: Record<string, number>;
  targetMergedCharLength?: number;
  hardMaxMergedCharLength?: number;
}

export interface MergePlanResult {
  summary: MergePlanSummary;
  candidates: MergePlanItem[];
  items: MergePlanItem[];
  clusters: MergeCluster[];
  skippedClusters: MergeSkippedCluster[];
}
