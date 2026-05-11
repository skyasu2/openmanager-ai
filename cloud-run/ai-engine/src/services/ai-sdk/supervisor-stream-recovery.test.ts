import type { ToolSet } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  emitGenericEmptySupervisorStreamFallback,
  recoverEmptySupervisorStreamOutput,
  type SupervisorStreamRecoveryResult,
} from './supervisor-stream-recovery';
import type { StreamEvent } from './supervisor-types';

async function collectRecoveryEvents(
  input: Partial<Parameters<typeof recoverEmptySupervisorStreamOutput>[0]> = {}
): Promise<{
  events: StreamEvent[];
  result: SupervisorStreamRecoveryResult;
}> {
  const generator = recoverEmptySupervisorStreamOutput({
    fullText: '',
    firstChunkMs: null,
    streamError: null,
    queryText: 'empty response test',
    steps: [],
    collectedToolResults: [],
    filteredTools: {} as ToolSet,
    provider: 'groq',
    modelId: 'test-model',
    providerStartTime: Date.now(),
    startTime: Date.now(),
    ...input,
  });
  const events: StreamEvent[] = [];

  for (;;) {
    const next = await generator.next();
    if (next.done) {
      return { events, result: next.value };
    }
    events.push(next.value);
  }
}

describe('recoverEmptySupervisorStreamOutput', () => {
  it('uses domain evidence fallback before generic empty-response text', async () => {
    const { events, result } = await collectRecoveryEvents({
      streamError: new Error('empty model output'),
      domainEvidence: {
        id: 'sample-evidence',
        prompt: 'Use exact sample facts.',
        fallback: 'acct-123 is the highest-risk account.',
      },
    });

    expect(events).toEqual([
      {
        type: 'text_delta',
        data: 'acct-123 is the highest-risk account.',
      },
    ]);
    expect(result.fullText).toBe('acct-123 is the highest-risk account.');
    expect(result.streamError).toBeNull();
  });

  it('recovers empty model text from a finalAnswer tool result', async () => {
    const { events, result } = await collectRecoveryEvents({
      steps: [
        {
          toolResults: [
            {
              toolName: 'finalAnswer',
              result: { answer: 'Recovered answer from tool result.' },
            },
          ],
        },
      ],
    });

    expect(events).toEqual([
      {
        type: 'text_delta',
        data: 'Recovered answer from tool result.',
      },
    ]);
    expect(result.fullText).toBe('Recovered answer from tool result.');
  });

  it('leaves empty output empty so provider retry can run before generic fallback', async () => {
    const streamError = new Error('empty model output');
    const { events, result } = await collectRecoveryEvents({
      streamError,
    });

    expect(events).toEqual([]);
    expect(result.fullText).toBe('');
    expect(result.streamError).toBe(streamError);
  });
});

describe('emitGenericEmptySupervisorStreamFallback', () => {
  it('emits the generic warning after provider retry is no longer available', async () => {
    const generator = emitGenericEmptySupervisorStreamFallback({
      streamError: null,
      queryText: 'empty response test',
      steps: [],
      provider: 'groq',
      modelId: 'test-model',
      startTime: Date.now(),
    });
    const events: StreamEvent[] = [];

    for (;;) {
      const next = await generator.next();
      if (next.done) {
        expect(next.value).toContain('응답 본문이 비어 있어');
        break;
      }
      events.push(next.value);
    }

    expect(events[0]).toEqual({
      type: 'warning',
      data: {
        code: 'EMPTY_RESPONSE',
        message: '모델이 빈 응답을 반환했습니다. 기본 안내 문구로 대체합니다.',
      },
    });
    expect(events[1]).toEqual({
      type: 'text_delta',
      data: '응답 본문이 비어 있어 요약 결과를 생성하지 못했습니다. 질문을 조금 더 구체적으로 다시 시도해 주세요.',
    });
  });
});
