/**
 * Message Transformation Helpers
 *
 * UIMessage ↔ EnhancedChatMessage 변환 및 AI 단계 처리
 */

import type { UIMessage } from 'ai';
import {
  extractTextFromUIMessage,
  normalizeAIResponse,
} from '@/lib/ai/utils/message-normalizer';
import {
  buildAnalysisFeatureStatus,
  normalizeRetrievalMetadata,
} from '@/lib/ai/utils/retrieval-status';
import {
  getToolDescription,
  getToolLabel,
} from '@/lib/ai/utils/tool-presentation';
import type {
  AnalysisBasis,
  EnhancedChatMessage,
  ToolResultSummary,
} from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import type {
  DeferredToolResult,
  RagSource,
  ToolPartWithCallId,
} from './message-transform-internals';
import {
  buildParityAwareAssistantResponseView,
  buildToolResultSummary,
  createDeferredToolParts,
  createThinkingStepsFromSummaries,
  createThinkingStepsFromToolNames,
  dedupeToolNames,
  extractToolOutput,
  getCompletedToolNames,
  getMessageMetadata,
  isServerAnalysisToolName,
  isToolPartWithCallId,
  mergeMessageMetadata,
  normalizeToolNames,
  reorderToolNamesForDisplay,
  reorderToolPartsForDisplay,
  reorderToolResultSummariesForDisplay,
  shouldPrioritizeMetricRankingPresentation,
} from './message-transform-internals';

function findRetrievalMetadataFromToolParts(toolParts: ToolPartWithCallId[]) {
  for (const toolPart of toolParts) {
    if (toolPart.type !== 'tool-searchKnowledgeBase') continue;
    const output = extractToolOutput(toolPart);
    if (!output || typeof output !== 'object') continue;
    const retrieval = normalizeRetrievalMetadata(
      (output as Record<string, unknown>).retrieval
    );
    if (retrieval) return retrieval;
  }
  return undefined;
}

// ============================================================================
// ThinkingSteps 변환
// ============================================================================

/**
 * ThinkingSteps를 AgentStep 형식으로 변환
 */
export function convertThinkingStepsToUI(thinkingSteps?: AIThinkingStep[]) {
  if (!thinkingSteps || thinkingSteps.length === 0) return [];

  const toolToAgent: Record<string, string> = {
    getServerMetrics: 'nlq',
    analyzePatterns: 'analyst',
    generateReport: 'reporter',
    classifyIntent: 'supervisor',
  };

  return thinkingSteps.map((step) => ({
    id: step.id,
    agent: toolToAgent[step.step || ''] || 'nlq',
    status:
      step.status === 'completed'
        ? 'completed'
        : step.status === 'failed'
          ? 'error'
          : step.status === 'processing'
            ? 'processing'
            : 'pending',
    message: step.description,
    startedAt: step.timestamp ? new Date(step.timestamp) : undefined,
  }));
}

// ============================================================================
// Message 변환
// ============================================================================

interface TransformOptions {
  isLoading: boolean;
  currentMode?: 'streaming' | 'job-queue';
  traceIdByMessageId?: Record<string, string>;
  deferredAssistantMetadataByMessageId?: Record<
    string,
    Record<string, unknown>
  >;
  deferredToolResultsByMessageId?: Record<string, DeferredToolResult[]>;
  /** 스트리밍 done 이벤트에서 수신한 ragSources (웹 검색 결과 등) */
  streamRagSources?: RagSource[];
  /** 사용자가 RAG 토글을 켰는지 여부 */
  ragEnabled?: boolean;
  /** 사용자가 웹 검색 토글을 켰는지 여부 */
  webSearchEnabled?: boolean;
}

/**
 * UIMessage를 EnhancedChatMessage로 변환
 */
export function transformUIMessageToEnhanced(
  message: UIMessage,
  options: TransformOptions,
  isLastMessage: boolean
): EnhancedChatMessage {
  const {
    isLoading,
    currentMode,
    traceIdByMessageId,
    streamRagSources,
    ragEnabled,
    webSearchEnabled,
  } = options;
  const rawText = extractTextFromUIMessage(message);
  // 단일 정규화 지점: Cloud Run Agent가 { answer, confidence } JSON을 반환할 때
  // answer 필드만 추출. Streaming/Job Queue 양쪽 경로 모두 여기서 처리.
  const textContent =
    message.role === 'assistant' ? normalizeAIResponse(rawText) : rawText;

  const deferredMessageMetadata =
    message.role === 'assistant'
      ? options.deferredAssistantMetadataByMessageId?.[message.id]
      : undefined;
  const metadata = mergeMessageMetadata(
    getMessageMetadata(message),
    deferredMessageMetadata
  );
  const messageToolParts = message.parts?.filter(isToolPartWithCallId) ?? [];
  const deferredToolParts =
    message.role === 'assistant'
      ? createDeferredToolParts(
          options.deferredToolResultsByMessageId?.[message.id]
        ).filter(
          (part) =>
            !messageToolParts.some(
              (existing) =>
                existing.type === part.type &&
                existing.toolCallId === part.toolCallId
            )
        )
      : [];
  const metadataToolResultSummaries =
    metadata?.toolResultSummaries && metadata.toolResultSummaries.length > 0
      ? metadata.toolResultSummaries
      : undefined;
  const prioritizeMetricRankingPresentation =
    shouldPrioritizeMetricRankingPresentation({
      toolParts: [...messageToolParts, ...deferredToolParts],
      metadataToolResultSummaries,
    });

  // Tool parts 추출 (null/undefined 방어 코드 추가)
  const toolParts = reorderToolPartsForDisplay(
    [...messageToolParts, ...deferredToolParts],
    prioritizeMetricRankingPresentation
  );
  const derivedToolResultSummaries = toolParts
    .map((toolPart) => buildToolResultSummary(toolPart))
    .filter((summary): summary is ToolResultSummary => summary !== null);
  const toolResultSummaries = reorderToolResultSummariesForDisplay(
    metadataToolResultSummaries ?? derivedToolResultSummaries,
    prioritizeMetricRankingPresentation
  );

  // ThinkingSteps 생성
  const thinkingSteps = toolParts.map((toolPart) => {
    const toolName = toolPart.type.slice(5);
    const state = (toolPart as { state?: string }).state;
    const output = (toolPart as { output?: unknown }).output;
    const toolSummary = buildToolResultSummary(toolPart);

    const isCompleted = state === 'output-available' || output !== undefined;
    const hasError = state === 'output-error';

    return {
      id: toolPart.toolCallId,
      step: toolName,
      title: getToolLabel(toolName),
      status: hasError
        ? ('failed' as const)
        : isCompleted
          ? ('completed' as const)
          : ('processing' as const),
      description: hasError
        ? `Error: ${(toolPart as { errorText?: string }).errorText || 'Unknown error'}`
        : isCompleted
          ? (toolSummary?.summary ??
            `${getToolLabel(toolName)} 실행을 완료했습니다.`)
          : (getToolDescription(toolName) ??
            `${getToolLabel(toolName)} 실행 중입니다.`),
      timestamp: new Date(),
    };
  });
  const fallbackThinkingSteps =
    thinkingSteps.length > 0
      ? []
      : createThinkingStepsFromSummaries(toolResultSummaries);
  const summaryResolvedThinkingSteps =
    thinkingSteps.length > 0 ? thinkingSteps : fallbackThinkingSteps;
  const toolNameFallbackThinkingSteps =
    summaryResolvedThinkingSteps.length > 0
      ? []
      : createThinkingStepsFromToolNames(
          normalizeToolNames(metadata?.toolsCalled)
        );
  const resolvedThinkingSteps =
    summaryResolvedThinkingSteps.length > 0
      ? summaryResolvedThinkingSteps
      : toolNameFallbackThinkingSteps;

  // Extract traceId from message metadata (available for all roles)
  const traceId = metadata?.traceId ?? traceIdByMessageId?.[message.id];
  const assistantResponseView = buildParityAwareAssistantResponseView(
    textContent,
    metadata?.assistantResponseView,
    toolParts
  );
  const handoffHistory = metadata?.handoffHistory;

  // 분석 근거 생성 (assistant 메시지에만)
  let analysisBasis: AnalysisBasis | undefined;
  if (message.role === 'assistant') {
    const isJobQueue = currentMode === 'job-queue';

    // 실제 호출된 도구 이름 추출
    const metadataToolNames = reorderToolNamesForDisplay(
      normalizeToolNames(metadata?.toolsCalled),
      prioritizeMetricRankingPresentation
    );
    const calledToolNames = dedupeToolNames([
      ...metadataToolNames,
      ...toolParts.map((p) => p.type.slice(5)),
    ]);
    const completedToolNames = dedupeToolNames([
      ...metadataToolNames,
      ...getCompletedToolNames(toolParts),
    ]);
    const hasServerAnalysisEvidence = completedToolNames.some(
      isServerAnalysisToolName
    );

    // RAG 출처 추출 (job-queue: metadata, streaming: streamRagSources fallback)
    const ragSources =
      metadata?.ragSources ?? (isLastMessage ? streamRagSources : undefined);
    const hasRag = ragSources && ragSources.length > 0;

    const webSources = ragSources?.filter((s) => s.sourceType === 'web') ?? [];
    const hasWebSearch = webSources.length > 0;
    const hasKnowledgeSearch = Boolean(
      ragSources?.some((s) => s.sourceType !== 'web')
    );
    const retrieval =
      normalizeRetrievalMetadata(metadata?.retrieval) ??
      findRetrievalMetadataFromToolParts(toolParts);
    const effectiveRagEnabled =
      typeof metadata?.enableRAG === 'boolean'
        ? metadata.enableRAG
        : ragEnabled;
    const effectiveWebSearchEnabled =
      metadata?.enableWebSearch !== undefined
        ? metadata.enableWebSearch
        : webSearchEnabled;
    const featureStatus =
      metadata?.featureStatus ??
      buildAnalysisFeatureStatus({
        retrieval,
        ragEnabled: effectiveRagEnabled,
        webSearchEnabled: effectiveWebSearchEnabled,
        hasKnowledgeEvidence: hasKnowledgeSearch,
        hasWebEvidence: hasWebSearch,
        analysisMode: metadata?.analysisMode,
      });
    const retrievalIndicatesKnowledgeUse = Boolean(retrieval?.retrievalUsed);

    // dataSource 결정: 실제 도구 호출 기반 + 토글 상태 반영
    let dataSource: string;
    if (hasWebSearch) {
      dataSource = `웹 검색 (${webSources.length}건)`;
    } else if (hasRag) {
      dataSource = `RAG 지식베이스 검색 (${ragSources.length}건)`;
    } else if (retrievalIndicatesKnowledgeUse) {
      dataSource = `RAG 지식베이스 검색 (${retrieval?.evidenceCount ?? 0}건)`;
    } else if (hasServerAnalysisEvidence) {
      dataSource = '서버 실시간 데이터 분석';
    } else if (effectiveRagEnabled) {
      dataSource = '일반 대화 응답 (RAG 활성)';
    } else {
      dataSource = '일반 대화 응답';
    }

    analysisBasis = {
      dataSource,
      engine: isJobQueue ? 'Cloud Run AI' : 'Streaming AI',
      ragUsed: hasKnowledgeSearch || retrievalIndicatesKnowledgeUse,
      toolsCalled: calledToolNames.length > 0 ? calledToolNames : undefined,
      timeRange: hasServerAnalysisEvidence ? '최근 1시간' : undefined,
      ragSources: hasRag ? ragSources : undefined,
      ...(retrieval && { retrieval }),
      featureStatus,
      analysisMode: metadata?.analysisMode,
    };
  }

  return {
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system' | 'thinking',
    content: textContent,
    timestamp: new Date(),
    isStreaming: isLoading && isLastMessage,
    thinkingSteps:
      resolvedThinkingSteps.length > 0 ? resolvedThinkingSteps : undefined,
    metadata:
      analysisBasis ||
      traceId ||
      assistantResponseView ||
      handoffHistory ||
      toolResultSummaries.length > 0
        ? {
            ...(analysisBasis && { analysisBasis }),
            ...(traceId && { traceId }),
            ...(typeof metadata?.processingTime === 'number' && {
              processingTime: metadata.processingTime,
            }),
            ...(metadata?.latencyTier && {
              latencyTier: metadata.latencyTier,
            }),
            ...(metadata?.resolvedMode && {
              resolvedMode: metadata.resolvedMode,
            }),
            ...(metadata?.modeSelectionSource && {
              modeSelectionSource: metadata.modeSelectionSource,
            }),
            ...(assistantResponseView && {
              assistantResponseView,
            }),
            ...(handoffHistory &&
              handoffHistory.length > 0 && {
                handoffHistory,
              }),
            ...(toolResultSummaries.length > 0 && {
              toolResultSummaries,
            }),
          }
        : undefined,
  };
}

/**
 * UIMessage 배열을 EnhancedChatMessage 배열로 변환
 */
export function transformMessages(
  messages: UIMessage[],
  options: TransformOptions
): EnhancedChatMessage[] {
  const lastMessageId = messages[messages.length - 1]?.id;

  return messages
    .filter(
      (m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system'
    )
    .map((m) =>
      transformUIMessageToEnhanced(m, options, m.id === lastMessageId)
    );
}
