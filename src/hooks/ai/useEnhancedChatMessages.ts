'use client';

import type { UIMessage } from '@ai-sdk/react';
import { useMemo } from 'react';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import { transformMessages } from './utils/message-helpers';
import type { PendingStreamToolResult } from './utils/stream-data-handler';

type StreamRagSource = {
  title: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
};

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
