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
  DashboardSummary: vi.fn(
    ({
      onOpenActiveAlerts,
      onOpenAlertHistory,
      onOpenLogExplorer,
      onToggleTopology,
    }: {
      onOpenActiveAlerts?: () => void;
      onOpenAlertHistory?: () => void;
      onOpenLogExplorer?: () => void;
      onToggleTopology?: () => void;
    }) => (
      <div data-testid="dashboard-summary">
        <button
          type="button"
          aria-label="open active alerts"
          onClick={onOpenActiveAlerts}
        >
          active alerts
        </button>
        <button
          type="button"
          aria-label="open alert history"
          onClick={onOpenAlertHistory}
        >
          alert history
        </button>
        <button
          type="button"
          aria-label="open log explorer"
          onClick={onOpenLogExplorer}
        >
          log explorer
        </button>
        <button
          type="button"
          aria-label="open topology"
          onClick={onToggleTopology}
        >
          topology
        </button>
      </div>
    )
  ),
}));

vi.mock('./SystemOverviewSection', () => ({
  SystemOverviewSection: vi.fn(() => <div data-testid="system-overview" />),
}));

vi.mock('./ServerDashboard', () => ({
  default: vi.fn(() => <div data-testid="server-dashboard" />),
}));

vi.mock('./ActiveAlertsModal', () => ({
  ActiveAlertsModal: vi.fn(({ open }: { open: boolean }) =>
    open ? <div data-testid="active-alerts-modal" /> : null
  ),
}));

vi.mock('./TopologyModal', () => ({
  TopologyModal: vi.fn(({ open }: { open: boolean }) =>
    open ? <div data-testid="topology-modal" /> : null
  ),
}));

vi.mock('./alert-history/AlertHistoryModal', () => ({
  AlertHistoryModal: vi.fn(({ open }: { open: boolean }) =>
    open ? <div data-testid="alert-history-modal" /> : null
  ),
}));

vi.mock('./log-explorer/LogExplorerModal', () => ({
  LogExplorerModal: vi.fn(({ open }: { open: boolean }) =>
    open ? <div data-testid="log-explorer-modal" /> : null
  ),
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

  it('요약 액션 콜백을 각 모달 open 상태로 연결한다', () => {
    render(
      <DashboardContent
        {...createProps({
          servers: [{ id: 's1', name: 'server-1', status: 'online' } as Server],
          allServers: [
            { id: 's1', name: 'server-1', status: 'online' } as Server,
          ],
          totalServers: 1,
        })}
      />
    );

    expect(screen.queryAllByTestId('dynamic-component')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'open active alerts' }));
    expect(screen.queryAllByTestId('dynamic-component')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'open alert history' }));
    expect(screen.queryAllByTestId('dynamic-component')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'open log explorer' }));
    expect(screen.queryAllByTestId('dynamic-component')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'open topology' }));
    expect(screen.queryAllByTestId('dynamic-component')).toHaveLength(4);
  });
});
