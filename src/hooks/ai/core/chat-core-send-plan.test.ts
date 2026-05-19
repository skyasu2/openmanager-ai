import type { UIMessage } from '@ai-sdk/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CHAT_CORE_SEND_MESSAGES,
  type ExecuteLocalChatCoreSendPlanContext,
  executeLocalChatCoreSendPlan,
  resolveChatCoreSendPlan,
} from './chat-core-send-plan';

describe('chat-core-send-plan', () => {
  const baseOptions = {
    input: '',
    disableSessionLimit: false,
    sessionLimitReached: false,
    sessionMessageCount: 0,
    hybridIsLoading: false,
    artifactBusy: false,
  };

  it('ignores empty submissions without text or attachments', () => {
    expect(resolveChatCoreSendPlan(baseOptions)).toEqual({
      kind: 'noop',
    });
  });

  it('normalizes attachment-only submissions before routing decisions', () => {
    const attachment = {
      id: 'file-1',
      name: 'screenshot.png',
      mimeType: 'image/png',
      size: 100,
      data: 'data:image/png;base64,test',
      type: 'image' as const,
    };

    expect(
      resolveChatCoreSendPlan({
        ...baseOptions,
        attachments: [attachment],
      })
    ).toEqual({
      kind: 'continue',
      effectiveText: '[이미지/파일 분석 요청]',
      attachments: [attachment],
    });
  });

  it('prioritizes session limit before queueing or artifact state', () => {
    expect(
      resolveChatCoreSendPlan({
        ...baseOptions,
        input: '서버 상태 확인',
        sessionLimitReached: true,
        sessionMessageCount: 50,
        hybridIsLoading: true,
        artifactBusy: true,
      })
    ).toEqual({
      kind: 'session-limit',
      messageCount: 50,
    });
  });

  it('queues effective text while hybrid streaming is active', () => {
    expect(
      resolveChatCoreSendPlan({
        ...baseOptions,
        input: '서버 상태 확인',
        hybridIsLoading: true,
      })
    ).toEqual({
      kind: 'queue',
      effectiveText: '서버 상태 확인',
      attachments: undefined,
    });
  });

  it('prioritizes queueing over artifact busy state while hybrid streaming is active', () => {
    expect(
      resolveChatCoreSendPlan({
        ...baseOptions,
        input: '응답 끝나면 이어서 확인',
        hybridIsLoading: true,
        artifactBusy: true,
      })
    ).toEqual({
      kind: 'queue',
      effectiveText: '응답 끝나면 이어서 확인',
      attachments: undefined,
    });
  });

  it('routes QA thinking visualizer prompts locally before chat execution', () => {
    expect(
      resolveChatCoreSendPlan({
        ...baseOptions,
        input: '/qa-thinking-visualizer',
      })
    ).toEqual({
      kind: 'qa-thinking',
      effectiveText: '/qa-thinking-visualizer',
      attachments: undefined,
    });
  });

  it('routes local debug prompts before chat or artifact execution', () => {
    expect(
      resolveChatCoreSendPlan({
        ...baseOptions,
        input: '/debug-routing',
      })
    ).toEqual({
      kind: 'debug-routing',
      effectiveText: '/debug-routing',
      attachments: undefined,
    });
  });

  const createExecuteContext = (
    messages: UIMessage[] = []
  ): ExecuteLocalChatCoreSendPlanContext => ({
    messages,
    analysisMode: 'auto',
    addToQueue: vi.fn(),
    setInput: vi.fn(),
    setError: vi.fn(),
    setMessages: vi.fn(),
    resetRequestState: vi.fn(),
    onSessionLimitReached: vi.fn(),
  });

  it('executes queue plans by preserving the query and clearing input', () => {
    const context = createExecuteContext();

    const result = executeLocalChatCoreSendPlan(
      {
        kind: 'queue',
        effectiveText: '다음 질문',
        attachments: undefined,
      },
      context
    );

    expect(result).toEqual({ handled: true });
    expect(context.addToQueue).toHaveBeenCalledWith('다음 질문', undefined);
    expect(context.setInput).toHaveBeenCalledWith('');
  });

  it('executes artifact-busy plans with the shared user-facing message', () => {
    const context = createExecuteContext();

    const result = executeLocalChatCoreSendPlan(
      { kind: 'artifact-busy' },
      context
    );

    expect(result).toEqual({ handled: true });
    expect(context.setError).toHaveBeenCalledWith(
      CHAT_CORE_SEND_MESSAGES.artifactBusy
    );
  });

  it('executes QA thinking plans as local user and assistant messages', () => {
    const context = createExecuteContext([
      {
        id: 'existing-user',
        role: 'user',
        parts: [{ type: 'text', text: '기존 질문' }],
      },
    ] as UIMessage[]);

    const result = executeLocalChatCoreSendPlan(
      {
        kind: 'qa-thinking',
        effectiveText: '/qa-thinking-visualizer',
        attachments: undefined,
      },
      context
    );

    expect(result).toEqual({ handled: true });
    expect(context.resetRequestState).toHaveBeenCalledWith(
      '/qa-thinking-visualizer',
      null
    );
    expect(context.setMessages).toHaveBeenCalledWith([
      context.messages[0],
      expect.objectContaining({
        role: 'user',
        parts: [{ type: 'text', text: '/qa-thinking-visualizer' }],
      }),
      expect.objectContaining({
        role: 'assistant',
        metadata: expect.objectContaining({
          toolsCalled: ['analyzeIntent', 'selectRoute', 'generateInsight'],
        }),
      }),
    ]);
  });
});
