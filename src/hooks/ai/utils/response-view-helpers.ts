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
  /** 실제 호출된 도구 이름 목록 (Cloud Run done 이벤트에서 전달) */
  toolsCalled?: unknown;
  /** 사용자 선택 분석 모드 */
  analysisMode?: unknown;
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

export function extractAnalysisModeFromDoneData(
  doneData: ResponseSourceData | undefined
): 'auto' | 'thinking' | undefined {
  if (!doneData) return undefined;

  const directValue = doneData.analysisMode;
  if (directValue === 'auto' || directValue === 'thinking') {
    return directValue;
  }

  const metadata = doneData.metadata;
  if (
    metadata &&
    typeof metadata === 'object' &&
    'analysisMode' in metadata &&
    (metadata as { analysisMode?: unknown }).analysisMode
  ) {
    const nestedValue = (metadata as { analysisMode?: unknown }).analysisMode;
    if (nestedValue === 'auto' || nestedValue === 'thinking') {
      return nestedValue;
    }
  }

  return undefined;
}
