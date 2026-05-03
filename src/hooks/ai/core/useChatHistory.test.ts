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
              traceId: 'trace-storage-1',
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
        traceId: 'trace-storage-1',
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

  it('restores explicit empty handoff history from stored assistant metadata', () => {
    localStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        sessionId: 'session-empty-handoff',
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: '직접 응답입니다.',
            timestamp: '2026-04-17T10:00:05.000Z',
            metadata: {
              handoffHistory: [],
            },
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

    expect(onMetadataRestore).toHaveBeenCalledWith({
      'assistant-1': {
        handoffHistory: [],
      },
    });
  });

  it('restores routeDecision from stored assistant metadata', () => {
    const routeDecision = {
      intent: 'job',
      executionPath: 'job',
      complexity: 'complex',
      reasonCodes: ['complexity_threshold_exceeded'],
      ruleVersion: '2026-05-03-v1',
      decidedBy: 'bff',
    };
    localStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        sessionId: 'session-route-decision',
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: '작업 큐로 처리합니다.',
            timestamp: '2026-05-03T10:00:05.000Z',
            metadata: {
              routeDecision,
            },
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

    expect(onMetadataRestore).toHaveBeenCalledWith({
      'assistant-1': {
        routeDecision,
      },
    });
  });

  it('prefers richer seed messages from sidebar snapshot over local history', () => {
    localStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        sessionId: 'session-seeded',
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: 'stale local history',
            timestamp: '2026-04-15T10:00:05.000Z',
            metadata: {
              toolsCalled: ['getServerMetrics'],
            },
          },
        ],
        lastUpdated: new Date().toISOString(),
      })
    );

    const setMessages = vi.fn();
    const onMetadataRestore = vi.fn();

    renderHook(() =>
      useChatHistory({
        sessionId: 'session-seeded',
        isMessagesEmpty: true,
        enhancedMessages: [],
        seedMessages: [
          {
            id: 'assistant-live',
            role: 'assistant',
            content: 'sidebar live response',
            timestamp: new Date(),
            metadata: {
              traceId: 'trace-live-1',
              analysisBasis: {
                dataSource: '서버 실시간 데이터 분석',
                engine: 'Streaming AI + RAG',
                toolsCalled: ['getServerMetrics'],
                ragSources: [
                  {
                    title: 'live source',
                    similarity: 0.97,
                    sourceType: 'graph',
                    category: 'incident',
                  },
                ],
              },
              assistantResponseView: {
                summary: 'live summary',
                details: 'live details',
                shouldCollapse: true,
              },
            },
          },
        ],
        seedSessionId: 'session-seeded',
        setMessages,
        isLoading: false,
        onMetadataRestore,
      })
    );

    expect(setMessages).toHaveBeenCalledWith([
      {
        id: 'assistant-live',
        role: 'assistant',
        content: 'sidebar live response',
        parts: [{ type: 'text', text: 'sidebar live response' }],
      },
    ]);
    expect(onMetadataRestore).toHaveBeenCalledWith({
      'assistant-live': {
        traceId: 'trace-live-1',
        toolsCalled: ['getServerMetrics'],
        ragSources: [
          {
            title: 'live source',
            similarity: 0.97,
            sourceType: 'graph',
            category: 'incident',
          },
        ],
        assistantResponseView: {
          summary: 'live summary',
          details: 'live details',
          shouldCollapse: true,
        },
      },
    });
  });
});
