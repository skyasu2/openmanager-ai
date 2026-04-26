/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AISidebarV4 from '@/components/ai-sidebar/AISidebarV4';

const mockSetInput = vi.fn();
const mockConsumePendingPrefillMessage = vi.fn();
const mockOpenFullscreen = vi.fn();
let mockPendingPrefillMessage: string | null = null;

// Mock useAIChatCore
vi.mock('@/hooks/ai/useAIChatCore', () => ({
  useAIChatCore: vi.fn(() => ({
    input: '',
    setInput: mockSetInput,
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
    handleTouchStart: vi.fn(),
  })),
}));

vi.mock('@/hooks/ai/useAIEntryController', () => ({
  useAIEntryController: vi.fn(() => ({
    openFullscreen: mockOpenFullscreen,
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
      setOpen: vi.fn(),
      sidebarWidth: 600,
      setSidebarWidth: vi.fn(),
      pendingEntryState: null,
      consumePendingEntryState: vi.fn(() => null),
      queuePendingEntryState: vi.fn(),
      pendingPrefillMessage: mockPendingPrefillMessage,
      consumePendingPrefillMessage: mockConsumePendingPrefillMessage,
      messages: [],
      addMessage: vi.fn(),
      webSearchEnabled: false,
      setWebSearchEnabled: vi.fn(),
      ragEnabled: false,
      setRagEnabled: vi.fn(),
      analysisMode: 'auto',
      setAnalysisMode: vi.fn(),
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

vi.mock('@/components/ai/AIContentArea', () => ({
  default: ({ selectedFunction }: { selectedFunction: string }) => {
    const [count, setCount] = useState(0);

    return (
      <div data-testid="ai-content-area">
        <div data-testid="ai-content-function">{selectedFunction}</div>
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          content-count:{count}
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/ai-sidebar/ResizeHandle', () => ({
  ResizeHandle: () => <div data-testid="resize-handle">Resize</div>,
}));

vi.mock('@/components/ai-sidebar/InlineAgentStatus', () => ({
  InlineAgentStatus: () => null,
}));

vi.mock('@/components/ai/AIAssistantIconPanel', () => ({
  default: ({
    onFunctionChange,
    onOpenFullscreen,
    isMobile,
  }: {
    onFunctionChange: (
      value: 'chat' | 'auto-report' | 'intelligent-monitoring'
    ) => void;
    onOpenFullscreen?: () => void;
    isMobile?: boolean;
  }) => (
    <div data-testid={isMobile ? 'ai-mobile-icon-panel' : 'ai-icon-panel'}>
      <button type="button" onClick={() => onFunctionChange('chat')}>
        switch-chat
      </button>
      <button type="button" onClick={() => onFunctionChange('auto-report')}>
        switch-reporter
      </button>
      <button
        type="button"
        onClick={() => onFunctionChange('intelligent-monitoring')}
      >
        switch-analyst
      </button>
      <button type="button" onClick={onOpenFullscreen}>
        open-fullscreen
      </button>
    </div>
  ),
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
  let originalInnerWidth = 1024;

  const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
  };

  const clickFunctionSwitch = (
    name: 'switch-chat' | 'switch-reporter' | 'switch-analyst'
  ) => {
    fireEvent.click(screen.getAllByRole('button', { name })[0]);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.canToggleAI = true;
    mockPendingPrefillMessage = null;
    originalInnerWidth = window.innerWidth;
    setViewportWidth(1024);
  });

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
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

  it('consumes pending prefill message when sidebar opens', async () => {
    mockPendingPrefillMessage =
      'storage-nfs-dc1-01 서버의 디스크 사용률이 85%입니다.';

    render(<AISidebarV4 {...defaultProps} />);

    await waitFor(() => {
      expect(mockSetInput).toHaveBeenCalledWith(
        'storage-nfs-dc1-01 서버의 디스크 사용률이 85%입니다.'
      );
      expect(mockConsumePendingPrefillMessage).toHaveBeenCalled();
    });
  });

  it('passes draft and analysis mode into fullscreen handoff from chat view', async () => {
    const { useAIChatCore } = await import('@/hooks/ai/useAIChatCore');

    vi.mocked(useAIChatCore).mockReturnValue({
      input: 'CPU 경고 서버 원인 분석',
      setInput: mockSetInput,
      messages: [],
      isLoading: false,
      hybridState: { progress: null, jobId: null },
      currentMode: 'streaming',
      streamStatus: undefined,
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
      warmingUp: false,
      estimatedWaitSeconds: 0,
      queuedQueries: [],
      removeQueuedQuery: vi.fn(),
    } as unknown as ReturnType<typeof useAIChatCore>);

    render(<AISidebarV4 {...defaultProps} />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'open-fullscreen' })[0]
    );

    expect(mockOpenFullscreen).toHaveBeenCalledWith({
      draft: 'CPU 경고 서버 원인 분석',
      selectedFunction: 'chat',
      analysisMode: 'auto',
    });
  });

  it('preserves sidebar Analyst state when switching to chat and back', () => {
    render(<AISidebarV4 {...defaultProps} />);

    clickFunctionSwitch('switch-analyst');
    fireEvent.click(screen.getByRole('button', { name: 'content-count:0' }));

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'intelligent-monitoring'
    );
    expect(
      screen.getByRole('button', { name: 'content-count:1' })
    ).toBeDefined();

    clickFunctionSwitch('switch-chat');
    clickFunctionSwitch('switch-analyst');

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'intelligent-monitoring'
    );
    expect(
      screen.getByRole('button', { name: 'content-count:1' })
    ).toBeDefined();
  });

  it('preserves sidebar Reporter state when switching to chat and back', () => {
    render(<AISidebarV4 {...defaultProps} />);

    clickFunctionSwitch('switch-reporter');
    fireEvent.click(screen.getByRole('button', { name: 'content-count:0' }));

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'auto-report'
    );
    expect(
      screen.getByRole('button', { name: 'content-count:1' })
    ).toBeDefined();

    clickFunctionSwitch('switch-chat');
    clickFunctionSwitch('switch-reporter');

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'auto-report'
    );
    expect(
      screen.getByRole('button', { name: 'content-count:1' })
    ).toBeDefined();
  });

  it('renders mobile backdrop and closes when clicked', () => {
    setViewportWidth(375);
    render(<AISidebarV4 {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: '사이드바 닫기' }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('uses full-screen layout on mobile', () => {
    setViewportWidth(375);
    render(<AISidebarV4 {...defaultProps} />);

    const sidebar = screen.getByTestId('ai-sidebar');
    expect(sidebar).toHaveClass('inset-0');
    expect(sidebar).toHaveClass('h-dvh');
    expect(sidebar).toHaveClass('w-screen');
  });

  it('keeps mobile function switching available above the chat surface', () => {
    setViewportWidth(375);
    render(<AISidebarV4 {...defaultProps} />);

    expect(screen.getByTestId('ai-mobile-function-nav')).toHaveClass(
      'shrink-0'
    );
    expect(screen.getByTestId('ai-function-page')).toHaveClass(
      'flex',
      'h-full',
      'flex-col'
    );
    expect(screen.getByTestId('ai-function-content')).toHaveClass(
      'min-h-0',
      'flex-1',
      'overflow-hidden'
    );
    expect(screen.getByTestId('ai-mobile-icon-panel')).toBeInTheDocument();
    expect(screen.getByTestId('enhanced-ai-chat')).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'switch-reporter' })[0]
    );

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'auto-report'
    );
  });

  it('locks background scroll on mobile and restores on unmount', async () => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'scroll';
    setViewportWidth(375);

    const { unmount } = render(<AISidebarV4 {...defaultProps} />);

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.documentElement.style.overflow).toBe('hidden');
    });

    unmount();

    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('scroll');
  });
});
