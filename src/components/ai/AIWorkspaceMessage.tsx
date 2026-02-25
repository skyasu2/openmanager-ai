import { Bot, Brain, ChevronDown, ChevronUp, User } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { formatTime } from '@/lib/format-date';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { CollapsibleContent } from './CollapsibleContent';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageActions } from './MessageActions';
import ThinkingProcessVisualizer from './ThinkingProcessVisualizer';
import { TypewriterMarkdown } from './TypewriterMarkdown';

const MemoizedThinkingProcessVisualizer = memo(ThinkingProcessVisualizer);

const ThinkingToggle = memo<{
  steps: AIThinkingStep[];
  isStreaming: boolean;
  defaultOpen: boolean;
}>(({ steps, isStreaming, defaultOpen }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (isStreaming) setIsOpen(true);
  }, [isStreaming]);

  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <Brain className="h-3 w-3" />
        <span>AI 처리 과정 ({steps.length}단계)</span>
      </button>
      {isOpen && (
        <MemoizedThinkingProcessVisualizer
          steps={steps}
          isActive={isStreaming}
          className="mt-2 rounded border border-gray-200 bg-gray-50"
        />
      )}
    </div>
  );
});
ThinkingToggle.displayName = 'ThinkingToggle';

export const AIWorkspaceMessage = memo<{
  message: EnhancedChatMessage;
  onRegenerateResponse?: (messageId: string) => void;
  onFeedback?: (
    messageId: string,
    type: 'positive' | 'negative',
    traceId?: string
  ) => Promise<boolean>;
  isLastMessage?: boolean;
}>(({ message, onRegenerateResponse, onFeedback, isLastMessage = false }) => {
  if (message.role === 'thinking' && message.thinkingSteps) {
    return (
      <div className="my-4">
        <MemoizedThinkingProcessVisualizer
          steps={message.thinkingSteps as AIThinkingStep[]}
          isActive={message.isStreaming || false}
          className="rounded-lg border border-purple-200 bg-linear-to-r from-purple-50 to-blue-50 p-4"
        />
      </div>
    );
  }

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

        <div className="flex-1">
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
              <CollapsibleContent
                maxHeight={400}
                isStreaming={message.isStreaming}
                isLastMessage={isLastMessage}
              >
                {isLastMessage && !message.isStreaming ? (
                  <TypewriterMarkdown
                    content={message.content}
                    enableTypewriter={true}
                    speed={12}
                  />
                ) : (
                  <MarkdownRenderer
                    content={message.content}
                    className="text-chat leading-relaxed"
                  />
                )}
              </CollapsibleContent>
            ) : (
              <div className="whitespace-pre-wrap wrap-break-word text-chat leading-relaxed">
                {message.content}
              </div>
            )}
          </div>

          <div
            className={`mt-1 flex items-center justify-between ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500" suppressHydrationWarning>
                {formatTime(message.timestamp)}
              </p>
              {message.role === 'assistant' &&
                message.metadata?.processingTime && (
                  <p className="text-xs text-gray-400">
                    · {message.metadata.processingTime}ms
                  </p>
                )}
            </div>

            <MessageActions
              messageId={message.id}
              content={message.content}
              role={message.role}
              onRegenerate={onRegenerateResponse}
              onFeedback={onFeedback}
              traceId={message.metadata?.traceId}
              showRegenerate={isLastMessage && message.role === 'assistant'}
            />
          </div>

          {message.role === 'assistant' &&
            message.thinkingSteps &&
            message.thinkingSteps.length > 0 && (
              <ThinkingToggle
                steps={message.thinkingSteps}
                isStreaming={message.isStreaming || false}
                defaultOpen={message.isStreaming || false}
              />
            )}
        </div>
      </div>
    </div>
  );
});

AIWorkspaceMessage.displayName = 'AIWorkspaceMessage';
