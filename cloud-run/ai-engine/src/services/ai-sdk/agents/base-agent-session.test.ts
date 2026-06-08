import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelMessage } from 'ai';

const { mockGetHistory, mockSaveHistory } = vi.hoisted(() => ({
  mockGetHistory: vi.fn(),
  mockSaveHistory: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../session-memory', () => ({
  SessionMemoryService: {
    getHistory: mockGetHistory,
    saveHistory: mockSaveHistory,
  },
}));

import {
  buildAgentContext,
  persistAgentHistory,
} from './base-agent-session';

type MessageWithReasoningContent = ModelMessage & {
  reasoning_content?: string;
};

function withReasoningContent(
  message: ModelMessage
): MessageWithReasoningContent {
  return {
    ...message,
    reasoning_content: 'provider-private reasoning',
  };
}

function expectNoReasoningContent(messages: ModelMessage[]): void {
  for (const message of messages) {
    expect('reasoning_content' in message).toBe(false);
  }
}

describe('base-agent-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveHistory.mockResolvedValue(undefined);
  });

  it('strips provider reasoning_content from restored session history', async () => {
    mockGetHistory.mockResolvedValueOnce([
      withReasoningContent({ role: 'user', content: 'oldest' }),
      withReasoningContent({ role: 'assistant', content: 'previous answer' }),
      withReasoningContent({ role: 'user', content: 'follow up' }),
      withReasoningContent({ role: 'assistant', content: 'follow answer' }),
      withReasoningContent({ role: 'user', content: 'latest' }),
    ]);

    const messages = await buildAgentContext(
      'Analyst',
      'current query',
      { sessionId: 'session-1' },
      (query) => query
    );

    expect(messages).toHaveLength(5);
    expect(messages.at(0)).toMatchObject({
      role: 'assistant',
      content: 'previous answer',
    });
    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: 'current query',
    });
    expectNoReasoningContent(messages);
  });

  it('strips provider reasoning_content before persisting session history', () => {
    const messages: ModelMessage[] = [
      withReasoningContent({ role: 'user', content: 'question' }),
      withReasoningContent({ role: 'assistant', content: 'answer' }),
    ];

    persistAgentHistory('session-1', messages, 'final response');

    expect(mockSaveHistory).toHaveBeenCalledTimes(1);
    const savedMessages = mockSaveHistory.mock.calls[0]?.[1] as ModelMessage[];
    expect(savedMessages).toEqual([
      { role: 'user', content: 'question' },
      { role: 'assistant', content: 'answer' },
      { role: 'assistant', content: 'final response' },
    ]);
    expectNoReasoningContent(savedMessages);
  });
});
