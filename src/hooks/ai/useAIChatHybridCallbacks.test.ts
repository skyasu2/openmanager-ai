/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIChatHybridCallbacks } from './useAIChatHybridCallbacks';

const mocks = vi.hoisted(() => ({
  handleStreamDataPart: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mocks.loggerInfo,
  },
}));

vi.mock('./utils/stream-data-handler', () => ({
  handleStreamDataPart: mocks.handleStreamDataPart,
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

describe('useAIChatHybridCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('onStreamFinish가 pending query 전달 후 상태를 초기화한다', () => {
    const onMessageSend = vi.fn();
    const setError = vi.fn();
    const setCurrentAgentStatus = vi.fn();
    const setCurrentHandoff = vi.fn();
    const setStreamRagSources = vi.fn();
    const pendingQueryRef = { current: '서버 상태 알려줘' };
    const deferredHandlers = { current: null };
    const messages = { current: [] as UIMessage[] };

    const { result } = renderHook(() =>
      useAIChatHybridCallbacks({
        onMessageSend,
        getPendingQuery: () => pendingQueryRef.current,
        clearPendingQuery: () => {
          pendingQueryRef.current = '';
        },
        getDeferredHandlers: () => deferredHandlers.current,
        getMessages: () => messages.current,
        setError,
        setCurrentAgentStatus,
        setCurrentHandoff,
        setStreamRagSources,
      })
    );

    result.current.onStreamFinish();

    expect(onMessageSend).toHaveBeenCalledWith('서버 상태 알려줘');
    expect(setError).toHaveBeenCalledWith(null);
    expect(setCurrentAgentStatus).toHaveBeenCalledWith(null);
    expect(setCurrentHandoff).toHaveBeenCalledWith(null);
    expect(pendingQueryRef.current).toBe('');
  });

  it('onJobResult가 실패 시 error를 반영하고 query를 비운다', () => {
    const onMessageSend = vi.fn();
    const setError = vi.fn();
    const pendingQueryRef = { current: '재시도 질문' };

    const { result } = renderHook(() =>
      useAIChatHybridCallbacks({
        onMessageSend,
        getPendingQuery: () => pendingQueryRef.current,
        clearPendingQuery: () => {
          pendingQueryRef.current = '';
        },
        getDeferredHandlers: () => null,
        getMessages: () => [],
        setError,
        setCurrentAgentStatus: vi.fn(),
        setCurrentHandoff: vi.fn(),
        setStreamRagSources: vi.fn(),
      })
    );

    result.current.onJobResult({
      success: false,
      error: 'Service unavailable',
    });

    expect(onMessageSend).toHaveBeenCalledWith('재시도 질문');
    expect(setError).toHaveBeenCalledWith('Service unavailable');
    expect(pendingQueryRef.current).toBe('');
  });

  it('onData는 handlers ref가 있으면 stream handler에 필요한 콜백을 전달한다', () => {
    const handlers = {
      setMessageTraceId: vi.fn(),
      getPendingToolResults: vi.fn(() => []),
      setPendingToolResults: vi.fn(),
      getPendingMessageMetadata: vi.fn(() => ({})),
      setPendingMessageMetadata: vi.fn(),
      setDeferredAssistantMetadata: vi.fn(),
      setDeferredAssistantToolResults: vi.fn(),
    };
    const messagesRef = {
      current: [
        createMessage('assistant-1', 'assistant', '응답'),
      ] as UIMessage[],
    };
    const part = { type: 'data-done', data: { responseSummary: '요약' } };
    const setStreamRagSources = vi.fn();

    const { result } = renderHook(() =>
      useAIChatHybridCallbacks({
        onMessageSend: vi.fn(),
        getPendingQuery: () => '',
        clearPendingQuery: vi.fn(),
        getDeferredHandlers: () => handlers,
        getMessages: () => messagesRef.current,
        setError: vi.fn(),
        setCurrentAgentStatus: vi.fn(),
        setCurrentHandoff: vi.fn(),
        setStreamRagSources,
      })
    );

    result.current.onData(part);

    expect(mocks.handleStreamDataPart).toHaveBeenCalledWith(
      part,
      expect.objectContaining({
        setMessageTraceId: handlers.setMessageTraceId,
        getPendingToolResults: handlers.getPendingToolResults,
        setPendingToolResults: handlers.setPendingToolResults,
        getPendingMessageMetadata: handlers.getPendingMessageMetadata,
        setPendingMessageMetadata: handlers.setPendingMessageMetadata,
        setDeferredAssistantMetadata: handlers.setDeferredAssistantMetadata,
        setDeferredAssistantToolResults:
          handlers.setDeferredAssistantToolResults,
        setStreamRagSources,
        getMessages: expect.any(Function),
      })
    );

    const callbackArg = mocks.handleStreamDataPart.mock.calls[0]?.[1];
    expect(callbackArg?.getMessages()).toEqual(messagesRef.current);
  });

  it('onData는 호출 시점의 최신 handlers와 messages를 읽는다', () => {
    const initialHandlers = {
      setMessageTraceId: vi.fn(),
      getPendingToolResults: vi.fn(() => []),
      setPendingToolResults: vi.fn(),
      getPendingMessageMetadata: vi.fn(() => ({})),
      setPendingMessageMetadata: vi.fn(),
      setDeferredAssistantMetadata: vi.fn(),
      setDeferredAssistantToolResults: vi.fn(),
    };
    const latestHandlers = {
      setMessageTraceId: vi.fn(),
      getPendingToolResults: vi.fn(() => [
        { toolName: 'getServerMetrics', result: { ok: true } },
      ]),
      setPendingToolResults: vi.fn(),
      getPendingMessageMetadata: vi.fn(() => ({
        responseSummary: '최신 요약',
      })),
      setPendingMessageMetadata: vi.fn(),
      setDeferredAssistantMetadata: vi.fn(),
      setDeferredAssistantToolResults: vi.fn(),
    };
    let currentHandlers = initialHandlers;
    const messagesRef = {
      current: [
        createMessage('assistant-1', 'assistant', '이전 응답'),
      ] as UIMessage[],
    };
    const latestMessages = [
      createMessage('assistant-2', 'assistant', '최신 응답'),
    ] as UIMessage[];
    const part = { type: 'data-done', data: { responseSummary: '요약' } };

    const { result } = renderHook(() =>
      useAIChatHybridCallbacks({
        onMessageSend: vi.fn(),
        getPendingQuery: () => '',
        clearPendingQuery: vi.fn(),
        getDeferredHandlers: () => currentHandlers,
        getMessages: () => messagesRef.current,
        setError: vi.fn(),
        setCurrentAgentStatus: vi.fn(),
        setCurrentHandoff: vi.fn(),
        setStreamRagSources: vi.fn(),
      })
    );

    currentHandlers = latestHandlers;
    messagesRef.current = latestMessages;

    result.current.onData(part);

    expect(mocks.handleStreamDataPart).toHaveBeenCalledWith(
      part,
      expect.objectContaining({
        setMessageTraceId: latestHandlers.setMessageTraceId,
        getPendingToolResults: latestHandlers.getPendingToolResults,
        setPendingToolResults: latestHandlers.setPendingToolResults,
        getPendingMessageMetadata: latestHandlers.getPendingMessageMetadata,
        setPendingMessageMetadata: latestHandlers.setPendingMessageMetadata,
        setDeferredAssistantMetadata:
          latestHandlers.setDeferredAssistantMetadata,
        setDeferredAssistantToolResults:
          latestHandlers.setDeferredAssistantToolResults,
      })
    );

    const callbackArg = mocks.handleStreamDataPart.mock.calls.at(-1)?.[1];
    expect(callbackArg?.getMessages()).toEqual(latestMessages);
  });

  it('onData는 handlers ref가 비어 있으면 no-op이다', () => {
    const { result } = renderHook(() =>
      useAIChatHybridCallbacks({
        onMessageSend: vi.fn(),
        getPendingQuery: () => '',
        clearPendingQuery: vi.fn(),
        getDeferredHandlers: () => null,
        getMessages: () => [],
        setError: vi.fn(),
        setCurrentAgentStatus: vi.fn(),
        setCurrentHandoff: vi.fn(),
        setStreamRagSources: vi.fn(),
      })
    );

    result.current.onData({ type: 'data-start', data: {} });

    expect(mocks.handleStreamDataPart).not.toHaveBeenCalled();
  });
});
