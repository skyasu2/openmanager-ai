import type { UIMessage } from '@ai-sdk/react';
import { describe, expect, it } from 'vitest';
import type { AsyncQueryResult } from '../useAsyncAIQuery';
import {
  buildAssistantMessageFromAsyncResult,
  mergeFinishedAssistantIntoMessages,
} from './async-result-message';

describe('async-result-message', () => {
  it('preserves async job runtime metadata for operator-facing UI', () => {
    const result: AsyncQueryResult = {
      success: true,
      response: '분석 완료',
      processingTimeMs: 1987,
      latencyTier: 'slow',
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_complexity',
      provider: 'mistral',
      modelId: 'mistral-large-latest',
      usedFallback: true,
      fallbackReason: 'empty_response',
      providerAttempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          durationMs: 820,
          error: 'raw tool-call JSON',
        },
      ],
    };

    const message = buildAssistantMessageFromAsyncResult(
      result,
      () => 'assistant-job-1'
    );

    expect(message).toMatchObject({
      id: 'assistant-job-1',
      role: 'assistant',
      content: '분석 완료',
      metadata: {
        processingTime: 1987,
        latencyTier: 'slow',
        resolvedMode: 'multi',
        modeSelectionSource: 'auto_complexity',
        provider: 'mistral',
        modelId: 'mistral-large-latest',
        usedFallback: true,
        fallbackReason: 'empty_response',
        providerAttempts: [
          {
            provider: 'cerebras',
            modelId: 'llama3.1-8b',
            attempt: 1,
            durationMs: 820,
            error: 'raw tool-call JSON',
          },
        ],
      },
    });
  });

  it('merges finished assistant metadata by id and injects fallback trace id when missing', () => {
    const previousMessages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: '초안 응답' }],
      },
    ] as UIMessage[];
    const finishedMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: '최종 응답' }],
      metadata: {
        toolResultSummaries: [
          {
            toolName: 'searchKnowledgeBase',
            label: '지식 근거 검색',
            status: 'completed',
            summary: '2건의 문서를 참조했습니다.',
          },
        ],
      },
    } as unknown as UIMessage;

    const mergedMessages = mergeFinishedAssistantIntoMessages(
      previousMessages,
      finishedMessage,
      'fallback-trace-1'
    );

    expect(mergedMessages[0]).toMatchObject({
      parts: [{ type: 'text', text: '최종 응답' }],
      metadata: {
        traceId: 'fallback-trace-1',
        toolResultSummaries: [
          expect.objectContaining({
            toolName: 'searchKnowledgeBase',
          }),
        ],
      },
    });
  });
});
