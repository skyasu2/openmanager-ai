/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import DashboardContent from './DashboardContent';

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-component" />,
}));

vi.mock('@/hooks/dashboard/useDashboardStats', () => ({
  useDashboardStats: vi.fn(() => ({
    total: 15,
    online: 15,
    offline: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
  })),
}));

vi.mock('@/hooks/dashboard/useMonitoringReport', () => ({
  useMonitoringReport: vi.fn(() => ({
    data: null,
    error: null,
    isError: false,
  })),
}));

vi.mock('./DashboardSummary', () => ({
  DashboardSummary: vi.fn(() => <div data-testid="dashboard-summary" />),
}));

vi.mock('./SystemOverviewSection', () => ({
  SystemOverviewSection: vi.fn(() => <div data-testid="system-overview" />),
}));

vi.mock('./ServerDashboard', () => ({
  default: vi.fn(() => <div data-testid="server-dashboard" />),
}));

vi.mock('./ActiveAlertsModal', () => ({
  ActiveAlertsModal: vi.fn(() => null),
}));

vi.mock('./TopologyModal', () => ({
  TopologyModal: vi.fn(() => null),
}));

vi.mock('./alert-history/AlertHistoryModal', () => ({
  AlertHistoryModal: vi.fn(() => null),
}));

vi.mock('./log-explorer/LogExplorerModal', () => ({
  LogExplorerModal: vi.fn(() => null),
}));

const createProps = (
  overrides: Partial<ComponentProps<typeof DashboardContent>> = {}
): ComponentProps<typeof DashboardContent> => ({
  showSequentialGeneration: false,
  servers: [],
  allServers: [],
  totalServers: 0,
  currentPage: 1,
  totalPages: 1,
  pageSize: 6,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  status: { type: 'running' },
  onStatsUpdate: vi.fn(),
  onShowSequentialChange: vi.fn(),
  isAgentOpen: false,
  statusFilter: null,
  onStatusFilterChange: vi.fn(),
  ...overrides,
});

describe('DashboardContent empty state', () => {
  it('필터 결과 0건이어도 요약 카드와 필터 초기화 버튼을 유지한다', () => {
    const onStatusFilterChange = vi.fn();
    const allServers = [
      { id: 's1', name: 'server-1', status: 'online' } as Server,
    ];

    render(
      <DashboardContent
        {...createProps({
          servers: [],
          allServers,
          statusFilter: 'warning',
          onStatusFilterChange,
        })}
      />
    );

    expect(screen.getByTestId('dashboard-summary')).toBeInTheDocument();
    expect(
      screen.getByText('필터 조건에 맞는 서버가 없습니다')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '상태 필터 초기화' }));
    expect(onStatusFilterChange).toHaveBeenCalledWith(null);
  });

  it('실제 데이터가 없으면 등록된 서버 없음 메시지를 표시한다', () => {
    render(<DashboardContent {...createProps()} />);

    expect(screen.getByText('등록된 서버가 없습니다')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '상태 필터 초기화' })
    ).not.toBeInTheDocument();
  });
});
