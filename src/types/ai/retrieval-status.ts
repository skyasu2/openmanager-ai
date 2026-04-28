export type RetrievalMode = 'off' | 'lite' | 'text-only' | 'cosine-neighbor';

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
