/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AISidebarV4 from '@/components/ai-sidebar/AISidebarV4';

// Mock useAIChatCore
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

// Mock useResizable
vi.mock('@/hooks/ui/useResizable', () => ({
  useResizable: vi.fn(() => ({
    width: 400,
    isResizing: false,
    handleMouseDown: vi.fn(),
  })),
}));

// Mock useUserPermissions
const mockPermissions = { canToggleAI: true, canAccessAdmin: false };
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: vi.fn(() => mockPermissions),
}));

// Mock guestMode
vi.mock('@/config/guestMode', () => ({
  isGuestFullAccessEnabled: vi.fn(() => false),
}));

// Mock Zustand store
vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: vi.fn((selector) => {
    const state = {
      isOpen: true,
      toggleSidebar: vi.fn(),
      setIsOpen: vi.fn(),
      messages: [],
      addMessage: vi.fn(),
      webSearchEnabled: false,
      setWebSearchEnabled: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock child components
vi.mock('@/components/ai-sidebar/AISidebarHeader', () => ({
  AISidebarHeader: () => <div data-testid="sidebar-header">Header</div>,
}));

vi.mock('@/components/ai-sidebar/EnhancedAIChat', () => ({
  EnhancedAIChat: () => <div data-testid="enhanced-ai-chat">AI Chat</div>,
}));

vi.mock('@/components/ai-sidebar/AIFunctionPages', () => ({
  AIFunctionPages: () => <div data-testid="ai-function-pages">Pages</div>,
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
  AIErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

describe('AISidebarV4', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.canToggleAI = true;
  });

  it('renders sidebar when user has AI permission', () => {
    render(<AISidebarV4 {...defaultProps} />);
    expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
  });

  it('returns null when user lacks AI permission', () => {
    mockPermissions.canToggleAI = false;
    const { container } = render(<AISidebarV4 {...defaultProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('closes sidebar on ESC key press', () => {
    render(<AISidebarV4 {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not close on ESC when sidebar is closed', () => {
    render(<AISidebarV4 {...defaultProps} isOpen={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('renders chat view by default', () => {
    render(<AISidebarV4 {...defaultProps} />);
    expect(screen.getByTestId('enhanced-ai-chat')).toBeInTheDocument();
  });
});
