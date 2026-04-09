'use client';

import type { UIMessage } from '@ai-sdk/react';
import { type Dispatch, type SetStateAction, useMemo } from 'react';
import type {
  AgentStatusEventData,
  HandoffEventData,
  StreamDataPart,
} from '@/hooks/ai/useHybridAIQuery';
import { logger } from '@/lib/logging';
import type { StreamRagSource } from './types/stream-rag.types';
import type { DeferredMetadataHandlers } from './useDeferredMessageMetadata';
import { handleStreamDataPart } from './utils/stream-data-handler';

interface UseAIChatHybridCallbacksOptions {
  onMessageSend?: (message: string) => void;
  getPendingQuery: () => string;
  clearPendingQuery: () => void;
  getDeferredHandlers: () => DeferredMetadataHandlers | null;
  getMessages: () => UIMessage[];
  setError: Dispatch<SetStateAction<string | null>>;
  setCurrentAgentStatus: Dispatch<SetStateAction<AgentStatusEventData | null>>;
  setCurrentHandoff: Dispatch<SetStateAction<HandoffEventData | null>>;
  setStreamRagSources: Dispatch<SetStateAction<StreamRagSource[]>>;
}

export function useAIChatHybridCallbacks({
  onMessageSend,
  getPendingQuery,
  clearPendingQuery,
  getDeferredHandlers,
  getMessages,
  setError,
  setCurrentAgentStatus,
  setCurrentHandoff,
  setStreamRagSources,
}: UseAIChatHybridCallbacksOptions) {
  return useMemo(
    () => ({
      onStreamFinish: () => {
        onMessageSend?.(getPendingQuery());
        setError(null);
        clearPendingQuery();
        setCurrentAgentStatus(null);
        setCurrentHandoff(null);
      },
      onStreamMessageFinish: (message: UIMessage) => {
        const dh = getDeferredHandlers();
        if (!dh) return;
        dh.flushPendingToMessage(message.id);
      },
      onJobResult: (result: { success: boolean; error?: string | null }) => {
        onMessageSend?.(getPendingQuery());
        if (result.success) {
          setError(null);
        } else if (result.error) {
          setError(result.error);
        }
        clearPendingQuery();
        if (process.env.NODE_ENV === 'development') {
          logger.info('📦 [Job Queue] Result received:', result.success);
        }
      },
      onProgress: (progress: { progress: number; stage: string }) => {
        if (process.env.NODE_ENV === 'development') {
          logger.info(
            `📊 [Job Queue] Progress: ${progress.progress}% - ${progress.stage}`
          );
        }
      },
      onData: (dataPart: StreamDataPart) => {
        const dh = getDeferredHandlers();
        if (!dh) return;

        handleStreamDataPart(dataPart, {
          setCurrentAgentStatus,
          setCurrentHandoff,
          setMessageTraceId: dh.setMessageTraceId,
          setStreamRagSources,
          getPendingToolResults: dh.getPendingToolResults,
          setPendingToolResults: dh.setPendingToolResults,
          getPendingMessageMetadata: dh.getPendingMessageMetadata,
          setPendingMessageMetadata: dh.setPendingMessageMetadata,
          setDeferredAssistantMetadata: dh.setDeferredAssistantMetadata,
          setDeferredAssistantToolResults: dh.setDeferredAssistantToolResults,
          getMessages,
        });
      },
    }),
    [
      clearPendingQuery,
      getDeferredHandlers,
      getMessages,
      getPendingQuery,
      onMessageSend,
      setError,
      setCurrentAgentStatus,
      setCurrentHandoff,
      setStreamRagSources,
    ]
  );
}
