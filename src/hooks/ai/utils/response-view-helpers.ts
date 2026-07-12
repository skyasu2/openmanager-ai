import type { StructuredAssistantResponse } from '@/lib/ai/utils/assistant-response-view';
import { resolveAssistantResponseView } from '@/lib/ai/utils/assistant-response-view';
import {
  normalizeEvidenceCards,
  normalizeRetrievalMetadata,
} from '@/lib/ai/utils/retrieval-status';
import type {
  EvidenceCard,
  RetrievalMetadata,
} from '@/types/ai/retrieval-status';

export type ResponseSourceData = {
  responseSummary?: unknown;
  responseDetails?: unknown;
  responseShouldCollapse?: unknown;
  summary?: unknown;
  details?: unknown;
  shouldCollapse?: unknown;
  assistantResponseView?: unknown;
  evidenceCards?: unknown;
  traceId?: unknown;
  metadata?: unknown;
  /** 실제 호출된 도구 이름 목록 (Cloud Run done 이벤트에서 전달) */
  toolsCalled?: unknown;
  processingTime?: unknown;
  durationMs?: unknown;
  latencyTier?: unknown;
  resolvedMode?: unknown;
  modeSelectionSource?: unknown;
  fallback?: unknown;
  usedFallback?: unknown;
  fallbackReason?: unknown;
};

function getNestedMetadataValue(
  doneData: ResponseSourceData | undefined,
  key: string
): unknown {
  if (!doneData) return undefined;
  const metadata = doneData.metadata;
  if (metadata && typeof metadata === 'object' && key in metadata) {
    return (metadata as Record<string, unknown>)[key];
  }
  return undefined;
}

export function buildStructuredResponseView(
  doneData: ResponseSourceData | undefined
): StructuredAssistantResponse | null {
  if (!doneData) return null;

  const responseMeta = doneData as Record<string, unknown>;
  const structured = resolveAssistantResponseView('', responseMeta);
  const summary = structured.summary.trim();

  if (!summary) return null;

  return {
    summary,
    details: structured.details,
    shouldCollapse: structured.shouldCollapse,
  };
}

export function extractProcessingTimeFromDoneData(
  doneData: ResponseSourceData | undefined
): number | undefined {
  if (!doneData) return undefined;

  const directValue =
    typeof doneData.processingTime === 'number'
      ? doneData.processingTime
      : typeof doneData.durationMs === 'number'
        ? doneData.durationMs
        : undefined;

  if (typeof directValue === 'number' && Number.isFinite(directValue)) {
    return Math.max(0, Math.round(directValue));
  }

  const nestedDuration = getNestedMetadataValue(doneData, 'durationMs');
  if (typeof nestedDuration === 'number' && Number.isFinite(nestedDuration)) {
    return Math.max(0, Math.round(nestedDuration));
  }

  return undefined;
}

export function extractLatencyTierFromDoneData(
  doneData: ResponseSourceData | undefined
): 'fast' | 'normal' | 'slow' | 'very_slow' | undefined {
  const candidates = [
    doneData?.latencyTier,
    getNestedMetadataValue(doneData, 'latencyTier'),
  ];

  for (const value of candidates) {
    if (
      value === 'fast' ||
      value === 'normal' ||
      value === 'slow' ||
      value === 'very_slow'
    ) {
      return value;
    }
  }

  return undefined;
}

export function extractResolvedModeFromDoneData(
  doneData: ResponseSourceData | undefined
): 'single' | 'multi' | undefined {
  const candidates = [
    doneData?.resolvedMode,
    getNestedMetadataValue(doneData, 'resolvedMode'),
  ];

  for (const value of candidates) {
    if (value === 'single' || value === 'multi') {
      return value;
    }
  }

  return undefined;
}

export function extractModeSelectionSourceFromDoneData(
  doneData: ResponseSourceData | undefined
): string | undefined {
  const candidates = [
    doneData?.modeSelectionSource,
    getNestedMetadataValue(doneData, 'modeSelectionSource'),
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

export function extractRetrievalMetadataFromDoneData(
  doneData: ResponseSourceData | undefined
): RetrievalMetadata | undefined {
  if (!doneData) return undefined;

  const direct = normalizeRetrievalMetadata(
    (doneData as Record<string, unknown>).retrieval
  );
  if (direct) return direct;

  return normalizeRetrievalMetadata(
    getNestedMetadataValue(doneData, 'retrieval')
  );
}

export function extractEvidenceCardsFromDoneData(
  doneData: ResponseSourceData | undefined
): EvidenceCard[] | undefined {
  if (!doneData) return undefined;

  const direct = normalizeEvidenceCards(
    (doneData as Record<string, unknown>).evidenceCards
  );
  if (direct.length > 0) return direct;

  const nested = normalizeEvidenceCards(
    getNestedMetadataValue(doneData, 'evidenceCards')
  );
  return nested.length > 0 ? nested : undefined;
}
