export type RetrievalMode = 'off' | 'lite' | 'text-only';

export type RetrievalSuppressedReason =
  | 'disabled'
  | 'not_needed'
  | 'no_results'
  | 'budget_guard'
  | 'unavailable';

export interface RetrievalMetadata {
  retrievalEnabled: boolean;
  retrievalUsed: boolean;
  retrievalMode: RetrievalMode;
  suppressedReason?: RetrievalSuppressedReason;
  evidenceCount: number;
  webUsed: boolean;
}

export type EvidenceSourceType = 'knowledge' | 'incident' | 'runbook' | 'web';

export interface EvidenceCard {
  id: string;
  title: string;
  summary: string;
  sourceType: EvidenceSourceType;
  score: number;
  category?: string;
  reason?: string;
  url?: string;
}

export type FeatureExecutionStatus =
  | 'disabled'
  | 'enabled'
  | 'used'
  | 'suppressed'
  | 'unavailable';

export interface FeatureExecutionState {
  status: FeatureExecutionStatus;
  reason?: RetrievalSuppressedReason | 'routing_mode' | 'auto';
}

export interface AnalysisFeatureStatus {
  rag: FeatureExecutionState;
  web: FeatureExecutionState;
  thinking: FeatureExecutionState;
}
