'use client';

import type { UIMessage } from '@ai-sdk/react';
import { useMemo } from 'react';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { StreamRagSource } from './types/stream-rag.types';
import { transformMessages } from './utils/message-helpers';
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
  return useMemo(
    () =>
      transformMessages(messages, {
        isLoading,
        currentMode,
        traceIdByMessageId,
        deferredAssistantMetadataByMessageId,
        deferredToolResultsByMessageId,
        streamRagSources,
        ragEnabled,
      }),
    [
      messages,
      isLoading,
      currentMode,
      traceIdByMessageId,
      deferredAssistantMetadataByMessageId,
      deferredToolResultsByMessageId,
      streamRagSources,
      ragEnabled,
    ]
  );
}
