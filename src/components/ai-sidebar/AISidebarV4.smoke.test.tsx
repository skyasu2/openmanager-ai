/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AISidebarV4 from '@/components/ai-sidebar/AISidebarV4';

const mockOnClose = vi.fn();
const mockPermissions = { canToggleAI: true };

vi.mock('@/hooks/ai/useAIChatCore', () => ({
  useAIChatCore: vi.fn(() => ({
    input: '',
    setInput: vi.fn(),
    messages: [],
    isLoading: false,
    hybridState: { progress: null, jobId: null },
    currentMode: 'fast',
    error: null,
    clearError: vi.fn(),
    sessionState: { messagesRemaining: 10, isLimited: false },
    handleNewSession: vi.fn(),
    handleFeedback: vi.fn(),
    regenerateLastResponse: vi.fn(),
    retryLastQuery: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    handleSendInput: vi.fn(),
    clarification: null,
    selectClarification: vi.fn(),
    submitCustomClarification: vi.fn(),
    skipClarification: vi.fn(),
    dismissClarification: vi.fn(),
    currentAgentStatus: null,
    currentHandoff: null,
  })),
  convertThinkingStepsToUI: vi.fn(() => []),
}));

vi.mock('@/hooks/ui/useResizable', () => ({
  useResizable: vi.fn(() => ({
    width: 400,
    isResizing: false,
    handleMouseDown: vi.fn(),
    handleTouchStart: vi.fn(),
  })),
}));

vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: vi.fn(() => mockPermissions),
}));

vi.mock('@/config/guestMode', () => ({
  isGuestFullAccessEnabled: vi.fn(() => false),
}));

vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: vi.fn((selector) => {
    const state = {
      isOpen: true,
      toggleSidebar: vi.fn(),
      setIsOpen: vi.fn(),
      sidebarWidth: 600,
      setSidebarWidth: vi.fn(),
      messages: [],
      addMessage: vi.fn(),
      webSearchEnabled: false,
      setWebSearchEnabled: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/components/ai-sidebar/AISidebarHeader', () => ({
  AISidebarHeader: () => <div data-testid="sidebar-header">Header</div>,
}));

vi.mock('@/components/ai-sidebar/EnhancedAIChat', () => ({
  EnhancedAIChat: () => <div data-testid="enhanced-ai-chat">AI Chat</div>,
}));

vi.mock('@/components/ai/AIContentArea', () => ({
  default: () => <div data-testid="ai-content-area">Content Area</div>,
}));

vi.mock('@/components/ai-sidebar/ResizeHandle', () => ({
  ResizeHandle: () => <div data-testid="resize-handle">Resize</div>,
}));

vi.mock('@/components/ai-sidebar/InlineAgentStatus', () => ({
  InlineAgentStatus: () => null,
}));

vi.mock('@/components/ai/AIAssistantIconPanel', () => ({
  default: () => <div data-testid="ai-icon-panel">Icon Panel</div>,
}));

vi.mock('@/components/ai/AnalysisBasisBadge', () => ({
  AnalysisBasisBadge: () => null,
}));

vi.mock('@/components/ai/MessageActions', () => ({
  MessageActions: () => null,
}));

vi.mock('@/components/ai/WebSourceCards', () => ({
  WebSourceCards: () => null,
}));

vi.mock('@/components/error/AIErrorBoundary', () => ({
  AIErrorBoundary: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

describe('AISidebarV4 smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.canToggleAI = true;
  });

  it('renders sidebar shell when AI access is enabled', () => {
    render(<AISidebarV4 isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
    expect(screen.getByTestId('enhanced-ai-chat')).toBeInTheDocument();
  });

  it('closes on escape', () => {
    render(<AISidebarV4 isOpen={true} onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
