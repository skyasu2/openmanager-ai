import type { UIMessage } from '@ai-sdk/react';
import { describe, expect, it, vi } from 'vitest';
import { createHybridStreamCallbacks } from './createHybridStreamCallbacks';

vi.mock('@/lib/logging', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createStateRef() {
  return {
    mode: 'streaming',
    complexity: null,
    progress: null,
    jobId: null,
    isLoading: true,
    error: null,
    clarification: null,
    warning: null,
    processingTime: 0,
    warmingUp: true,
    estimatedWaitSeconds: 60,
  };
}

function createDeps() {
  let state = createStateRef();

  return {
    persistFinishedAssistantMessage: vi.fn(),
    onStreamFinish: vi.fn(),
    setState: vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    }),
    getState: () => state,
    deps: {
      traceIdRef: { current: 'feedfacefeedfacefeedfacefeedface' },
      verboseLogging: false,
      maxRetries: 1,
      onStreamFinish: vi.fn(),
      onData: vi.fn(),
      persistFinishedAssistantMessage: vi.fn(),
      setState: vi.fn((updater) => {
        state = typeof updater === 'function' ? updater(state) : updater;
      }),
      refs: {
        retryCount: { current: 1 },
        warmingUp: { current: true },
        currentQuery: { current: 'CPU 상태 알려줘' },
        pendingAttachments: { current: null },
        errorHandled: { current: false },
        redirecting: { current: false },
        abortController: { current: null },
        retryTimeout: { current: null },
        executeQuery: { current: null },
      },
      stopStreaming: vi.fn(),
      runJobQueueQuery: vi.fn(),
    },
  };
}

describe('createHybridStreamCallbacks.onFinish', () => {
  it('assistant metadata에 traceId가 없으면 fallback traceId와 함께 최종 메시지를 보강한다', () => {
    const context = createDeps();
    const callbacks = createHybridStreamCallbacks(context.deps);

    const message = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: '응답 완료' }],
    } as UIMessage;

    callbacks.onFinish({ message });

    expect(context.deps.persistFinishedAssistantMessage).toHaveBeenCalledWith(
      message,
      'feedfacefeedfacefeedfacefeedface'
    );
    expect(context.getState().isLoading).toBe(false);
    expect(context.getState().warmingUp).toBe(false);
  });

  it('assistant metadata에 traceId가 이미 있어도 최종 메시지를 동기화한다', () => {
    const context = createDeps();
    const callbacks = createHybridStreamCallbacks(context.deps);

    const message = {
      id: 'assistant-2',
      role: 'assistant',
      parts: [{ type: 'text', text: '응답 완료' }],
      metadata: {
        traceId: 'existing-trace-id',
      },
    } as UIMessage;

    callbacks.onFinish({ message });

    expect(context.deps.persistFinishedAssistantMessage).toHaveBeenCalledWith(
      message,
      'feedfacefeedfacefeedfacefeedface'
    );
    expect(context.getState().isLoading).toBe(false);
  });
});
