/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { type ComponentProps, createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnhancedAIChat } from '@/components/ai-sidebar/EnhancedAIChat';

const mocks = vi.hoisted(() => ({
  dismissRestoreBanner: vi.fn(),
  useChatActions: vi.fn(() => ({
    scrollContainerRef: { current: null },
    textareaRef: { current: null },
    fileInputRef: { current: null },
    attachments: [],
    isDragging: false,
    fileErrors: [],
    removeFile: vi.fn(),
    clearFileErrors: vi.fn(),
    dragHandlers: {},
    canAddMore: true,
    previewImage: null,
    handleSendWithAttachments: vi.fn(),
    openFileDialog: vi.fn(),
    handleFileSelect: vi.fn(),
    handleImageClick: vi.fn(),
    closePreviewModal: vi.fn(),
    handlePaste: vi.fn(),
  })),
}));

vi.mock('@/components/ai-sidebar/useChatActions', () => ({
  useChatActions: mocks.useChatActions,
}));

vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: vi.fn((selector) =>
    selector({
      restoreBannerDismissed: true,
      dismissRestoreBanner: mocks.dismissRestoreBanner,
    })
  ),
}));

vi.mock('@/hooks/ai/utils/chat-history-storage', () => ({
  loadChatHistory: vi.fn(() => null),
}));

vi.mock('@/hooks/useServerQuery', () => ({
  useServerQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/components/ai-sidebar/ChatMessageList', () => ({
  ChatMessageList: () => <div data-testid="chat-message-list" />,
}));

vi.mock('@/components/ai-sidebar/ChatInputArea', () => ({
  ChatInputArea: () => <div data-testid="chat-input-area" />,
}));

type EnhancedAIChatProps = ComponentProps<typeof EnhancedAIChat>;

const baseProps = (): EnhancedAIChatProps => ({
  autoReportTrigger: { shouldGenerate: false },
  allMessages: [],
  limitedMessages: [],
  messagesEndRef: createRef<HTMLDivElement>(),
  MessageComponent: () => <div data-testid="message-component" />,
  inputValue: '',
  setInputValue: vi.fn(),
  handleSendInput: vi.fn(),
  isGenerating: false,
  regenerateResponse: vi.fn(),
});

const renderChat = (overrides: Partial<EnhancedAIChatProps> = {}) =>
  render(<EnhancedAIChat {...baseProps()} {...overrides} />);

describe('EnhancedAIChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the internal header by default', () => {
    renderChat();

    expect(
      screen.getByRole('heading', { name: 'AI Chat' })
    ).toBeInTheDocument();
    expect(screen.getByText('AI 기반 대화형 인터페이스')).toBeInTheDocument();
  });

  it('hides the internal header when requested by the parent surface', () => {
    renderChat({ showInternalHeader: false });

    expect(
      screen.queryByRole('heading', { name: 'AI Chat' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('AI 기반 대화형 인터페이스')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-message-list')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-area')).toBeInTheDocument();
  });

  it('uses the unified neutral sidebar surface instead of slate-blue gradients', () => {
    const { container } = renderChat();

    const root = container.firstElementChild;

    expect(root).toHaveClass('bg-gray-50/50');
    expect(root).not.toHaveClass('bg-linear-to-br');
    expect(root).not.toHaveClass('from-slate-50');
    expect(root).not.toHaveClass('to-blue-50');
  });
});
