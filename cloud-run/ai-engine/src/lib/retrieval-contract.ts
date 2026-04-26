export const RETRIEVAL_MODES = [
  'off',
  'lite',
  'text-only',
  'cosine-neighbor',
] as const;

export type RetrievalMode = (typeof RETRIEVAL_MODES)[number];

export const RETRIEVAL_SUPPRESSED_REASONS = [
  'disabled',
  'not_needed',
  'no_results',
  'budget_guard',
  'unavailable',
] as const;

export type RetrievalSuppressedReason =
  (typeof RETRIEVAL_SUPPRESSED_REASONS)[number];

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

export interface RetrievalMetadata {
  retrievalEnabled: boolean;
  retrievalUsed: boolean;
  retrievalMode: RetrievalMode;
  suppressedReason?: RetrievalSuppressedReason;
  evidenceCount: number;
  webUsed: boolean;
}

export interface LegacyRagSource {
  title: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
}

type RetrievalMetadataInput = Partial<RetrievalMetadata> &
  Pick<RetrievalMetadata, 'retrievalEnabled'>;

export function createRetrievalMetadata(
  input: RetrievalMetadataInput
): RetrievalMetadata {
  if (!input.retrievalEnabled) {
    return {
      retrievalEnabled: false,
      retrievalUsed: false,
      retrievalMode: 'off',
      suppressedReason: 'disabled',
      evidenceCount: 0,
      webUsed: false,
    };
  }

  const evidenceCount = Math.max(0, Math.floor(input.evidenceCount ?? 0));
  const retrievalUsed = input.retrievalUsed ?? evidenceCount > 0;

  return {
    retrievalEnabled: true,
    retrievalUsed,
    retrievalMode: input.retrievalMode ?? 'lite',
    ...(retrievalUsed
      ? {}
      : { suppressedReason: input.suppressedReason ?? 'not_needed' }),
    evidenceCount: retrievalUsed ? evidenceCount : 0,
    webUsed: input.webUsed ?? false,
  };
}

export function legacyRagSourcesToEvidenceCards(
  sources: readonly LegacyRagSource[]
): EvidenceCard[] {
  return sources.map((source, index) => {
    const title = source.title || 'Untitled evidence';

    return {
      id: `legacy-rag-${index}-${slugify(title)}`,
      title,
      summary: title,
      sourceType: mapLegacySourceType(source),
      score: clampScore(source.similarity),
      ...(source.category && { category: source.category }),
      reason: `legacy-rag-source:${source.sourceType || 'unknown'}`,
      ...(source.url && { url: source.url }),
    };
  });
}

function mapLegacySourceType(source: LegacyRagSource): EvidenceSourceType {
  const sourceType = source.sourceType.toLowerCase();
  const category = source.category?.toLowerCase() ?? '';

  if (sourceType === 'web' || source.url) return 'web';
  if (sourceType.includes('runbook') || category.includes('runbook')) {
    return 'runbook';
  }
  if (sourceType.includes('incident') || category.includes('incident')) {
    return 'incident';
  }
  return 'knowledge';
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'evidence';
}
