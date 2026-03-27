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
export type RagSource = {
  title: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
};

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
