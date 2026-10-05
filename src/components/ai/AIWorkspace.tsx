'use client';

/**
 * 🤖 AI Workspace Controller (Unified Streaming Architecture)
 *
 * v4.0.0 - useAIChatCore 통합:
 * - AISidebarV4와 동일한 공통 훅 사용 (useAIChatCore)
 * - 세션 제한 (전체화면에서는 비활성화)
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EnhancedAIChat } from '@/components/ai-sidebar/EnhancedAIChat';
import { AIErrorBoundary } from '@/components/error/AIErrorBoundary';
import { useAIChatCore } from '@/hooks/ai/useAIChatCore';
import { useAIChatSurface } from '@/hooks/ai/useAIChatSurface';
import { useSystemWindowChatGate } from '@/hooks/system/useSystemWindowChatGate';
import {
  type PendingAIEntryState,
  useAISidebarStore,
} from '@/stores/useAISidebarStore';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { Server } from '@/types/server';
import type { AIAssistantFunction } from './AIAssistantIconPanel';
import AIContentArea from './AIContentArea';
import {
  DASHBOARD_ROUTE,
  MOBILE_WORKSPACE_MEDIA_QUERY,
} from './AIWorkspace.constants';
import { AIWorkspaceEmbeddedLayout } from './AIWorkspaceEmbeddedLayout';
import { AIWorkspaceFullscreenHeader } from './AIWorkspaceFullscreenHeader';
import { AIWorkspaceMessage } from './AIWorkspaceMessage';
import { AIWorkspaceNavigationSidebar } from './AIWorkspaceNavigationSidebar';
import { ArtifactWorkspacePanel } from './artifact-workspace/ArtifactWorkspacePanel';
import SystemContextPanel from './SystemContextPanel';
import { useAIAssistantLightTheme } from './useAIAssistantLightTheme';

// 공통 로직은 useAIChatCore 훅에서 관리

interface AIWorkspaceProps {
  /** Dashboard route body mode. Avoids the legacy standalone AI shell. */
  embedded?: boolean;
  /** Dashboard data slot used to keep AI pages aligned with visible metrics. */
  queryAsOfDataSlot?: JobDataSlot;
  /** Dashboard servers used for read-only contextual matching in embedded mode. */
  serverContextServers?: Server[];
}

/**
 * AIWorkspace Component
 *
 * 통합된 AI 작업 공간을 제공합니다.
 * Sidebar 모드와 Fullscreen 모드를 모두 지원하며,
 * Chat, Auto Report, Intelligent Monitoring 기능을 포함합니다.
 */
export default function AIWorkspace({
  embedded = false,
  queryAsOfDataSlot,
  serverContextServers,
}: AIWorkspaceProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileHandoffActive, setIsMobileHandoffActive] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const mobileHandoffStartedRef = useRef(false);

  useAIAssistantLightTheme();

  const openSidebar = useAISidebarStore((state) => state.setOpen);
  const queuePendingEntryState = useAISidebarStore(
    (state) => state.queuePendingEntryState
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 공통 chat surface 상태 (selectedFunction + store 구독 번들)
  const {
    selectedFunction,
    setSelectedFunction,
    webSearchEnabled,
    toggleWebSearch,
    pendingEntryState,
    consumePendingEntryState,
    pendingPrefillMessage,
    consumePendingPrefillMessage,
  } = useAIChatSurface();
  const { systemWindowClosed, isStartingSystem, onStartSystem } =
    useSystemWindowChatGate();
  const [workspaceQueryAsOfDataSlot, setWorkspaceQueryAsOfDataSlot] = useState(
    pendingEntryState?.queryAsOfDataSlot ?? queryAsOfDataSlot
  );
  const [workspaceArtifactId, setWorkspaceArtifactId] = useState(
    pendingEntryState?.artifactWorkspaceId
  );

  // 아티팩트 focus의 1차 소스는 URL이다. pendingEntryState는 one-shot이라
  // 라우트를 떠나도 마운트된 채 남은 이전 AIWorkspace 인스턴스가 먼저 소비할 수 있고,
  // 그러면 새로 보이는 인스턴스는 focus를 영영 못 받는다(2026-08-16 production 실측).
  const artifactParam = searchParams.get('artifact') ?? undefined;
  const focusArtifactId = artifactParam ?? workspaceArtifactId;

  useEffect(() => {
    if (pendingEntryState?.queryAsOfDataSlot) {
      return;
    }
    setWorkspaceQueryAsOfDataSlot(queryAsOfDataSlot);
  }, [pendingEntryState?.queryAsOfDataSlot, queryAsOfDataSlot]);

  // URL로 넘어온 focus는 우측 패널이 닫혀 있으면 빈 화면처럼 보인다.
  // pendingEntryState 경로의 setIsRightPanelOpen(true)와 같은 역할을 URL 경로에서 한다.
  useEffect(() => {
    if (!artifactParam) {
      return;
    }
    setIsRightPanelOpen(true);
  }, [artifactParam]);

  const handleFunctionSelect = useCallback(
    (func: AIAssistantFunction) => {
      setWorkspaceArtifactId(undefined);
      // focus를 해제할 때 URL도 함께 정리한다. 남겨두면 다른 기능으로 갔다가
      // 돌아올 때 focusArtifactId가 다시 살아난다.
      if (artifactParam) {
        router.replace(pathname);
      }
      setSelectedFunction(func);
    },
    [artifactParam, pathname, router, setSelectedFunction]
  );

  const handleToggleRightPanel = useCallback(() => {
    setIsRightPanelOpen((prev) => !prev);
  }, []);

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
    regenerateLastResponse,
    canRegenerateLastResponse,
    regenerateCooldownSeconds,
    retryLastQuery,
    stop,
    cancel,
    // 통합 입력 핸들러
    handleSendInput,
    handleArtifactGuidanceCta,
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
    queryAsOfDataSlot: workspaceQueryAsOfDataSlot,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestAssistantRuntime = useMemo(() => {
    for (let index = enhancedMessages.length - 1; index >= 0; index -= 1) {
      const message = enhancedMessages[index];
      if (!message) {
        continue;
      }

      if (message.role !== 'assistant' || message.isStreaming) {
        continue;
      }

      const provider = message.metadata?.provider?.trim();
      if (!provider) {
        continue;
      }

      return {
        provider,
        modelId: message.metadata?.modelId?.trim(),
      };
    }

    return null;
  }, [enhancedMessages]);
  const artifactWorkspaceId = sessionId
    ? `ai-session-${sessionId}`
    : 'current-ai-session';

  useEffect(() => {
    if (embedded) {
      return;
    }

    if (mobileHandoffStartedRef.current) {
      return;
    }

    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia(MOBILE_WORKSPACE_MEDIA_QUERY).matches
    ) {
      return;
    }

    mobileHandoffStartedRef.current = true;

    const sidebarEntry: PendingAIEntryState = {
      ...(pendingEntryState ?? {}),
      selectedFunction: pendingEntryState?.selectedFunction ?? selectedFunction,
      target: 'sidebar',
    };
    const handoffQueryAsOfDataSlot =
      pendingEntryState?.queryAsOfDataSlot ??
      workspaceQueryAsOfDataSlot ??
      queryAsOfDataSlot;
    if (handoffQueryAsOfDataSlot) {
      sidebarEntry.queryAsOfDataSlot = handoffQueryAsOfDataSlot;
    }
    const draft =
      pendingEntryState?.draft ??
      (selectedFunction === 'chat' ? input.trim() : undefined);

    if (draft) {
      sidebarEntry.draft = draft;
    }

    queuePendingEntryState(sidebarEntry);
    openSidebar(true);
    setIsMobileHandoffActive(true);
    router.replace(DASHBOARD_ROUTE);
  }, [
    input,
    openSidebar,
    pendingEntryState,
    queuePendingEntryState,
    queryAsOfDataSlot,
    router,
    selectedFunction,
    workspaceQueryAsOfDataSlot,
    embedded,
  ]);

  useEffect(() => {
    if (mobileHandoffStartedRef.current) {
      return;
    }

    if (!pendingEntryState) {
      return;
    }

    const entry = consumePendingEntryState('fullscreen');
    if (!entry) {
      return;
    }

    setSelectedFunction(entry.selectedFunction ?? 'chat');

    setWorkspaceQueryAsOfDataSlot(entry.queryAsOfDataSlot ?? queryAsOfDataSlot);
    setWorkspaceArtifactId(entry.artifactWorkspaceId);

    // 아티팩트 카드에서 넘어온 replay pack은 채팅 우측 패널에서만 열람 가능하다.
    // 패널이 닫혀 있으면 "전체화면에서 보기"가 빈 화면처럼 보인다.
    if (entry.artifactWorkspaceId) {
      setIsRightPanelOpen(true);
    }

    if (entry.draft) {
      setInput(entry.draft);
    }
  }, [
    consumePendingEntryState,
    pendingEntryState,
    queryAsOfDataSlot,
    setInput,
    setSelectedFunction,
  ]);

  useEffect(() => {
    if (mobileHandoffStartedRef.current) {
      return;
    }

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
  const renderAssistantContent = () => (
    <AIErrorBoundary
      componentName="AIWorkspace"
      resetKey={`${selectedFunction}:${sessionId}`}
      onReset={() => {
        setInput('');
        handleNewSession();
      }}
    >
      <Activity mode={selectedFunction === 'chat' ? 'visible' : 'hidden'}>
        <EnhancedAIChat
          autoReportTrigger={{ shouldGenerate: false }}
          allMessages={enhancedMessages}
          limitedMessages={enhancedMessages}
          messagesEndRef={messagesEndRef}
          MessageComponent={AIWorkspaceMessage}
          inputValue={input}
          setInputValue={setInput}
          handleSendInput={handleSendInput}
          onStarterPromptSubmit={(prompt) => {
            setInput(prompt);
            handleSendInput(undefined, prompt);
          }}
          onArtifactGuidanceCta={handleArtifactGuidanceCta}
          sessionState={sessionState}
          onNewSession={handleNewSession}
          isGenerating={isLoading}
          streamStatus={streamStatus}
          regenerateResponse={regenerateLastResponse}
          canRegenerateResponse={canRegenerateLastResponse}
          regenerateCooldownSeconds={regenerateCooldownSeconds}
          onStopGeneration={stop}
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
          warmingUp={warmingUp}
          estimatedWaitSeconds={estimatedWaitSeconds}
          queuedQueries={queuedQueries}
          removeQueuedQuery={removeQueuedQuery}
          showInternalHeader={false}
          systemWindowClosed={systemWindowClosed}
          isStartingSystem={isStartingSystem}
          onStartSystem={onStartSystem}
        />
      </Activity>
      <Activity mode={selectedFunction !== 'chat' ? 'visible' : 'hidden'}>
        <div className="h-full p-0">
          <AIContentArea
            artifactWorkspaceId={focusArtifactId}
            selectedFunction={selectedFunction}
            queryAsOfDataSlot={workspaceQueryAsOfDataSlot}
          />
        </div>
      </Activity>
    </AIErrorBoundary>
  );

  // 🔒 Hydration 불일치 방지 (Zustand persist + 조건부 렌더링)
  if (!isMounted) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (isMobileHandoffActive) {
    return (
      <div
        className="flex h-dvh w-full items-center justify-center bg-white px-6 text-center text-gray-700"
        data-testid="ai-workspace-mobile-handoff"
      >
        <div className="space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm font-medium">AI 사이드바로 전환 중입니다</p>
        </div>
      </div>
    );
  }

  if (embedded) {
    return (
      <AIWorkspaceEmbeddedLayout
        selectedFunction={selectedFunction}
        isRightPanelOpen={isRightPanelOpen}
        assistantContent={renderAssistantContent()}
        finalModelId={latestAssistantRuntime?.modelId}
        finalProvider={latestAssistantRuntime?.provider}
        artifactWorkspaceId={artifactWorkspaceId}
        focusReplayPackId={focusArtifactId}
        messages={enhancedMessages}
        queryAsOfDataSlot={workspaceQueryAsOfDataSlot}
        serverContextMessages={enhancedMessages}
        serverContextServers={serverContextServers}
        onFunctionSelect={handleFunctionSelect}
        onToggleRightPanel={handleToggleRightPanel}
      />
    );
  }

  // 🖥️ FULLSCREEN LAYOUT
  // 🎨 화이트 모드 전환 (2025-12 업데이트)
  return (
    <div className="flex h-full w-full overflow-hidden bg-white text-gray-900">
      <AIWorkspaceNavigationSidebar
        selectedFunction={selectedFunction}
        hasMessages={enhancedMessages.length > 0}
        userQuestionCount={
          enhancedMessages.filter((message) => message.role === 'user').length
        }
        onNewSession={handleNewSession}
        onFunctionSelect={handleFunctionSelect}
      />

      {/* CENTER & RIGHT (Main Content) */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* CENTER CONTENT */}
        <div className="flex flex-1 flex-col relative min-w-0">
          <AIWorkspaceFullscreenHeader
            selectedFunction={selectedFunction}
            isRightPanelOpen={isRightPanelOpen}
            onBackToDashboard={() => router.push('/dashboard')}
            onToggleRightPanel={handleToggleRightPanel}
          />

          <div className="flex-1 overflow-hidden relative">
            {renderAssistantContent()}
          </div>
        </div>

        {/* RIGHT SIDEBAR (System Context) - 실시간 헬스 체크 연동 */}
        {selectedFunction === 'chat' && isRightPanelOpen && (
          <SystemContextPanel
            className="hidden lg:flex"
            finalModelId={latestAssistantRuntime?.modelId}
            finalProvider={latestAssistantRuntime?.provider}
          >
            <ArtifactWorkspacePanel
              focusReplayPackId={focusArtifactId}
              messages={enhancedMessages}
              workspaceId={artifactWorkspaceId}
            />
          </SystemContextPanel>
        )}
      </div>
    </div>
  );
}
