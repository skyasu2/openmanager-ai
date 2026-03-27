import type { StreamEvent } from '../supervisor';

export function unifyResults(
  agentResults: Array<{ agent: string; response: string }>
): string {
  if (agentResults.length === 0) {
    return '결과를 생성할 수 없습니다.';
  }

  if (agentResults.length === 1) {
    return agentResults[0].response;
  }

  const sections = agentResults.map(({ agent, response }) => {
    const agentLabel = agent.replace(' Agent', '');
    return `## ${agentLabel} 분석\n${response}`;
  });

  return `# 종합 분석 결과\n\n${sections.join('\n\n---\n\n')}`;
}

/**
 * Stream pre-computed text as text_delta events in chunks.
 * Used by Collect-then-Stream pattern to deliver unified results.
 */
export function* streamTextInChunks(
  text: string,
  chunkSize = 80
): Generator<StreamEvent> {
  for (let i = 0; i < text.length; i += chunkSize) {
    yield { type: 'text_delta', data: text.slice(i, i + chunkSize) };
  }
}
