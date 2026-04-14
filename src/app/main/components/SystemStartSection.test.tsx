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
  it('카운트다운 오버레이를 버튼 내부 기준으로 렌더링해야 한다', () => {
    render(
      <SystemStartSection
        isMounted
        systemStartCountdown={3}
        isSystemStarting={false}
        isSystemStarted={false}
        isSystemRunning={false}
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
});
