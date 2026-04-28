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
  extractAnalysisModeFromDoneData,
  extractLatencyTierFromDoneData,
  extractModeSelectionSourceFromDoneData,
  extractProcessingTimeFromDoneData,
  extractResolvedModeFromDoneData,
  extractRetrievalMetadataFromDoneData,
  normalizeRagSources,
  type ResponseSourceData,
} from './response-view-helpers';

const VALID_AGENT_STATUSES = new Set([
  'thinking',
  'processing',
  'completed',
  'idle',
]);

const LEGACY_AGENT_STATUS_FALLBACKS: Record<
  string,
  Pick<AgentStatusEventData, 'agent' | 'status'>
> = {
  degraded: { agent: 'Orchestrator', status: 'processing' },
  decomposing: { agent: 'Orchestrator', status: 'processing' },
  executing: { agent: 'Orchestrator', status: 'processing' },
  routing_fallback: { agent: 'Orchestrator', status: 'processing' },
  unifying: { agent: 'Orchestrator', status: 'processing' },
  vision_fallback: { agent: 'Vision Agent', status: 'processing' },
};

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

function normalizeToolNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (toolName): toolName is string =>
      typeof toolName === 'string' && toolName.trim().length > 0
  );
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

function normalizeHandoffHistory(value: unknown): HandoffEventData[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (entry): entry is HandoffEventData =>
      isRecord(entry) &&
      typeof entry.from === 'string' &&
      typeof entry.to === 'string' &&
      (entry.reason === undefined || typeof entry.reason === 'string')
  );
}

function isAgentStatusEventData(value: unknown): value is AgentStatusEventData {
  return (
    isRecord(value) &&
    typeof value.agent === 'string' &&
    typeof value.status === 'string' &&
    VALID_AGENT_STATUSES.has(value.status)
  );
}

function normalizeAgentStatusEventData(
  value: unknown
): AgentStatusEventData | null {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return null;
  }

  const message = typeof value.message === 'string' ? value.message : undefined;

  if (isAgentStatusEventData(value)) {
    return {
      agent: value.agent,
      status: value.status,
      ...(message ? { message } : {}),
    };
  }

  const legacyFallback = LEGACY_AGENT_STATUS_FALLBACKS[value.status];
  if (!legacyFallback) {
    return null;
  }

  return {
    agent: typeof value.agent === 'string' ? value.agent : legacyFallback.agent,
    status: legacyFallback.status,
    ...(message ? { message } : {}),
  };
}

function _createSyntheticToolParts(
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
    const agentStatus = normalizeAgentStatusEventData(dataPart.data);
    if (!agentStatus) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('⚠️ [Agent Status] Invalid event payload ignored', {
          data: dataPart.data,
        });
      }
      return;
    }
    callbacks.setCurrentAgentStatus(agentStatus);
    if (process.env.NODE_ENV === 'development') {
      logger.info(
        `🤖 [Agent Status] ${agentStatus.agent}: ${agentStatus.status}`
      );
    }
  } else if (partType === 'data-handoff' && dataPart.data) {
    const handoff = dataPart.data as HandoffEventData;
    callbacks.setCurrentHandoff(handoff);
    const pendingMetadata = callbacks.getPendingMessageMetadata();
    const handoffHistory = normalizeHandoffHistory(
      pendingMetadata.handoffHistory
    );
    callbacks.setPendingMessageMetadata({
      ...pendingMetadata,
      handoffHistory: [...handoffHistory, handoff],
    });
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
    const pendingMessageMetadata = callbacks.getPendingMessageMetadata();

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
    const toolsCalled = normalizeToolNames(doneData?.toolsCalled);
    const analysisMode = extractAnalysisModeFromDoneData(doneData);
    const processingTime = extractProcessingTimeFromDoneData(doneData);
    const latencyTier = extractLatencyTierFromDoneData(doneData);
    const resolvedMode = extractResolvedModeFromDoneData(doneData);
    const modeSelectionSource =
      extractModeSelectionSourceFromDoneData(doneData);
    const retrieval = extractRetrievalMetadataFromDoneData(doneData);
    const normalizedHandoffHistory = normalizeHandoffHistory(
      pendingMessageMetadata.handoffHistory
    );
    const nextMessageMetadata = {
      ...(traceId && { traceId }),
      ...(typeof processingTime === 'number' && { processingTime }),
      ...(latencyTier && { latencyTier }),
      ...(resolvedMode && { resolvedMode }),
      ...(modeSelectionSource && { modeSelectionSource }),
      ...(toolsCalled.length > 0 && { toolsCalled }),
      ...(analysisMode && { analysisMode }),
      ...(retrieval && { retrieval }),
      ...(normalizedHandoffHistory && {
        handoffHistory: normalizedHandoffHistory,
      }),
      ...(structuredView && {
        assistantResponseView: structuredView,
      }),
    };

    if (
      structuredView ||
      traceId ||
      toolsCalled.length > 0 ||
      analysisMode ||
      retrieval ||
      normalizedHandoffHistory !== undefined ||
      pendingToolResults.length > 0 ||
      Object.keys(pendingMessageMetadata).length > 0
    ) {
      const currentMessages = [...callbacks.getMessages()];
      const targetMessage = currentMessages.at(-1);
      if (!targetMessage || targetMessage.role !== 'assistant') {
        callbacks.setPendingMessageMetadata({
          ...pendingMessageMetadata,
          ...nextMessageMetadata,
        });
        return;
      }
      if (traceId) {
        callbacks.setMessageTraceId(targetMessage.id, traceId);
      }
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
