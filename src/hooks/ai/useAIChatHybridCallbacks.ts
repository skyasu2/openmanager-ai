'use client';

import type { UIMessage } from '@ai-sdk/react';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useMemo,
} from 'react';
import type {
  AgentStatusEventData,
  HandoffEventData,
  StreamDataPart,
} from '@/hooks/ai/useHybridAIQuery';
import { logger } from '@/lib/logging';
import type { DeferredMetadataHandlers } from './useDeferredMessageMetadata';
import { handleStreamDataPart } from './utils/stream-data-handler';

type StreamRagSource = {
  title: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
};

interface UseAIChatHybridCallbacksOptions {
  onMessageSend?: (message: string) => void;
  pendingQueryRef: MutableRefObject<string>;
  deferredHandlersRef: MutableRefObject<DeferredMetadataHandlers | null>;
  messagesRef: MutableRefObject<UIMessage[]>;
  setError: Dispatch<SetStateAction<string | null>>;
  setCurrentAgentStatus: Dispatch<SetStateAction<AgentStatusEventData | null>>;
  setCurrentHandoff: Dispatch<SetStateAction<HandoffEventData | null>>;
  setStreamRagSources: Dispatch<SetStateAction<StreamRagSource[]>>;
}

export function useAIChatHybridCallbacks({
  onMessageSend,
  pendingQueryRef,
  deferredHandlersRef,
  messagesRef,
  setError,
  setCurrentAgentStatus,
  setCurrentHandoff,
  setStreamRagSources,
}: UseAIChatHybridCallbacksOptions) {
  return useMemo(
    () => ({
      onStreamFinish: () => {
        onMessageSend?.(pendingQueryRef.current);
        setError(null);
        pendingQueryRef.current = '';
        setCurrentAgentStatus(null);
        setCurrentHandoff(null);
      },
      onJobResult: (result: { success: boolean; error?: string | null }) => {
        onMessageSend?.(pendingQueryRef.current);
        if (result.success) {
          setError(null);
        } else if (result.error) {
          setError(result.error);
        }
        pendingQueryRef.current = '';
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
        const dh = deferredHandlersRef.current;
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
          getMessages: () => messagesRef.current,
        });
      },
    }),
    [
      onMessageSend,
      pendingQueryRef,
      deferredHandlersRef,
      messagesRef,
      setError,
      setCurrentAgentStatus,
      setCurrentHandoff,
      setStreamRagSources,
    ]
  );
}
