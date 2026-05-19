import type { UIMessage } from '@ai-sdk/react';
import type { AsyncQueryResult } from '../useAsyncAIQuery';
import { generateMessageId } from '../utils/hybrid-query-utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function areJsonLikeValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;

    return left.every((item, index) =>
      areJsonLikeValuesEqual(item, right[index])
    );
  }

  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false;

    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (!areJsonLikeValuesEqual(leftKeys, rightKeys)) return false;

    return leftKeys.every((key) =>
      areJsonLikeValuesEqual(left[key], right[key])
    );
  }

  return false;
}

export function buildAssistantMessageFromAsyncResult(
  result: AsyncQueryResult,
  createMessageId: (prefix: string) => string = generateMessageId
): UIMessage {
  const response = result.response ?? '';
  const hasExplicitHandoffHistory = Array.isArray(result.handoffHistory);
  const hasProviderTelemetry =
    Boolean(result.provider) ||
    Boolean(result.modelId) ||
    Boolean(result.providerAttempts && result.providerAttempts.length > 0) ||
    typeof result.usedFallback === 'boolean' ||
    Boolean(result.fallbackReason) ||
    typeof result.ttfbMs === 'number' ||
    typeof result.rotationSlot === 'number';
  const metadata =
    result.ragSources ||
    (result.evidenceCards && result.evidenceCards.length > 0) ||
    result.traceId ||
    typeof result.processingTimeMs === 'number' ||
    Boolean(result.latencyTier) ||
    Boolean(result.resolvedMode) ||
    Boolean(result.modeSelectionSource) ||
    Boolean(result.retrieval) ||
    Boolean(result.analysisMode) ||
    Boolean(result.routeDecision) ||
    Boolean(result.assistantPlan) ||
    Boolean(result.assistantResult) ||
    Boolean(result.semanticQueryTrace) ||
    (result.toolsCalled && result.toolsCalled.length > 0) ||
    hasExplicitHandoffHistory ||
    (result.toolResultSummaries && result.toolResultSummaries.length > 0) ||
    hasProviderTelemetry
      ? {
          ...(result.ragSources && { ragSources: result.ragSources }),
          ...(result.evidenceCards &&
            result.evidenceCards.length > 0 && {
              evidenceCards: result.evidenceCards,
            }),
          ...(result.retrieval && { retrieval: result.retrieval }),
          ...(result.traceId && { traceId: result.traceId }),
          ...(typeof result.processingTimeMs === 'number' && {
            processingTime: result.processingTimeMs,
          }),
          ...(result.latencyTier && {
            latencyTier: result.latencyTier,
          }),
          ...(result.resolvedMode && {
            resolvedMode: result.resolvedMode,
          }),
          ...(result.modeSelectionSource && {
            modeSelectionSource: result.modeSelectionSource,
          }),
          ...(result.toolsCalled &&
            result.toolsCalled.length > 0 && {
              toolsCalled: result.toolsCalled,
            }),
          ...(result.analysisMode && {
            analysisMode: result.analysisMode,
          }),
          ...(result.routeDecision && {
            routeDecision: result.routeDecision,
          }),
          ...(result.assistantPlan && {
            assistantPlan: result.assistantPlan,
          }),
          ...(result.assistantResult && {
            assistantResult: result.assistantResult,
          }),
          ...(result.semanticQueryTrace && {
            semanticQueryTrace: result.semanticQueryTrace,
          }),
          ...(hasExplicitHandoffHistory && {
            handoffHistory: result.handoffHistory,
          }),
          ...(result.toolResultSummaries &&
            result.toolResultSummaries.length > 0 && {
              toolResultSummaries: result.toolResultSummaries,
            }),
          ...(result.provider && { provider: result.provider }),
          ...(result.modelId && { modelId: result.modelId }),
          ...(result.providerAttempts &&
            result.providerAttempts.length > 0 && {
              providerAttempts: result.providerAttempts,
            }),
          ...(typeof result.usedFallback === 'boolean' && {
            usedFallback: result.usedFallback,
          }),
          ...(result.fallbackReason && {
            fallbackReason: result.fallbackReason,
          }),
          ...(typeof result.ttfbMs === 'number' && {
            ttfbMs: result.ttfbMs,
          }),
          ...(typeof result.rotationSlot === 'number' && {
            rotationSlot: result.rotationSlot,
          }),
        }
      : undefined;

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    content: response,
    parts: [{ type: 'text', text: response }],
    ...(metadata && { metadata }),
  } as UIMessage;
}

export function mergeFinishedAssistantIntoMessages(
  previousMessages: UIMessage[],
  message: UIMessage,
  fallbackTraceId: string
): UIMessage[] {
  if (message.role !== 'assistant') {
    return previousMessages;
  }

  const finishedMetadata = isRecord(message.metadata) ? message.metadata : {};
  const nextMetadata =
    typeof finishedMetadata.traceId === 'string'
      ? finishedMetadata
      : { ...finishedMetadata, traceId: fallbackTraceId };
  const nextParts =
    Array.isArray(message.parts) && message.parts.length > 0
      ? message.parts
      : undefined;

  const mergeAssistantMessage = (targetMessage: UIMessage): UIMessage => {
    const currentMetadata = isRecord(targetMessage.metadata)
      ? targetMessage.metadata
      : {};
    const mergedMetadata =
      Object.keys(nextMetadata).length > 0
        ? { ...currentMetadata, ...nextMetadata }
        : targetMessage.metadata;

    const mergedParts = nextParts ?? targetMessage.parts;
    const metadataChanged =
      mergedMetadata !== targetMessage.metadata &&
      !areJsonLikeValuesEqual(mergedMetadata, targetMessage.metadata);
    const partsChanged =
      mergedParts !== targetMessage.parts &&
      !areJsonLikeValuesEqual(mergedParts, targetMessage.parts);

    if (!metadataChanged && !partsChanged) {
      return targetMessage;
    }

    return {
      ...targetMessage,
      ...(metadataChanged && { metadata: mergedMetadata }),
      ...(partsChanged && mergedParts && { parts: mergedParts }),
    };
  };

  let matched = false;
  const mergedById = previousMessages.map((prevMessage) => {
    if (prevMessage.id !== message.id) {
      return prevMessage;
    }

    matched = true;
    return mergeAssistantMessage(prevMessage);
  });

  if (matched) {
    return mergedById;
  }

  const fallbackAssistantIndex = mergedById
    .map((prevMessage) => prevMessage.role)
    .lastIndexOf('assistant');
  if (fallbackAssistantIndex < 0) {
    return previousMessages;
  }

  return mergedById.map((prevMessage, index) =>
    index === fallbackAssistantIndex
      ? mergeAssistantMessage(prevMessage)
      : prevMessage
  );
}
