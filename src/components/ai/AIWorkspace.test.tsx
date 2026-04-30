/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AIWorkspace from '@/components/ai/AIWorkspace';

const mockEnhancedAIChat = vi.fn(() => (
  <div data-testid="enhanced-ai-chat">AI Chat</div>
));
const mockConsumePendingEntryState = vi.fn(() => null);
const mockConsumePendingPrefillMessage = vi.fn();

let mockSidebarState: Record<string, unknown>;

// Mock next/navigation
const mockBack = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock the AI Chat Core hook
vi.mock('@/hooks/ai/useAIChatCore', () => ({
  useAIChatCore: vi.fn(() => ({
    // 입력 상태
    input: '',
    setInput: vi.fn(),
    // 메시지
    messages: [],
    // 로딩/진행 상태
    isLoading: false,
    hybridState: {
      progress: null,
      jobId: null,
    },
    currentMode: 'fast',
    // 에러 상태
    error: null,
    clearError: vi.fn(),
    // 세션 관리
    sessionState: {
      messagesRemaining: 10,
      isLimited: false,
    },
    handleNewSession: vi.fn(),
    // 액션
    handleFeedback: vi.fn(),
    regenerateLastResponse: vi.fn(),
    retryLastQuery: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    // 통합 입력 핸들러
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
  })),
}));

// Mock Zustand store with selector support
vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: vi.fn((selector) =>
    selector ? selector(mockSidebarState) : mockSidebarState
  ),
}));

// Mock child components to simplify testing
vi.mock('@/components/shared/OpenManagerLogo', () => ({
  OpenManagerLogo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('@/components/ai-sidebar/EnhancedAIChat', () => ({
  EnhancedAIChat: (props: unknown) => mockEnhancedAIChat(props),
}));

vi.mock('@/components/ai/AIAssistantIconPanel', () => ({
  default: ({
    selectedFunction,
    onFunctionChange,
    isMobile,
    showFullscreenButton,
  }: {
    selectedFunction: string;
    onFunctionChange: (fn: string) => void;
    isMobile?: boolean;
    showFullscreenButton?: boolean;
  }) => (
    <div
      data-testid={isMobile ? 'ai-mobile-icon-panel' : 'ai-icon-panel'}
      data-selected-function={selectedFunction}
      data-show-fullscreen={String(showFullscreenButton)}
    >
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
    </div>
  ),
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

vi.mock('@/components/ai/ThinkingProcessVisualizer', () => ({
  default: () => <div data-testid="thinking-visualizer">Thinking</div>,
  ThinkingProcessVisualizer: () => (
    <div data-testid="thinking-visualizer">Thinking</div>
  ),
}));

vi.mock('@/components/shared/UnifiedProfileHeader', () => ({
  default: () => <div data-testid="profile-header">Profile Header</div>,
}));

vi.mock('@/components/dashboard/RealTimeDisplay', () => ({
  RealTimeDisplay: () => <div data-testid="realtime-display">RealTime</div>,
}));

vi.mock('@/components/ai/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

vi.mock('@/components/ai/TypewriterMarkdown', () => ({
  TypewriterMarkdown: ({ content }: { content: string }) => (
    <div data-testid="typewriter-markdown">{content}</div>
  ),
}));

vi.mock('@/components/ai/MessageActions', () => ({
  MessageActions: () => <div data-testid="message-actions">Actions</div>,
}));

vi.mock('@/components/ai/SystemContextPanel', () => ({
  default: () => <div data-testid="system-context">System Context</div>,
}));

vi.mock('@/components/error/AIErrorBoundary', () => ({
  AIErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

function mockViewportMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('AIWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('style');
    mockViewportMedia(false);
    mockSidebarState = {
      isOpen: true,
      toggleSidebar: vi.fn(),
      setIsOpen: vi.fn(),
      setOpen: vi.fn(),
      queuePendingEntryState: vi.fn(),
      pendingEntryState: null,
      consumePendingEntryState: mockConsumePendingEntryState,
      pendingPrefillMessage: null,
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
  });

  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('renders AI workspace interface', () => {
    render(<AIWorkspace />);

    // Check for key UI elements (로고는 desktop/mobile 두 곳에 표시될 수 있음)
    const logos = screen.getAllByTestId('logo');
    expect(logos.length).toBeGreaterThan(0);
    // 새 대화 버튼 (한국어)
    expect(screen.getByText('새 대화')).toBeInTheDocument();
    // AI 기능 섹션 레이블 (한국어로 변경됨)
    expect(screen.getByText('AI 기능')).toBeInTheDocument();
  });

  it('scopes fullscreen workspace root theme tokens to the light surface', async () => {
    document.documentElement.style.setProperty('--background', '217 33% 17%');

    const { unmount } = render(<AIWorkspace />);

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue('--background')
      ).toBe('0 0% 100%');
      expect(document.documentElement.style.colorScheme).toBe('light');
    });

    unmount();

    expect(
      document.documentElement.style.getPropertyValue('--background')
    ).toBe('217 33% 17%');
  });

  it('handles dashboard navigation', () => {
    render(<AIWorkspace />);

    const dashboardButton = screen.getByRole('button', {
      name: '대시보드로 돌아가기',
    });
    fireEvent.click(dashboardButton);

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('displays loading state correctly', async () => {
    const { useAIChatCore } = await import('@/hooks/ai/useAIChatCore');

    vi.mocked(useAIChatCore).mockReturnValue({
      input: '',
      setInput: vi.fn(),
      messages: [],
      isLoading: true,
      hybridState: {
        progress: null,
        jobId: null,
      },
      currentMode: 'fast',
      error: null,
      clearError: vi.fn(),
      sessionState: {
        messagesRemaining: 10,
        isLimited: false,
      },
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

    render(<AIWorkspace />);

    // Component should render without errors during loading state
    const logos = screen.getAllByTestId('logo');
    expect(logos.length).toBeGreaterThan(0);
  });

  it('renders AI function buttons', () => {
    render(<AIWorkspace />);

    // AI 기능 버튼들 확인
    const aiChatElements = screen.getAllByText('AI Chat');
    expect(aiChatElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('장애 보고서')).toBeInTheDocument();
    expect(screen.getByText('이상감지/예측')).toBeInTheDocument();
  });

  it('renders dashboard embedded AI function page without standalone workspace chrome', () => {
    render(<AIWorkspace embedded />);

    expect(
      screen.getByRole('button', { name: /AI Chat\s+NLQ Agent/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /장애 보고서\s+Reporter Agent/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /이상감지\/예측\s+Analyst Agent/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '대시보드로 돌아가기' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('AI Engine Active')).not.toBeInTheDocument();
  });

  it('keeps the embedded mobile AI route as a dashboard function page', async () => {
    mockViewportMedia(true);
    const setOpen = vi.fn();
    const queuePendingEntryState = vi.fn();
    mockSidebarState = {
      ...mockSidebarState,
      setOpen,
      queuePendingEntryState,
    };

    render(<AIWorkspace embedded />);

    expect(
      await screen.findByRole('button', { name: /AI Chat\s+NLQ Agent/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /장애 보고서\s+Reporter Agent/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /이상감지\/예측\s+Analyst Agent/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ai-workspace-mobile-handoff')
    ).not.toBeInTheDocument();
    expect(queuePendingEntryState).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard');
  });

  it('hands off the mobile fullscreen route to the dashboard sidebar', async () => {
    mockViewportMedia(true);
    const setOpen = vi.fn();
    const queuePendingEntryState = vi.fn();
    mockSidebarState = {
      ...mockSidebarState,
      setOpen,
      queuePendingEntryState,
    };

    render(<AIWorkspace />);

    await waitFor(() => {
      expect(queuePendingEntryState).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'sidebar',
          selectedFunction: 'chat',
          analysisMode: 'auto',
        })
      );
    });
    expect(setOpen).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    expect(
      screen.getByTestId('ai-workspace-mobile-handoff')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ai-workspace-mobile-function-nav')
    ).not.toBeInTheDocument();
  });

  it('retargets pending fullscreen entry state to the sidebar during mobile handoff', async () => {
    mockViewportMedia(true);
    const setOpen = vi.fn();
    const queuePendingEntryState = vi.fn();
    mockSidebarState = {
      ...mockSidebarState,
      setOpen,
      queuePendingEntryState,
      pendingEntryState: {
        draft: '모바일 handoff 초안',
        selectedFunction: 'auto-report',
        analysisMode: 'thinking',
        target: 'fullscreen',
      },
    };

    render(<AIWorkspace />);

    await waitFor(() => {
      expect(queuePendingEntryState).toHaveBeenCalledWith({
        draft: '모바일 handoff 초안',
        selectedFunction: 'auto-report',
        analysisMode: 'thinking',
        target: 'sidebar',
      });
    });
    expect(setOpen).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    expect(mockConsumePendingEntryState).not.toHaveBeenCalledWith('fullscreen');
  });

  it('preserves dashboard queryAsOf data slot in fullscreen AI core', async () => {
    const { useAIChatCore } = await import('@/hooks/ai/useAIChatCore');
    const queryAsOfDataSlot = {
      slotIndex: 42,
      minuteOfDay: 420,
      timeLabel: '07:00 KST',
    };

    mockConsumePendingEntryState.mockReturnValueOnce({
      selectedFunction: 'intelligent-monitoring',
      target: 'fullscreen',
      queryAsOfDataSlot,
    });
    mockSidebarState = {
      ...mockSidebarState,
      pendingEntryState: {
        selectedFunction: 'intelligent-monitoring',
        target: 'fullscreen',
        queryAsOfDataSlot,
      },
    };

    render(<AIWorkspace />);

    expect(useAIChatCore).toHaveBeenCalledWith(
      expect.objectContaining({
        queryAsOfDataSlot,
      })
    );
  });

  it('forwards sidebar parity props to fullscreen chat', async () => {
    const { useAIChatCore } = await import('@/hooks/ai/useAIChatCore');

    mockSidebarState = {
      ...mockSidebarState,
      webSearchEnabled: true,
      ragEnabled: true,
      analysisMode: 'thinking',
    };

    vi.mocked(useAIChatCore).mockReturnValue({
      input: '',
      setInput: vi.fn(),
      messages: [],
      isLoading: true,
      hybridState: {
        progress: null,
        jobId: null,
      },
      currentMode: 'streaming',
      error: null,
      clearError: vi.fn(),
      sessionState: {
        messagesRemaining: 10,
        isLimited: false,
      },
      handleNewSession: vi.fn(),
      handleFeedback: vi.fn(),
      regenerateLastResponse: vi.fn(),
      retryLastQuery: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      handleSendInput: vi.fn(),
      clarification: { question: '확인', options: [] },
      selectClarification: vi.fn(),
      submitCustomClarification: vi.fn(),
      skipClarification: vi.fn(),
      dismissClarification: vi.fn(),
      currentAgentStatus: { agent: 'supervisor', status: 'running' },
      currentHandoff: { from: 'supervisor', to: 'advisor', reason: 'detail' },
      warmingUp: true,
      estimatedWaitSeconds: 30,
      queuedQueries: [{ id: 1, text: 'queued' }],
      removeQueuedQuery: vi.fn(),
    } as unknown as ReturnType<typeof useAIChatCore>);

    render(<AIWorkspace mode="fullscreen" />);

    const lastCall = mockEnhancedAIChat.mock.calls.at(-1)?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(lastCall?.clarification).toEqual({ question: '확인', options: [] });
    expect(lastCall?.currentAgentStatus).toEqual({
      agent: 'supervisor',
      status: 'running',
    });
    expect(lastCall?.currentHandoff).toEqual({
      from: 'supervisor',
      to: 'advisor',
      reason: 'detail',
    });
    expect(lastCall?.warmingUp).toBe(true);
    expect(lastCall?.estimatedWaitSeconds).toBe(30);
    expect(lastCall?.webSearchEnabled).toBe(true);
    expect(lastCall?.ragEnabled).toBe(true);
    expect(lastCall?.analysisMode).toBe('thinking');
    expect(lastCall?.onSelectAnalysisMode).toEqual(expect.any(Function));
    expect(lastCall?.queuedQueries).toEqual([{ id: 1, text: 'queued' }]);
  });

  it('consumes pending prefill message when fullscreen chat mounts', async () => {
    const { useAIChatCore } = await import('@/hooks/ai/useAIChatCore');
    const mockSetInput = vi.fn();

    mockSidebarState = {
      ...mockSidebarState,
      pendingPrefillMessage: 'storage-nfs-dc1-01 디스크 원인 분석',
    };

    vi.mocked(useAIChatCore).mockReturnValue({
      input: '',
      setInput: mockSetInput,
      messages: [],
      isLoading: false,
      hybridState: {
        progress: null,
        jobId: null,
      },
      currentMode: 'streaming',
      error: null,
      clearError: vi.fn(),
      sessionState: {
        messagesRemaining: 10,
        isLimited: false,
      },
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

    render(<AIWorkspace mode="fullscreen" />);

    await waitFor(() => {
      expect(mockSetInput).toHaveBeenCalledWith(
        'storage-nfs-dc1-01 디스크 원인 분석'
      );
      expect(mockConsumePendingPrefillMessage).toHaveBeenCalled();
    });
  });

  it('does not consume sidebar-targeted prefill when fullscreen entry target mismatches', async () => {
    const { useAIChatCore } = await import('@/hooks/ai/useAIChatCore');
    const mockSetInput = vi.fn();

    mockConsumePendingEntryState.mockReturnValueOnce(null);
    mockSidebarState = {
      ...mockSidebarState,
      pendingEntryState: {
        draft: 'sidebar에서만 열어야 하는 초안',
        selectedFunction: 'chat',
        target: 'sidebar',
      },
      pendingPrefillMessage: 'sidebar에서만 열어야 하는 초안',
    };

    vi.mocked(useAIChatCore).mockReturnValue({
      input: '',
      setInput: mockSetInput,
      messages: [],
      isLoading: false,
      hybridState: {
        progress: null,
        jobId: null,
      },
      currentMode: 'streaming',
      error: null,
      clearError: vi.fn(),
      sessionState: {
        messagesRemaining: 10,
        isLimited: false,
      },
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

    render(<AIWorkspace mode="fullscreen" />);

    await waitFor(() => {
      expect(mockConsumePendingEntryState).toHaveBeenCalledWith('fullscreen');
    });
    expect(mockSetInput).not.toHaveBeenCalledWith(
      'sidebar에서만 열어야 하는 초안'
    );
    expect(mockConsumePendingPrefillMessage).not.toHaveBeenCalled();
  });

  it('preserves fullscreen Analyst state when switching to chat and back', () => {
    render(<AIWorkspace mode="fullscreen" />);

    fireEvent.click(
      screen.getByRole('button', { name: /이상감지\/예측\s+Analyst Agent/i })
    );
    fireEvent.click(screen.getByRole('button', { name: 'content-count:0' }));

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'intelligent-monitoring'
    );
    expect(
      screen.getByRole('button', { name: 'content-count:1' })
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: /AI Chat\s+NLQ Agent/i })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /이상감지\/예측\s+Analyst Agent/i })
    );

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'intelligent-monitoring'
    );
    expect(
      screen.getByRole('button', { name: 'content-count:1' })
    ).toBeDefined();
  });

  it('preserves fullscreen Reporter state when switching to chat and back', () => {
    render(<AIWorkspace mode="fullscreen" />);

    fireEvent.click(
      screen.getByRole('button', { name: /장애 보고서\s+Reporter Agent/i })
    );
    fireEvent.click(screen.getByRole('button', { name: 'content-count:0' }));

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'auto-report'
    );
    expect(
      screen.getByRole('button', { name: 'content-count:1' })
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: /AI Chat\s+NLQ Agent/i })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /장애 보고서\s+Reporter Agent/i })
    );

    expect(screen.getByTestId('ai-content-function')).toHaveTextContent(
      'auto-report'
    );
    expect(
      screen.getByRole('button', { name: 'content-count:1' })
    ).toBeDefined();
  });
});
