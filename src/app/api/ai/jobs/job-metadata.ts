export interface ClientProviderAttempt {
  provider: string;
  modelId?: string;
  attempt?: number;
  durationMs?: number;
  error?: string;
}

export interface ClientJobMetadata {
  [key: string]: unknown;
  traceId?: string;
  analysisMode?: 'auto' | 'thinking';
  enableRAG?: boolean;
  enableWebSearch?: boolean | 'auto';
  queryAsOf?: unknown;
  retrieval?: unknown;
  handoffs?: Array<{ from: string; to: string; reason?: string }>;
  toolResultSummaries?: Array<{
    toolName: string;
    label: string;
    summary: string;
    preview?: string;
    status: 'completed' | 'failed';
  }>;
  provider?: string;
  modelId?: string;
  providerAttempts?: ClientProviderAttempt[];
  usedFallback?: boolean;
  fallbackReason?: string;
  durationMs?: number;
  ttfbMs?: number;
  latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
  resolvedMode?: 'single' | 'multi';
  modeSelectionSource?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

function sanitizeProviderErrorForClient(value: unknown): string | undefined {
  const raw = getNonEmptyString(value);
  if (!raw) return undefined;

  const redacted = raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted-token]')
    .replace(
      /\b[A-Za-z0-9_-]*(?:sk|key)_[A-Za-z0-9_-]{12,}\b/gi,
      '[redacted-secret]'
    )
    .replace(/\b(?:sk|csk)-[A-Za-z0-9_-]{12,}\b/gi, '[redacted-secret]');

  return redacted.length > 240 ? `${redacted.slice(0, 237)}...` : redacted;
}

function normalizeHandoffs(
  value: unknown
): ClientJobMetadata['handoffs'] | undefined {
  if (!Array.isArray(value)) return undefined;

  const handoffs = value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const from = getNonEmptyString(entry.from);
      const to = getNonEmptyString(entry.to);
      if (!from || !to) return null;
      const reason = getNonEmptyString(entry.reason);
      return { from, to, ...(reason && { reason }) };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return handoffs.length > 0 ? handoffs : undefined;
}

function normalizeToolResultSummaries(
  value: unknown
): ClientJobMetadata['toolResultSummaries'] | undefined {
  if (!Array.isArray(value)) return undefined;

  const summaries = value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const toolName = getNonEmptyString(entry.toolName);
      const label = getNonEmptyString(entry.label);
      const summary = getNonEmptyString(entry.summary);
      const status: 'completed' | 'failed' =
        entry.status === 'failed' ? 'failed' : 'completed';
      if (!toolName || !label || !summary) return null;
      const preview = getNonEmptyString(entry.preview);
      return { toolName, label, summary, status, ...(preview && { preview }) };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return summaries.length > 0 ? summaries : undefined;
}

function normalizeProviderAttempts(
  value: unknown
): ClientProviderAttempt[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const attempts = value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const provider = getNonEmptyString(entry.provider);
      if (!provider) return null;
      const modelId = getNonEmptyString(entry.modelId);
      const error = sanitizeProviderErrorForClient(entry.error);
      const attempt = getFiniteNumber(entry.attempt);
      const durationMs = getFiniteNumber(entry.durationMs);
      return {
        provider,
        ...(modelId && { modelId }),
        ...(attempt !== undefined && { attempt }),
        ...(durationMs !== undefined && { durationMs }),
        ...(error && { error }),
      };
    })
    .filter((entry): entry is ClientProviderAttempt => entry !== null);

  return attempts.length > 0 ? attempts : undefined;
}

export function sanitizeJobMetadataForClient(
  metadata: unknown
): ClientJobMetadata | undefined {
  if (!isRecord(metadata)) return undefined;

  const traceId = getNonEmptyString(metadata.traceId);
  const analysisMode =
    metadata.analysisMode === 'auto' || metadata.analysisMode === 'thinking'
      ? metadata.analysisMode
      : undefined;
  const enableRAG =
    typeof metadata.enableRAG === 'boolean' ? metadata.enableRAG : undefined;
  const enableWebSearch =
    typeof metadata.enableWebSearch === 'boolean' ||
    metadata.enableWebSearch === 'auto'
      ? metadata.enableWebSearch
      : undefined;
  const provider = getNonEmptyString(metadata.provider);
  const modelId = getNonEmptyString(metadata.modelId);
  const fallbackReason = getNonEmptyString(metadata.fallbackReason);
  const durationMs = getFiniteNumber(metadata.durationMs);
  const ttfbMs = getFiniteNumber(metadata.ttfbMs);
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
  const modeSelectionSource = getNonEmptyString(metadata.modeSelectionSource);
  const providerAttempts = normalizeProviderAttempts(metadata.providerAttempts);
  const handoffs = normalizeHandoffs(metadata.handoffs);
  const toolResultSummaries = normalizeToolResultSummaries(
    metadata.toolResultSummaries
  );

  const result: ClientJobMetadata = {
    ...(traceId && { traceId }),
    ...(analysisMode && { analysisMode }),
    ...(enableRAG !== undefined && { enableRAG }),
    ...(enableWebSearch !== undefined && { enableWebSearch }),
    ...(metadata.queryAsOf !== undefined && { queryAsOf: metadata.queryAsOf }),
    ...(metadata.retrieval !== undefined && { retrieval: metadata.retrieval }),
    ...(handoffs && { handoffs }),
    ...(toolResultSummaries && { toolResultSummaries }),
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

  return Object.keys(result).length > 0 ? result : undefined;
}
