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

type PendingStreamToolResult = {
  toolName: string;
  result: unknown;
};

type StreamDataCallbacks = {
  setCurrentAgentStatus: (status: AgentStatusEventData | null) => void;
  setCurrentHandoff: (handoff: HandoffEventData | null) => void;
  setMessageTraceId: (messageId: string, traceId: string) => void;
  setStreamRagSources: (
    sources: Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
      url?: string;
    }>
  ) => void;
  getPendingToolResults: () => PendingStreamToolResult[];
  setPendingToolResults: (results: PendingStreamToolResult[]) => void;
  getMessages: () => UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
};

function extractTraceIdFromDoneData(
  doneData: ResponseSourceData | undefined
): string | undefined {
  if (!doneData) return undefined;

  const directTraceId =
    typeof doneData.traceId === 'string' ? doneData.traceId : undefined;
  if (directTraceId) return directTraceId;

  const metadata =
    typeof doneData.metadata === 'object' && doneData.metadata !== null
      ? (doneData.metadata as Record<string, unknown>)
      : undefined;

  return typeof metadata?.traceId === 'string' ? metadata.traceId : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractPendingToolResult(
  data: unknown
): PendingStreamToolResult | null {
  if (!isRecord(data) || typeof data.toolName !== 'string') {
    return null;
  }

  const result =
    'result' in data ? data.result : 'output' in data ? data.output : undefined;

  if (result === undefined) return null;

  return {
    toolName: data.toolName,
    result,
  };
}

function createSyntheticToolParts(
  toolResults: PendingStreamToolResult[]
): UIMessage['parts'] {
  return toolResults.map((entry, index) => ({
    type: `tool-${entry.toolName}`,
    toolCallId: `stream-tool-${entry.toolName}-${index}`,
    output: entry.result,
    state: 'output-available',
  })) as UIMessage['parts'];
}

export function handleStreamDataPart(
  dataPart: StreamDataPart,
  callbacks: StreamDataCallbacks
): void {
  const partType = dataPart.type;
  if (partType === 'data-start') {
    callbacks.setPendingToolResults([]);
  } else if (partType === 'data-agent-status' && dataPart.data) {
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
  } else if (partType === 'data-tool-result' && dataPart.data) {
    const pendingToolResult = extractPendingToolResult(dataPart.data);
    if (!pendingToolResult) return;

    callbacks.setPendingToolResults([
      ...callbacks.getPendingToolResults(),
      pendingToolResult,
    ]);
  } else if (partType === 'data-done') {
    callbacks.setCurrentAgentStatus(null);
    callbacks.setCurrentHandoff(null);

    const doneData = dataPart.data as ResponseSourceData | undefined;
    const pendingToolResults = callbacks.getPendingToolResults();

    if (doneData?.ragSources) {
      const parsedRagSources = normalizeRagSources(doneData.ragSources);
      if (parsedRagSources) {
        callbacks.setStreamRagSources(parsedRagSources);
      }
    } else {
      callbacks.setStreamRagSources([]);
    }

    const structuredView = buildStructuredResponseView(doneData);
    const traceId = extractTraceIdFromDoneData(doneData);
    const syntheticToolParts = createSyntheticToolParts(pendingToolResults);

    if (structuredView || traceId || syntheticToolParts?.length) {
      const currentMessages = [...callbacks.getMessages()];
      const lastAssistantIndex = currentMessages
        .map((message) => message.role)
        .lastIndexOf('assistant');
      if (lastAssistantIndex < 0) {
        callbacks.setPendingToolResults([]);
        return;
      }

      const targetMessage = currentMessages[lastAssistantIndex];
      if (!targetMessage) {
        callbacks.setPendingToolResults([]);
        return;
      }
      if (traceId) {
        callbacks.setMessageTraceId(targetMessage.id, traceId);
      }
      const prevMetadata =
        typeof targetMessage.metadata === 'object' &&
        targetMessage.metadata !== null
          ? (targetMessage.metadata as Record<string, unknown>)
          : {};

      callbacks.setMessages(
        currentMessages.map(
          (message: (typeof currentMessages)[number], index: number) => {
            if (index !== lastAssistantIndex) return message;
            return {
              ...message,
              parts: [
                ...(Array.isArray(message.parts) ? message.parts : []),
                ...(syntheticToolParts ?? []),
              ],
              metadata: {
                ...prevMetadata,
                ...(traceId && { traceId }),
                ...(structuredView && {
                  assistantResponseView: structuredView,
                }),
              },
            };
          }
        )
      );
    }

    callbacks.setPendingToolResults([]);
  }
}
