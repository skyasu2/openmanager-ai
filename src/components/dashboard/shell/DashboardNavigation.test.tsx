/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
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
    const { container } = render(<DashboardNavigation />);

    expect(container.querySelector('aside')).toHaveClass('w-28');

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
    expect(aside).toHaveClass('hover:w-28');
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

  it('closes the mobile drawer with Escape and restores focus to the menu trigger', () => {
    render(<DashboardNavigation />);

    const menuButton = screen.getByRole('button', {
      name: '대시보드 메뉴 열기',
    });
    fireEvent.click(menuButton);

    expect(screen.getByRole('dialog', { name: '대시보드 메뉴' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: '대시보드 메뉴 닫기' })
    ).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen.queryByRole('dialog', { name: '대시보드 메뉴' })
    ).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it('keeps keyboard tab focus inside the mobile drawer', () => {
    render(<DashboardNavigation />);

    fireEvent.click(screen.getByRole('button', { name: '대시보드 메뉴 열기' }));

    const drawer = screen.getByRole('dialog', { name: '대시보드 메뉴' });
    const closeButton = within(drawer).getByRole('button', {
      name: '대시보드 메뉴 닫기',
    });
    const lastNavLink = within(drawer).getByRole('link', { name: '토폴로지' });

    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastNavLink).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
  });
});
