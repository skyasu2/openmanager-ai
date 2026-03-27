/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnhancedChatMessages } from './useEnhancedChatMessages';

const mocks = vi.hoisted(() => ({
  transformMessages: vi.fn(),
}));

vi.mock('./utils/message-helpers', () => ({
  transformMessages: mocks.transformMessages,
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
    mocks.transformMessages.mockReturnValue([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '요약',
      },
    ]);
  });

  it('transformMessages에 필요한 옵션을 그대로 전달한다', () => {
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
        ragEnabled: true,
      })
    );

    expect(mocks.transformMessages).toHaveBeenCalledWith(
      messages,
      expect.objectContaining({
        isLoading: true,
        currentMode: 'streaming',
        traceIdByMessageId: { 'assistant-1': 'trace-1' },
        ragEnabled: true,
      })
    );
    expect(result.current).toEqual([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '요약',
      },
    ]);
  });

  it('의존성이 바뀌면 transformMessages를 다시 호출한다', () => {
    const messages = [createMessage('assistant-1', 'assistant', '응답')];

    const { rerender } = renderHook(
      (props: {
        ragEnabled: boolean;
        currentMode?: 'streaming' | 'job-queue';
      }) =>
        useEnhancedChatMessages({
          messages,
          isLoading: false,
          currentMode: props.currentMode,
          traceIdByMessageId: {},
          deferredAssistantMetadataByMessageId: {},
          deferredToolResultsByMessageId: {},
          streamRagSources: undefined,
          ragEnabled: props.ragEnabled,
        }),
      {
        initialProps: {
          ragEnabled: false,
          currentMode: 'streaming' as const,
        },
      }
    );

    expect(mocks.transformMessages).toHaveBeenCalledTimes(1);

    rerender({
      ragEnabled: true,
      currentMode: 'job-queue' as const,
    });

    expect(mocks.transformMessages).toHaveBeenCalledTimes(2);
  });
});
