/**
 * 🤖 AI 사이드바 통합 상태 관리 스토어 - 최적화 버전
 *
 * ⚡ 최적화 사항:
 * - SSR 안전성 보장
 * - 메모리 사용량 최적화
 * - 함수 패널 기능 통합
 * - 공통 로직 중앙화
 * - hooks/ai-sidebar 훅들과 통합
 */

'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  AssistantPlan,
  AssistantResult,
} from '@/lib/ai/assistant-contract';
import type { ChatArtifactIntentReason } from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import type {
  ArtifactEnvelope,
  IncidentReportArtifact,
  MonitoringAnalysisArtifact,
  ServerSnapshotArtifact,
} from '@/lib/ai/chat-artifacts/types';
import type { RouteDecision } from '@/lib/ai/route-decision';
import type { SemanticQueryTrace } from '@/lib/ai/semantic-intent-frame';
import type {
  AnalysisFeatureStatus,
  EvidenceCard,
  RetrievalMetadata,
} from '@/types/ai/retrieval-status';
import type { JobDataSlot } from '@/types/ai-jobs';

// AI Thinking Step 타입 import (ai-sidebar에서 제공)
import type { AIThinkingStep } from '../types/ai-sidebar';
import { SESSION_LIMITS } from '../types/session';

export const AI_SIDEBAR_WIDTH_LIMITS = {
  MIN: 440,
  DEFAULT: 680,
  MAX: 960,
} as const;

export const AI_SIDEBAR_PERSISTED_MESSAGE_LIMIT = 20;

export type AISidebarTab =
  | 'chat'
  | 'presets'
  | 'thinking'
  | 'settings'
  | 'functions';

const AI_SIDEBAR_TABS = [
  'chat',
  'presets',
  'thinking',
  'settings',
  'functions',
] as const satisfies readonly AISidebarTab[];

const createSessionId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function normalizeAISidebarWidth(width: unknown): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return AI_SIDEBAR_WIDTH_LIMITS.DEFAULT;
  }

  return Math.min(
    AI_SIDEBAR_WIDTH_LIMITS.MAX,
    Math.max(AI_SIDEBAR_WIDTH_LIMITS.MIN, Math.round(width))
  );
}

function normalizeActiveTab(tab: unknown): AISidebarTab {
  return typeof tab === 'string' &&
    (AI_SIDEBAR_TABS as readonly string[]).includes(tab)
    ? (tab as AISidebarTab)
    : 'chat';
}

function normalizeSessionId(sessionId: unknown): string {
  return typeof sessionId === 'string' && sessionId.trim().length > 0
    ? sessionId
    : createSessionId();
}

export interface AgentLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: unknown;
}

/**
 * 📊 분석 근거 메타데이터
 * AI 응답의 투명성을 위해 분석 근거 정보를 제공
 */
export interface AnalysisBasis {
  /** 데이터 소스 설명 (예: "18개 서버 실시간 데이터") */
  dataSource: string;
  /** AI 엔진 (예: "Cloud Run AI", "Fallback", "Streaming") */
  engine: string;
  /** RAG 사용 여부 */
  ragUsed?: boolean;
  /** 분석된 서버 수 */
  serverCount?: number;
  /** 분석 시간 범위 (예: "최근 1시간") */
  timeRange?: string;
  /** 실제 호출된 도구 이름 목록 */
  toolsCalled?: string[];
  /** Legacy retrieval source list for old chat history and web-source cards */
  ragSources?: Array<{
    title: string;
    similarity: number;
    sourceType: string;
    category?: string;
    url?: string;
  }>;
  /** Canonical retrieval evidence for new AI Engine responses */
  evidenceCards?: EvidenceCard[];
  /** Retrieval execution contract from Cloud Run AI Engine */
  retrieval?: RetrievalMetadata;
  /** UI-facing status split: enabled vs used vs suppressed vs unavailable */
  featureStatus?: AnalysisFeatureStatus;
  /** Operator-facing grouping of evidence/source origins */
  sourceGroups?: AnalysisBasisSourceGroup[];
}

export type AnalysisBasisSourceGroupType =
  | 'monitoring-data'
  | 'knowledge-base'
  | 'web-search'
  | 'tool-result';

export interface AnalysisBasisSourceGroup {
  type: AnalysisBasisSourceGroupType;
  label: string;
  count: number;
  detail?: string;
}

export interface ToolResultSummary {
  toolName: string;
  label: string;
  summary: string;
  preview?: string;
  status: 'completed' | 'failed';
}

export interface ResponseHandoff {
  from: string;
  to: string;
  reason?: string;
}

export interface ProviderAttemptTelemetry {
  provider: string;
  modelId?: string;
  attempt?: number;
  durationMs?: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'thinking';
  timestamp: Date | string;
  engine?: string;
  metadata?: {
    processingTime?: number;
    latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
    resolvedMode?: 'single' | 'multi';
    modeSelectionSource?: string;
    provider?: string;
    modelId?: string;
    providerAttempts?: ProviderAttemptTelemetry[];
    usedFallback?: boolean;
    fallbackReason?: string;
    ttfbMs?: number;
    confidence?: number;
    error?: string;
    /** Round-robin provider selection slot [0-3] for UI attribution */
    rotationSlot?: number;
    /** Langfuse trace ID for observability correlation */
    traceId?: string;
    /** 분석 근거 정보 */
    analysisBasis?: AnalysisBasis;
    /** read-only routing/planning decision metadata */
    routeDecision?: RouteDecision;
    /** read-only assistant plan facade derived from routeDecision */
    assistantPlan?: AssistantPlan;
    /** read-only assistant result facade derived from routeDecision */
    assistantResult?: AssistantResult;
    /** semantic parser/evidence routing trace for domain evidence answers */
    semanticQueryTrace?: SemanticQueryTrace;
    /** 접을 수 있는 응답 뷰 */
    assistantResponseView?: {
      summary: string;
      details?: string | null;
      shouldCollapse?: boolean;
    };
    /** 아티팩트 intent 분기 원인 코드 */
    artifactIntentReason?: ChatArtifactIntentReason;
    /** guidance 응답일 때 대상 아티팩트 */
    artifactIntentTarget?: 'incident-report' | 'monitoring-analysis';
    /** metadata message type marker for guidance-only responses */
    type?: 'guidance';
    /** guidance 응답을 즉시 artifact 실행으로 전환하는 CTA */
    guidanceCta?: {
      target: 'incident-report' | 'monitoring-analysis';
      label: string;
    };
    /** 채팅에서 생성한 사용자 다운로드 가능 장애 보고서 */
    incidentReportArtifact?: IncidentReportArtifact;
    /** 채팅에서 생성한 사용자 다운로드 가능 이상감지/추세 분석 */
    monitoringAnalysisArtifact?: MonitoringAnalysisArtifact;
    /** 채팅에서 생성한 사용자 다운로드 가능 서버 상태 스냅샷 */
    serverSnapshotArtifact?: ServerSnapshotArtifact;
    /** domain renderer registry가 복원할 수 있는 generic artifact envelope */
    artifactEnvelopes?: ArtifactEnvelope[];
    /** 도구 실행 결과 요약 */
    toolResultSummaries?: ToolResultSummary[];
    /** 에이전트 handoff 이력 */
    handoffHistory?: ResponseHandoff[];
  };
}

export interface EnhancedChatMessage extends ChatMessage {
  thinkingSteps?: AIThinkingStep[];
  isStreaming?: boolean;
  isCompleted?: boolean;
  parentMessageId?: string; // thinking 메시지가 속한 원본 메시지 ID
}

/** Store 상태용 AI 응답 (최소 구조) */
export interface SidebarAIResponse {
  content: string;
  thinkingSteps?: AIThinkingStep[];
  metadata?: Record<string, unknown>;
}

export interface ChatHookOptions {
  autoScroll?: boolean;
  maxMessages?: number;
}

export type AIEntryTarget = 'sidebar' | 'fullscreen' | 'any';

export type AIEntryFunction = 'chat' | 'auto-report' | 'intelligent-monitoring';

export interface PendingAIEntryState {
  draft?: string;
  selectedFunction?: AIEntryFunction;
  queryAsOfDataSlot?: JobDataSlot;
  artifactWorkspaceId?: string;
  target?: AIEntryTarget;
}

function isPersistableMessage(
  message: unknown
): message is EnhancedChatMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const candidate = message as Partial<EnhancedChatMessage>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.role === 'string' &&
    ['user', 'assistant', 'system', 'thinking'].includes(candidate.role) &&
    (candidate.timestamp instanceof Date ||
      typeof candidate.timestamp === 'string')
  );
}

function normalizeMessageSnapshot(
  messages: unknown,
  limit: number = SESSION_LIMITS.MESSAGE_LIMIT
): EnhancedChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter(isPersistableMessage).slice(-limit);
}

function normalizeRehydratedState(state: AISidebarState): void {
  const persisted = state as AISidebarState & {
    activeTab?: unknown;
    isMinimized?: unknown;
    messages?: unknown;
    restoreBannerDismissed?: unknown;
    sessionId?: unknown;
    sidebarWidth?: unknown;
    webSearchEnabled?: unknown;
  };

  state.isOpen = false;
  state.isMinimized = persisted.isMinimized === true;
  state.activeTab = normalizeActiveTab(persisted.activeTab);
  state.sidebarWidth = normalizeAISidebarWidth(persisted.sidebarWidth);
  state.webSearchEnabled = persisted.webSearchEnabled === true;
  state.restoreBannerDismissed = persisted.restoreBannerDismissed === true;
  state.messages = normalizeMessageSnapshot(
    persisted.messages,
    AI_SIDEBAR_PERSISTED_MESSAGE_LIMIT
  );
  state.sessionId = normalizeSessionId(persisted.sessionId);
  state.pendingPrefillMessage = null;
  state.pendingEntryState = null;
}

// 🔧 타입 정의
export interface PresetQuestion {
  id: string;
  question: string;
  category: 'performance' | 'security' | 'prediction' | 'analysis';
  isAIRecommended?: boolean;
}

// 🎯 프리셋 질문 상수
export const PRESET_QUESTIONS: readonly PresetQuestion[] = [
  // 성능 분석
  {
    id: 'perf-1',
    question: '현재 시스템의 전반적인 성능 상태는 어떤가요?',
    category: 'performance',
  },
  {
    id: 'perf-2',
    question: 'CPU 사용률이 높은 서버들을 분석해주세요',
    category: 'performance',
  },
  {
    id: 'perf-3',
    question: '메모리 사용량 트렌드를 분석해주세요',
    category: 'performance',
    isAIRecommended: true,
  },
  {
    id: 'perf-4',
    question: '응답 시간이 느린 서버를 찾아주세요',
    category: 'performance',
  },

  // 보안 점검
  {
    id: 'sec-1',
    question: '보안상 위험한 서버나 패턴이 있나요?',
    category: 'security',
  },
  {
    id: 'sec-2',
    question: '비정상적인 네트워크 활동을 감지해주세요',
    category: 'security',
    isAIRecommended: true,
  },
  {
    id: 'sec-3',
    question: '접근 권한 관련 이슈가 있는지 확인해주세요',
    category: 'security',
  },

  // 예측 분석
  {
    id: 'pred-1',
    question: '향후 1시간 내 장애 가능성이 있는 서버는?',
    category: 'prediction',
  },
  {
    id: 'pred-2',
    question: '리소스 부족으로 인한 문제가 예상되는 곳은?',
    category: 'prediction',
    isAIRecommended: true,
  },
  {
    id: 'pred-3',
    question: '내일까지 주의 깊게 모니터링해야 할 서버는?',
    category: 'prediction',
  },

  // 종합 분석
  {
    id: 'anal-1',
    question: '전체 인프라의 상태를 종합적으로 분석해주세요',
    category: 'analysis',
  },
  {
    id: 'anal-2',
    question: '최적화가 필요한 부분을 우선순위별로 알려주세요',
    category: 'analysis',
    isAIRecommended: true,
  },
  {
    id: 'anal-3',
    question: '비용 절감을 위한 개선사항을 제안해주세요',
    category: 'analysis',
  },
] as const;

// 🏪 메인 스토어 인터페이스 (확장)
interface AISidebarState {
  // UI 상태
  isOpen: boolean;
  isMinimized: boolean;
  activeTab: AISidebarTab;
  /** 사이드바 너비 (px) - 드래그 리사이즈용 */
  sidebarWidth: number;
  /** 외부 UI 액션에서 주입하는 입력 초안 */
  pendingPrefillMessage: string | null;
  /** surface 전환 또는 외부 진입 시 1회 소비할 상태 */
  pendingEntryState: PendingAIEntryState | null;

  // 채팅 관련 상태
  messages: EnhancedChatMessage[];
  sessionId: string;
  // currentEngine 제거 - v4.0: AI 모드 자동 선택으로 불필요

  // 웹 검색 source mode. false=Auto, true=On.
  webSearchEnabled: boolean;

  // 대화 복원 배너 닫힘 상태 (탭 전환 시 재노출 방지)
  restoreBannerDismissed: boolean;

  // 액션들
  setOpen: (open: boolean) => void;
  openWithPrefill: (message: string) => void;
  consumePendingPrefillMessage: () => string | null;
  queuePendingEntryState: (entry: PendingAIEntryState) => void;
  consumePendingEntryState: (
    target?: AIEntryTarget
  ) => PendingAIEntryState | null;
  setMinimized: (minimized: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setWebSearchEnabled: (
    enabled: boolean | ((prev: boolean) => boolean)
  ) => void;
  dismissRestoreBanner: () => void;
  setActiveTab: (tab: AISidebarTab) => void;

  // 채팅 관련 액션들
  addMessage: (message: EnhancedChatMessage) => void;
  syncChatSnapshot: (
    messages: EnhancedChatMessage[],
    sessionId: string
  ) => void;
  updateMessage: (
    messageId: string,
    updates: Partial<EnhancedChatMessage>
  ) => void;
  clearMessages: () => void;
  // setCurrentEngine 제거 - v4.0: AI 모드 자동 선택으로 불필요

  reset: () => void;
}

// ⚡ 메인 스토어 (간소화 - AI 로직은 hooks/ai-sidebar 훅들 사용)
export const useAISidebarStore = create<AISidebarState>()(
  devtools(
    persist(
      (set, get) => ({
        // 초기 상태
        isOpen: false,
        isMinimized: false,
        activeTab: 'chat',
        sidebarWidth: AI_SIDEBAR_WIDTH_LIMITS.DEFAULT,
        pendingPrefillMessage: null,
        pendingEntryState: null,
        webSearchEnabled: false,
        restoreBannerDismissed: false,
        messages: [],
        sessionId: createSessionId(),
        // currentEngine 제거 - v4.0: UNIFIED 모드로 자동 선택

        // UI 액션들
        setOpen: (open) =>
          set((state) => ({
            isOpen: open,
            isMinimized: open ? false : state.isMinimized,
          })),

        openWithPrefill: (message) =>
          set({
            isOpen: true,
            isMinimized: false,
            activeTab: 'chat',
            pendingPrefillMessage: message,
            pendingEntryState: {
              draft: message,
              selectedFunction: 'chat',
              target: 'sidebar',
            },
          }),

        consumePendingPrefillMessage: () => {
          const { pendingPrefillMessage, pendingEntryState } = get();
          const message = pendingEntryState?.draft ?? pendingPrefillMessage;
          set({
            pendingPrefillMessage: null,
            pendingEntryState: null,
          });
          return message;
        },

        queuePendingEntryState: (entry) =>
          set({
            pendingEntryState: entry,
            pendingPrefillMessage: entry.draft ?? null,
          }),

        consumePendingEntryState: (target = 'any') => {
          const entry = get().pendingEntryState;
          if (!entry) {
            return null;
          }

          const entryTarget = entry.target ?? 'any';
          const shouldConsume =
            target === 'any' || entryTarget === 'any' || entryTarget === target;

          if (!shouldConsume) {
            return null;
          }

          set({
            pendingEntryState: null,
            pendingPrefillMessage: null,
          });

          return entry;
        },

        setMinimized: (minimized) => set({ isMinimized: minimized }),

        toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),

        setSidebarWidth: (width) =>
          set({ sidebarWidth: normalizeAISidebarWidth(width) }),

        setWebSearchEnabled: (enabled) =>
          set((state) => ({
            webSearchEnabled:
              typeof enabled === 'function'
                ? enabled(state.webSearchEnabled)
                : enabled,
          })),

        dismissRestoreBanner: () => set({ restoreBannerDismissed: true }),

        setActiveTab: (tab) => set({ activeTab: tab }),

        // 채팅 관련 액션들
        addMessage: (message) =>
          set((state) => ({
            messages: normalizeMessageSnapshot(
              [...state.messages, message],
              SESSION_LIMITS.MESSAGE_LIMIT
            ),
          })),

        syncChatSnapshot: (messages, sessionId) =>
          set({
            messages: normalizeMessageSnapshot(
              messages,
              SESSION_LIMITS.MESSAGE_LIMIT
            ),
            sessionId: normalizeSessionId(sessionId),
          }),

        updateMessage: (messageId, updates) =>
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === messageId ? { ...msg, ...updates } : msg
            ),
          })),

        clearMessages: () => set({ messages: [] }),

        // setCurrentEngine 제거 - v4.0: AI 모드 자동 선택으로 불필요

        reset: () =>
          set({
            isOpen: false,
            isMinimized: false,
            activeTab: 'chat',
            sidebarWidth: AI_SIDEBAR_WIDTH_LIMITS.DEFAULT,
            pendingPrefillMessage: null,
            pendingEntryState: null,
            webSearchEnabled: false,
            restoreBannerDismissed: false,
            messages: [],
            sessionId: createSessionId(),
            // currentEngine 제거 - v4.0: UNIFIED 모드로 자동 선택
          }),
      }),
      {
        name: 'ai-sidebar-storage',
        partialize: (state) => ({
          // 중요한 상태만 영속화
          isMinimized: state.isMinimized,
          activeTab: normalizeActiveTab(state.activeTab),
          sidebarWidth: normalizeAISidebarWidth(state.sidebarWidth),
          webSearchEnabled: state.webSearchEnabled,
          restoreBannerDismissed: state.restoreBannerDismissed,
          messages: normalizeMessageSnapshot(
            state.messages,
            AI_SIDEBAR_PERSISTED_MESSAGE_LIMIT
          ),
          // currentEngine 제거 - v4.0: localStorage 마이그레이션으로 자동 정리됨
          sessionId: normalizeSessionId(state.sessionId),
        }),
        // SSR 안전성을 위한 완전한 hydration 제어
        skipHydration: true,
        // Hydration 불일치 방지를 위한 추가 옵션
        onRehydrateStorage: () => (state) => {
          if (state) {
            normalizeRehydratedState(state);
          }
        },
      }
    ),
    { name: 'AISidebarStore' }
  )
);

if (typeof window !== 'undefined' && !useAISidebarStore.persist.hasHydrated()) {
  void useAISidebarStore.persist.rehydrate();
}

// 🚨 타입 정의 추가
export interface AISidebarSettings {
  autoThinking: boolean;
  contextLevel: 'basic' | 'advanced' | 'custom';
  responseFormat: 'brief' | 'detailed' | 'technical';
}

export interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  isClosable?: boolean;
  autoClose?: number;
}
