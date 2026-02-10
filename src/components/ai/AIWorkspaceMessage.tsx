import { Bot, User } from 'lucide-react';
import { memo } from 'react';
import { formatTime } from '@/lib/format-date';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageActions } from './MessageActions';
import ThinkingProcessVisualizer from './ThinkingProcessVisualizer';
import { TypewriterMarkdown } from './TypewriterMarkdown';

const MemoizedThinkingProcessVisualizer = memo(ThinkingProcessVisualizer);

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
              isLastMessage && !message.isStreaming ? (
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
              )
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
              <div className="mt-3 border-t border-gray-100 pt-3">
                <MemoizedThinkingProcessVisualizer
                  steps={message.thinkingSteps}
                  isActive={message.isStreaming || false}
                  className="rounded border border-gray-200 bg-gray-50"
                />
              </div>
            )}
        </div>
      </div>
    </div>
  );
});

AIWorkspaceMessage.displayName = 'AIWorkspaceMessage';
