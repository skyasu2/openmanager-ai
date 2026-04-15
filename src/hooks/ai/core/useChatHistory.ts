'use client';

import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logging';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import {
  clearChatHistory as clearStorage,
  loadChatHistory,
  type StoredMessageMetadata,
  saveChatHistory,
} from '../utils/chat-history-storage';

// Restored message structure (minimal for history restore)
interface RestoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts: Array<{ type: 'text'; text: string }>;
}

interface UseChatHistoryProps<
  TMessage extends RestoredMessage = RestoredMessage,
> {
  sessionId: string;
  isMessagesEmpty: boolean;
  enhancedMessages: EnhancedChatMessage[];
  /** setMessages that accepts our restored message format */
  setMessages: (messages: TMessage[]) => void;
  isLoading: boolean;
  onSessionRestore?: (sessionId: string) => void;
  /** 복원된 메시지의 메타데이터(toolsCalled/ragSources)를 deferred state에 주입하는 콜백 */
  onMetadataRestore?: (
    metadataByMessageId: Record<string, StoredMessageMetadata>
  ) => void;
}

export function useChatHistory<TMessage extends RestoredMessage>({
  sessionId,
  isMessagesEmpty,
  enhancedMessages,
  setMessages,
  isLoading,
  onSessionRestore,
  onMetadataRestore,
}: UseChatHistoryProps<TMessage>) {
  const isHistoryLoaded = useRef(false);

  // 로컬 스토리지에서 히스토리 복원
  useEffect(() => {
    if (isHistoryLoaded.current || !isMessagesEmpty) return;
    isHistoryLoaded.current = true;

    const localHistory = loadChatHistory();
    if (!localHistory || localHistory.messages.length === 0) return;

    const filteredHistory = localHistory.messages.filter(
      (m) => m.content && m.content.trim().length > 0
    );

    const restoredMessages = filteredHistory.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      parts: [{ type: 'text' as const, text: m.content }],
    }));

    setMessages(restoredMessages as TMessage[]);

    // analysisBasis 메타데이터(toolsCalled/ragSources) 복원 — deferred state에 주입
    if (onMetadataRestore) {
      const metadataByMessageId: Record<string, StoredMessageMetadata> = {};
      for (const m of filteredHistory) {
        if (m.metadata && (m.metadata.toolsCalled || m.metadata.ragSources)) {
          metadataByMessageId[m.id] = m.metadata;
        }
      }
      if (Object.keys(metadataByMessageId).length > 0) {
        onMetadataRestore(metadataByMessageId);
      }
    }

    if (localHistory.sessionId && onSessionRestore) {
      onSessionRestore(localHistory.sessionId);
    }

    if (process.env.NODE_ENV === 'development') {
      logger.info(
        `📂 [ChatHistory] Restored ${restoredMessages.length} messages`
      );
    }
  }, [isMessagesEmpty, setMessages, onSessionRestore]);

  // 메시지 변경 시 localStorage 자동 저장
  useEffect(() => {
    if (!isLoading && enhancedMessages.length > 0) {
      saveChatHistory(sessionId, enhancedMessages);
    }
  }, [enhancedMessages, isLoading, sessionId]);

  const clearHistory = () => {
    clearStorage();
  };

  return {
    clearHistory,
    // Original code updated sessionId ref on restore.
    // We might need to handle that.
    // For now, let's keep it simple and assume session ID management is separate,
    // OR we export a restore function.
  };
}
