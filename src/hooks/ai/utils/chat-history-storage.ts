/**
 * Chat History Local Storage Utilities
 *
 * 로컬 스토리지를 활용한 채팅 히스토리 영속화
 */

import { logger } from '@/lib/logging';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';

// ============================================================================
// Constants
// ============================================================================

export const CHAT_HISTORY_KEY = 'openmanager-chat-history';
export const MAX_STORED_MESSAGES = 50;
const HISTORY_EXPIRY_HOURS = 24;

// ============================================================================
// Types
// ============================================================================

export interface StoredChatHistory {
  sessionId: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
  }>;
  lastUpdated: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * 로컬 스토리지에서 채팅 히스토리 로드
 */
export function loadChatHistory(): StoredChatHistory | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as StoredChatHistory;

    // 24시간 이상 된 데이터는 무효화
    const lastUpdated = new Date(parsed.lastUpdated);
    const hoursSinceUpdate =
      (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate > HISTORY_EXPIRY_HOURS) {
      localStorage.removeItem(CHAT_HISTORY_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    logger.warn('[ChatHistory] Failed to load:', error);
    return null;
  }
}

/**
 * 로컬 스토리지에 채팅 히스토리 저장
 */
export function saveChatHistory(
  sessionId: string,
  messages: EnhancedChatMessage[]
): void {
  if (typeof window === 'undefined') return;

  try {
    // 저장할 메시지 필터링 (user/assistant만, content가 있는 것만, 최대 50개)
    const messagesToStore = messages
      .filter(
        (m) =>
          (m.role === 'user' || m.role === 'assistant') &&
          m.content &&
          m.content.trim().length > 0
      )
      .slice(-MAX_STORED_MESSAGES)
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp:
          m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      }));

    const history: StoredChatHistory = {
      sessionId,
      messages: messagesToStore,
      lastUpdated: new Date().toISOString(),
    };

    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    logger.warn('[ChatHistory] Failed to save:', error);
  }
}

/**
 * 로컬 스토리지에서 채팅 히스토리 삭제
 */
export function clearChatHistory(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CHAT_HISTORY_KEY);
  } catch (error) {
    logger.warn('[ChatHistory] Failed to clear:', error);
  }
}
