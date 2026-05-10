/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import { ChatMessageList } from './ChatMessageList';

vi.mock('@/components/ai/WelcomePromptCards', () => ({
  WelcomePromptCards: ({
    onPromptClick,
  }: {
    onPromptClick: (prompt: string) => void;
  }) => (
    <button type="button" onClick={() => onPromptClick('prompt')}>
      welcome prompt
    </button>
  ),
}));

const MessageComponent = ({
  message,
}: {
  message: EnhancedChatMessage;
  onRegenerateResponse?: (messageId: string) => void;
  isLastMessage?: boolean;
}) => <div>{message.content}</div>;

const createMessage = (
  overrides: Partial<EnhancedChatMessage> = {}
): EnhancedChatMessage => ({
  id: 'm1',
  role: 'assistant',
  content: 'hello',
  timestamp: new Date('2026-04-14T17:00:00.000Z'),
  ...overrides,
});

describe('ChatMessageList', () => {
  it('does not expose the welcome screen as a chat log before any messages exist', () => {
    const onStarterPromptSubmit = vi.fn();
    const setInputValue = vi.fn();

    render(
      <ChatMessageList
        scrollContainerRef={createRef<HTMLDivElement>()}
        autoReportTrigger={{ shouldGenerate: false }}
        allMessages={[]}
        limitedMessages={[]}
        messagesEndRef={createRef<HTMLDivElement>()}
        MessageComponent={MessageComponent}
        isGenerating={false}
        regenerateResponse={vi.fn()}
        setInputValue={setInputValue}
        onStarterPromptSubmit={onStarterPromptSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: 'welcome prompt' })
    ).toBeVisible();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'welcome prompt' }));

    expect(onStarterPromptSubmit).toHaveBeenCalledWith('prompt');
    expect(setInputValue).not.toHaveBeenCalled();
  });

  it('exposes the message region as a live chat log once messages exist', () => {
    render(
      <ChatMessageList
        scrollContainerRef={createRef<HTMLDivElement>()}
        autoReportTrigger={{ shouldGenerate: false }}
        allMessages={[createMessage()]}
        limitedMessages={[createMessage()]}
        messagesEndRef={createRef<HTMLDivElement>()}
        MessageComponent={MessageComponent}
        isGenerating={true}
        regenerateResponse={vi.fn()}
        setInputValue={vi.fn()}
      />
    );

    expect(screen.getByRole('log', { name: 'AI 대화 메시지' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('keeps the message region as the only vertical scroll container', () => {
    render(
      <ChatMessageList
        scrollContainerRef={createRef<HTMLDivElement>()}
        autoReportTrigger={{ shouldGenerate: false }}
        allMessages={[createMessage()]}
        limitedMessages={[createMessage()]}
        messagesEndRef={createRef<HTMLDivElement>()}
        MessageComponent={MessageComponent}
        isGenerating={false}
        regenerateResponse={vi.fn()}
        setInputValue={vi.fn()}
      />
    );

    expect(screen.getByRole('log', { name: 'AI 대화 메시지' })).toHaveClass(
      'min-h-0',
      'flex-1',
      'overflow-y-auto'
    );
  });
});
