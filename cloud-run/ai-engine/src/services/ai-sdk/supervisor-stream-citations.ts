import type { RagSource } from '../../lib/ai-sdk-utils';

const URL_PATTERN = /https?:\/\//i;

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
