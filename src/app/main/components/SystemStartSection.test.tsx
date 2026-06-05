/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SystemStartSection } from './SystemStartSection';

vi.mock('lucide-react', async () => {
  const actual =
    await vi.importActual<typeof import('lucide-react')>('lucide-react');

  return {
    ...actual,
    MessageSquareQuote: () => <span data-testid="assistant-icon" />,
  };
});

describe('SystemStartSection', () => {
  const renderSystemStartSection = () =>
    render(
      <SystemStartSection
        isMounted
        systemStartCountdown={0}
        buttonConfig={{
          disabled: false,
          className: 'bg-blue-500 text-white',
          icon: <span>icon</span>,
          text: '시스템 시작',
        }}
        statusInfo={{
          color: 'text-white',
          message: '준비됨',
          showEscHint: false,
        }}
        onSystemToggle={vi.fn()}
      />
    );

  it('카운트다운 오버레이를 버튼 내부 기준으로 렌더링해야 한다', () => {
    render(
      <SystemStartSection
        isMounted
        systemStartCountdown={3}
        buttonConfig={{
          disabled: false,
          className: 'bg-red-500 text-white',
          icon: <span>icon</span>,
          text: '시작 중지',
        }}
        statusInfo={{
          color: 'text-white',
          message: '3초 후 종료',
          showEscHint: true,
        }}
        onSystemToggle={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /시작 중지/ });
    expect(button.className).toContain('relative');
    expect(button.className).toContain('overflow-hidden');
    expect(button.querySelector('.absolute.inset-0.origin-left')).toBeTruthy();
  });

  it('예시 질문을 클릭 액션이 아닌 표시 전용 목록으로 렌더링한다', () => {
    renderSystemStartSection();

    expect(
      screen.getByRole('list', {
        name: '시스템 시작 후 사용할 수 있는 예시 질문',
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: /CPU 사용률/ })
    ).not.toBeInTheDocument();
  });
});
