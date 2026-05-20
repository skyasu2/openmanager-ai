import type { RagSource } from '../../lib/ai-sdk-utils';
import {
  buildInternalImplementationPathRefusal,
  shouldRefuseInternalImplementationPathRequest,
  type InternalDisclosureMode,
} from './internal-disclosure-policy';
import { THRESHOLDS } from '../../data/precomputed-state-core';

const URL_PATTERN = /https?:\/\//i;

type ToolResultLike = {
  toolName: string;
  result: unknown;
};

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readWebResults(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => readRecord(item) !== null)
    : [];
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readKnowledgeResults(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => readRecord(item) !== null)
    : [];
}

function readKnowledgeResultText(result: Record<string, unknown>): string {
  return [
    readString(result.title),
    readString(result.content),
    readString(result.summary),
    readString(result.description),
    readString(result.url),
  ]
    .filter((item): item is string => item !== null)
    .join('\n');
}

function readKnowledgeResultTitle(result: Record<string, unknown>): string {
  return (
    readString(result.title) ??
    readString(result.name) ??
    readString(result.summary) ??
    '내부 지식 문서'
  );
}

function readKnowledgeResultSource(result: Record<string, unknown>): string {
  return (
    readString(result.sourceType) ??
    readString(result.type) ??
    readString(result.category) ??
    'knowledge'
  );
}

function readKnowledgeResultScore(result: Record<string, unknown>): number {
  return (
    readNumber(result.similarity) ??
    readNumber(result.score) ??
    0
  );
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function extractRepoLikePaths(text: string): string[] {
  const pathMatches =
    text.match(
      /(?:^|[\s`"'(])((?:\.{1,2}\/)?(?:[A-Za-z0-9_.@-]+\/){1,}[A-Za-z0-9_.@*-]+(?:\.[A-Za-z0-9]+)?)/g
    ) ?? [];

  return uniqueValues(
    pathMatches
      .map((match) => match.replace(/^[\s`"'(]+/, '').replace(/[),.;:`"']+$/g, ''))
      .filter((path) => path.includes('/'))
      .filter((path) => !/^(?:https?:)?\/\//i.test(path))
      .filter((path) => !/\/path\/to\//i.test(path))
      .slice(0, 8)
  );
}

function uniqueWebSources(sources: RagSource[]): RagSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (source.sourceType !== 'web' || !source.url) return false;
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export function buildWebCitationAppendix(
  answer: string,
  sources: RagSource[]
): string {
  const webSources = uniqueWebSources(sources).slice(0, 3);
  if (webSources.length === 0) return '';
  if (URL_PATTERN.test(answer)) return '';

  const citations = webSources.map((source) => {
    const title = source.title.trim() || 'Web source';
    return `- [${title}](${source.url})`;
  });

  return `\n\n참고 출처\n${citations.join('\n')}`;
}

export function buildWebSearchFallbackAnswer(
  toolResults: ToolResultLike[]
): string | null {
  const webOutputs = toolResults
    .filter((result) => result.toolName === 'searchWeb')
    .map((result) => readRecord(result.result))
    .filter((result): result is Record<string, unknown> => result !== null);
  if (webOutputs.length === 0) return null;

  for (const output of webOutputs) {
    const answer = readString(output.answer);
    if (answer) {
      return answer;
    }
  }

  for (const output of webOutputs) {
    const error = readString(output.error);
    if (error) {
      return `웹 검색 결과를 수신하지 못했습니다: ${error}`;
    }
  }

  for (const output of webOutputs) {
    const results = readWebResults(output.results);
    const firstResult = results[0];
    if (!firstResult) continue;

    const title = readString(firstResult.title) ?? '웹 검색 결과';
    const content = readString(firstResult.content);

    if (!content) {
      return `웹 검색 결과를 확인했습니다: ${title}`;
    }

    const summary =
      content.length > 280 ? `${content.slice(0, 277).trimEnd()}...` : content;
    return `웹 검색 결과 기준 요약: ${title}\n\n${summary}`;
  }

  return null;
}

export function hasWebSearchFallbackAnswer(
  toolResults: ToolResultLike[]
): boolean {
  return toolResults.some((result) => {
    if (result.toolName !== 'searchWeb') return false;
    const output = readRecord(result.result);
    return output !== null && readString(output.answer) !== null;
  });
}

function buildKnowledgeEvidenceSummaries(
  results: Array<Record<string, unknown>>,
  maxItems = 2
): string[] {
  return results.slice(0, maxItems).flatMap((result) => {
    const content = readKnowledgeResultText(result)
      .replace(/`[^`]*\/[^`]*`/g, '')
      .replace(/\b(?:[\w.-]+\/){1,}[\w./-]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!content) return [];

    const title = readKnowledgeResultTitle(result);
    const summary =
      content.length > 260 ? `${content.slice(0, 257).trim()}...` : content;

    return [`- ${title}: ${summary}`];
  });
}

function buildOTelStatusCriteriaLines(query: string): string[] {
  const asksAboutOTel = /otel|opentelemetry|ssot|pre[-\s]?generated/i.test(query);
  const asksAboutStatusCriteria = /18대|서버|상태|판단|판정|기준/i.test(query);
  if (!asksAboutOTel || !asksAboutStatusCriteria) return [];

  const { cpu, memory, disk } = THRESHOLDS;
  const criticalThresholds =
    `CPU ${cpu.critical}% / Memory ${memory.critical}% / ` +
    `Disk ${disk.critical}%`;
  const warningThresholds =
    `CPU ${cpu.warning}%, Memory ${memory.warning}%, Disk ${disk.warning}%`;

  return [
    '',
    'OTel 상태 판단 기준',
    `- 18대 서버 inventory와 현재 메트릭은 pre-generated OTel data slot을 SSOT로 봅니다.`,
    '- 현재 CPU/Memory/Disk 값은 KRL에서 추정하지 않고 monitoring data tool 또는 OTel slot 결과를 우선합니다.',
    '- P0 offline: CPU, Memory, Disk가 모두 0인 경우',
    '- P1/P2 critical: CPU와 Memory가 모두 critical 임계값' +
      `(CPU ${cpu.critical}%, Memory ${memory.critical}%) 이상이거나, ` +
      `${criticalThresholds} 중 하나가 critical 임계값 이상인 경우`,
    '- P3/P4 warning: CPU/Memory/Disk 중 2개 이상이 warning 임계값' +
      `(${warningThresholds}) 이상이거나, 하나라도 warning 임계값 이상인 경우`,
    `- P99 online: ${warningThresholds} warning 임계값 미만인 경우`,
  ];
}

export function appendOTelStatusCriteriaIfMissing(
  query: string,
  answer: string
): string {
  const criteriaLines = buildOTelStatusCriteriaLines(query);
  if (criteriaLines.length === 0) return answer;

  const hasCompleteCriteria =
    answer.includes('OTel 상태 판단 기준') &&
    answer.includes('P0 offline') &&
    answer.includes('P1/P2 critical') &&
    answer.includes('P3/P4 warning') &&
    answer.includes('P99 online');
  if (hasCompleteCriteria) return answer;

  const trimmedAnswer = answer.trim();
  const criteriaText = criteriaLines.join('\n').trim();
  return [trimmedAnswer, criteriaText].filter(Boolean).join('\n\n');
}

export function buildGroundedKRLSystemPrompt(
  kbResults: Array<Record<string, unknown>>,
  query: string
): string {
  const contextSections = kbResults.slice(0, 3).map((result, index) => {
    const title = readKnowledgeResultTitle(result);
    const source = readKnowledgeResultSource(result);
    const score = readKnowledgeResultScore(result);
    const scoreText = score > 0 ? ` (관련도: ${score.toFixed(2)})` : '';
    const content = readKnowledgeResultText(result).trim();
    return `### ${index + 1}. ${title} [출처: ${source}${scoreText}]\n${content}`;
  });

  const otelLines = buildOTelStatusCriteriaLines(query);
  const otelSection =
    otelLines.length > 0
      ? `\n\n[OTel 상태 판단 기준 — 이 질문에는 답변에 반드시 포함]\n${otelLines.join('\n')}`
      : '';

  return [
    '당신은 OpenManager AI 내부 지식 문서 전문가입니다.',
    '',
    '[엄격한 제약]',
    '- 아래 [KB 검색 결과]에 있는 내용만 근거로 답변하라.',
    '- KB 결과에 없는 파일 경로, 함수명, 코드, 구현 세부사항은 절대 생성하지 마라.',
    '- KB 결과 밖의 내용을 "아마", "추정", "~일 것이다"로 포함하지 마라.',
    '- KB 결과에 없는 내용을 질문받으면 "해당 내용은 검색된 근거에서 확인되지 않습니다"라고 명시하라.',
    '',
    '[답변 스타일]',
    '- 한국어로 답변. 기술 용어(파일 경로, 함수명, 설정 키)는 원문 그대로.',
    '- 질의 의도에 맞는 길이로 정리. "3줄 요약"이면 3줄, "상세히"면 상세히.',
    '- "물론입니다", "답변 드리겠습니다" 같은 머리말 없이 바로 답변.',
    '',
    `[KB 검색 결과]${otelSection}`,
    '',
    ...contextSections,
  ].join('\n');
}

export function buildKnowledgeBaseGroundedAnswer(
  query: string,
  toolResults: ToolResultLike[],
  options: { internalDisclosureMode?: InternalDisclosureMode } = {}
): string | null {
  if (
    shouldRefuseInternalImplementationPathRequest(
      query,
      options.internalDisclosureMode
    )
  ) {
    return buildInternalImplementationPathRefusal(query);
  }

  const knowledgeOutputs = toolResults
    .filter((result) => result.toolName === 'searchKnowledgeBase')
    .map((result) => readRecord(result.result))
    .filter((result): result is Record<string, unknown> => result !== null);

  if (knowledgeOutputs.length === 0) return null;

  const knowledgeResults = knowledgeOutputs.flatMap((output) => [
    ...readKnowledgeResults(output.results),
    ...readKnowledgeResults(output.similarCases),
  ]);

  if (knowledgeResults.length === 0) {
    return [
      '내부 근거를 찾지 못했습니다.',
      `- 질의: ${query}`,
      '- `searchKnowledgeBase` 결과에서 관련 문서나 파일 경로가 0건으로 확인되었습니다.',
      '- 정확한 repo 경로, 문서명, 운영 파일 위치는 추정하지 않습니다.',
    ].join('\n');
  }

  const topResults = knowledgeResults.slice(0, 3);
  const paths = extractRepoLikePaths(
    topResults.map((result) => readKnowledgeResultText(result)).join('\n')
  );
  const evidenceLines = topResults.map((result, index) => {
    const title = readKnowledgeResultTitle(result);
    const source = readKnowledgeResultSource(result);
    const score = readKnowledgeResultScore(result);
    const scoreText = score > 0 ? `, score ${score.toFixed(2)}` : '';
    return `${index + 1}. ${title} (${source}${scoreText})`;
  });
  const summaryLines = buildKnowledgeEvidenceSummaries(topResults);
  const otelStatusCriteriaLines = buildOTelStatusCriteriaLines(query);

  return [
    '내부 지식 검색 결과 기준으로만 답합니다.',
    `- 질의: ${query}`,
    paths.length > 0
      ? ['- 확인된 파일/문서 경로:', ...paths.map((path) => `  - \`${path}\``)].join('\n')
      : '- 정확한 repo 파일 경로는 검색 근거에서 확인되지 않았습니다.',
    '',
    '근거 문서',
    ...evidenceLines,
    ...(summaryLines.length > 0 ? ['', '근거 요약', ...summaryLines] : []),
    ...otelStatusCriteriaLines,
    '',
    '근거에 없는 경로는 추정하지 않았습니다.',
  ].join('\n');
}
