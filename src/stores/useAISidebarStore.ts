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
import { useShallow } from 'zustand/react/shallow';
import type { AnalysisMode } from '@/types/ai/analysis-mode';
import type {
  AnalysisFeatureStatus,
  RetrievalMetadata,
} from '@/types/ai/retrieval-status';
import type { JobDataSlot } from '@/types/ai-jobs';

// AI Thinking Step 타입 import (ai-sidebar에서 제공)
import type { AIThinkingStep } from '../types/ai-sidebar';
import { SESSION_LIMITS } from '../types/session';

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
  /** RAG 검색 출처 목록 */
  ragSources?: Array<{
    title: string;
    similarity: number;
    sourceType: string;
    category?: string;
    url?: string;
  }>;
  /** Retrieval execution contract from Cloud Run AI Engine */
  retrieval?: RetrievalMetadata;
  /** UI-facing status split: enabled vs used vs suppressed vs unavailable */
  featureStatus?: AnalysisFeatureStatus;
  /** 사용자가 선택한 분석 강도 모드 */
  analysisMode?: AnalysisMode;
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
  timestamp: Date;
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
    /** Langfuse trace ID for feedback scoring */
    traceId?: string;
    /** 분석 근거 정보 */
    analysisBasis?: AnalysisBasis;
    /** 접을 수 있는 응답 뷰 */
    assistantResponseView?: {
      summary: string;
      details?: string | null;
      shouldCollapse?: boolean;
    };
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
  analysisMode?: AnalysisMode;
  queryAsOfDataSlot?: JobDataSlot;
  target?: AIEntryTarget;
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
  activeTab: 'chat' | 'presets' | 'thinking' | 'settings' | 'functions';
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

  // RAG (Knowledge Base) source mode. false=Auto, true=On.
  ragEnabled: boolean;

  // 분석 강도 모드
  analysisMode: AnalysisMode;

  // 대화 복원 배너 닫힘 상태 (탭 전환 시 재노출 방지)
  restoreBannerDismissed: boolean;

  // 함수 패널 관련 상태
  functionTab: 'qa' | 'report' | 'patterns' | 'logs' | 'context';
  selectedContext: 'basic' | 'advanced' | 'custom';

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
  setRagEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setAnalysisMode: (mode: AnalysisMode) => void;
  dismissRestoreBanner: () => void;
  resetRestoreBanner: () => void;
  setActiveTab: (
    tab: 'chat' | 'presets' | 'thinking' | 'settings' | 'functions'
  ) => void;
  setFunctionTab: (
    tab: 'qa' | 'report' | 'patterns' | 'logs' | 'context'
  ) => void;
  setSelectedContext: (context: 'basic' | 'advanced' | 'custom') => void;

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
        sidebarWidth: 680, // 기본 너비 680px
        pendingPrefillMessage: null,
        pendingEntryState: null,
        webSearchEnabled: false,
        ragEnabled: false,
        analysisMode: 'auto',
        restoreBannerDismissed: false,
        functionTab: 'qa',
        selectedContext: 'basic',
        messages: [],
        sessionId:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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

        setSidebarWidth: (width) => set({ sidebarWidth: width }),

        setWebSearchEnabled: (enabled) =>
          set((state) => ({
            webSearchEnabled:
              typeof enabled === 'function'
                ? enabled(state.webSearchEnabled)
                : enabled,
          })),

        setRagEnabled: (enabled) =>
          set((state) => ({
            ragEnabled:
              typeof enabled === 'function'
                ? enabled(state.ragEnabled)
                : enabled,
          })),

        setAnalysisMode: (mode) => set({ analysisMode: mode }),

        dismissRestoreBanner: () => set({ restoreBannerDismissed: true }),
        resetRestoreBanner: () => set({ restoreBannerDismissed: false }),

        setActiveTab: (tab) => set({ activeTab: tab }),

        setFunctionTab: (tab) => set({ functionTab: tab }),

        setSelectedContext: (context) => set({ selectedContext: context }),

        // 채팅 관련 액션들
        addMessage: (message) =>
          set((state) => ({
            messages: [...state.messages, message].slice(
              -SESSION_LIMITS.MESSAGE_LIMIT
            ), // SESSION_LIMITS 상수 사용 (50개, 보안 강화)
          })),

        syncChatSnapshot: (messages, sessionId) =>
          set({
            messages: messages.slice(-SESSION_LIMITS.MESSAGE_LIMIT),
            sessionId,
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
            sidebarWidth: 680, // 기본 너비로 리셋
            pendingPrefillMessage: null,
            pendingEntryState: null,
            webSearchEnabled: false,
            ragEnabled: false,
            analysisMode: 'auto',
            restoreBannerDismissed: false,
            functionTab: 'qa',
            selectedContext: 'basic',
            messages: [],
            sessionId:
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            // currentEngine 제거 - v4.0: UNIFIED 모드로 자동 선택
          }),
      }),
      {
        name: 'ai-sidebar-storage',
        partialize: (state) => ({
          // 중요한 상태만 영속화
          isMinimized: state.isMinimized,
          activeTab: state.activeTab,
          sidebarWidth: state.sidebarWidth, // 사이드바 너비 영속화
          webSearchEnabled: state.webSearchEnabled,
          ragEnabled: state.ragEnabled,
          analysisMode: state.analysisMode,
          restoreBannerDismissed: state.restoreBannerDismissed,
          functionTab: state.functionTab,
          selectedContext: state.selectedContext,
          // 🔥 대화 기록 영속화 (최근 20개만 - localStorage 5MB 초과 방지)
          messages: state.messages.slice(-20),
          // currentEngine 제거 - v4.0: localStorage 마이그레이션으로 자동 정리됨
          sessionId: state.sessionId,
        }),
        // SSR 안전성을 위한 완전한 hydration 제어
        skipHydration: true,
        // Hydration 불일치 방지를 위한 추가 옵션
        onRehydrateStorage: () => (state) => {
          // Hydration 후 초기 상태 정규화
          if (state) {
            state.isOpen = false; // 초기에는 항상 닫힌 상태로 시작
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

// 🎛️ 선택적 훅들 (성능 최적화 - useShallow로 불필요한 리렌더링 방지)
export const useAISidebarUI = () => {
  return useAISidebarStore(
    useShallow((state) => ({
      isOpen: state.isOpen,
      isMinimized: state.isMinimized,
      activeTab: state.activeTab,
      functionTab: state.functionTab,
      sidebarWidth: state.sidebarWidth,
      setOpen: state.setOpen,
      setMinimized: state.setMinimized,
      setActiveTab: state.setActiveTab,
      setFunctionTab: state.setFunctionTab,
      setSidebarWidth: state.setSidebarWidth,
    }))
  );
};

export const useAIContext = () => {
  return useAISidebarStore(
    useShallow((state) => ({
      selectedContext: state.selectedContext,
      setSelectedContext: state.setSelectedContext,
    }))
  );
};

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
