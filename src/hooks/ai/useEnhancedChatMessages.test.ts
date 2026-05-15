/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnhancedChatMessages } from './useEnhancedChatMessages';

const mocks = vi.hoisted(() => ({
  transformUIMessageToEnhanced: vi.fn(),
}));

vi.mock('./utils/message-helpers', () => ({
  transformUIMessageToEnhanced: mocks.transformUIMessageToEnhanced,
}));

function createMessage(
  id: string,
  role: UIMessage['role'],
  text: string
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
  };
}

describe('useEnhancedChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transformUIMessageToEnhanced.mockImplementation(
      (message: UIMessage, _options: unknown, isLastMessage: boolean) => ({
        id: message.id,
        role: message.role,
        content: isLastMessage ? '마지막 메시지' : '일반 메시지',
      })
    );
  });

  it('message 단위로 변환하며 마지막 메시지 여부를 올바르게 전달한다', () => {
    const messages = [
      createMessage('user-1', 'user', '질문'),
      createMessage('assistant-1', 'assistant', '응답'),
    ];

    const { result } = renderHook(() =>
      useEnhancedChatMessages({
        messages,
        isLoading: true,
        currentMode: 'streaming',
        traceIdByMessageId: { 'assistant-1': 'trace-1' },
        deferredAssistantMetadataByMessageId: {
          'assistant-1': { responseSummary: '요약' },
        },
        deferredToolResultsByMessageId: {
          'assistant-1': [
            { toolName: 'getServerMetrics', result: { ok: true } },
          ],
        },
        streamRagSources: [
          {
            title: 'KB',
            similarity: 0.9,
            sourceType: 'knowledge_base',
          },
        ],
      })
    );

    expect(mocks.transformUIMessageToEnhanced).toHaveBeenCalledTimes(2);
    const firstCall = mocks.transformUIMessageToEnhanced.mock.calls[0];
    const secondCall = mocks.transformUIMessageToEnhanced.mock.calls[1];
    expect(firstCall?.[0]).toEqual(messages[0]);
    expect(firstCall?.[2]).toBe(false);
    expect(secondCall?.[0]).toEqual(messages[1]);
    expect(secondCall?.[2]).toBe(true);
    expect(result.current).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: '일반 메시지',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '마지막 메시지',
      },
    ]);
  });

  it('의존성이 바뀌면 필요한 메시지 변환을 다시 수행한다', () => {
    const messages = [createMessage('assistant-1', 'assistant', '응답')];

    const { rerender } = renderHook(
      (props: { currentMode?: 'streaming' | 'job-queue' }) =>
        useEnhancedChatMessages({
          messages,
          isLoading: false,
          currentMode: props.currentMode,
          traceIdByMessageId: {},
          deferredAssistantMetadataByMessageId: {},
          deferredToolResultsByMessageId: {},
          streamRagSources: undefined,
        }),
      {
        initialProps: {
          currentMode: 'streaming' as const,
        },
      }
    );

    expect(mocks.transformUIMessageToEnhanced).toHaveBeenCalledTimes(1);

    rerender({
      currentMode: 'job-queue' as const,
    });

    expect(mocks.transformUIMessageToEnhanced).toHaveBeenCalledTimes(2);
  });

  it('Incremental transform: 변경된 메시지만 재변환한다', () => {
    const messages = [
      createMessage('assistant-1', 'assistant', '첫 번째 응답'),
      createMessage('assistant-2', 'assistant', '두 번째 응답'),
    ];

    const { rerender } = renderHook(
      (props: { traceIdByMessageId: Record<string, string> }) =>
        useEnhancedChatMessages({
          messages,
          isLoading: false,
          currentMode: 'streaming',
          traceIdByMessageId: props.traceIdByMessageId,
          deferredAssistantMetadataByMessageId: {},
          deferredToolResultsByMessageId: {},
          streamRagSources: undefined,
        }),
      {
        initialProps: {
          traceIdByMessageId: {
            'assistant-1': 'trace-1',
            'assistant-2': 'trace-2',
          },
        },
      }
    );

    expect(mocks.transformUIMessageToEnhanced).toHaveBeenCalledTimes(2);

    rerender({
      traceIdByMessageId: {
        'assistant-1': 'trace-1',
        'assistant-2': 'trace-2-updated',
      },
    });

    expect(mocks.transformUIMessageToEnhanced).toHaveBeenCalledTimes(3);
  });
});
