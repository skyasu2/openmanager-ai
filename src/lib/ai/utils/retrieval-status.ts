import type { AnalysisMode } from '@/types/ai/analysis-mode';
import type {
  AnalysisFeatureStatus,
  FeatureExecutionState,
  RetrievalMetadata,
  RetrievalMode,
  RetrievalSuppressedReason,
} from '@/types/ai/retrieval-status';

const RETRIEVAL_MODES = new Set<RetrievalMode>([
  'off',
  'lite',
  'text-only',
  'cosine-neighbor',
]);

const SUPPRESSED_REASONS = new Set<RetrievalSuppressedReason>([
  'disabled',
  'not_needed',
  'no_results',
  'budget_guard',
  'unavailable',
]);

type FeatureName = keyof AnalysisFeatureStatus;

export interface FeatureStatusBadge {
  feature: FeatureName;
  state: FeatureExecutionState;
  label: string;
  className: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeRetrievalMode(value: unknown): RetrievalMode | null {
  return typeof value === 'string' &&
    RETRIEVAL_MODES.has(value as RetrievalMode)
    ? (value as RetrievalMode)
    : null;
}

function normalizeSuppressedReason(
  value: unknown
): RetrievalSuppressedReason | undefined {
  return typeof value === 'string' &&
    SUPPRESSED_REASONS.has(value as RetrievalSuppressedReason)
    ? (value as RetrievalSuppressedReason)
    : undefined;
}

export function normalizeRetrievalMetadata(
  value: unknown
): RetrievalMetadata | undefined {
  if (!isRecord(value)) return undefined;

  const retrievalMode = normalizeRetrievalMode(value.retrievalMode);
  if (!retrievalMode) return undefined;

  if (
    typeof value.retrievalEnabled !== 'boolean' ||
    typeof value.retrievalUsed !== 'boolean' ||
    typeof value.evidenceCount !== 'number' ||
    !Number.isFinite(value.evidenceCount) ||
    typeof value.webUsed !== 'boolean'
  ) {
    return undefined;
  }

  const suppressedReason = normalizeSuppressedReason(value.suppressedReason);

  return {
    retrievalEnabled: value.retrievalEnabled,
    retrievalUsed: value.retrievalUsed,
    retrievalMode,
    ...(suppressedReason ? { suppressedReason } : {}),
    evidenceCount: Math.max(0, Math.floor(value.evidenceCount)),
    webUsed: value.webUsed,
  };
}

function statusFromSuppressedReason(
  reason: RetrievalSuppressedReason | undefined
): FeatureExecutionState {
  if (reason === 'disabled') {
    return { status: 'disabled', reason };
  }
  if (reason === 'unavailable') {
    return { status: 'unavailable', reason };
  }
  return {
    status: 'suppressed',
    ...(reason ? { reason } : {}),
  };
}

export function buildAnalysisFeatureStatus(params: {
  retrieval?: RetrievalMetadata;
  ragEnabled?: boolean;
  webSearchEnabled?: boolean | 'auto';
  hasKnowledgeEvidence: boolean;
  hasWebEvidence: boolean;
  analysisMode?: AnalysisMode;
}): AnalysisFeatureStatus {
  const {
    retrieval,
    ragEnabled,
    webSearchEnabled,
    hasKnowledgeEvidence,
    hasWebEvidence,
    analysisMode,
  } = params;

  const rag: FeatureExecutionState = hasKnowledgeEvidence
    ? { status: 'used' }
    : retrieval?.retrievalUsed
      ? { status: 'used' }
      : retrieval
        ? retrieval.retrievalEnabled
          ? statusFromSuppressedReason(retrieval.suppressedReason)
          : { status: 'disabled', reason: 'disabled' }
        : ragEnabled
          ? { status: 'enabled' }
          : { status: 'disabled' };

  const web: FeatureExecutionState =
    hasWebEvidence || retrieval?.webUsed
      ? { status: 'used' }
      : webSearchEnabled === true
        ? { status: 'enabled' }
        : webSearchEnabled === 'auto'
          ? { status: 'enabled', reason: 'auto' }
          : { status: 'disabled' };

  const thinking: FeatureExecutionState =
    analysisMode === 'thinking'
      ? { status: 'enabled', reason: 'routing_mode' }
      : { status: 'disabled' };

  return { rag, web, thinking };
}

const FEATURE_STATUS_LABELS: Record<
  FeatureName,
  Record<FeatureExecutionState['status'], string>
> = {
  rag: {
    disabled: 'RAG 꺼짐',
    enabled: 'RAG 허용',
    used: 'RAG 사용됨',
    suppressed: 'RAG 생략됨',
    unavailable: 'RAG 사용 불가',
  },
  web: {
    disabled: 'Web 꺼짐',
    enabled: 'Web 허용',
    used: 'Web 사용됨',
    suppressed: 'Web 생략됨',
    unavailable: 'Web 사용 불가',
  },
  thinking: {
    disabled: '심층 분석 꺼짐',
    enabled: '심층 분석 요청됨',
    used: '심층 분석 사용됨',
    suppressed: '심층 분석 생략됨',
    unavailable: '심층 분석 사용 불가',
  },
};

const FEATURE_STATUS_CLASSNAMES: Record<
  FeatureExecutionState['status'],
  string
> = {
  disabled: 'bg-slate-100 text-slate-500',
  enabled: 'bg-slate-100 text-slate-600',
  used: 'bg-emerald-50 text-emerald-700',
  suppressed: 'bg-amber-50 text-amber-700',
  unavailable: 'bg-rose-50 text-rose-700',
};

export function buildVisibleFeatureStatusBadges(
  featureStatus: AnalysisFeatureStatus | undefined
): FeatureStatusBadge[] {
  if (!featureStatus) return [];

  return (['rag', 'web', 'thinking'] as const)
    .map((feature) => {
      const state = featureStatus[feature];
      return {
        feature,
        state,
        label: FEATURE_STATUS_LABELS[feature][state.status],
        className: FEATURE_STATUS_CLASSNAMES[state.status],
      };
    })
    .filter((badge) => badge.state.status !== 'disabled');
}
