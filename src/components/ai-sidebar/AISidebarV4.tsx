'use client';

// Icons
import { Bot, Cpu, User } from 'lucide-react';
import {
  type FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AIAssistantFunction } from '@/components/ai/AIAssistantIconPanel';
import AIAssistantIconPanel from '@/components/ai/AIAssistantIconPanel';
import { AnalysisBasisBadge } from '@/components/ai/AnalysisBasisBadge';
import { MessageActions } from '@/components/ai/MessageActions';
import { WebSourceCards } from '@/components/ai/WebSourceCards';
// Components
import { AIErrorBoundary } from '@/components/error/AIErrorBoundary';
import { isGuestFullAccessEnabled } from '@/config/guestMode';
import {
  convertThinkingStepsToUI,
  useAIChatCore,
} from '@/hooks/ai/useAIChatCore';
import { useResizable } from '@/hooks/ui/useResizable';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import { useAISidebarStore } from '@/stores/useAISidebarStore';
// Types
import type {
  AISidebarV3Props,
  AIThinkingStep,
} from '@/types/ai-sidebar/ai-sidebar-types';
import { RenderMarkdownContent } from '@/utils/markdown-parser';
import { AIFunctionPages } from './AIFunctionPages';
import { AISidebarHeader } from './AISidebarHeader';
import { EnhancedAIChat } from './EnhancedAIChat';
import { type AgentStep, InlineAgentStatus } from './InlineAgentStatus';
import { ResizeHandle } from './ResizeHandle';

// 🔧 공통 로직은 useAIChatCore 훅에서 관리
// - Hybrid AI Query (Streaming + Job Queue)
// - 세션 제한
// - 피드백
// - 메시지 변환

/**
 * ThinkingSteps를 AgentStep 형식으로 변환 (UI 표시용)
 */
function convertToAgentSteps(thinkingSteps?: AIThinkingStep[]): AgentStep[] {
  return convertThinkingStepsToUI(thinkingSteps) as AgentStep[];
}

// 🎯 메시지 컴포넌트 성능 최적화 (Cursor/Copilot 스타일)
const MessageComponent = memo<{
  message: EnhancedChatMessage;
  onRegenerateResponse?: (messageId: string) => void;
  onFeedback?: (
    messageId: string,
    type: 'positive' | 'negative',
    traceId?: string
  ) => Promise<boolean>;
  isLastMessage?: boolean;
}>(({ message, onRegenerateResponse, onFeedback, isLastMessage }) => {
  const agentSteps = useMemo(
    () => convertToAgentSteps(message.thinkingSteps),
    [message.thinkingSteps]
  );

  // thinking 메시지일 경우 간소화된 인라인 상태 표시
  if (message.role === 'thinking' && message.thinkingSteps) {
    return (
      <InlineAgentStatus steps={agentSteps} isComplete={!message.isStreaming} />
    );
  }

  // 일반 메시지 렌더링
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      data-testid={message.role === 'user' ? 'user-message' : 'ai-message'}
    >
      <div
        className={`flex max-w-[90%] items-start space-x-2 sm:max-w-[85%] ${
          message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
        }`}
      >
        {/* 아바타 */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-xs ${
            message.role === 'user'
              ? 'bg-blue-100 text-blue-600'
              : 'bg-linear-to-br from-purple-500 to-pink-500 text-white'
          }`}
        >
          {message.role === 'user' ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>

        {/* 메시지 콘텐츠 */}
        <div className="flex-1">
          {/* 스트리밍 중 인라인 Agent 상태 표시 */}
          {message.role === 'assistant' &&
            message.isStreaming &&
            message.thinkingSteps &&
            message.thinkingSteps.length > 0 && (
              <InlineAgentStatus steps={agentSteps} isComplete={false} />
            )}

          {/* 메시지 내용 (콘텐츠가 있을 때만 표시) */}
          {message.content && (
            <div
              className={`rounded-2xl p-4 shadow-xs ${
                message.role === 'user'
                  ? 'rounded-tr-sm bg-linear-to-br from-blue-500 to-blue-600 text-white'
                  : 'rounded-tl-sm border border-gray-100 bg-white text-gray-800'
              }`}
              data-testid={
                message.role === 'assistant' ? 'ai-response' : undefined
              }
            >
              {message.role === 'assistant' ? (
                <div className="relative">
                  <RenderMarkdownContent
                    content={message.content}
                    className="text-chat leading-relaxed"
                  />
                  {/* 🎯 스트리밍 중 타이핑 커서 */}
                  {message.isStreaming && (
                    <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-purple-500" />
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap wrap-break-word text-chat leading-relaxed">
                  {message.content}
                </div>
              )}
            </div>
          )}

          {/* 타임스탬프 & 메타데이터 */}
          <div
            className={`mt-1 flex items-center justify-between ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <p className="text-xs text-gray-500">
              {typeof message.timestamp === 'string'
                ? new Date(message.timestamp).toLocaleTimeString()
                : message.timestamp.toLocaleTimeString()}
            </p>
            {/* 처리 시간 표시 (assistant 메시지만) */}
            {message.role === 'assistant' &&
              message.metadata?.processingTime && (
                <p className="text-xs text-gray-400">
                  {message.metadata.processingTime}ms
                </p>
              )}
          </div>

          {/* 인라인 메타데이터 + 분석 근거 (assistant 메시지 + 스트리밍 완료 + analysisBasis 있을 때만) */}
          {message.role === 'assistant' &&
            !message.isStreaming &&
            message.metadata?.analysisBasis && (
              <>
                {/* 인라인 소스 메타 */}
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <Cpu className="h-3 w-3 text-slate-400" />
                  <span>Cloud AI</span>
                  <span className="text-slate-300">&middot;</span>
                  <span>실시간 메트릭</span>
                  {message.metadata.analysisBasis.ragSources &&
                    message.metadata.analysisBasis.ragSources.length > 0 && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                        RAG
                      </span>
                    )}
                </div>
                {/* 웹 출처 카드 + 분석 근거 뱃지 */}
                <WebSourceCards
                  sources={(
                    message.metadata.analysisBasis.ragSources ?? []
                  ).filter(
                    (s): s is typeof s & { url: string } =>
                      s.sourceType === 'web' && !!s.url
                  )}
                />
                <AnalysisBasisBadge basis={message.metadata.analysisBasis} />
              </>
            )}

          {/* 메시지 액션 (복사, 피드백, 재생성) */}
          {message.content && (
            <MessageActions
              messageId={message.id}
              content={message.content}
              role={message.role}
              onRegenerate={onRegenerateResponse}
              onFeedback={onFeedback}
              traceId={message.metadata?.traceId}
              showRegenerate={isLastMessage && message.role === 'assistant'}
              className="mt-2"
            />
          )}
        </div>
      </div>
    </div>
  );
});

MessageComponent.displayName = 'MessageComponent';

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
          className="fixed inset-0 z-30 bg-slate-900/35 backdrop-blur-[1px] md:hidden"
        />
      )}
      <div
        data-testid="ai-sidebar"
        role="dialog"
        aria-labelledby="ai-sidebar-v4-title"
        aria-modal={isOpen || undefined}
        className={cn(
          'gpu-sidebar-slide-in fixed z-40 flex bg-white shadow-2xl',
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
