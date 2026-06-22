'use client';

import { ChevronDown, FileText } from 'lucide-react';
import React, {
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { WelcomeServerMetric } from '@/components/ai/WelcomePromptCards';
import { WelcomePromptCards } from '@/components/ai/WelcomePromptCards';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';

const SCROLL_TO_BOTTOM_THRESHOLD_PX = 100;

interface ChatMessageListProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  autoReportTrigger: {
    shouldGenerate: boolean;
    lastQuery?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  };
  allMessages: EnhancedChatMessage[];
  limitedMessages: EnhancedChatMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  MessageComponent: React.ComponentType<{
    message: EnhancedChatMessage;
    onRegenerateResponse?: (messageId: string) => void;
    isLastMessage?: boolean;
    regenerateDisabled?: boolean;
    regenerateDisabledReason?: string;
  }>;
  isGenerating: boolean;
  regenerateResponse: (messageId: string) => void;
  regenerateDisabled?: boolean;
  regenerateDisabledReason?: string;
  setInputValue: (value: string) => void;
  onStarterPromptSubmit?: (prompt: string) => void;
  welcomeServers?: readonly WelcomeServerMetric[];
}

export const ChatMessageList = memo(function ChatMessageList({
  scrollContainerRef,
  autoReportTrigger,
  allMessages,
  limitedMessages,
  messagesEndRef,
  MessageComponent,
  isGenerating,
  regenerateResponse,
  regenerateDisabled = false,
  regenerateDisabledReason,
  setInputValue,
  onStarterPromptSubmit,
  welcomeServers,
}: ChatMessageListProps) {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const hasMessages = allMessages.length > 0;
  const liveRegionProps = hasMessages
    ? {
        role: 'log' as const,
        'aria-live': 'polite' as const,
        'aria-label': 'AI 대화 메시지',
        'aria-relevant': 'additions text' as const,
        'aria-atomic': 'false' as const,
      }
    : {};
  const updateScrollToBottomVisibility = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollToBottom(
      hasMessages && distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD_PX
    );
  }, [hasMessages, scrollContainerRef]);

  const handleScrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const top = container.scrollHeight;
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ top, behavior: 'smooth' });
    } else {
      container.scrollTop = top;
    }
    setShowScrollToBottom(false);
  }, [scrollContainerRef]);

  useEffect(() => {
    if (!hasMessages) {
      setShowScrollToBottom(false);
    }
  }, [hasMessages]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollContainerRef}
        className="h-full min-h-0 flex-1 overflow-y-auto scroll-smooth will-change-scroll"
        aria-busy={isGenerating}
        onScroll={updateScrollToBottomVisibility}
        {...liveRegionProps}
      >
        <div className="mx-auto max-w-3xl space-y-3 p-3 sm:space-y-4 sm:p-4">
          {/* 자동장애보고서 알림 */}
          {autoReportTrigger.shouldGenerate && (
            <div className="rounded-lg border border-red-200 bg-linear-to-r from-red-50 to-orange-50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-red-600" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">
                      자동장애보고서 생성 준비
                    </h4>
                    <p className="text-xs text-red-600">
                      &quot;{autoReportTrigger.lastQuery}&quot;에서{' '}
                      {autoReportTrigger.severity} 수준의 이슈가 감지되었습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 웰컴 화면 */}
          {allMessages.length === 0 && (
            <WelcomePromptCards
              onPromptClick={onStarterPromptSubmit ?? setInputValue}
              servers={welcomeServers}
            />
          )}

          {/* 채팅 메시지 렌더링 */}
          {limitedMessages.map((message, index) => {
            const isLastMessage = index === limitedMessages.length - 1;

            return (
              <MessageComponent
                key={message.id}
                message={message}
                onRegenerateResponse={regenerateResponse}
                isLastMessage={isLastMessage}
                regenerateDisabled={regenerateDisabled}
                regenerateDisabledReason={regenerateDisabledReason}
              />
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {showScrollToBottom && (
        <button
          type="button"
          onClick={handleScrollToBottom}
          aria-label="최신 메시지로 이동"
          className="absolute right-4 bottom-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});
