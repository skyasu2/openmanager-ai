'use client';

import { type FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AIAssistantFunction } from '@/components/ai/AIAssistantIconPanel';
import AIAssistantIconPanel from '@/components/ai/AIAssistantIconPanel';
// Components
import { AIErrorBoundary } from '@/components/error/AIErrorBoundary';
import { isGuestFullAccessEnabled } from '@/config/guestMode';
import { useAIChatCore } from '@/hooks/ai/useAIChatCore';
import { useResizable } from '@/hooks/ui/useResizable';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { useAISidebarStore } from '@/stores/useAISidebarStore';
// Types
import type { AISidebarV3Props } from '@/types/ai-sidebar/ai-sidebar-types';
import { AIFunctionPages } from './AIFunctionPages';
import { AISidebarHeader } from './AISidebarHeader';
import { EnhancedAIChat } from './EnhancedAIChat';
import { ResizeHandle } from './ResizeHandle';
import { MessageComponent } from './SidebarMessage';

// 🔧 공통 로직은 useAIChatCore 훅에서 관리
// - Hybrid AI Query (Streaming + Job Queue)
// - 세션 제한
// - 피드백
// - 메시지 변환

// 📐 리사이즈 상수
const SIDEBAR_MIN_WIDTH = 400;
const SIDEBAR_MAX_WIDTH = 900;
const SIDEBAR_DEFAULT_WIDTH = 600;
const MOBILE_BREAKPOINT = 768; // md breakpoint

// 🔒 완전 Client-Only AI 사이드바 컴포넌트 (V4 - useAIChatCore 통합)
export const AISidebarV4: FC<AISidebarV3Props> = ({
  isOpen,
  onClose,
  className = '',
  sessionId: propSessionId,
  onMessageSend,
}) => {
  // 🔐 권한 확인
  const permissions = useUserPermissions();

  // 🔧 UI 상태 관리 (사이드바 전용)
  const [selectedFunction, setSelectedFunction] =
    useState<AIAssistantFunction>('chat');

  // 📐 사이드바 너비 상태 (Zustand Store)
  const sidebarWidth = useAISidebarStore((state) => state.sidebarWidth);
  const setSidebarWidth = useAISidebarStore((state) => state.setSidebarWidth);
  const webSearchEnabled = useAISidebarStore((state) => state.webSearchEnabled);
  const setWebSearchEnabled = useAISidebarStore(
    (state) => state.setWebSearchEnabled
  );

  const toggleWebSearch = useCallback(() => {
    setWebSearchEnabled(!webSearchEnabled);
  }, [webSearchEnabled, setWebSearchEnabled]);

  // 📐 드래그 리사이즈 훅
  const { width, isResizing, handleMouseDown, handleTouchStart } = useResizable(
    {
      initialWidth: sidebarWidth || SIDEBAR_DEFAULT_WIDTH,
      minWidth: SIDEBAR_MIN_WIDTH,
      maxWidth: SIDEBAR_MAX_WIDTH,
      onWidthChange: setSidebarWidth,
    }
  );

  // 📱 모바일 여부 확인 (리사이즈 비활성화용)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () =>
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 📱 모바일 전체 화면 모드에서는 배경 스크롤 잠금
  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isMobile, isOpen]);

  // 📱 스와이프 제스처 상태
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const SWIPE_THRESHOLD = 100; // 100px 이상 스와이프 시 닫기
  const SWIPE_RATIO_THRESHOLD = 2; // 수평 이동이 수직 이동의 2배 이상일 때만 인식

  // ============================================================================
  // 🎯 공통 AI 채팅 로직 (useAIChatCore 훅 사용)
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
    // 에러 상태
    error,
    clearError,
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
    // 🎯 실시간 Agent 상태
    currentAgentStatus,
    currentHandoff,
    // ⚡ Cloud Run 웜업 상태
    warmingUp,
    estimatedWaitSeconds,
    // 대기열
    queuedQueries,
    removeQueuedQuery,
  } = useAIChatCore({
    sessionId: propSessionId,
    onMessageSend,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤 (메시지 추가 시 하단으로)
  const messageCount = enhancedMessages.length;
  useEffect(() => {
    if (messageCount > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageCount]);

  // ESC 키로 사이드바 닫기
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // 📱 스와이프 제스처 핸들러 (수평/수직 비율 체크로 오작동 방지)
  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
    touchStartY.current = e.touches[0]?.clientY ?? 0;
  };

  const handleSwipeTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0]?.clientX ?? 0;
    touchEndY.current = e.touches[0]?.clientY ?? 0;
  };

  const handleSwipeTouchEnd = () => {
    const swipeDistanceX = touchEndX.current - touchStartX.current;
    const swipeDistanceY = Math.abs(touchEndY.current - touchStartY.current);

    // 수평 이동이 수직 이동의 2배 이상이고, 오른쪽으로 100px 이상 스와이프할 때만 닫기
    // 이렇게 하면 코드 블록 수평 스크롤이나 텍스트 선택 시 오작동 방지
    const isHorizontalSwipe =
      swipeDistanceY === 0 ||
      swipeDistanceX / swipeDistanceY > SWIPE_RATIO_THRESHOLD;

    if (swipeDistanceX > SWIPE_THRESHOLD && isHorizontalSwipe) {
      onClose();
    }

    // 리셋
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };

  const canRenderSidebar =
    permissions.canToggleAI || isGuestFullAccessEnabled();
  if (!canRenderSidebar) {
    return null;
  }

  const renderFunctionPage = () => {
    if (selectedFunction === 'chat') {
      return (
        <EnhancedAIChat
          autoReportTrigger={{ shouldGenerate: false }}
          allMessages={enhancedMessages}
          limitedMessages={enhancedMessages}
          messagesEndRef={messagesEndRef}
          MessageComponent={MessageComponent}
          inputValue={input}
          setInputValue={setInput}
          handleSendInput={handleSendInput}
          sessionState={sessionState}
          onNewSession={handleNewSession}
          isGenerating={isLoading}
          regenerateResponse={regenerateLastResponse}
          onFeedback={handleFeedback}
          onStopGeneration={stop}
          jobProgress={hybridState.progress}
          jobId={hybridState.jobId}
          onCancelJob={cancel}
          queryMode={currentMode}
          error={error}
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
        />
      );
    }
    return (
      <AIFunctionPages
        selectedFunction={selectedFunction}
        onFunctionChange={setSelectedFunction}
      />
    );
  };

  return (
    <>
      {isOpen && isMobile && (
        <button
          type="button"
          aria-label="사이드바 닫기"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm md:hidden"
        />
      )}
      <div
        data-testid="ai-sidebar"
        role="dialog"
        aria-labelledby="ai-sidebar-v4-title"
        aria-modal={isOpen || undefined}
        className={cn(
          'gpu-sidebar-slide-in fixed z-50 flex bg-white shadow-2xl',
          isMobile
            ? 'inset-0 h-dvh w-screen max-w-none rounded-none'
            : 'right-0 top-0 h-full',
          // 리사이징 중이 아닐 때만 너비 전환 애니메이션
          !isResizing && 'transition-[width] duration-200 ease-out',
          isOpen ? '' : 'gpu-sidebar-slide-out',
          className
        )}
        // 📐 데스크톱에서는 동적 너비 적용
        style={!isMobile ? { width: `${width}px` } : undefined}
        // 📱 스와이프 제스처 지원
        onTouchStart={handleSwipeTouchStart}
        onTouchMove={handleSwipeTouchMove}
        onTouchEnd={handleSwipeTouchEnd}
      >
        {/* 📐 리사이즈 핸들 (데스크톱 전용) */}
        {!isMobile && (
          <ResizeHandle
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            isResizing={isResizing}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <AISidebarHeader onClose={onClose} onNewSession={handleNewSession} />
          <div className="flex-1 overflow-hidden pb-20 sm:pb-0">
            <AIErrorBoundary
              componentName="AISidebar"
              onReset={() => {
                // 에러 발생 시 세션 리셋
                setInput('');
              }}
            >
              {renderFunctionPage()}
            </AIErrorBoundary>
          </div>
        </div>

        <div className="hidden sm:block">
          <AIAssistantIconPanel
            selectedFunction={selectedFunction}
            onFunctionChange={setSelectedFunction}
            className="w-16 sm:w-20"
          />
        </div>
      </div>
    </>
  );
};

export default memo(AISidebarV4) as FC<AISidebarV3Props>;
