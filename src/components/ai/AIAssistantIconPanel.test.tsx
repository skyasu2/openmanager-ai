/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AIAssistantIconPanel from '@/components/ai/AIAssistantIconPanel';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
}));

describe('AIAssistantIconPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the feature rail without misleading engine-active status', () => {
    const { container } = render(
      <AIAssistantIconPanel
        selectedFunction="chat"
        onFunctionChange={vi.fn()}
      />
    );

    expect(screen.getByText('AI 기능')).toHaveClass('whitespace-nowrap');
    expect(screen.queryByText('AI 활성')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('uses plain selected styling and clear tooltip copy', () => {
    render(
      <AIAssistantIconPanel
        selectedFunction="chat"
        onFunctionChange={vi.fn()}
      />
    );

    const chatButton = screen.getByTestId('ai-function-chat');

    expect(chatButton).toHaveAttribute('aria-label', 'AI Chat');
    expect(chatButton).toHaveAttribute('aria-pressed', 'true');
    expect(chatButton).not.toHaveClass('bg-linear-to-r');
    expect(chatButton).toHaveAttribute(
      'title',
      'AI Chat\n서버 질의, 트러블슈팅, 명령어 추천'
    );
  });

  it('uses the unified sidebar rail surface and purple selected accent', () => {
    const { container } = render(
      <AIAssistantIconPanel
        selectedFunction="chat"
        onFunctionChange={vi.fn()}
      />
    );

    const rail = container.firstElementChild;
    const chatButton = screen.getByTestId('ai-function-chat');
    const selectedMarker = container.querySelector('.rounded-r-full');

    expect(rail).toHaveClass('bg-gray-50/50');
    expect(rail).toHaveClass('border-gray-100');
    expect(rail).not.toHaveClass('bg-white');
    expect(rail).not.toHaveClass('border-gray-200');
    expect(chatButton).toHaveClass('bg-purple-600');
    expect(chatButton).not.toHaveClass('bg-slate-900');
    expect(selectedMarker).toHaveClass('bg-purple-600');
  });

  it('keeps feature switching and fullscreen handoff behavior', () => {
    const onFunctionChange = vi.fn();
    const onOpenFullscreen = vi.fn();

    render(
      <AIAssistantIconPanel
        selectedFunction="chat"
        onFunctionChange={onFunctionChange}
        onOpenFullscreen={onOpenFullscreen}
      />
    );

    fireEvent.click(screen.getByTestId('ai-function-auto-report'));
    fireEvent.click(screen.getByTestId('ai-fullscreen-button'));

    expect(onFunctionChange).toHaveBeenCalledWith('auto-report');
    expect(onOpenFullscreen).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps mobile icon buttons accessible', () => {
    render(
      <AIAssistantIconPanel
        selectedFunction="intelligent-monitoring"
        onFunctionChange={vi.fn()}
        isMobile
      />
    );

    expect(screen.getByLabelText('이상감지/추세')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('전체 화면으로 열기')).toBeInTheDocument();
  });

  it('can hide fullscreen handoff when already rendered in fullscreen', () => {
    render(
      <AIAssistantIconPanel
        selectedFunction="chat"
        onFunctionChange={vi.fn()}
        isMobile
        showFullscreenButton={false}
      />
    );

    expect(
      screen.queryByLabelText('전체 화면으로 열기')
    ).not.toBeInTheDocument();
  });
});
