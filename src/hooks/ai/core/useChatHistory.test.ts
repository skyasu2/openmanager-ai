/**
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_HISTORY_KEY } from '../utils/chat-history-storage';
import { useChatHistory } from './useChatHistory';

vi.mock('@/lib/logging', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useChatHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('restores persisted assistant metadata through onMetadataRestore', () => {
    localStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        sessionId: 'session-restored',
        messages: [
          {
            id: 'user-1',
            role: 'user',
            content: 'CPU 높은 서버 알려줘',
            timestamp: '2026-04-15T10:00:00.000Z',
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: 'lb-haproxy-dc1-01 CPU가 높습니다.',
            timestamp: '2026-04-15T10:00:05.000Z',
            metadata: {
              toolsCalled: ['getServerMetrics', 'detectAnomalies'],
              ragSources: [
                {
                  title: 'incident note',
                  similarity: 0.94,
                  sourceType: 'graph',
                  category: 'incident',
                },
              ],
            },
          },
        ],
        lastUpdated: new Date().toISOString(),
      })
    );

    const setMessages = vi.fn();
    const onSessionRestore = vi.fn();
    const onMetadataRestore = vi.fn();

    renderHook(() =>
      useChatHistory({
        sessionId: 'session-current',
        isMessagesEmpty: true,
        enhancedMessages: [],
        setMessages,
        isLoading: false,
        onSessionRestore,
        onMetadataRestore,
      })
    );

    expect(setMessages).toHaveBeenCalledWith([
      {
        id: 'user-1',
        role: 'user',
        content: 'CPU 높은 서버 알려줘',
        parts: [{ type: 'text', text: 'CPU 높은 서버 알려줘' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'lb-haproxy-dc1-01 CPU가 높습니다.',
        parts: [{ type: 'text', text: 'lb-haproxy-dc1-01 CPU가 높습니다.' }],
      },
    ]);
    expect(onSessionRestore).toHaveBeenCalledWith('session-restored');
    expect(onMetadataRestore).toHaveBeenCalledWith({
      'assistant-1': {
        toolsCalled: ['getServerMetrics', 'detectAnomalies'],
        ragSources: [
          {
            title: 'incident note',
            similarity: 0.94,
            sourceType: 'graph',
            category: 'incident',
          },
        ],
      },
    });
  });

  it('does not emit metadata restore for legacy history entries without metadata', () => {
    localStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        sessionId: 'session-legacy',
        messages: [
          {
            id: 'assistant-legacy',
            role: 'assistant',
            content: '예전 저장 포맷 응답',
            timestamp: '2026-04-15T10:00:05.000Z',
          },
        ],
        lastUpdated: new Date().toISOString(),
      })
    );

    const setMessages = vi.fn();
    const onMetadataRestore = vi.fn();

    renderHook(() =>
      useChatHistory({
        sessionId: 'session-current',
        isMessagesEmpty: true,
        enhancedMessages: [],
        setMessages,
        isLoading: false,
        onMetadataRestore,
      })
    );

    expect(setMessages).toHaveBeenCalledTimes(1);
    expect(onMetadataRestore).not.toHaveBeenCalled();
  });
});
