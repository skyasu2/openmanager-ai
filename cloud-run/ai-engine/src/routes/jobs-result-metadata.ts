import {
  RETRIEVAL_MODES,
  RETRIEVAL_SUPPRESSED_REASONS,
  type RetrievalMetadata,
  type RetrievalMode,
  type RetrievalSuppressedReason,
} from '../lib/retrieval-contract';
import { getStringValue, isRecord } from './jobs-route-helpers';

const RETRIEVAL_MODE_SET = new Set<string>(RETRIEVAL_MODES);
const RETRIEVAL_SUPPRESSED_REASON_SET = new Set<string>(
  RETRIEVAL_SUPPRESSED_REASONS
);

type ProviderAttemptTelemetry = {
  provider: string;
  modelId?: string;
  attempt?: number;
  durationMs?: number;
  error?: string;
};

export type JobProviderMetadata = {
  provider?: string;
  modelId?: string;
  providerAttempts?: ProviderAttemptTelemetry[];
  usedFallback?: boolean;
  fallbackReason?: string;
  durationMs?: number;
  ttfbMs?: number;
  latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
  resolvedMode?: 'single' | 'multi';
  modeSelectionSource?: string;
};

export function parseRetrievalMetadata(
  value: unknown
): RetrievalMetadata | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.retrievalEnabled !== 'boolean' ||
    typeof value.retrievalUsed !== 'boolean' ||
    typeof value.retrievalMode !== 'string' ||
    !RETRIEVAL_MODE_SET.has(value.retrievalMode) ||
    typeof value.evidenceCount !== 'number' ||
    !Number.isFinite(value.evidenceCount) ||
    typeof value.webUsed !== 'boolean'
  ) {
    return undefined;
  }

  const suppressedReason =
    typeof value.suppressedReason === 'string' &&
    RETRIEVAL_SUPPRESSED_REASON_SET.has(value.suppressedReason)
      ? (value.suppressedReason as RetrievalSuppressedReason)
      : undefined;

  return {
    retrievalEnabled: value.retrievalEnabled,
    retrievalUsed: value.retrievalUsed,
    retrievalMode: value.retrievalMode as RetrievalMode,
    ...(suppressedReason && { suppressedReason }),
    evidenceCount: Math.max(0, Math.floor(value.evidenceCount)),
    webUsed: value.webUsed,
  };
}

function getNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return undefined;
}

function normalizeProviderAttempts(
  value: unknown
): ProviderAttemptTelemetry[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const attempts = value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const provider = getStringValue(entry.provider);
      if (!provider) return null;
      const modelId = getStringValue(entry.modelId);
      const attempt = getNumberValue(entry.attempt);
      const durationMs = getNumberValue(entry.durationMs);
      const error = getStringValue(entry.error);
      return {
        provider,
        ...(modelId && { modelId }),
        ...(attempt !== undefined && { attempt }),
        ...(durationMs !== undefined && { durationMs }),
        ...(error && { error }),
      };
    })
    .filter((entry): entry is ProviderAttemptTelemetry => entry !== null);

  return attempts.length > 0 ? attempts : undefined;
}

export function extractProviderMetadata(
  metadata: Record<string, unknown>
): JobProviderMetadata {
  const provider = getStringValue(metadata.provider);
  const modelId = getStringValue(metadata.modelId);
  const fallbackReason = getStringValue(metadata.fallbackReason);
  const durationMs = getNumberValue(metadata.durationMs);
  const ttfbMs = getNumberValue(metadata.ttfbMs);
  const modeSelectionSource = getStringValue(metadata.modeSelectionSource);
  const latencyTier =
    metadata.latencyTier === 'fast' ||
    metadata.latencyTier === 'normal' ||
    metadata.latencyTier === 'slow' ||
    metadata.latencyTier === 'very_slow'
      ? metadata.latencyTier
      : undefined;
  const resolvedMode =
    metadata.resolvedMode === 'single' || metadata.resolvedMode === 'multi'
      ? metadata.resolvedMode
      : undefined;
  const providerAttempts = normalizeProviderAttempts(metadata.providerAttempts);
  const providerMetadata: JobProviderMetadata = {
    ...(provider && { provider }),
    ...(modelId && { modelId }),
    ...(providerAttempts && { providerAttempts }),
    ...(typeof metadata.usedFallback === 'boolean' && {
      usedFallback: metadata.usedFallback,
    }),
    ...(fallbackReason && { fallbackReason }),
    ...(durationMs !== undefined && { durationMs }),
    ...(ttfbMs !== undefined && { ttfbMs }),
    ...(latencyTier && { latencyTier }),
    ...(resolvedMode && { resolvedMode }),
    ...(modeSelectionSource && { modeSelectionSource }),
  };

  return providerMetadata;
}
