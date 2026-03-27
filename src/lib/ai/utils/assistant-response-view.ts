/**
 * Assistant Response View Helper
 *
 * 긴 AI 응답을 "핵심 요약 + 상세 분석" 구조로 표시하기 위한
 * UI 전용 뷰 모델을 생성합니다.
 */

export interface AssistantResponseView {
  summary: string;
  details: string | null;
  shouldCollapse: boolean;
}

export interface StructuredAssistantResponse {
  summary: string;
  details?: string | null;
  shouldCollapse?: boolean;
}

interface ResponseMetadataInput {
  responseSummary?: unknown;
  responseDetails?: unknown;
  responseShouldCollapse?: unknown;
  summary?: unknown;
  details?: unknown;
  shouldCollapse?: unknown;
  assistantResponseView?: unknown;
}

const COLLAPSE_CHAR_THRESHOLD = 680;
const COLLAPSE_LINE_THRESHOLD = 14;

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * 긴 응답 텍스트를 요약/상세로 분리
 * - 짧은 응답: 그대로 표시
 * - 긴 응답: 첫 단락(또는 앞 2문장)을 요약으로 노출하고 나머지는 접기
 */
export function createAssistantResponseView(
  content: string
): AssistantResponseView {
  const normalized = typeof content === 'string' ? content.trim() : '';
  if (!normalized) {
    return { summary: '', details: null, shouldCollapse: false };
  }

  const lines = normalized
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const isLong =
    normalized.length >= COLLAPSE_CHAR_THRESHOLD ||
    lines.length >= COLLAPSE_LINE_THRESHOLD;

  if (!isLong) {
    return {
      summary: normalized,
      details: null,
      shouldCollapse: false,
    };
  }

  const paragraphs = splitIntoParagraphs(normalized);

  // 단락이 2개 이상이면 첫 단락(헤딩 단락이면 2개)을 요약으로 사용
  if (paragraphs.length >= 2) {
    const firstParagraph = paragraphs[0];
    if (!firstParagraph) {
      return { summary: normalized, details: null, shouldCollapse: false };
    }

    let summary = firstParagraph;
    let detailsStartIndex = 1;

    const isHeadingOnly = /^#{1,3}\s.+$/m.test(summary) && summary.length <= 80;
    const secondParagraph = paragraphs[1];
    if (isHeadingOnly && secondParagraph) {
      summary = `${summary}\n\n${secondParagraph}`;
      detailsStartIndex = 2;
    }

    const details = paragraphs.slice(detailsStartIndex).join('\n\n').trim();
    if (details.length > 0) {
      return { summary, details, shouldCollapse: true };
    }
  }

  // 단락 분리가 어려운 경우 문장 단위로 soft guide 생성
  const sentences = splitSentences(normalized);
  if (sentences.length >= 3) {
    const summary = sentences.slice(0, 2).join(' ').trim();
    const details = sentences.slice(2).join(' ').trim();
    if (summary && details) {
      return { summary, details, shouldCollapse: true };
    }
  }

  // 분리 실패 시 원문 그대로 노출 (내용 유실 방지)
  return {
    summary: normalized,
    details: null,
    shouldCollapse: false,
  };
}

function isStringValue(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isStringValue(value);
}

function isBooleanValue(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function normalizeStructuredResponse(
  data: ResponseMetadataInput
): StructuredAssistantResponse | null {
  const structured = data.assistantResponseView;

  if (structured && typeof structured === 'object') {
    const metadata = structured as Partial<StructuredAssistantResponse>;
    if (isStringValue(metadata.summary)) {
      return {
        summary: metadata.summary,
        details: isNullableString(metadata.details)
          ? metadata.details
          : undefined,
        shouldCollapse: isBooleanValue(metadata.shouldCollapse)
          ? metadata.shouldCollapse
          : undefined,
      };
    }
  }

  const summary = isStringValue(data.responseSummary)
    ? data.responseSummary
    : isStringValue(data.summary)
      ? data.summary
      : undefined;
  if (!summary) return null;

  return {
    summary,
    details: isNullableString(data.responseDetails)
      ? (data.responseDetails ?? null)
      : isNullableString(data.details)
        ? (data.details ?? null)
        : undefined,
    shouldCollapse: isBooleanValue(data.responseShouldCollapse)
      ? data.responseShouldCollapse
      : isBooleanValue(data.shouldCollapse)
        ? data.shouldCollapse
        : undefined,
  };
}

export function resolveAssistantResponseView(
  content: string,
  data: Record<string, unknown> | null | undefined
): AssistantResponseView {
  const normalizedContent = typeof content === 'string' ? content : '';
  const structured = data ? normalizeStructuredResponse(data) : null;

  if (!structured) {
    return createAssistantResponseView(normalizedContent);
  }

  if (!structured.summary.trim()) {
    return createAssistantResponseView(normalizedContent);
  }

  const shouldCollapse =
    typeof structured.shouldCollapse === 'boolean'
      ? structured.shouldCollapse
      : !!(structured.details && structured.details.trim().length > 0);

  return {
    summary: structured.summary,
    details:
      typeof structured.details === 'string' &&
      structured.details.trim().length > 0
        ? structured.details
        : null,
    shouldCollapse,
  };
}
