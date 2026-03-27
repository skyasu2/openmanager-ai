import type { StructuredAssistantResponse } from '@/lib/ai/utils/assistant-response-view';
import { resolveAssistantResponseView } from '@/lib/ai/utils/assistant-response-view';
import type { StreamRagSource } from '../types/stream-rag.types';

export type ResponseSourceData = {
  responseSummary?: unknown;
  responseDetails?: unknown;
  responseShouldCollapse?: unknown;
  summary?: unknown;
  details?: unknown;
  shouldCollapse?: unknown;
  assistantResponseView?: unknown;
  ragSources?: unknown;
  traceId?: unknown;
  metadata?: unknown;
};

export function normalizeRagSources(
  sources: unknown
): StreamRagSource[] | null {
  if (!Array.isArray(sources)) return null;
  return sources as StreamRagSource[];
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
