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
  const { isLoading, currentMode, streamRagSources, ragEnabled } = options;
  const rawText = extractTextFromUIMessage(message);
  // 단일 정규화 지점: Cloud Run Agent가 { answer, confidence } JSON을 반환할 때
  // answer 필드만 추출. Streaming/Job Queue 양쪽 경로 모두 여기서 처리.
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

    // 실제 호출된 도구 이름 추출
    const calledToolNames = toolParts.map((p) => p.type.slice(5));

    // RAG 출처 추출 (job-queue: metadata, streaming: streamRagSources fallback)
    const ragSources =
      metadata?.ragSources ?? (isLastMessage ? streamRagSources : undefined);
    const hasRag = ragSources && ragSources.length > 0;

    const webSources = ragSources?.filter((s) => s.sourceType === 'web') ?? [];
    const hasWebSearch = webSources.length > 0;

    // dataSource 결정: 실제 도구 호출 기반 + 토글 상태 반영
    let dataSource: string;
    if (hasWebSearch) {
      dataSource = `웹 검색 (${webSources.length}건)`;
    } else if (hasRag) {
      dataSource = `RAG 지식베이스 검색 (${ragSources.length}건)`;
    } else if (hasTools) {
      dataSource = '서버 실시간 데이터 분석';
    } else if (ragEnabled) {
      dataSource = '일반 대화 응답 (RAG 활성)';
    } else {
      dataSource = '일반 대화 응답';
    }

    analysisBasis = {
      dataSource,
      engine: isJobQueue ? 'Cloud Run AI' : 'Streaming AI',
      ragUsed: hasRag || hasTools || hasWebSearch,
      toolsCalled: calledToolNames.length > 0 ? calledToolNames : undefined,
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
