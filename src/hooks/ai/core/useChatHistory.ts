'use client';

import { useCallback, useEffect, useRef } from 'react';
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
  seedMessages?: EnhancedChatMessage[];
  seedSessionId?: string;
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
  seedMessages = [],
  seedSessionId,
  setMessages,
  isLoading,
  onSessionRestore,
  onMetadataRestore,
}: UseChatHistoryProps<TMessage>) {
  const isHistoryLoaded = useRef(false);

  const buildMetadataFromEnhancedMessage = useCallback(
    (message: EnhancedChatMessage): StoredMessageMetadata | undefined => {
      const metadata = message.metadata;
      const analysisBasis = metadata?.analysisBasis;
      const hasExplicitHandoffHistory = Array.isArray(metadata?.handoffHistory);

      if (
        !metadata?.traceId &&
        !analysisBasis?.retrieval &&
        !analysisBasis?.featureStatus &&
        !analysisBasis?.analysisMode &&
        !analysisBasis?.toolsCalled &&
        !analysisBasis?.ragSources &&
        !metadata?.assistantResponseView &&
        !hasExplicitHandoffHistory &&
        !(
          metadata?.toolResultSummaries &&
          metadata.toolResultSummaries.length > 0
        )
      ) {
        return undefined;
      }

      return {
        ...(metadata?.traceId && { traceId: metadata.traceId }),
        ...(analysisBasis?.retrieval && {
          retrieval: analysisBasis.retrieval,
        }),
        ...(analysisBasis?.featureStatus && {
          featureStatus: analysisBasis.featureStatus,
        }),
        ...(analysisBasis?.analysisMode && {
          analysisMode: analysisBasis.analysisMode,
        }),
        ...(analysisBasis?.toolsCalled && {
          toolsCalled: analysisBasis.toolsCalled,
        }),
        ...(analysisBasis?.ragSources && {
          ragSources: analysisBasis.ragSources,
        }),
        ...(metadata?.assistantResponseView && {
          assistantResponseView: metadata.assistantResponseView,
        }),
        ...(hasExplicitHandoffHistory && {
          handoffHistory: metadata.handoffHistory,
        }),
        ...(metadata?.toolResultSummaries &&
          metadata.toolResultSummaries.length > 0 && {
            toolResultSummaries: metadata.toolResultSummaries,
          }),
      };
    },
    []
  );

  // 로컬 스토리지에서 히스토리 복원
  useEffect(() => {
    if (isHistoryLoaded.current || !isMessagesEmpty) return;
    isHistoryLoaded.current = true;

    const localHistory = loadChatHistory();
    const shouldUseSeedHistory =
      seedMessages.length > 0 && seedSessionId === sessionId;
    const restoredSourceMessages = shouldUseSeedHistory
      ? seedMessages
      : (localHistory?.messages ?? []);
    const restoredSessionId = shouldUseSeedHistory
      ? seedSessionId
      : localHistory?.sessionId;

    if (restoredSourceMessages.length === 0) return;

    const filteredHistory = restoredSourceMessages.filter(
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
        const restoredMetadata = shouldUseSeedHistory
          ? buildMetadataFromEnhancedMessage(m as EnhancedChatMessage)
          : (m.metadata as StoredMessageMetadata | undefined);

        if (restoredMetadata) {
          metadataByMessageId[m.id] = restoredMetadata;
        }
      }
      if (Object.keys(metadataByMessageId).length > 0) {
        onMetadataRestore(metadataByMessageId);
      }
    }

    if (restoredSessionId && onSessionRestore) {
      onSessionRestore(restoredSessionId);
    }

    if (process.env.NODE_ENV === 'development') {
      logger.info(
        `📂 [ChatHistory] Restored ${restoredMessages.length} messages`
      );
    }
  }, [
    buildMetadataFromEnhancedMessage,
    isMessagesEmpty,
    onMetadataRestore,
    onSessionRestore,
    seedMessages,
    seedSessionId,
    sessionId,
    setMessages,
  ]);

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
