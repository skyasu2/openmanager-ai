import type { UIMessage } from '@ai-sdk/react';
import type {
  AgentStatusEventData,
  HandoffEventData,
  StreamDataPart,
} from '@/hooks/ai/useHybridAIQuery';
import { logger } from '@/lib/logging';
import type { StreamRagSource } from '../types/stream-rag.types';
import {
  buildStructuredResponseView,
  normalizeRagSources,
  type ResponseSourceData,
} from './response-view-helpers';

type SyntheticToolPart = Extract<
  UIMessage['parts'][number],
  {
    type: `tool-${string}`;
  }
>;

export type PendingStreamToolResult = {
  toolName: string;
  result: unknown;
};

type StreamDataCallbacks = {
  setCurrentAgentStatus: (status: AgentStatusEventData | null) => void;
  setCurrentHandoff: (handoff: HandoffEventData | null) => void;
  setMessageTraceId: (messageId: string, traceId: string) => void;
  setStreamRagSources: (sources: StreamRagSource[]) => void;
  getPendingToolResults: () => PendingStreamToolResult[];
  setPendingToolResults: (results: PendingStreamToolResult[]) => void;
  getPendingMessageMetadata: () => Record<string, unknown>;
  setPendingMessageMetadata: (metadata: Record<string, unknown>) => void;
  setDeferredAssistantMetadata: (
    messageId: string,
    metadata: Record<string, unknown>
  ) => void;
  setDeferredAssistantToolResults: (
    messageId: string,
    toolResults: PendingStreamToolResult[]
  ) => void;
  getMessages: () => UIMessage[];
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

export function createSyntheticToolParts(
  toolResults: PendingStreamToolResult[]
): SyntheticToolPart[] {
  return toolResults.map((entry, index) => ({
    type: `tool-${entry.toolName}` as `tool-${string}`,
    toolCallId: `stream-tool-${entry.toolName}-${index}`,
    input: undefined,
    output: entry.result,
    state: 'output-available',
  }));
}

export function handleStreamDataPart(
  dataPart: StreamDataPart,
  callbacks: StreamDataCallbacks
): void {
  const partType = dataPart.type;
  if (partType === 'data-start') {
    callbacks.setPendingToolResults([]);
    callbacks.setPendingMessageMetadata({});
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
    const nextMessageMetadata = {
      ...(traceId && { traceId }),
      ...(structuredView && {
        assistantResponseView: structuredView,
      }),
    };

    if (structuredView || traceId || pendingToolResults.length > 0) {
      const currentMessages = [...callbacks.getMessages()];
      const targetMessage = currentMessages.at(-1);
      if (!targetMessage || targetMessage.role !== 'assistant') {
        callbacks.setPendingMessageMetadata({
          ...callbacks.getPendingMessageMetadata(),
          ...nextMessageMetadata,
        });
        return;
      }
      if (traceId) {
        callbacks.setMessageTraceId(targetMessage.id, traceId);
      }
      const pendingMessageMetadata = callbacks.getPendingMessageMetadata();
      const mergedMetadata = {
        ...pendingMessageMetadata,
        ...nextMessageMetadata,
      };
      if (Object.keys(mergedMetadata).length > 0) {
        callbacks.setDeferredAssistantMetadata(
          targetMessage.id,
          mergedMetadata
        );
      }
      if (pendingToolResults.length > 0) {
        callbacks.setDeferredAssistantToolResults(
          targetMessage.id,
          pendingToolResults
        );
      }
    }

    callbacks.setPendingToolResults([]);
    callbacks.setPendingMessageMetadata({});
  }
}
