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

  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
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
