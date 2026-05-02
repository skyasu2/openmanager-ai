/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHAT_HISTORY_KEY,
  clearChatHistory,
  loadChatHistory,
  MAX_STORED_MESSAGES,
  saveChatHistory,
} from './chat-history-storage';

vi.mock('@/lib/logging', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function makeMessage(
  overrides: Partial<{
    id: string;
    role: string;
    content: string;
    timestamp: Date | string;
    parts: unknown[];
  }> = {}
) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    role: overrides.role ?? 'user',
    content: overrides.content ?? 'hello',
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    parts: overrides.parts ?? [],
  };
}

function makeStoredHistory(
  overrides: Partial<{
    sessionId: string;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: string;
    }>;
    lastUpdated: string;
  }> = {}
) {
  return {
    sessionId: overrides.sessionId ?? 'session-1',
    messages: overrides.messages ?? [
      {
        id: '1',
        role: 'user',
        content: 'hi',
        timestamp: new Date().toISOString(),
      },
    ],
    lastUpdated: overrides.lastUpdated ?? new Date().toISOString(),
  };
}

describe('chat-history-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ── loadChatHistory ──────────────────────────────────────────────

  describe('loadChatHistory', () => {
    it('returns null when localStorage is empty', () => {
      expect(loadChatHistory()).toBeNull();
    });

    it('returns stored data when valid and fresh', () => {
      const history = makeStoredHistory();
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));

      const result = loadChatHistory();
      expect(result).toEqual(history);
    });

    it('returns null and removes data when expired (>24h)', () => {
      const expired = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const history = makeStoredHistory({ lastUpdated: expired });
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));

      expect(loadChatHistory()).toBeNull();
      expect(localStorage.getItem(CHAT_HISTORY_KEY)).toBeNull();
    });

    it('returns null on invalid JSON', () => {
      localStorage.setItem(CHAT_HISTORY_KEY, '{not-valid-json!!!');

      expect(loadChatHistory()).toBeNull();
    });
  });

  // ── saveChatHistory ──────────────────────────────────────────────

  describe('saveChatHistory', () => {
    it('stores only user/assistant messages with content', () => {
      const messages = [
        makeMessage({ role: 'user', content: 'question' }),
        makeMessage({ role: 'assistant', content: 'answer' }),
        makeMessage({ role: 'system', content: 'system prompt' }),
        makeMessage({ role: 'user', content: '' }),
        makeMessage({ role: 'user', content: '   ' }),
      ];

      saveChatHistory('s1', messages as never[]);

      const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
      expect(stored.messages).toHaveLength(2);
      expect(stored.messages[0].content).toBe('question');
      expect(stored.messages[1].content).toBe('answer');
      expect(stored.sessionId).toBe('s1');
    });

    it('limits stored messages to MAX_STORED_MESSAGES (50)', () => {
      const messages = Array.from({ length: 70 }, (_, i) =>
        makeMessage({ id: `msg-${i}`, role: 'user', content: `msg ${i}` })
      );

      saveChatHistory('s2', messages as never[]);

      const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
      expect(stored.messages).toHaveLength(MAX_STORED_MESSAGES);
      // Should keep the last 50 (slice(-50))
      expect(stored.messages[0].content).toBe('msg 20');
      expect(stored.messages[49].content).toBe('msg 69');
    });

    it('converts Date timestamps to ISO strings', () => {
      const date = new Date('2026-03-06T12:00:00.000Z');
      const messages = [
        makeMessage({ role: 'user', content: 'hi', timestamp: date }),
      ];

      saveChatHistory('s3', messages as never[]);

      const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
      expect(stored.messages[0].timestamp).toBe('2026-03-06T12:00:00.000Z');
    });

    it('persists analysisBasis toolsCalled and ragSources for assistant messages', () => {
      const messages = [
        {
          ...makeMessage({
            id: 'assistant-1',
            role: 'assistant',
            content: '분석 결과',
          }),
          metadata: {
            traceId: 'trace-storage-save-1',
            analysisBasis: {
              dataSource: '서버 실시간 데이터 분석',
              engine: 'Cloud Run AI',
              toolsCalled: ['getServerMetrics', 'detectAnomalies'],
              ragSources: [
                {
                  title: 'runbook',
                  similarity: 0.91,
                  sourceType: 'graph',
                  category: 'incident',
                },
              ],
            },
            assistantResponseView: {
              summary: '요약',
              details: '상세',
              shouldCollapse: true,
            },
          },
        },
      ];

      saveChatHistory('s4', messages as never[]);

      const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
      expect(stored.messages[0].metadata).toEqual({
        traceId: 'trace-storage-save-1',
        toolsCalled: ['getServerMetrics', 'detectAnomalies'],
        ragSources: [
          {
            title: 'runbook',
            similarity: 0.91,
            sourceType: 'graph',
            category: 'incident',
          },
        ],
        assistantResponseView: {
          summary: '요약',
          details: '상세',
          shouldCollapse: true,
        },
      });
    });

    it('persists explicit empty handoff history for assistant messages', () => {
      const messages = [
        {
          ...makeMessage({
            id: 'assistant-empty-handoff',
            role: 'assistant',
            content: '직접 응답',
          }),
          metadata: {
            handoffHistory: [],
          },
        },
      ];

      saveChatHistory('s5', messages as never[]);

      const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
      expect(stored.messages[0].metadata).toEqual({
        handoffHistory: [],
      });
    });

    it('persists artifact metadata for assistant messages', () => {
      const messages = [
        {
          ...makeMessage({
            id: 'assistant-artifact',
            role: 'assistant',
            content: '장애 보고서를 작성했습니다.',
          }),
          metadata: {
            incidentReportArtifact: {
              kind: 'incident-report',
              generatedAt: '2026-05-02T00:00:00.000Z',
              report: {
                id: 'incident-history-1',
                title: 'DB 메모리 경고',
                severity: 'warning',
                timestamp: new Date('2026-05-02T00:00:00.000Z'),
                affectedServers: ['db-mysql-dc1-primary'],
                description: '메모리 사용률이 높습니다.',
                status: 'active',
              },
            },
          },
        },
      ];

      saveChatHistory('s-artifact', messages as never[]);

      const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
      expect(stored.messages[0].metadata.incidentReportArtifact).toMatchObject({
        kind: 'incident-report',
        report: {
          id: 'incident-history-1',
          title: 'DB 메모리 경고',
        },
      });
    });
  });

  // ── clearChatHistory ─────────────────────────────────────────────

  describe('clearChatHistory', () => {
    it('removes the key from localStorage', () => {
      localStorage.setItem(
        CHAT_HISTORY_KEY,
        JSON.stringify(makeStoredHistory())
      );
      expect(localStorage.getItem(CHAT_HISTORY_KEY)).not.toBeNull();

      clearChatHistory();

      expect(localStorage.getItem(CHAT_HISTORY_KEY)).toBeNull();
    });
  });
});
