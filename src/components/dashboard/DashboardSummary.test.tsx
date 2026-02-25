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

  it('모바일 상태 카드 레이아웃 클래스를 유지한다', () => {
    render(<DashboardSummary stats={mockStats} onFilterChange={vi.fn()} />);

    const onlineButton = screen.getByTestId('status-card-online');
    const statusGrid = screen.getByTestId('dashboard-status-grid');

    expect(statusGrid).toHaveClass('grid-cols-2');
    expect(statusGrid).toHaveClass('sm:grid-cols-4');
    expect(onlineButton).toHaveClass('min-h-[84px]');
  });

  it('모바일에서 위험/경고/오프라인을 우선 순서로 배치한다', () => {
    render(<DashboardSummary stats={mockStats} onFilterChange={vi.fn()} />);

    expect(screen.getByTestId('dashboard-system-status-card')).toHaveClass(
      'order-1'
    );
    expect(screen.getByTestId('dashboard-status-grid')).toHaveClass('order-2');
    expect(screen.getByTestId('dashboard-total-card')).toHaveClass('order-3');

    expect(screen.getByTestId('status-card-critical')).toHaveClass('order-1');
    expect(screen.getByTestId('status-card-warning')).toHaveClass('order-2');
    expect(screen.getByTestId('status-card-offline')).toHaveClass('order-3');
    expect(screen.getByTestId('status-card-online')).toHaveClass('order-4');
  });

  it('모바일 액션 버튼 터치 영역 클래스를 유지한다', () => {
    render(
      <DashboardSummary
        stats={mockStats}
        onOpenActiveAlerts={vi.fn()}
        onOpenAlertHistory={vi.fn()}
        onOpenLogExplorer={vi.fn()}
      />
    );

    const activeAlertsButton = screen.getByRole('button', {
      name: '활성 알림 보기',
    });
    const alertHistoryButton = screen.getByRole('button', {
      name: '알림 이력 보기',
    });
    const logSearchButton = screen.getByRole('button', {
      name: '로그 검색 보기',
    });

    expect(activeAlertsButton).toHaveClass('h-12');
    expect(activeAlertsButton).toHaveClass('min-w-12');
    expect(alertHistoryButton).toHaveClass('h-12');
    expect(alertHistoryButton).toHaveClass('min-w-12');
    expect(logSearchButton).toHaveClass('h-12');
    expect(logSearchButton).toHaveClass('min-w-12');
  });

  it('시스템 상태 카드에 오프라인 카운트를 표시한다', () => {
    render(<DashboardSummary stats={mockStats} />);
    expect(screen.getAllByText('오프라인').length).toBeGreaterThanOrEqual(2);
  });
});
