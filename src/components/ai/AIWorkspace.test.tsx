/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AIWorkspace from '@/components/ai/AIWorkspace';

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
  })),
}));

// Mock Zustand store with selector support
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

// Mock child components to simplify testing
vi.mock('@/components/shared/OpenManagerLogo', () => ({
  OpenManagerLogo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('@/components/ai-sidebar/EnhancedAIChat', () => ({
  EnhancedAIChat: () => <div data-testid="enhanced-ai-chat">AI Chat</div>,
}));

vi.mock('@/components/ai-sidebar/AIFunctionPages', () => ({
  AIFunctionPages: () => (
    <div data-testid="ai-function-pages">Function Pages</div>
  ),
}));

vi.mock('@/components/ai/AIAssistantIconPanel', () => ({
  default: () => <div data-testid="ai-icon-panel">Icon Panel</div>,
}));

vi.mock('@/components/ai/AIContentArea', () => ({
  default: () => <div data-testid="ai-content-area">Content Area</div>,
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
});
