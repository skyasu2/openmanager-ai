/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardNavigation } from './DashboardNavigation';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/dashboard'));
const mockUseAISidebarStore = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}));

vi.mock('@/stores/useAISidebarStore', () => ({
  useAISidebarStore: (selector: (state: { isOpen: boolean }) => unknown) =>
    mockUseAISidebarStore(selector),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('DashboardNavigation', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/dashboard');
    mockUseAISidebarStore.mockImplementation(
      (selector: (state: { isOpen: boolean }) => unknown) =>
        selector({ isOpen: false })
    );
  });

  it('keeps AI assistant out of the left app navigation', () => {
    render(<DashboardNavigation />);

    expect(screen.getByRole('link', { name: '개요' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('link', { name: '서버' })).toHaveAttribute(
      'href',
      '/dashboard/servers'
    );
    expect(screen.queryByText('AI 어시스턴트')).not.toBeInTheDocument();
  });

  it('collapses the desktop side nav into an icon rail while AI sidebar is open', () => {
    const { container } = render(
      <DashboardNavigation isAIAssistantOpen={true} />
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-16');
    expect(aside).toHaveClass('hover:w-56');
    expect(screen.getByRole('link', { name: '개요' })).toHaveClass(
      'justify-center'
    );
    expect(
      screen.queryByRole('button', { name: '대시보드 메뉴 열기' })
    ).not.toBeInTheDocument();
  });

  it('uses the AI sidebar store to hide the mobile menu trigger while sidebar is open', () => {
    mockUseAISidebarStore.mockImplementation(
      (selector: (state: { isOpen: boolean }) => unknown) =>
        selector({ isOpen: true })
    );

    render(<DashboardNavigation />);

    expect(
      screen.queryByRole('button', { name: '대시보드 메뉴 열기' })
    ).not.toBeInTheDocument();
  });
});
