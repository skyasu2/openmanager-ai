'use client';

/**
 * 🤖 AI Workspace Controller (Unified Streaming Architecture)
 *
 * v4.0.0 - useAIChatCore 통합:
 * - AISidebarV4와 동일한 공통 훅 사용 (useAIChatCore)
 * - 세션 제한 (전체화면에서는 비활성화)
 * - 피드백 기능 통합
 */

import {
  ArrowLeftFromLine,
  Bot,
  FileText,
  MessageSquare,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Plus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Activity, useCallback, useEffect, useRef, useState } from 'react';
import { EnhancedAIChat } from '@/components/ai-sidebar/EnhancedAIChat';
import { AIErrorBoundary } from '@/components/error/AIErrorBoundary';
import { APP_VERSION } from '@/config/app-meta';
import { useAIChatCore } from '@/hooks/ai/useAIChatCore';
import { useAIChatSurface } from '@/hooks/ai/useAIChatSurface';
import { RealTimeDisplay } from '../dashboard/RealTimeDisplay';
import { OpenManagerLogo } from '../shared/OpenManagerLogo';
import UnifiedProfileHeader from '../shared/UnifiedProfileHeader';
import AIAssistantIconPanel, {
  type AIAssistantFunction,
} from './AIAssistantIconPanel';
import AIContentArea from './AIContentArea';
import { AIWorkspaceMessage } from './AIWorkspaceMessage';
import SystemContextPanel from './SystemContextPanel';

// 🔧 공통 로직은 useAIChatCore 훅에서 관리

const AI_ASSISTANT_LIGHT_THEME_TOKENS = {
  '--background': '0 0% 100%',
  '--foreground': '222.2 84% 4.9%',
  '--card': '0 0% 100%',
  '--card-foreground': '222.2 84% 4.9%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '222.2 84% 4.9%',
  '--secondary': '210 40% 96%',
  '--secondary-foreground': '222.2 84% 4.9%',
  '--muted': '210 40% 96%',
  '--muted-foreground': '215.4 16.3% 46.9%',
  '--accent': '210 40% 96%',
  '--accent-foreground': '222.2 84% 4.9%',
  '--border': '214.3 31.8% 91.4%',
  '--input': '214.3 31.8% 91.4%',
} as const;

function useAIAssistantLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const previousTokens = new Map<string, string>();
    const previousColorScheme = root.style.colorScheme;

    for (const [token, value] of Object.entries(
      AI_ASSISTANT_LIGHT_THEME_TOKENS
    )) {
      previousTokens.set(token, root.style.getPropertyValue(token));
      root.style.setProperty(token, value);
    }
    root.style.colorScheme = 'light';

    return () => {
      for (const [token, previousValue] of previousTokens) {
        if (previousValue) {
          root.style.setProperty(token, previousValue);
        } else {
          root.style.removeProperty(token);
        }
      }
      root.style.colorScheme = previousColorScheme;
    };
  }, []);
}

interface AIWorkspaceProps {
  /** @deprecated mode prop은 제거됨. AIWorkspace는 fullscreen 전용. sidebar는 AISidebarV4 사용. */
  mode?: never;
}

/**
 * AIWorkspace Component
 *
 * 통합된 AI 작업 공간을 제공합니다.
 * Sidebar 모드와 Fullscreen 모드를 모두 지원하며,
 * Chat, Auto Report, Intelligent Monitoring 기능을 포함합니다.
 */
export default function AIWorkspace(_props: AIWorkspaceProps = {}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  useAIAssistantLightTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🔧 공통 chat surface 상태 (selectedFunction + store 구독 번들)
  const {
    selectedFunction,
    setSelectedFunction,
    webSearchEnabled,
    toggleWebSearch,
    ragEnabled,
    toggleRAG,
    analysisMode,
    selectAnalysisMode,
    pendingEntryState,
    consumePendingEntryState,
    pendingPrefillMessage,
    consumePendingPrefillMessage,
  } = useAIChatSurface();

  const handleFunctionSelect = useCallback(
    (func: AIAssistantFunction) => {
      setSelectedFunction(func);
    },
    [setSelectedFunction]
  );

  const handleToggleRightPanel = useCallback(() => {
    setIsRightPanelOpen((prev) => !prev);
  }, []);

  const renderMobileFunctionNav = () => (
    <div
      className="flex md:hidden shrink-0 border-b border-gray-200 bg-white px-4 pt-3"
      data-testid="ai-workspace-mobile-function-nav"
    >
      <AIAssistantIconPanel
        selectedFunction={selectedFunction}
        onFunctionChange={setSelectedFunction}
        isMobile
        showFullscreenButton={false}
      />
    </div>
  );

  // ============================================================================
  // 🎯 공통 AI 채팅 로직 (useAIChatCore 훅 사용)
  // 사이드바/전체화면 모두 동일한 대화 엔진을 사용한다.
  // ============================================================================
  const {
    // 입력 상태
    input,
    setInput,
    // 메시지
    messages: enhancedMessages,
    // 로딩/진행 상태
    isLoading,
    hybridState,
    currentMode,
    streamStatus,
    // 에러 상태
    error,
    clearError,
    sessionId,
    // 세션 관리
    sessionState,
    handleNewSession,
    // 액션
    handleFeedback,
    regenerateLastResponse,
    retryLastQuery,
    stop,
    cancel,
    // 통합 입력 핸들러
    handleSendInput,
    // 명확화 기능
    clarification,
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
    // 실시간 상태 표시
    currentAgentStatus,
    currentHandoff,
    warmingUp,
    estimatedWaitSeconds,
    // 대기열
    queuedQueries,
    removeQueuedQuery,
  } = useAIChatCore({
    // 전체화면에서도 세션 제한 적용 (악의적 사용/폭주 방지)
    disableSessionLimit: false,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingEntryState) {
      return;
    }

    const entry = consumePendingEntryState('fullscreen');
    if (!entry) {
      return;
    }

    setSelectedFunction(entry.selectedFunction ?? 'chat');

    if (entry.analysisMode) {
      selectAnalysisMode(entry.analysisMode);
    }

    if (entry.draft) {
      setInput(entry.draft);
    }
  }, [
    consumePendingEntryState,
    pendingEntryState,
    selectAnalysisMode,
    setInput,
    setSelectedFunction,
  ]);

  useEffect(() => {
    if (pendingEntryState) {
      return;
    }

    if (!pendingPrefillMessage) {
      return;
    }

    setSelectedFunction('chat');
    setInput(pendingPrefillMessage);
    consumePendingPrefillMessage();
  }, [
    consumePendingPrefillMessage,
    pendingEntryState,
    pendingPrefillMessage,
    setInput,
    setSelectedFunction,
  ]);

  // --- Render Logic ---

  // 🔒 Hydration 불일치 방지 (Zustand persist + 조건부 렌더링)
  if (!isMounted) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // 🖥️ FULLSCREEN LAYOUT
  // 🎨 화이트 모드 전환 (2025-12 업데이트)
  return (
    <div className="flex h-full w-full overflow-hidden bg-white text-gray-900">
      {/* LEFT SIDEBAR (Navigation) - Hidden on mobile */}
      <div className="hidden md:flex w-[280px] flex-col border-r border-gray-200 bg-gray-50">
        {/* Header with Logo */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <OpenManagerLogo variant="light" showSubtitle={false} href="/" />
        </div>

        {/* Current Session Section */}
        <div className="flex-1 px-3 overflow-y-auto">
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                현재 세션
              </span>
              <button
                type="button"
                onClick={handleNewSession}
                className="flex min-h-6 min-w-6 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
                title="새 대화 시작"
              >
                <Plus className="h-3 w-3" />
                <span>새 대화</span>
              </button>
            </div>
            {enhancedMessages.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-700 border border-blue-100">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1">진행 중인 대화</span>
                  <span className="text-xs text-blue-500 shrink-0">
                    {enhancedMessages.filter((m) => m.role === 'user').length}개
                    질문
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-3 py-6 text-center">
                <Bot className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">새 대화를 시작하세요</p>
                <p className="mt-1 text-xs text-gray-400">
                  AI에게 질문해보세요!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Features Section (하단) - Fullscreen용 리스트 레이아웃 */}
        <div className="shrink-0 border-t border-gray-200 px-3 py-3">
          <div className="mb-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            AI 기능
          </div>
          <div className="space-y-1">
            {/* 자연어 질의 */}
            <button
              type="button"
              onClick={() => handleFunctionSelect('chat')}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                selectedFunction === 'chat'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">AI Chat</div>
                <div className="text-xs text-gray-500 truncate">NLQ Agent</div>
              </div>
            </button>
            {/* 자동 장애보고서 */}
            <button
              type="button"
              onClick={() => handleFunctionSelect('auto-report')}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                selectedFunction === 'auto-report'
                  ? 'bg-pink-50 text-pink-700 border border-pink-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">장애 보고서</div>
                <div className="text-xs text-gray-500 truncate">
                  Reporter Agent
                </div>
              </div>
            </button>
            {/* 이상감지/예측 */}
            <button
              type="button"
              onClick={() => handleFunctionSelect('intelligent-monitoring')}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                selectedFunction === 'intelligent-monitoring'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Monitor className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">이상감지/예측</div>
                <div className="text-xs text-gray-500 truncate">
                  Analyst Agent
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Status */}
        <div className="shrink-0 border-t border-gray-200 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>AI Engine Active</span>
            </div>
            <span className="text-gray-400">v{APP_VERSION}</span>
          </div>
        </div>
      </div>

      {/* CENTER & RIGHT (Main Content) */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* MOBILE HEADER - Only visible on small screens */}
        <div className="flex md:hidden h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
              title="뒤로 가기"
            >
              <ArrowLeftFromLine className="h-5 w-5" />
            </button>
            <OpenManagerLogo variant="light" showSubtitle={false} href="/" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNewSession}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
              title="새 대화"
            >
              <Plus className="h-4 w-4" />
            </button>
            {/* 모바일 프로필 */}
            <UnifiedProfileHeader />
          </div>
        </div>
        {renderMobileFunctionNav()}

        {/* CENTER CONTENT */}
        <div className="flex flex-1 flex-col relative min-w-0">
          {/* 🎯 통합 헤더 (대시보드와 동일한 스타일) - Desktop Only */}
          <header className="hidden md:flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-xs">
            {/* 좌측: 대시보드 버튼 + 브레드크럼 */}
            <div className="flex items-center gap-4">
              {/* 대시보드 돌아가기 버튼 */}
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex min-h-6 min-w-6 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
                title="대시보드로 돌아가기"
                aria-label="대시보드로 돌아가기"
              >
                <ArrowLeftFromLine className="h-4 w-4" />
                <span>대시보드</span>
              </button>
              {/* 브레드크럼 구분선 */}
              <div className="h-5 w-px bg-gray-200" />
              {/* 브레드크럼 */}
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <span className="font-medium text-gray-900">AI Workspace</span>
                <span>/</span>
                <span className="text-blue-600 capitalize font-medium">
                  {selectedFunction === 'chat'
                    ? '대화'
                    : selectedFunction === 'auto-report'
                      ? '보고서'
                      : '모니터링'}
                </span>
              </div>
            </div>

            {/* 중앙: 실시간 정보 (숨김 on mobile) */}
            <div className="hidden md:flex items-center">
              <RealTimeDisplay />
            </div>

            {/* 우측: 패널 토글 + 프로필 */}
            <div className="flex items-center gap-3">
              {/* 패널 토글 버튼 */}
              {selectedFunction === 'chat' && (
                <button
                  type="button"
                  onClick={handleToggleRightPanel}
                  className="hidden min-h-6 min-w-6 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 lg:flex"
                  title="시스템 컨텍스트 패널 토글"
                >
                  {isRightPanelOpen ? (
                    <PanelRightClose className="h-5 w-5" />
                  ) : (
                    <PanelRightOpen className="h-5 w-5" />
                  )}
                </button>
              )}

              {/* 프로필 헤더 (대시보드와 동일) */}
              <UnifiedProfileHeader />
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
            <AIErrorBoundary
              componentName="AIWorkspace"
              resetKey={`${selectedFunction}:${sessionId}`}
              onReset={() => {
                setInput('');
                handleNewSession();
              }}
            >
              <Activity
                mode={selectedFunction === 'chat' ? 'visible' : 'hidden'}
              >
                <EnhancedAIChat
                  autoReportTrigger={{ shouldGenerate: false }}
                  allMessages={enhancedMessages}
                  limitedMessages={enhancedMessages}
                  messagesEndRef={messagesEndRef}
                  MessageComponent={AIWorkspaceMessage}
                  inputValue={input}
                  setInputValue={setInput}
                  handleSendInput={handleSendInput}
                  sessionState={sessionState}
                  onNewSession={handleNewSession}
                  isGenerating={isLoading}
                  streamStatus={streamStatus}
                  regenerateResponse={regenerateLastResponse}
                  onStopGeneration={stop}
                  onFeedback={handleFeedback}
                  jobProgress={hybridState.progress}
                  jobId={hybridState.jobId}
                  onCancelJob={cancel}
                  queryMode={currentMode}
                  error={error}
                  errorDetails={hybridState.errorDetails}
                  onClearError={clearError}
                  onRetry={retryLastQuery}
                  clarification={clarification}
                  onSelectClarification={selectClarification}
                  onSubmitCustomClarification={submitCustomClarification}
                  onSkipClarification={skipClarification}
                  onDismissClarification={dismissClarification}
                  currentAgentStatus={currentAgentStatus}
                  currentHandoff={currentHandoff}
                  webSearchEnabled={webSearchEnabled}
                  onToggleWebSearch={toggleWebSearch}
                  ragEnabled={ragEnabled}
                  onToggleRAG={toggleRAG}
                  analysisMode={analysisMode}
                  onSelectAnalysisMode={selectAnalysisMode}
                  warmingUp={warmingUp}
                  estimatedWaitSeconds={estimatedWaitSeconds}
                  queuedQueries={queuedQueries}
                  removeQueuedQuery={removeQueuedQuery}
                />
              </Activity>
              <Activity
                mode={selectedFunction !== 'chat' ? 'visible' : 'hidden'}
              >
                <div className="h-full p-0">
                  <AIContentArea selectedFunction={selectedFunction} />
                </div>
              </Activity>
            </AIErrorBoundary>
          </div>
        </div>

        {/* RIGHT SIDEBAR (System Context) - 실시간 헬스 체크 연동 */}
        {selectedFunction === 'chat' && isRightPanelOpen && (
          <SystemContextPanel className="hidden lg:flex" />
        )}
      </div>
    </div>
  );
}
