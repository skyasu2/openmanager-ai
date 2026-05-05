import type { RagSource } from '../../lib/ai-sdk-utils';

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
