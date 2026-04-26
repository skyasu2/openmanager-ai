import {
  createRetrievalMetadata,
  legacyRagSourcesToEvidenceCards,
  type EvidenceCard,
  type EvidenceSourceType,
  type LegacyRagSource,
  type RetrievalMetadata,
  type RetrievalMode,
  type RetrievalSuppressedReason,
  RETRIEVAL_MODES,
  RETRIEVAL_SUPPRESSED_REASONS,
} from './retrieval-contract';

/**
 * AI SDK v6 호환: toolResult에서 output 추출
 * v6는 'output', 이전 버전은 'result' 사용
 */
export function extractToolResultOutput(toolResult: unknown): unknown {
  const tr = toolResult as Record<string, unknown>;
  return tr.result ?? tr.output;
}

/**
 * RAG source 타입 정의
 */
export type RagSource = LegacyRagSource;

/**
 * toolResult에서 RAG sources를 추출하는 유틸리티.
 * searchKnowledgeBase, searchWeb 결과를 통합 처리.
 */
export function extractRagSources(
  toolName: string,
  toolOutput: unknown
): RagSource[] {
  if (toolOutput === null || toolOutput === undefined || typeof toolOutput !== 'object') return [];

  const output = toolOutput as Record<string, unknown>;

  if (toolName === 'searchKnowledgeBase') {
    const similarCases = (output.similarCases ?? output.results) as
      | Array<Record<string, unknown>>
      | undefined;
    if (!Array.isArray(similarCases)) return [];

    return similarCases.map((doc) => ({
      title: String(doc.title ?? doc.name ?? 'Unknown'),
      similarity: Number(doc.similarity ?? doc.score ?? 0),
      sourceType: String(doc.sourceType ?? doc.type ?? 'vector'),
      category: doc.category ? String(doc.category) : undefined,
    }));
  }

  if (toolName === 'searchWeb') {
    const webResults = output.results as
      | Array<Record<string, unknown>>
      | undefined;
    if (!Array.isArray(webResults)) return [];

    return webResults.map((doc) => ({
      title: String(doc.title ?? 'Web Result'),
      similarity: Number(doc.score ?? 0),
      sourceType: 'web',
      category: 'web-search',
      url: doc.url ? String(doc.url) : undefined,
    }));
  }

  return [];
}

export function extractEvidenceCards(
  toolName: string,
  toolOutput: unknown
): EvidenceCard[] {
  const directCards = readDirectEvidenceCards(toolOutput);
  if (directCards.length > 0) {
    return directCards;
  }

  return legacyRagSourcesToEvidenceCards(
    extractRagSources(toolName, toolOutput)
  );
}

export function extractRetrievalMetadata(
  toolName: string,
  toolOutput: unknown
): RetrievalMetadata | undefined {
  if (toolName !== 'searchKnowledgeBase') return undefined;
  if (toolOutput === null || toolOutput === undefined || typeof toolOutput !== 'object') {
    return undefined;
  }

  const output = toolOutput as Record<string, unknown>;
  const retrieval = output.retrieval;
  if (retrieval === null || retrieval === undefined || typeof retrieval !== 'object') {
    return undefined;
  }

  const raw = retrieval as Record<string, unknown>;
  return createRetrievalMetadata({
    retrievalEnabled: readBoolean(raw.retrievalEnabled) ?? true,
    retrievalUsed: readBoolean(raw.retrievalUsed),
    retrievalMode: readRetrievalMode(raw.retrievalMode),
    suppressedReason: readSuppressedReason(raw.suppressedReason),
    evidenceCount: readNumber(raw.evidenceCount),
    webUsed: readBoolean(raw.webUsed),
  });
}

export function mergeRetrievalMetadata(
  current: RetrievalMetadata | undefined,
  next: RetrievalMetadata | undefined
): RetrievalMetadata | undefined {
  if (!next) return current;
  if (!current) return next;

  const retrievalUsed = current.retrievalUsed || next.retrievalUsed;
  const evidenceCount = current.evidenceCount + next.evidenceCount;
  return createRetrievalMetadata({
    retrievalEnabled: current.retrievalEnabled || next.retrievalEnabled,
    retrievalUsed,
    retrievalMode: next.retrievalMode === 'off' ? current.retrievalMode : next.retrievalMode,
    evidenceCount,
    webUsed: current.webUsed || next.webUsed,
    suppressedReason: retrievalUsed
      ? undefined
      : current.suppressedReason ?? next.suppressedReason,
  });
}

function readDirectEvidenceCards(toolOutput: unknown): EvidenceCard[] {
  if (toolOutput === null || toolOutput === undefined || typeof toolOutput !== 'object') {
    return [];
  }

  const output = toolOutput as Record<string, unknown>;
  const cards = output.evidenceCards;
  if (!Array.isArray(cards)) return [];

  return cards
    .map((card): EvidenceCard | null => {
      if (card === null || card === undefined || typeof card !== 'object') {
        return null;
      }

      const record = card as Record<string, unknown>;
      const id = readString(record.id);
      const title = readString(record.title);
      const summary = readString(record.summary);
      const sourceType = readEvidenceSourceType(record.sourceType);
      const score = readNumber(record.score);

      if (!id || !title || !summary || !sourceType || score === undefined) {
        return null;
      }

      return {
        id,
        title,
        summary,
        sourceType,
        score,
        ...(readString(record.category) && { category: readString(record.category) }),
        ...(readString(record.reason) && { reason: readString(record.reason) }),
        ...(readString(record.url) && { url: readString(record.url) }),
      };
    })
    .filter((card): card is EvidenceCard => card !== null);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readEvidenceSourceType(value: unknown): EvidenceSourceType | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === 'knowledge' || value === 'incident' || value === 'runbook' || value === 'web') {
    return value;
  }
  return undefined;
}

function readRetrievalMode(value: unknown): RetrievalMode | undefined {
  return typeof value === 'string' &&
    RETRIEVAL_MODES.includes(value as RetrievalMode)
    ? (value as RetrievalMode)
    : undefined;
}

function readSuppressedReason(
  value: unknown
): RetrievalSuppressedReason | undefined {
  return typeof value === 'string' &&
    RETRIEVAL_SUPPRESSED_REASONS.includes(value as RetrievalSuppressedReason)
    ? (value as RetrievalSuppressedReason)
    : undefined;
}

/**
 * Multimodal content part 타입 (AI SDK v6 호환)
 */
type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; mimeType?: string }
  | { type: 'file'; data: string; mimeType: string };

/**
 * 텍스트 + 이미지 + 파일을 multimodal content 배열로 빌드.
 * 첨부파일이 없으면 원본 텍스트를 그대로 반환.
 */
export function buildMultimodalContent(
  text: string,
  images?: Array<{ data: string; mimeType: string }>,
  files?: Array<{ data: string; mimeType: string }>
): string | MultimodalContentPart[] {
  const hasImages = images && images.length > 0;
  const hasFiles = files && files.length > 0;

  if (!hasImages && !hasFiles) return text;

  const parts: MultimodalContentPart[] = [{ type: 'text', text }];

  if (hasImages) {
    for (const img of images) {
      parts.push({ type: 'image', image: img.data, mimeType: img.mimeType });
    }
  }

  if (hasFiles) {
    for (const file of files) {
      parts.push({ type: 'file', data: file.data, mimeType: file.mimeType });
    }
  }

  return parts;
}
