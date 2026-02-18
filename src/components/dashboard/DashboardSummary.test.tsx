/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardSummary } from './DashboardSummary';
import type { DashboardStats } from './types/dashboard.types';

vi.mock('lucide-react', () => {
  const MockIcon = () => <svg aria-hidden="true" />;

  return {
    Activity: MockIcon,
    AlertOctagon: MockIcon,
    AlertTriangle: MockIcon,
    Bell: MockIcon,
    CheckCircle2: MockIcon,
    FileSearch: MockIcon,
    Network: MockIcon,
    Server: MockIcon,
    ShieldAlert: MockIcon,
    XCircle: MockIcon,
  };
});

const mockStats: DashboardStats = {
  total: 6,
  online: 3,
  warning: 2,
  critical: 1,
  offline: 0,
  unknown: 0,
};

describe('DashboardSummary status filter cards', () => {
  it('상태 카드를 button으로 렌더링하고 필터 변경을 호출한다', () => {
    const onFilterChange = vi.fn();

    render(
      <DashboardSummary stats={mockStats} onFilterChange={onFilterChange} />
    );

    const onlineButton = screen.getByRole('button', {
      name: '온라인 3대 필터',
    });
    expect(onlineButton).toBeEnabled();

    fireEvent.click(onlineButton);
    expect(onFilterChange).toHaveBeenCalledWith('online');
  });

  it('활성 필터를 aria-pressed로 표시한다', () => {
    render(
      <DashboardSummary
        stats={mockStats}
        activeFilter="online"
        onFilterChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: '온라인 3대 필터' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: '경고 2대 필터' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('필터 핸들러가 없으면 상태 카드를 비활성화한다', () => {
    render(<DashboardSummary stats={mockStats} />);

    expect(
      screen.getByRole('button', { name: '온라인 3대 필터' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '위험 1대 필터' })
    ).toBeDisabled();
  });
});
