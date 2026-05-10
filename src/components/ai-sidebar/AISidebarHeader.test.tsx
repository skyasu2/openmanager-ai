/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AISidebarHeader } from './AISidebarHeader';

const mockClearMessages = vi.fn();

vi.mock('@/components/ui/BasicTyping', () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('@/components/ai-sidebar/CloudRunStatusIndicator', () => ({
  CloudRunStatusIndicator: () => (
    <div data-testid="cloud-run-status">Cloud Run</div>
  ),
}));

vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: vi.fn((selector) =>
    selector({
      clearMessages: mockClearMessages,
    })
  ),
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: vi.fn((selector) =>
    selector({
      isSystemStarted: true,
    })
  ),
}));

describe('AISidebarHeader', () => {
  it('활성 AI 탭에 맞춰 subtitle을 바꾼다', () => {
    const { rerender } = render(
      <AISidebarHeader activeFunction="chat" onClose={vi.fn()} />
    );

    expect(
      screen.getByText('서버 상태·로그·메트릭을 자연어로 질의')
    ).toBeInTheDocument();

    rerender(
      <AISidebarHeader activeFunction="auto-report" onClose={vi.fn()} />
    );
    expect(screen.getByText('장애·정기 보고서 자동 생성')).toBeInTheDocument();

    rerender(
      <AISidebarHeader
        activeFunction="intelligent-monitoring"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('이상감지·추세 분석 실행')).toBeInTheDocument();
  });

  it('새 대화 콜백이 없으면 사이드바 메시지를 초기화한다', () => {
    mockClearMessages.mockClear();

    render(<AISidebarHeader onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '새 대화 시작' }));

    expect(mockClearMessages).toHaveBeenCalledTimes(1);
  });

  it('헤더에서 전체화면 전환 버튼을 노출한다', () => {
    const onOpenFullscreen = vi.fn();

    render(
      <AISidebarHeader
        activeFunction="chat"
        onClose={vi.fn()}
        onOpenFullscreen={onOpenFullscreen}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '전체화면으로 보기' }));

    expect(screen.getByText('전체화면')).toBeInTheDocument();
    expect(onOpenFullscreen).toHaveBeenCalledTimes(1);
  });
});
