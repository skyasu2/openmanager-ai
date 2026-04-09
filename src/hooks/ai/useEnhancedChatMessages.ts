'use client';

import type { UIMessage } from '@ai-sdk/react';
import { useMemo, useRef } from 'react';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { StreamRagSource } from './types/stream-rag.types';
import { transformUIMessageToEnhanced } from './utils/message-helpers';
import type { PendingStreamToolResult } from './utils/stream-data-handler';

interface UseEnhancedChatMessagesOptions {
  messages: UIMessage[];
  isLoading: boolean;
  currentMode?: 'streaming' | 'job-queue';
  traceIdByMessageId: Record<string, string>;
  deferredAssistantMetadataByMessageId: Record<string, Record<string, unknown>>;
  deferredToolResultsByMessageId: Record<string, PendingStreamToolResult[]>;
  streamRagSources?: StreamRagSource[];
  ragEnabled: boolean;
}

interface MessageTransformCacheEntry {
  message: UIMessage;
  isLastMessage: boolean;
  loadingForMessage: boolean;
  currentMode?: 'streaming' | 'job-queue';
  ragEnabled: boolean;
  traceId?: string;
  deferredMetadata?: Record<string, unknown>;
  deferredToolResults?: PendingStreamToolResult[];
  streamRagSources?: StreamRagSource[];
  enhanced: EnhancedChatMessage;
}

export function useEnhancedChatMessages({
  messages,
  isLoading,
  currentMode,
  traceIdByMessageId,
  deferredAssistantMetadataByMessageId,
  deferredToolResultsByMessageId,
  streamRagSources,
  ragEnabled,
}: UseEnhancedChatMessagesOptions): EnhancedChatMessage[] {
  const transformCacheRef = useRef<Map<string, MessageTransformCacheEntry>>(
    new Map()
  );

  return useMemo(() => {
    const filteredMessages = messages.filter(
      (message) =>
        message.role === 'user' ||
        message.role === 'assistant' ||
        message.role === 'system'
    );
    const lastMessageId = filteredMessages[filteredMessages.length - 1]?.id;
    const activeIds = new Set<string>();
    const nextEnhancedMessages: EnhancedChatMessage[] = [];

    for (const message of filteredMessages) {
      const isLastMessage = message.id === lastMessageId;
      const loadingForMessage = isLoading && isLastMessage;
      const traceId = traceIdByMessageId[message.id];
      const deferredMetadata = deferredAssistantMetadataByMessageId[message.id];
      const deferredToolResults = deferredToolResultsByMessageId[message.id];
      const ragSourcesForMessage = isLastMessage ? streamRagSources : undefined;

      activeIds.add(message.id);
      const cached = transformCacheRef.current.get(message.id);
      const canReuse =
        cached &&
        cached.message === message &&
        cached.isLastMessage === isLastMessage &&
        cached.loadingForMessage === loadingForMessage &&
        cached.currentMode === currentMode &&
        cached.ragEnabled === ragEnabled &&
        cached.traceId === traceId &&
        cached.deferredMetadata === deferredMetadata &&
        cached.deferredToolResults === deferredToolResults &&
        cached.streamRagSources === ragSourcesForMessage;

      if (canReuse) {
        nextEnhancedMessages.push(cached.enhanced);
        continue;
      }

      const enhanced = transformUIMessageToEnhanced(
        message,
        {
          isLoading,
          currentMode,
          traceIdByMessageId,
          deferredAssistantMetadataByMessageId,
          deferredToolResultsByMessageId,
          streamRagSources,
          ragEnabled,
        },
        isLastMessage
      );

      transformCacheRef.current.set(message.id, {
        message,
        isLastMessage,
        loadingForMessage,
        currentMode,
        ragEnabled,
        traceId,
        deferredMetadata,
        deferredToolResults,
        streamRagSources: ragSourcesForMessage,
        enhanced,
      });
      nextEnhancedMessages.push(enhanced);
    }

    // 삭제된 메시지는 캐시에서도 제거
    for (const messageId of transformCacheRef.current.keys()) {
      if (!activeIds.has(messageId)) {
        transformCacheRef.current.delete(messageId);
      }
    }

    return nextEnhancedMessages;
  }, [
    messages,
    isLoading,
    currentMode,
    traceIdByMessageId,
    deferredAssistantMetadataByMessageId,
    deferredToolResultsByMessageId,
    streamRagSources,
    ragEnabled,
  ]);
}
