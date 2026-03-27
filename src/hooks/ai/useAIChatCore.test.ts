/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const handleFeedback = vi.fn(async () => true);
  const clearHistory = vi.fn();
  const addToQueue = vi.fn();
  const removeQueuedQuery = vi.fn();
  const popAndSendQueue = vi.fn();
  const clearQueue = vi.fn();
  const sendQuery = vi.fn();
  const executeQuery = vi.fn();
  const stop = vi.fn();
  const cancel = vi.fn();
  const reset = vi.fn();
  const clearError = vi.fn();
  const triggerAIWarmup = vi.fn(async () => undefined);
  const hybridSetMessagesSpy = vi.fn();

  let latestHybridOptions: Record<string, unknown> | null = null;
  let seedHybridMessages:
    | ((next: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void)
    | null = null;

  return {
    handleFeedback,
    clearHistory,
    addToQueue,
    removeQueuedQuery,
    popAndSendQueue,
    clearQueue,
    sendQuery,
    executeQuery,
    stop,
    cancel,
    reset,
    clearError,
    triggerAIWarmup,
    hybridSetMessagesSpy,
    getLatestHybridOptions: () => latestHybridOptions,
    setLatestHybridOptions: (options: Record<string, unknown>) => {
      latestHybridOptions = options;
    },
    setSeedHybridMessages: (
      setter: (next: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void
    ) => {
      seedHybridMessages = setter;
    },
    getSeedHybridMessages: () => seedHybridMessages,
  };
});

vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: (
    selector: (state: {
      webSearchEnabled: boolean;
      ragEnabled: boolean;
    }) => unknown
  ) =>
    selector({
      webSearchEnabled: false,
      ragEnabled: false,
    }),
}));

vi.mock('@/utils/ai-warmup', () => ({
  triggerAIWarmup: mocks.triggerAIWarmup,
}));

vi.mock('./core/useChatFeedback', () => ({
  useChatFeedback: () => ({
    handleFeedback: mocks.handleFeedback,
  }),
}));

vi.mock('./core/useChatHistory', () => ({
  useChatHistory: () => ({
    clearHistory: mocks.clearHistory,
  }),
}));

vi.mock('./core/useChatQueue', () => ({
  useChatQueue: () => ({
    queuedQueries: [],
    addToQueue: mocks.addToQueue,
    removeQueuedQuery: mocks.removeQueuedQuery,
    popAndSendQueue: mocks.popAndSendQueue,
    clearQueue: mocks.clearQueue,
    sendQueryRef: { current: null },
  }),
}));

vi.mock('./core/useChatSession', () => ({
  useChatSession: () => ({
    sessionId: 'session-test',
    sessionIdRef: { current: 'session-test' },
    refreshSessionId: vi.fn(),
    setSessionId: vi.fn(),
  }),
}));

vi.mock('./core/useChatSessionState', () => ({
  useChatSessionState: () => ({
    count: 0,
    remaining: 50,
    isWarning: false,
    isLimitReached: false,
  }),
}));

vi.mock('@/hooks/ai/useHybridAIQuery', async () => {
  const React = await import('react');

  return {
    useHybridAIQuery: (options: Record<string, unknown> = {}) => {
      mocks.setLatestHybridOptions(options);
      const [messages, setMessagesState] = React.useState<UIMessage[]>([]);

      React.useEffect(() => {
        mocks.setSeedHybridMessages((next) => {
          setMessagesState((prev) =>
            typeof next === 'function' ? next(prev) : next
          );
        });
      }, []);

      const setMessages = (
        next: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
      ) => {
        mocks.hybridSetMessagesSpy(next);
        setMessagesState((prev) =>
          typeof next === 'function' ? next(prev) : next
        );
      };

      return {
        sendQuery: mocks.sendQuery,
        executeQuery: mocks.executeQuery,
        messages,
        setMessages,
        state: {
          progress: null,
          jobId: null,
          error: null,
          clarification: null,
          warmingUp: false,
          estimatedWaitSeconds: 0,
        },
        isLoading: false,
        stop: mocks.stop,
        cancel: mocks.cancel,
        reset: mocks.reset,
        clearError: mocks.clearError,
        currentMode: 'streaming' as const,
        selectClarification: vi.fn(),
        submitCustomClarification: vi.fn(),
        skipClarification: vi.fn(),
        dismissClarification: vi.fn(),
      };
    },
  };
});

import { useAIChatCore } from './useAIChatCore';

describe('useAIChatCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stale onData callback also injects traceId into the latest assistant message', async () => {
    const traceId = '1234567890abcdef1234567890abcdef';
    const { result } = renderHook(() => useAIChatCore());

    const initialOnData = mocks.getLatestHybridOptions()?.onData as
      | ((part: { type: string; data?: unknown }) => void)
      | undefined;

    expect(typeof initialOnData).toBe('function');
    expect(mocks.getSeedHybridMessages()).toBeTypeOf('function');

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'CPU 상태 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '확인 중입니다.' }],
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    act(() => {
      initialOnData?.({
        type: 'data-done',
        data: {
          metadata: {
            traceId,
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.messages[1]?.metadata?.traceId).toBe(traceId);
    });

    expect(result.current.messages[1]?.metadata?.traceId).toBe(traceId);
  });

  it('flushes pending stream tool results and response metadata after assistant message arrives', async () => {
    const traceId = 'abcdef1234567890abcdef1234567890';
    const { result } = renderHook(() => useAIChatCore());

    const initialOnData = mocks.getLatestHybridOptions()?.onData as
      | ((part: { type: string; data?: unknown }) => void)
      | undefined;

    expect(typeof initialOnData).toBe('function');
    expect(mocks.getSeedHybridMessages()).toBeTypeOf('function');

    act(() => {
      initialOnData?.({
        type: 'data-tool-result',
        data: {
          toolName: 'getServerMetrics',
          result: {
            success: true,
            dataSlot: {
              slotIndex: 82,
              minuteOfDay: 820,
              timeLabel: '13:40 KST',
            },
            dataSource: {
              scopeName: 'openmanager-ai-otel-pipeline',
              scopeVersion: '1.0.0',
              catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
              hour: 13,
            },
          },
        },
      });
      initialOnData?.({
        type: 'data-done',
        data: {
          responseSummary: '서버 상태 요약',
          responseDetails: '상세 분석',
          responseShouldCollapse: true,
          metadata: {
            traceId,
          },
        },
      });
    });

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '메모리 사용률 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '응답 본문' }],
        },
      ]);
    });

    await waitFor(() => {
      const assistant = result.current.messages[1];
      expect(assistant?.metadata?.traceId).toBe(traceId);
      expect(assistant?.metadata?.assistantResponseView).toBeDefined();
      expect(
        assistant?.thinkingSteps?.some(
          (step) => step.step === 'getServerMetrics'
        )
      ).toBe(true);
    });

    const assistant = result.current.messages[1];
    expect(assistant?.metadata?.assistantResponseView?.summary).toBe(
      '서버 상태 요약'
    );
  });

  it('keeps metadata pending until the newest assistant message arrives when the latest message is user', async () => {
    const traceId = 'trace-latest-assistant-abcdef';
    const { result } = renderHook(() => useAIChatCore());

    const initialOnData = mocks.getLatestHybridOptions()?.onData as
      | ((part: { type: string; data?: unknown }) => void)
      | undefined;

    expect(typeof initialOnData).toBe('function');
    expect(mocks.getSeedHybridMessages()).toBeTypeOf('function');

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '첫 질문' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '이전 응답' }],
        },
        {
          id: 'user-2',
          role: 'user',
          parts: [{ type: 'text', text: '추가 질문' }],
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(3);
    });

    act(() => {
      initialOnData?.({
        type: 'data-tool-result',
        data: {
          toolName: 'getServerMetrics',
          result: {
            success: true,
            dataSlot: {
              slotIndex: 108,
              minuteOfDay: 1080,
              timeLabel: '18:00 KST',
            },
          },
        },
      });
      initialOnData?.({
        type: 'data-done',
        data: {
          responseSummary: '최신 응답 요약',
          metadata: {
            traceId,
          },
        },
      });
    });

    expect(result.current.messages[1]?.metadata?.traceId).toBeUndefined();

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '첫 질문' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '이전 응답' }],
        },
        {
          id: 'user-2',
          role: 'user',
          parts: [{ type: 'text', text: '추가 질문' }],
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          parts: [{ type: 'text', text: '최신 응답 본문' }],
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.messages[3]?.metadata?.traceId).toBe(traceId);
    });

    expect(result.current.messages[1]?.metadata?.traceId).toBeUndefined();
    expect(
      result.current.messages[3]?.metadata?.assistantResponseView?.summary
    ).toBe('최신 응답 요약');
    expect(
      result.current.messages[3]?.thinkingSteps?.some(
        (step) => step.step === 'getServerMetrics'
      )
    ).toBe(true);
  });

  it('preserves deferred stream parity metadata even if the assistant message is overwritten later', async () => {
    const traceId = 'trace-race-1234567890abcdef';
    const { result } = renderHook(() => useAIChatCore());

    const initialOnData = mocks.getLatestHybridOptions()?.onData as
      | ((part: { type: string; data?: unknown }) => void)
      | undefined;

    expect(typeof initialOnData).toBe('function');
    expect(mocks.getSeedHybridMessages()).toBeTypeOf('function');

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '메모리 사용률 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '중간 응답' }],
        },
      ]);
    });

    act(() => {
      initialOnData?.({
        type: 'data-tool-result',
        data: {
          toolName: 'getServerMetrics',
          result: {
            success: true,
            dataSlot: {
              slotIndex: 85,
              minuteOfDay: 850,
              timeLabel: '14:10 KST',
            },
            dataSource: {
              scopeName: 'openmanager-ai-otel-pipeline',
              scopeVersion: '1.0.0',
              catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
              hour: 14,
            },
          },
        },
      });
      initialOnData?.({
        type: 'data-done',
        data: {
          responseSummary: '메모리 상태 요약',
          responseDetails: '상세 분석',
          responseShouldCollapse: true,
          metadata: {
            traceId,
          },
        },
      });
    });

    await act(async () => {
      mocks.getSeedHybridMessages()?.([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: '메모리 사용률 알려줘' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: '최종 응답 본문' }],
        },
      ]);
    });

    await waitFor(() => {
      const assistant = result.current.messages[1];
      expect(assistant?.metadata?.traceId).toBe(traceId);
      expect(assistant?.metadata?.analysisBasis?.dataSource).toBe(
        '서버 실시간 데이터 분석'
      );
      expect(
        assistant?.thinkingSteps?.some(
          (step) => step.step === 'getServerMetrics'
        )
      ).toBe(true);
      expect(assistant?.metadata?.assistantResponseView?.summary).toBe(
        '메모리 상태 요약'
      );
    });
  });
});
