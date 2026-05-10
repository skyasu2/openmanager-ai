'use client';

/**
 * 🤖 useAIChatCore - AI 채팅 공통 로직 훅
 *
 * AISidebarV4와 AIWorkspace에서 공유하는 핵심 로직:
 * - Hybrid AI Query (Streaming + Job Queue)
 * - 세션 제한
 * - 메시지 변환
 * - 파일 첨부 재시도 지원
 *
 * @note 유틸리티는 utils/ 폴더로 분리됨
 * @updated 2026-01-28 - 재시도 시 파일 첨부 보존 (lastAttachmentsRef)
 */

import type { UIMessage } from '@ai-sdk/react';
import {
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { getComplexityThreshold } from '@/config/ai-proxy.config';
import {
  type AgentStatusEventData,
  type AIStreamStatus,
  type ClarificationOption,
  type ClarificationRequest,
  type HandoffEventData,
  useHybridAIQuery,
} from '@/hooks/ai/useHybridAIQuery';
import {
  buildAssistantPlanFromRouteDecision,
  buildAssistantResultFromRouteDecision,
} from '@/lib/ai/assistant-contract';
import {
  type ChatArtifactIntentReason,
  classifyChatArtifactIntent,
  createArtifactGuidanceMessage,
  fetchLLMChatArtifactIntent,
  shouldUseLLMChatArtifactIntent,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import { generateIncidentReportArtifact } from '@/lib/ai/chat-artifacts/incident-report-artifact';
import { generateMonitoringAnalysisArtifact } from '@/lib/ai/chat-artifacts/monitoring-analysis-artifact';
import { generateServerSnapshotArtifact } from '@/lib/ai/chat-artifacts/server-snapshot-artifact';
import {
  type ChatArtifact,
  createArtifactEnvelope,
} from '@/lib/ai/chat-artifacts/types';
import type { DeveloperPanelData } from '@/lib/ai/developer-panel';
import { MONITORING_ARTIFACT_RENDERER_DOMAIN_ID } from '@/lib/ai/domain-renderers/artifact-renderer-registry';
import type { AIErrorDetails } from '@/lib/ai/error-details';
import { buildRouteDecision } from '@/lib/ai/route-decision';
import { logger } from '@/lib/logging';
import {
  type EnhancedChatMessage,
  useAISidebarStore,
} from '@/stores/useAISidebarStore';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { SessionState } from '@/types/session';
import { triggerAIWarmup } from '@/utils/ai-warmup';
import { buildFrontendQueryRoutingDecision } from './core/query-routing';
import { useChatHistory } from './core/useChatHistory';
import { useChatQueue } from './core/useChatQueue';
import { useChatSession } from './core/useChatSession';
import { useChatSessionState } from './core/useChatSessionState';
import type { StreamRagSource } from './types/stream-rag.types';
import { useAIChatHybridCallbacks } from './useAIChatHybridCallbacks';
import { useDeferredMessageMetadata } from './useDeferredMessageMetadata';
import { useEnhancedChatMessages } from './useEnhancedChatMessages';
import type { FileAttachment } from './useFileAttachments';
import { convertThinkingStepsToUI } from './utils/message-helpers';

// Re-export for backwards compatibility
export { convertThinkingStepsToUI };
// NOTE: SessionState 타입은 './core/useChatSessionState'에서 직접 import하세요.
// Storybook vitest mock 변환기가 type 재내보내기를 런타임 값으로 취급하므로 제거

// ============================================================================
// Types
// ============================================================================

export interface UseAIChatCoreOptions {
  /** 세션 ID (외부에서 전달 시 사용) */
  sessionId?: string;
  /** 메시지 전송 콜백 */
  onMessageSend?: (message: string) => void;
  /** 세션 제한 비활성화 (전체화면에서 필요시) */
  disableSessionLimit?: boolean;
  /** Dashboard snapshot data slot used to keep sidebar AI answers aligned. */
  queryAsOfDataSlot?: JobDataSlot;
}

export interface UseAIChatCoreReturn {
  // 입력 상태
  input: string;
  setInput: (value: string) => void;

  // 메시지
  messages: EnhancedChatMessage[];
  sendQuery: (query: string) => void;

  // 로딩/진행 상태
  isLoading: boolean;
  hybridState: {
    progress?: { progress: number; stage: string; message?: string };
    jobId?: string;
    error?: string | null;
    errorDetails?: AIErrorDetails | null;
  };
  currentMode?: 'streaming' | 'job-queue';
  streamStatus?: AIStreamStatus;

  // 에러 상태
  error: string | null;
  clearError: () => void;

  // 세션 관리
  sessionId: string;
  sessionState: SessionState;
  handleNewSession: () => void;

  // 액션
  regenerateLastResponse: () => void;
  /** 마지막 쿼리 재시도 (파일 첨부 포함) */
  retryLastQuery: () => void;
  stop: () => void;
  cancel: () => void;

  // 입력 처리 (파일 첨부 지원)
  handleSendInput: (
    attachments?: FileAttachment[],
    overrideText?: string
  ) => void;

  // 명확화 기능
  clarification: ClarificationRequest | null;
  selectClarification: (option: ClarificationOption) => void;
  submitCustomClarification: (customInput: string) => void;
  skipClarification: () => void;
  /** 명확화 취소 (쿼리 미실행, 상태 정리만) */
  dismissClarification: () => void;

  // 대기열 큐 상태
  queuedQueries: Array<{
    id: number;
    text: string;
    attachments?: FileAttachment[];
  }>;
  removeQueuedQuery: (index: number) => void;

  // 🎯 실시간 Agent 상태 (스트리밍 중 표시)
  currentAgentStatus: AgentStatusEventData | null;
  currentHandoff: HandoffEventData | null;
  developerPanelData: DeveloperPanelData | null;

  /** Cloud Run AI Engine 웜업 중 여부 */
  warmingUp: boolean;
  /** 웜업 예상 대기 시간 (초) */
  estimatedWaitSeconds: number;
}

const QA_THINKING_VISUALIZER_PROMPT = '/qa-thinking-visualizer';
const DEBUG_ROUTING_PROMPT = '/debug-routing';

function isQAThinkingVisualizerPrompt(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.includes(QA_THINKING_VISUALIZER_PROMPT);
}

function isDebugRoutingPrompt(text: string): boolean {
  return text.trim().toLowerCase().startsWith(DEBUG_ROUTING_PROMPT);
}

function createDebugRoutingMessages(
  fullText: string,
  analysisMode: import('@/types/ai/analysis-mode').AnalysisMode
): [UIMessage, UIMessage] {
  const query = fullText.replace(/^\/debug-routing\s*/i, '').trim();
  const token = Date.now().toString(36);

  const threshold = getComplexityThreshold(); // 기본 19
  const routingDecision = buildFrontendQueryRoutingDecision({
    query: query || '(쿼리 없음)',
    complexityThreshold: threshold,
    analysisMode,
  });
  const {
    analysis,
    forceJobQueue: forceResult,
    modeAdjustedThreshold,
    queryMode,
  } = routingDecision;

  const isComplex = queryMode === 'job-queue';
  const routePath = isComplex
    ? 'Job Queue (/api/ai/jobs)'
    : 'Streaming (/api/ai/supervisor/stream/v2)';

  const factorLines =
    analysis.factors.length > 0
      ? analysis.factors.map((f) => `  · ${f}`).join('\n')
      : '  · (없음)';

  const forceNote = forceResult.force
    ? `\n⚡ 강제 Job Queue: 키워드 "${forceResult.matchedKeyword}" 감지`
    : '';

  const thinkingNote =
    analysisMode === 'thinking'
      ? `\n🧠 thinking 모드: threshold ${threshold} → ${modeAdjustedThreshold} (−8)`
      : '';

  const resultText =
    `🔍 **Routing Debug**\n` +
    `\`\`\`\n` +
    `쿼리:       ${query || '(없음)'}\n` +
    `복잡도:     ${analysis.level} (score: ${analysis.score})\n` +
    `threshold:  ${modeAdjustedThreshold} (기본값: ${threshold})\n` +
    `경로:       ${isComplex ? '🔄 ' : '⚡ '}${routePath}\n` +
    `\`\`\`\n` +
    `**factors**\n${factorLines}` +
    forceNote +
    thinkingNote;

  const userMessage: UIMessage = {
    id: `debug-user-${token}`,
    role: 'user',
    parts: [{ type: 'text', text: fullText }],
  };
  const assistantMessage: UIMessage = {
    id: `debug-assistant-${token}`,
    role: 'assistant',
    parts: [{ type: 'text', text: resultText }],
  };

  return [userMessage, assistantMessage];
}

function createQAToolResultSummaries() {
  return [
    {
      toolName: 'analyzeIntent',
      label: '의도 분석',
      summary: '질문의 핵심 의도를 분석해 서버 진단 요청으로 분류했습니다.',
      status: 'completed' as const,
    },
    {
      toolName: 'selectRoute',
      label: '라우팅 결정',
      summary: '실시간 메트릭 기반 분석 경로를 선택했습니다.',
      status: 'completed' as const,
    },
    {
      toolName: 'generateInsight',
      label: '인사이트 생성',
      summary: '우선 조치 항목과 근거를 구조화했습니다.',
      status: 'completed' as const,
    },
  ];
}

function createQAAssistantMessages(text: string): [UIMessage, UIMessage] {
  const token = Date.now().toString(36);
  const userMessage: UIMessage = {
    id: `qa-user-${token}`,
    role: 'user',
    parts: [{ type: 'text', text }],
  };
  const assistantMessage: UIMessage = {
    id: `qa-assistant-${token}`,
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'QA thinking visualizer 샘플 응답입니다. AI 처리 과정 토글을 펼쳐 단계 렌더링을 확인하세요.',
      },
    ],
    metadata: {
      traceId: `qa-trace-${token}`,
      toolsCalled: ['analyzeIntent', 'selectRoute', 'generateInsight'],
      toolResultSummaries: createQAToolResultSummaries(),
    },
  };

  return [userMessage, assistantMessage];
}

function createTextMessage({
  id,
  role,
  text,
  metadata,
}: {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  metadata?: Record<string, unknown>;
}): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
    ...(metadata && { metadata }),
  };
}

function getArtifactLoadingText(kind: ChatArtifact['kind']): string {
  switch (kind) {
    case 'incident-report':
      return '장애 보고서를 작성하고 있습니다.';
    case 'monitoring-analysis':
      return '이상감지/추세 분석을 실행하고 있습니다.';
    case 'server-snapshot':
      return '서버 상태 스냅샷을 생성하고 있습니다.';
  }
}

function getArtifactSuccessText(artifact: ChatArtifact): string {
  if (artifact.kind === 'incident-report') {
    return [
      '장애 보고서를 작성했습니다.',
      '',
      `- 제목: ${artifact.report.title}`,
      `- 영향 서버: ${artifact.report.affectedServers.length}대`,
      '',
      '아래 카드에서 MD/TXT 파일로 내려받거나 장애 보고서 작성 화면에서 확인할 수 있습니다.',
    ].join('\n');
  }

  if (artifact.kind === 'server-snapshot') {
    return [
      '서버 상태 스냅샷을 생성했습니다.',
      '',
      `- 총 서버: ${artifact.totals.total}대`,
      `- 주의/위험: ${artifact.totals.warning + artifact.totals.critical + artifact.totals.offline}대`,
      '',
      '아래 카드에서 MD/JSON 파일로 내려받을 수 있습니다.',
    ].join('\n');
  }

  return [
    '이상감지/추세 분석을 완료했습니다.',
    '',
    `- 분석 서버: ${artifact.serverCount}대`,
    `- 위험 신호: ${artifact.riskSignalCount}건`,
    '',
    '아래 카드에서 MD/JSON 파일로 내려받거나 이상감지/추세 화면에서 확인할 수 있습니다.',
  ].join('\n');
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function getArtifactErrorText(
  kind: ChatArtifact['kind'],
  error: unknown
): string {
  if (isAbortError(error)) {
    const target =
      kind === 'incident-report'
        ? '장애 보고서 작성'
        : kind === 'server-snapshot'
          ? '서버 상태 스냅샷 생성'
          : '이상감지/추세 분석';
    return `${target}을 중단했습니다.`;
  }

  const message = error instanceof Error ? error.message : String(error);
  const target =
    kind === 'incident-report'
      ? '장애 보고서 작성'
      : kind === 'server-snapshot'
        ? '서버 상태 스냅샷 생성'
        : '이상감지/추세 분석';
  return `${target}을 완료하지 못했습니다. ${message}`;
}

function buildArtifactMetadata(
  artifact: ChatArtifact,
  intentReason: ChatArtifactIntentReason,
  queryAsOfDataSlot?: JobDataSlot
): Record<string, unknown> {
  const routeDecision = buildRouteDecision({
    intent: 'artifact',
    executionPath: 'client-artifact',
    artifactKind: artifact.kind,
    reasonCodes: [intentReason],
    decidedBy: 'frontend',
    ...(queryAsOfDataSlot?.timeLabel && {
      dataSlot: queryAsOfDataSlot.timeLabel,
    }),
  });
  const assistantPlan = buildAssistantPlanFromRouteDecision(routeDecision);
  const assistantResult = buildAssistantResultFromRouteDecision(routeDecision);
  const artifactEnvelope = createArtifactEnvelope(artifact, {
    domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
    sourceMode:
      artifact.sourceMode ??
      (artifact.kind === 'server-snapshot' ? 'otel-static' : 'tool-result'),
    ...(queryAsOfDataSlot?.timeLabel && {
      dataSlot: queryAsOfDataSlot.timeLabel,
    }),
  });

  if (artifact.kind === 'incident-report') {
    return {
      artifactIntentReason: intentReason,
      routeDecision,
      assistantPlan,
      assistantResult,
      artifactEnvelopes: [artifactEnvelope],
      incidentReportArtifact: artifact,
      toolsCalled: ['generateIncidentReportArtifact'],
      toolResultSummaries: [
        {
          toolName: 'generateIncidentReportArtifact',
          label: '장애 보고서 작성',
          summary: `${artifact.report.title} 보고서를 생성했습니다.`,
          status: 'completed' as const,
        },
      ],
    };
  }

  if (artifact.kind === 'server-snapshot') {
    return {
      artifactIntentReason: intentReason,
      routeDecision,
      assistantPlan,
      assistantResult,
      artifactEnvelopes: [artifactEnvelope],
      serverSnapshotArtifact: artifact,
      toolsCalled: ['generateServerSnapshotArtifact'],
      toolResultSummaries: [
        {
          toolName: 'generateServerSnapshotArtifact',
          label: '서버 상태 스냅샷',
          summary: `${artifact.totals.total}대 서버 상태 스냅샷을 생성했습니다.`,
          status: 'completed' as const,
        },
      ],
    };
  }

  return {
    artifactIntentReason: intentReason,
    routeDecision,
    assistantPlan,
    assistantResult,
    artifactEnvelopes: [artifactEnvelope],
    monitoringAnalysisArtifact: artifact,
    toolsCalled: ['generateMonitoringAnalysisArtifact'],
    toolResultSummaries: [
      {
        toolName: 'generateMonitoringAnalysisArtifact',
        label: '이상감지/추세 분석',
        summary: `${artifact.serverCount}개 서버 분석과 위험 신호 ${artifact.riskSignalCount}건을 정리했습니다.`,
        status: 'completed' as const,
      },
    ],
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useAIChatCore(
  options: UseAIChatCoreOptions = {}
): UseAIChatCoreReturn {
  const {
    sessionId: propSessionId,
    onMessageSend,
    disableSessionLimit,
    queryAsOfDataSlot,
  } = options;

  // 입력 상태
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [artifactIsLoading, setArtifactIsLoading] = useState(false);

  // 🎯 실시간 Agent 상태 (스트리밍 중 표시)
  const [currentAgentStatus, setCurrentAgentStatus] =
    useState<AgentStatusEventData | null>(null);
  const [currentHandoff, setCurrentHandoff] = useState<HandoffEventData | null>(
    null
  );

  // 웹 검색 UI 상태와 내부 RAG override 상태 (Store에서 읽기)
  const webSearchEnabled = useAISidebarStore((s) => s.webSearchEnabled);
  const ragEnabled = useAISidebarStore((s) => s.ragEnabled);
  const analysisMode = useAISidebarStore((s) => s.analysisMode);
  const persistedSidebarMessages = useAISidebarStore((s) => s.messages);
  const persistedSidebarSessionId = useAISidebarStore((s) => s.sessionId);
  const syncChatSnapshot = useAISidebarStore((s) => s.syncChatSnapshot);

  // 🧩 Chat Queue Hook (메시지 대기열 Batching)
  const {
    queuedQueries,
    addToQueue,
    removeQueuedQuery,
    popAndSendQueue,
    clearQueue,
    sendQueryRef,
  } = useChatQueue();

  // 스트리밍 done 이벤트에서 수신한 ragSources (웹 검색 결과 등)
  const [streamRagSources, setStreamRagSources] = useState<StreamRagSource[]>(
    []
  );
  const [developerPanelData, setDeveloperPanelData] =
    useState<DeveloperPanelData | null>(null);
  const developerPanelDataRef = useRef<DeveloperPanelData | null>(null);

  // Refs
  const lastQueryRef = useRef<string>('');
  const lastAttachmentsRef = useRef<FileAttachment[] | null>(null);
  const pendingQueryRef = useRef<string>('');
  const artifactIntentInFlightRef = useRef(false);
  const artifactInFlightRef = useRef(false);
  const artifactRequestIdRef = useRef<string | null>(null);
  const artifactAbortControllerRef = useRef<AbortController | null>(null);

  // 🧩 Composed Hooks
  const { sessionId, refreshSessionId, setSessionId } =
    useChatSession(propSessionId);

  // ============================================================================
  // Hybrid AI Query Hook
  // ============================================================================

  // Deferred metadata handlers ref: populated after useDeferredMessageMetadata call below.
  // onData fires asynchronously (never during the first render), so the ref is always
  // populated before it's first invoked.
  const deferredHandlersRef = useRef<
    import('./useDeferredMessageMetadata').DeferredMetadataHandlers | null
  >(null);

  const messagesRef = useRef<UIMessage[]>([]);
  const getPendingQuery = useCallback(() => pendingQueryRef.current, []);
  const clearPendingQuery = useCallback(() => {
    pendingQueryRef.current = '';
  }, []);
  const getDeferredHandlers = useCallback(
    () => deferredHandlersRef.current,
    []
  );
  const getMessages = useCallback(() => messagesRef.current, []);
  const getDeveloperPanelData = useCallback(
    () => developerPanelDataRef.current,
    []
  );
  const updateDeveloperPanelData = useCallback(
    (next: SetStateAction<DeveloperPanelData | null>) => {
      const resolved =
        typeof next === 'function' ? next(developerPanelDataRef.current) : next;
      developerPanelDataRef.current = resolved;
      setDeveloperPanelData(resolved);
    },
    []
  );

  const hybridCallbacks = useAIChatHybridCallbacks({
    onMessageSend,
    getPendingQuery,
    clearPendingQuery,
    getDeferredHandlers,
    getMessages,
    setError,
    setCurrentAgentStatus,
    setCurrentHandoff,
    setStreamRagSources,
    getDeveloperPanelData,
    setDeveloperPanelData: updateDeveloperPanelData,
  });

  const {
    sendQuery,
    executeQuery,
    messages,
    setMessages,
    state: hybridState,
    isLoading: hybridIsLoading,
    stop,
    cancel,
    reset: resetHybridQuery,
    clearError: clearHybridError,
    currentMode,
    streamStatus,
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
  } = useHybridAIQuery({
    sessionId,
    webSearchEnabled,
    ragEnabled,
    analysisMode,
    queryAsOfDataSlot,
    ...hybridCallbacks,
  });
  const isGenerating = hybridIsLoading || artifactIsLoading;

  const {
    streamTraceIds,
    deferredAssistantMetadataByMessageId,
    deferredToolResultsByMessageId,
    handlers: deferredHandlers,
    resetDeferredMetadata,
  } = useDeferredMessageMetadata(messages);

  useEffect(() => {
    sendQueryRef.current = sendQuery;
  }, [sendQuery, sendQueryRef]);

  // Keep imperative refs aligned before async stream callbacks observe them.
  useLayoutEffect(() => {
    messagesRef.current = messages;
    deferredHandlersRef.current = deferredHandlers;
    developerPanelDataRef.current = developerPanelData;
  }, [messages, deferredHandlers, developerPanelData]);

  const hasQueuedQueries = queuedQueries.length > 0;

  // 🎯 대기열 쿼리 발송 Effect: 응답이 완전히 끝났을 때(hybridIsLoading false 전환 시)
  // 단, 에러가 없을 때만 발송(에러 발생 시엔 재시도 등 대비해 큐 유지/또는 별도 처리)
  useEffect(() => {
    if (!hybridIsLoading && hasQueuedQueries && !error) {
      popAndSendQueue();
    }
  }, [hybridIsLoading, hasQueuedQueries, error, popAndSendQueue]);

  // ============================================================================
  // Message Transformation
  // ============================================================================

  const enhancedMessages = useEnhancedChatMessages({
    messages,
    isLoading: isGenerating,
    currentMode: currentMode ?? undefined,
    traceIdByMessageId: streamTraceIds,
    deferredAssistantMetadataByMessageId,
    deferredToolResultsByMessageId,
    streamRagSources:
      streamRagSources.length > 0 ? streamRagSources : undefined,
    ragEnabled,
  });

  // 🧩 History Hook (Needs messages from hybrid query)
  const handleMetadataRestore = useCallback(
    (
      metadataByMessageId: Record<
        string,
        { toolsCalled?: string[]; ragSources?: unknown[] }
      >
    ) => {
      for (const [messageId, meta] of Object.entries(metadataByMessageId)) {
        deferredHandlers.setDeferredAssistantMetadata(
          messageId,
          meta as Record<string, unknown>
        );
      }
    },
    [deferredHandlers]
  );

  const { clearHistory } = useChatHistory({
    sessionId,
    isMessagesEmpty: messages.length === 0,
    enhancedMessages,
    seedMessages: persistedSidebarMessages,
    seedSessionId: persistedSidebarSessionId,
    setMessages,
    isLoading: isGenerating,
    onSessionRestore: setSessionId,
    onMetadataRestore: handleMetadataRestore,
  });

  // 🧩 Session State Hook
  const sessionState = useChatSessionState(
    messages.length,
    disableSessionLimit
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // ⚡ Cloud Run 선제 웜업: 사이드바 마운트 시 한 번만 실행
  // 쿼리 시점이 아닌 UI 진입 시점에 wake-up하여 cold start 시간 선점
  useEffect(() => {
    void triggerAIWarmup('ai-chat-core');
  }, []);

  // 에러 동기화: retry 경로가 로컬 에러를 먼저 지우지 않도록 정렬했으므로
  // 메시지 변경 기준으로만 동기화한다.
  useEffect(() => {
    setError(hybridState.error ?? null);
  }, [hybridState.error]);

  // 새 쿼리 시작 시 이전 스트림 RAG 출처를 초기화해 혼합 표시를 방지한다.
  useEffect(() => {
    if (hybridIsLoading) {
      setStreamRagSources([]);
    }
  }, [hybridIsLoading]);

  useEffect(() => {
    if (enhancedMessages.length === 0) return;
    syncChatSnapshot(enhancedMessages, sessionId);
  }, [enhancedMessages, sessionId, syncChatSnapshot]);

  const handleNewSession = useCallback(() => {
    resetHybridQuery();
    updateDeveloperPanelData(null);
    const nextSessionId = refreshSessionId();
    setInput('');
    setError(null);
    setStreamRagSources([]);
    resetDeferredMetadata();
    setCurrentAgentStatus(null);
    setCurrentHandoff(null);
    pendingQueryRef.current = '';
    lastAttachmentsRef.current = null;
    artifactAbortControllerRef.current?.abort();
    artifactAbortControllerRef.current = null;
    artifactRequestIdRef.current = null;
    artifactIntentInFlightRef.current = false;
    artifactInFlightRef.current = false;
    setArtifactIsLoading(false);
    clearHistory();
    clearQueue();
    syncChatSnapshot([], nextSessionId);
  }, [
    resetHybridQuery,
    refreshSessionId,
    resetDeferredMetadata,
    clearHistory,
    clearQueue,
    syncChatSnapshot,
    updateDeveloperPanelData,
  ]);

  const clearError = useCallback(() => {
    setError(null);
    clearHybridError();
  }, [clearHybridError]);

  const regenerateLastResponse = useCallback(() => {
    if (messages.length < 2) return;
    const lastUserMessageIndex = [...messages]
      .reverse()
      .findIndex((m) => m.role === 'user');
    if (lastUserMessageIndex === -1) return;
    const actualIndex = messages.length - 1 - lastUserMessageIndex;
    const lastUserMessage = messages[actualIndex];
    if (!lastUserMessage) return;

    // Extract text content from the message (null/undefined 방어 코드)
    const textPart = lastUserMessage.parts?.find(
      (p): p is { type: 'text'; text: string } => p != null && p.type === 'text'
    );
    const textContent = textPart?.text;

    if (textContent) {
      setMessages(messages.slice(0, actualIndex));
      setError(null);
      // BUG-7 fix: setMessages는 비동기 상태 업데이트이므로 sendQuery를 microtask로 지연
      queueMicrotask(() => sendQuery(textContent));
    }
  }, [messages, setMessages, sendQuery]);

  /**
   * 마지막 쿼리 재시도
   *
   * 에러 발생 후 동일한 쿼리를 다시 전송합니다.
   * 파일 첨부가 있었던 경우 함께 재전송됩니다.
   *
   * @see lastAttachmentsRef - 첨부 파일 보존용 ref
   */
  const retryLastQuery = useCallback(() => {
    if (!lastQueryRef.current) return;
    // 🎯 Fix: 재시도 시 executeQuery 사용 (재분류/재명확화 건너뛰기)
    // Cold Start 타임아웃 → 자동 재시도 시 동일 쿼리에 대해 명확화가 재트리거되는 문제 방지
    executeQuery(
      lastQueryRef.current,
      lastAttachmentsRef.current || undefined,
      true
    );
  }, [executeQuery]);

  /**
   * 명확화 선택 래퍼 - lastQueryRef를 명확화된 쿼리로 업데이트
   * 재시도 시 명확화된 쿼리가 사용되도록 보장
   */
  const wrappedSelectClarification = useCallback(
    (option: ClarificationOption) => {
      // lastQueryRef를 명확화된 쿼리로 업데이트 (재시도 대비)
      lastQueryRef.current = option.suggestedQuery;
      selectClarification(option);
    },
    [selectClarification]
  );

  // ============================================================================
  // Input Handler
  // ============================================================================

  const handleSendInput = useCallback(
    async (attachments?: FileAttachment[], overrideText?: string) => {
      // 🎯 Fix: 텍스트 또는 첨부 중 하나는 있어야 전송
      const textInput = overrideText ?? input;
      const hasText = textInput.trim().length > 0;
      const hasAttachments = attachments && attachments.length > 0;

      if (!hasText && !hasAttachments) return;

      if (!disableSessionLimit && sessionState.isLimitReached) {
        logger.warn(
          `⚠️ [Session] Limit reached (${sessionState.count} messages)`
        );
        return;
      }

      // 🎯 Fix: 첨부만 있을 경우 기본 텍스트 설정
      const effectiveText = hasText ? textInput : '[이미지/파일 분석 요청]';

      // 🎯 Batching: 스트리밍 중이면 큐에 추가 (즉시 전송하지 않음)
      if (hybridIsLoading) {
        addToQueue(effectiveText, attachments);
        setInput('');
        return;
      }

      if (artifactInFlightRef.current || artifactIntentInFlightRef.current) {
        setError(
          '아티팩트 생성이 진행 중입니다. 완료 후 다음 요청을 보내주세요.'
        );
        return;
      }

      if (isQAThinkingVisualizerPrompt(effectiveText)) {
        setError(null);
        setStreamRagSources([]);
        lastQueryRef.current = effectiveText;
        lastAttachmentsRef.current = attachments || null;
        pendingQueryRef.current = '';
        setInput('');
        const [qaUserMessage, qaAssistantMessage] =
          createQAAssistantMessages(effectiveText);
        setMessages([...messages, qaUserMessage, qaAssistantMessage]);
        return;
      }

      if (isDebugRoutingPrompt(effectiveText)) {
        setError(null);
        setStreamRagSources([]);
        lastQueryRef.current = effectiveText;
        lastAttachmentsRef.current = attachments || null;
        pendingQueryRef.current = '';
        setInput('');
        const [dbgUserMsg, dbgAssistantMsg] = createDebugRoutingMessages(
          effectiveText,
          analysisMode
        );
        setMessages([...messages, dbgUserMsg, dbgAssistantMsg]);
        return;
      }

      const regexIntent = classifyChatArtifactIntent(effectiveText);
      let artifactIntent = regexIntent;
      if (
        regexIntent.kind === 'none' &&
        shouldUseLLMChatArtifactIntent(effectiveText)
      ) {
        const intentAbortController = new AbortController();
        artifactIntentInFlightRef.current = true;
        artifactAbortControllerRef.current = intentAbortController;
        try {
          artifactIntent = await fetchLLMChatArtifactIntent(
            effectiveText,
            intentAbortController.signal
          );
        } finally {
          artifactIntentInFlightRef.current = false;
          if (artifactAbortControllerRef.current === intentAbortController) {
            artifactAbortControllerRef.current = null;
          }
        }

        // fetchLLMChatArtifactIntent intentionally degrades failures to none.
        // On an explicit abort, stop here so cancellation does not fall through
        // into the normal Supervisor chat path.
        if (intentAbortController.signal.aborted) {
          return;
        }
      }
      if (artifactIntent.kind === 'guidance') {
        setError(null);
        setStreamRagSources([]);
        lastQueryRef.current = effectiveText;
        lastAttachmentsRef.current = attachments || null;
        pendingQueryRef.current = '';
        setInput('');
        const token = Date.now().toString(36);
        setMessages([
          ...messages,
          createTextMessage({
            id: `artifact-guidance-user-${token}`,
            role: 'user',
            text: effectiveText,
          }),
          createTextMessage({
            id: `artifact-guidance-assistant-${token}`,
            role: 'assistant',
            text: createArtifactGuidanceMessage(artifactIntent.target),
            metadata: {
              artifactIntentReason: artifactIntent.reason,
              artifactIntentTarget: artifactIntent.target,
            },
          }),
        ]);
        return;
      }

      if (
        artifactIntent.kind === 'incident-report' ||
        artifactIntent.kind === 'monitoring-analysis' ||
        artifactIntent.kind === 'server-snapshot'
      ) {
        const artifactKind = artifactIntent.kind;
        setError(null);
        setStreamRagSources([]);
        lastQueryRef.current = effectiveText;
        lastAttachmentsRef.current = attachments || null;
        pendingQueryRef.current = '';
        setInput('');

        const token = Date.now().toString(36);
        const userMessage = createTextMessage({
          id: `artifact-user-${token}`,
          role: 'user',
          text: effectiveText,
        });
        const pendingAssistantMessage = createTextMessage({
          id: `artifact-assistant-${token}`,
          role: 'assistant',
          text: getArtifactLoadingText(artifactKind),
        });
        const fallbackArtifactMessages = [...messages, userMessage];
        const abortController = new AbortController();
        setMessages([...fallbackArtifactMessages, pendingAssistantMessage]);
        artifactRequestIdRef.current = token;
        artifactAbortControllerRef.current = abortController;
        artifactInFlightRef.current = true;
        setArtifactIsLoading(true);

        void (async () => {
          try {
            const artifact =
              artifactKind === 'incident-report'
                ? await generateIncidentReportArtifact({
                    query: effectiveText,
                    sessionId,
                    queryAsOfDataSlot,
                    signal: abortController.signal,
                  })
                : artifactKind === 'server-snapshot'
                  ? await generateServerSnapshotArtifact({
                      query: effectiveText,
                      sessionId,
                      queryAsOfDataSlot,
                      signal: abortController.signal,
                    })
                  : await generateMonitoringAnalysisArtifact({
                      query: effectiveText,
                      sessionId,
                      queryAsOfDataSlot,
                      signal: abortController.signal,
                    });

            if (artifactRequestIdRef.current !== token) {
              return;
            }

            const finalMessage = createTextMessage({
              id: pendingAssistantMessage.id,
              role: 'assistant',
              text: getArtifactSuccessText(artifact),
              metadata: buildArtifactMetadata(
                artifact,
                artifactIntent.reason,
                queryAsOfDataSlot
              ),
            });
            const currentMessages = messagesRef.current;
            const nextMessages = currentMessages.some(
              (message) => message.id === pendingAssistantMessage.id
            )
              ? currentMessages.map((message) =>
                  message.id === pendingAssistantMessage.id
                    ? finalMessage
                    : message
                )
              : [...fallbackArtifactMessages, finalMessage];

            setError(null);
            setMessages(nextMessages);
          } catch (requestError) {
            if (artifactRequestIdRef.current !== token) {
              return;
            }

            const errorText = getArtifactErrorText(artifactKind, requestError);
            const routeDecision = buildRouteDecision({
              intent: 'artifact',
              executionPath: 'client-artifact',
              artifactKind,
              reasonCodes: [artifactIntent.reason],
              decidedBy: 'frontend',
              ...(queryAsOfDataSlot?.timeLabel && {
                dataSlot: queryAsOfDataSlot.timeLabel,
              }),
            });
            const errorMessage = createTextMessage({
              id: pendingAssistantMessage.id,
              role: 'assistant',
              text: errorText,
              metadata: {
                artifactIntentReason: artifactIntent.reason,
                routeDecision,
                assistantPlan:
                  buildAssistantPlanFromRouteDecision(routeDecision),
                assistantResult: buildAssistantResultFromRouteDecision(
                  routeDecision,
                  {
                    status: 'failed',
                    errorCode: isAbortError(requestError)
                      ? 'ARTIFACT_ABORTED'
                      : 'ARTIFACT_GENERATION_FAILED',
                  }
                ),
                toolResultSummaries: [
                  {
                    toolName:
                      artifactKind === 'incident-report'
                        ? 'generateIncidentReportArtifact'
                        : artifactKind === 'server-snapshot'
                          ? 'generateServerSnapshotArtifact'
                          : 'generateMonitoringAnalysisArtifact',
                    label:
                      artifactKind === 'incident-report'
                        ? '장애 보고서 작성'
                        : artifactKind === 'server-snapshot'
                          ? '서버 상태 스냅샷'
                          : '이상감지/추세 분석',
                    summary: errorText,
                    status: 'failed' as const,
                  },
                ],
              },
            });
            const currentMessages = messagesRef.current;
            const nextMessages = currentMessages.some(
              (message) => message.id === pendingAssistantMessage.id
            )
              ? currentMessages.map((message) =>
                  message.id === pendingAssistantMessage.id
                    ? errorMessage
                    : message
                )
              : [...fallbackArtifactMessages, errorMessage];

            setError(errorText);
            setMessages(nextMessages);
          } finally {
            if (artifactRequestIdRef.current === token) {
              artifactRequestIdRef.current = null;
              artifactAbortControllerRef.current = null;
              artifactInFlightRef.current = false;
              setArtifactIsLoading(false);
            }
          }
        })();
        return;
      }

      setError(null);
      setStreamRagSources([]);
      lastQueryRef.current = effectiveText;
      lastAttachmentsRef.current = attachments || null;
      pendingQueryRef.current = effectiveText;
      setInput('');

      // 🎯 파일 첨부와 함께 전송
      sendQuery(effectiveText, attachments);
    },
    [
      input,
      disableSessionLimit,
      sessionState,
      hybridIsLoading,
      sendQuery,
      addToQueue,
      messages,
      setMessages,
      analysisMode,
      sessionId,
      queryAsOfDataSlot,
    ]
  );

  const stopGeneration = useCallback(() => {
    if (artifactInFlightRef.current || artifactIntentInFlightRef.current) {
      artifactAbortControllerRef.current?.abort();
      return;
    }

    stop();
  }, [stop]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    input,
    setInput,
    messages: enhancedMessages,
    sendQuery,
    isLoading: isGenerating,
    hybridState: {
      progress: hybridState.progress ?? undefined,
      jobId: hybridState.jobId ?? undefined,
      error: hybridState.error ?? undefined,
      errorDetails: hybridState.errorDetails ?? undefined,
    },
    currentMode: currentMode ?? undefined,
    streamStatus,
    error,
    clearError,
    sessionId: sessionId,
    sessionState,
    handleNewSession,
    regenerateLastResponse,
    retryLastQuery,
    stop: stopGeneration,
    cancel,
    handleSendInput,
    clarification: hybridState.clarification ?? null,
    selectClarification: wrappedSelectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
    queuedQueries,
    removeQueuedQuery,
    // 🎯 실시간 Agent 상태
    currentAgentStatus,
    currentHandoff,
    developerPanelData,

    // ⚡ Cloud Run 웜업 상태
    warmingUp: hybridState.warmingUp,
    estimatedWaitSeconds: hybridState.estimatedWaitSeconds,
  };
}
