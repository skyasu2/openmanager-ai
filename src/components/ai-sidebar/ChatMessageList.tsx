'use client';

import { FileText } from 'lucide-react';
import React, { memo, type RefObject } from 'react';
import { WelcomePromptCards } from '@/components/ai/WelcomePromptCards';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';

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
    onFeedback?: (
      messageId: string,
      type: 'positive' | 'negative',
      traceId?: string
    ) => Promise<boolean>;
    isLastMessage?: boolean;
  }>;
  onFeedback?: (
    messageId: string,
    type: 'positive' | 'negative',
    traceId?: string
  ) => Promise<boolean>;
  isGenerating: boolean;
  regenerateResponse: (messageId: string) => void;
  setInputValue: (value: string) => void;
}

export const ChatMessageList = memo(function ChatMessageList({
  scrollContainerRef,
  autoReportTrigger,
  allMessages,
  limitedMessages,
  messagesEndRef,
  MessageComponent,
  onFeedback,
  isGenerating,
  regenerateResponse,
  setInputValue,
}: ChatMessageListProps) {
  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto scroll-smooth will-change-scroll"
      role="log"
      aria-live="polite"
      aria-label="AI 대화 메시지"
      aria-relevant="additions text"
      aria-atomic="false"
      aria-busy={isGenerating}
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
          <WelcomePromptCards onPromptClick={setInputValue} />
        )}

        {/* 채팅 메시지 렌더링 */}
        {limitedMessages.map((message, index) => {
          const isLastMessage = index === limitedMessages.length - 1;

          return (
            <MessageComponent
              key={message.id}
              message={message}
              onRegenerateResponse={regenerateResponse}
              onFeedback={onFeedback}
              isLastMessage={isLastMessage}
            />
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
});
