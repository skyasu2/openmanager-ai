import { describe, expect, it } from 'vitest';

import { resolveChatCoreSendPlan } from './chat-core-send-plan';

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
});
