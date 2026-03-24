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

type DeferredToolResult = {
  toolName: string;
  result: unknown;
};

type UIMessagePart = NonNullable<UIMessage['parts']>[number];

type ToolPartWithCallId = UIMessagePart & {
  type: `tool-${string}`;
  toolCallId: string;
  output?: unknown;
  result?: unknown;
  state?: string;
  errorText?: string;
};

type ServerMetricsDataSlot = {
  slotIndex: number;
  minuteOfDay: number;
  timeLabel: string;
};

type ServerMetricsDataSource = {
  scopeName: string;
  scopeVersion: string;
  catalogGeneratedAt: string;
  hour: number;
};

type ServerMetricsParityMetadata = {
  dataSlot: ServerMetricsDataSlot;
  dataSource: ServerMetricsDataSource;
};

const LEGACY_PARITY_PATTERNS = [
  /getServerMetrics의 원본 데이터 필드/i,
  /_dataSlot/i,
  /_dataSource/i,
  /YYYYMMDD_HHMM/i,
  /메트릭 수집 소스/i,
  /전체 응답의 기준 시간 슬롯/i,
];

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

function mergeMessageMetadata(
  base: MessageMetadata | undefined,
  deferred: Record<string, unknown> | undefined
): MessageMetadata | undefined {
  if (!base && !deferred) return undefined;
  return {
    ...(base ?? {}),
    ...(deferred ?? {}),
  } as MessageMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDataSlot(value: unknown): value is ServerMetricsDataSlot {
  return (
    isRecord(value) &&
    typeof value.slotIndex === 'number' &&
    typeof value.minuteOfDay === 'number' &&
    typeof value.timeLabel === 'string'
  );
}

function isDataSource(value: unknown): value is ServerMetricsDataSource {
  return (
    isRecord(value) &&
    typeof value.scopeName === 'string' &&
    typeof value.scopeVersion === 'string' &&
    typeof value.catalogGeneratedAt === 'string' &&
    typeof value.hour === 'number'
  );
}

function isToolPartWithCallId(
  part: UIMessagePart | null | undefined
): part is ToolPartWithCallId {
  return (
    part != null &&
    typeof part.type === 'string' &&
    part.type.startsWith('tool-') &&
    'toolCallId' in part &&
    typeof part.toolCallId === 'string'
  );
}

function extractToolOutput(toolPart: ToolPartWithCallId): unknown {
  return toolPart.output ?? toolPart.result;
}

function createDeferredToolParts(
  toolResults: DeferredToolResult[] | undefined
): ToolPartWithCallId[] {
  if (!toolResults || toolResults.length === 0) return [];

  return toolResults.map((entry, index) => ({
    type: `tool-${entry.toolName}` as `tool-${string}`,
    toolCallId: `stream-tool-${entry.toolName}-${index}`,
    input: undefined,
    output: entry.result,
    state: 'output-available',
  }));
}

function extractServerMetricsParityMetadata(
  toolParts: ToolPartWithCallId[]
): ServerMetricsParityMetadata | null {
  const metricsToolPart = [...toolParts]
    .reverse()
    .find((part) => part.type === 'tool-getServerMetrics');

  if (!metricsToolPart) return null;

  const output = extractToolOutput(metricsToolPart);
  if (!isRecord(output)) return null;
  if (!isDataSlot(output.dataSlot) || !isDataSource(output.dataSource)) {
    return null;
  }

  return {
    dataSlot: output.dataSlot,
    dataSource: output.dataSource,
  };
}

function stripLegacyParityDetails(
  details: string | null | undefined
): string | null {
  if (typeof details !== 'string' || !details.trim()) return null;

  const filteredParagraphs = details
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter(
      (paragraph) =>
        !LEGACY_PARITY_PATTERNS.some((pattern) => pattern.test(paragraph))
    );

  const normalized = filteredParagraphs.join('\n\n').trim();
  return normalized.length > 0 ? normalized : null;
}

function formatParityMetadataDetails(
  parity: ServerMetricsParityMetadata
): string {
  return [
    '### Parity Metadata Contract',
    '```json',
    JSON.stringify(
      {
        dataSlot: parity.dataSlot,
        dataSource: parity.dataSource,
      },
      null,
      2
    ),
    '```',
  ].join('\n');
}

function buildParityAwareAssistantResponseView(
  content: string,
  structured: StructuredAssistantResponse | undefined,
  parity: ServerMetricsParityMetadata | null
): StructuredAssistantResponse | undefined {
  if (!parity) return structured;

  const normalizedParityDetails = formatParityMetadataDetails(parity);

  if (!structured) {
    return {
      summary: content.trim(),
      details: normalizedParityDetails,
      // Keep the main message rendering unchanged for short parity answers.
      shouldCollapse: false,
    };
  }

  const sanitizedExistingDetails = stripLegacyParityDetails(structured.details);
  const details = sanitizedExistingDetails
    ? `${sanitizedExistingDetails}\n\n${normalizedParityDetails}`
    : normalizedParityDetails;

  return {
    ...structured,
    details,
    shouldCollapse: true,
  };
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

  // Tool parts 추출 (null/undefined 방어 코드 추가)
  const toolParts = [...messageToolParts, ...deferredToolParts];

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
  const traceId = metadata?.traceId ?? traceIdByMessageId?.[message.id];
  const parityMetadata =
    message.role === 'assistant'
      ? extractServerMetricsParityMetadata(toolParts)
      : null;
  const assistantResponseView = buildParityAwareAssistantResponseView(
    textContent,
    metadata?.assistantResponseView,
    parityMetadata
  );

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
      analysisBasis || traceId || assistantResponseView
        ? {
            ...(analysisBasis && { analysisBasis }),
            ...(traceId && { traceId }),
            ...(assistantResponseView && {
              assistantResponseView,
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
