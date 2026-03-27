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
