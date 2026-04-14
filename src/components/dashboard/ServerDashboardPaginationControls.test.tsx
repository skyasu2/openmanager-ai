/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { MouseEvent, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ServerDashboardPaginationControls from './ServerDashboardPaginationControls';

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => (
    <div>
      {children}
      <button type="button" onClick={() => onValueChange('12')}>
        change-page-size
      </button>
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: () => <span>value</span>,
}));

vi.mock('@/components/ui/pagination', () => ({
  Pagination: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
  PaginationContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PaginationItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PaginationLink: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: (e: MouseEvent) => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  PaginationPrevious: ({ onClick }: { onClick?: (e: MouseEvent) => void }) => (
    <button type="button" onClick={onClick}>
      prev
    </button>
  ),
  PaginationNext: ({ onClick }: { onClick?: (e: MouseEvent) => void }) => (
    <button type="button" onClick={onClick}>
      next
    </button>
  ),
}));

describe('ServerDashboardPaginationControls', () => {
  it('delegates page-size resets to the parent handler only once', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <ServerDashboardPaginationControls
        currentPage={3}
        totalPages={8}
        pageSize={6}
        totalServers={48}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'change-page-size' }));

    expect(onPageSizeChange).toHaveBeenCalledWith(12);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('renders a stable zero-state range when no servers exist', () => {
    render(
      <ServerDashboardPaginationControls
        currentPage={1}
        totalPages={1}
        pageSize={6}
        totalServers={0}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText('0개 서버 중 0-0번째 표시 중')).toBeInTheDocument();
  });
});
