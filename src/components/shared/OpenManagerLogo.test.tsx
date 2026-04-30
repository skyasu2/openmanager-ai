/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpenManagerLogo } from './OpenManagerLogo';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    prefetch,
    children,
    className,
  }: {
    href: string;
    prefetch?: boolean;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: <T,>(selector: T) => selector,
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: (selector: (state: unknown) => unknown) =>
    selector({
      aiAgent: { isEnabled: false },
      isSystemStarted: false,
    }),
}));

vi.mock('@/styles/design-constants', () => ({
  AI_ICON_GRADIENT_ANIMATED_STYLE: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
  AI_TEXT_GRADIENT_ANIMATED_STYLE: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
}));

describe('OpenManagerLogo', () => {
  it('홈 링크 로고는 기본적으로 prefetch를 비활성화해야 한다', () => {
    render(<OpenManagerLogo variant="light" href="/" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/');
    expect(screen.getByRole('link')).toHaveAttribute('data-prefetch', 'false');
  });

  it('필요할 때는 prefetch를 명시적으로 활성화할 수 있어야 한다', () => {
    render(<OpenManagerLogo variant="light" href="/" prefetch />);

    expect(screen.getByRole('link')).toHaveAttribute('data-prefetch', 'true');
  });

  it('모바일 compact 옵션은 좁은 앱 헤더용 크기 클래스를 적용한다', () => {
    render(<OpenManagerLogo variant="light" href="/" compactOnMobile />);

    const title = screen.getByRole('heading', { name: /OpenManager AI/ });
    expect(title).toHaveClass('text-base');
    expect(title).toHaveClass('sm:text-xl');
  });
});
