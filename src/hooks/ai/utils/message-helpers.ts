/**
 * Message Transformation Helpers
 *
 * UIMessage ↔ EnhancedChatMessage 변환 및 AI 단계 처리
 */

import type { UIMessage } from 'ai';
import type { StructuredAssistantResponse } from '@/lib/ai/utils/assistant-response-view';
import {
  extractTextFromUIMessage,
  normalizeAIResponse,
} from '@/lib/ai/utils/message-normalizer';
import type {
  AnalysisBasis,
  EnhancedChatMessage,
} from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';

type RagSource = {
  title: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
};

type MessageMetadata = {
  traceId?: string;
  ragSources?: RagSource[];
  assistantResponseView?: StructuredAssistantResponse;
};

function getMessageMetadata(message: UIMessage): MessageMetadata | undefined {
  if (
    'metadata' in message &&
    message.metadata != null &&
    typeof message.metadata === 'object'
  ) {
    return message.metadata as MessageMetadata;
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
  /** 스트리밍 done 이벤트에서 수신한 ragSources (웹 검색 결과 등) */
  streamRagSources?: RagSource[];
}

/**
 * UIMessage를 EnhancedChatMessage로 변환
 */
export function transformUIMessageToEnhanced(
  message: UIMessage,
  options: TransformOptions,
  isLastMessage: boolean
): EnhancedChatMessage {
  const { isLoading, currentMode, streamRagSources } = options;
  const rawText = extractTextFromUIMessage(message);
  // 🐛 Fix: 스트리밍 응답에서 JSON 페이로드 노출 방지
  // Cloud Run NLQ Agent가 { answer, confidence, toolsUsed } JSON을 반환할 때
  // answer 필드만 추출 (Job Queue 경로에서는 이미 적용됨, 스트리밍 경로 누락 수정)
  const textContent =
    message.role === 'assistant' ? normalizeAIResponse(rawText) : rawText;

  // Tool parts 추출 (null/undefined 방어 코드 추가)
  const toolParts =
    message.parts?.filter(
      (part): part is typeof part & { toolCallId: string } =>
        part != null &&
        typeof part.type === 'string' &&
        part.type.startsWith('tool-') &&
        'toolCallId' in part
    ) ?? [];

  // ThinkingSteps 생성
  const thinkingSteps = toolParts.map((toolPart) => {
    const toolName = toolPart.type.slice(5);
    const state = (toolPart as { state?: string }).state;
    const output = (toolPart as { output?: unknown }).output;

    const isCompleted = state === 'output-available' || output !== undefined;
    const hasError = state === 'output-error';

    return {
      id: toolPart.toolCallId,
      step: toolName,
      status: hasError
        ? ('failed' as const)
        : isCompleted
          ? ('completed' as const)
          : ('processing' as const),
      description: hasError
        ? `Error: ${(toolPart as { errorText?: string }).errorText || 'Unknown error'}`
        : isCompleted
          ? `Completed: ${JSON.stringify(output)}`
          : `Executing ${toolName}...`,
      timestamp: new Date(),
    };
  });

  // Extract traceId from message metadata (available for all roles)
  const metadata = getMessageMetadata(message);
  const traceId = metadata?.traceId;

  // 분석 근거 생성 (assistant 메시지에만)
  let analysisBasis: AnalysisBasis | undefined;
  if (message.role === 'assistant') {
    const isJobQueue = currentMode === 'job-queue';
    const hasTools = toolParts.length > 0;

    // RAG 출처 추출 (job-queue: metadata, streaming: streamRagSources fallback)
    const ragSources =
      metadata?.ragSources ?? (isLastMessage ? streamRagSources : undefined);
    const hasRag = ragSources && ragSources.length > 0;

    const webSources = ragSources?.filter((s) => s.sourceType === 'web') ?? [];
    const hasWebSearch = webSources.length > 0;

    analysisBasis = {
      dataSource: hasWebSearch
        ? `웹 검색 (${webSources.length}건)`
        : hasRag
          ? `RAG 지식베이스 검색 (${ragSources.length}건)`
          : hasTools
            ? '서버 실시간 데이터 분석'
            : '일반 대화 응답',
      engine: isJobQueue ? 'Cloud Run AI' : 'Streaming AI',
      ragUsed: hasRag || hasTools || hasWebSearch,
      confidence: hasWebSearch ? 88 : hasRag ? 90 : hasTools ? 85 : undefined,
      timeRange: hasTools ? '최근 1시간' : undefined,
      ragSources: hasRag ? ragSources : undefined,
    };
  }

  return {
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system' | 'thinking',
    content: textContent,
    timestamp: new Date(),
    isStreaming: isLoading && isLastMessage,
    thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
    metadata:
      analysisBasis || traceId || metadata?.assistantResponseView
        ? {
            ...(analysisBasis && { analysisBasis }),
            ...(traceId && { traceId }),
            ...(metadata?.assistantResponseView && {
              assistantResponseView: metadata.assistantResponseView,
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
