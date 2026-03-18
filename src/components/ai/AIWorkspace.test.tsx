/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AIWorkspace from '@/components/ai/AIWorkspace';

const mockEnhancedAIChat = vi.fn(() => (
  <div data-testid="enhanced-ai-chat">AI Chat</div>
));

let mockSidebarState: Record<string, unknown>;

// Mock next/navigation
const mockBack = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
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
  default: () => <div data-testid="ai-icon-panel">Icon Panel</div>,
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

describe('AIWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSidebarState = {
      isOpen: true,
      toggleSidebar: vi.fn(),
      setIsOpen: vi.fn(),
      messages: [],
      addMessage: vi.fn(),
      webSearchEnabled: false,
      setWebSearchEnabled: vi.fn(),
      ragEnabled: false,
      setRagEnabled: vi.fn(),
    };
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

  it('handles back navigation', () => {
    render(<AIWorkspace />);

    // Find the back button by its title
    const backButton = screen.getByTitle('뒤로 가기');
    fireEvent.click(backButton);

    expect(mockBack).toHaveBeenCalled();
  });

  it('navigates to /dashboard/ai-assistant from sidebar fullscreen button', () => {
    render(<AIWorkspace mode="sidebar" />);

    const fullscreenButton = screen.getByTitle('전체 화면으로 보기');
    fireEvent.click(fullscreenButton);

    expect(mockPush).toHaveBeenCalledWith('/dashboard/ai-assistant');
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

  it('forwards sidebar parity props to fullscreen chat', async () => {
    const { useAIChatCore } = await import('@/hooks/ai/useAIChatCore');

    mockSidebarState = {
      ...mockSidebarState,
      webSearchEnabled: true,
      ragEnabled: true,
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
    expect(lastCall?.queuedQueries).toEqual([{ id: 1, text: 'queued' }]);
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
