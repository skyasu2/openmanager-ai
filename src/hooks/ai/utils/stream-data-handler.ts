import type { UIMessage } from '@ai-sdk/react';
import type {
  AgentStatusEventData,
  HandoffEventData,
  StreamDataPart,
} from '@/hooks/ai/useHybridAIQuery';
import { logger } from '@/lib/logging';
import {
  buildStructuredResponseView,
  normalizeRagSources,
  type ResponseSourceData,
} from './response-view-helpers';

export type StreamDataCallbacks = {
  setCurrentAgentStatus: (status: AgentStatusEventData | null) => void;
  setCurrentHandoff: (handoff: HandoffEventData | null) => void;
  setStreamRagSources: (
    sources: Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
      url?: string;
    }>
  ) => void;
  getMessages: () => UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
};

export function handleStreamDataPart(
  dataPart: StreamDataPart,
  callbacks: StreamDataCallbacks
): void {
  const partType = dataPart.type;
  if (partType === 'data-agent-status' && dataPart.data) {
    const agentStatus = dataPart.data as AgentStatusEventData;
    callbacks.setCurrentAgentStatus(agentStatus);
    if (process.env.NODE_ENV === 'development') {
      logger.info(
        `🤖 [Agent Status] ${agentStatus.agent}: ${agentStatus.status}`
      );
    }
  } else if (partType === 'data-handoff' && dataPart.data) {
    const handoff = dataPart.data as HandoffEventData;
    callbacks.setCurrentHandoff(handoff);
    if (process.env.NODE_ENV === 'development') {
      logger.info(`🔄 [Handoff] ${handoff.from} → ${handoff.to}`);
    }
  } else if (partType === 'data-done') {
    callbacks.setCurrentAgentStatus(null);
    callbacks.setCurrentHandoff(null);

    const doneData = dataPart.data as ResponseSourceData | undefined;

    if (doneData?.ragSources) {
      const parsedRagSources = normalizeRagSources(doneData.ragSources);
      if (parsedRagSources) {
        callbacks.setStreamRagSources(parsedRagSources);
      }
    } else {
      callbacks.setStreamRagSources([]);
    }

    const structuredView = buildStructuredResponseView(doneData);
    if (structuredView) {
      const currentMessages = [...callbacks.getMessages()];
      const lastAssistantIndex = currentMessages
        .map((message) => message.role)
        .lastIndexOf('assistant');
      if (lastAssistantIndex < 0) return;

      const targetMessage = currentMessages[lastAssistantIndex];
      const prevMetadata =
        typeof targetMessage?.metadata === 'object' &&
        targetMessage?.metadata !== null
          ? (targetMessage.metadata as Record<string, unknown>)
          : {};

      callbacks.setMessages(
        currentMessages.map(
          (message: (typeof currentMessages)[number], index: number) => {
            if (index !== lastAssistantIndex) return message;
            return {
              ...message,
              metadata: {
                ...prevMetadata,
                assistantResponseView: structuredView,
              },
            };
          }
        )
      );
    }
  }
}
