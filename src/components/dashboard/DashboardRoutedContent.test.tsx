/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import DashboardRoutedContent from './DashboardRoutedContent';

const { searchParamsState, alertHistoryPanelMock } = vi.hoisted(() => ({
  searchParamsState: {
    value: new URLSearchParams(),
  },
  alertHistoryPanelMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsState.value,
}));

vi.mock('next/dynamic', () => {
  return {
    default: () =>
      function MockDynamicComponent() {
        return <div data-testid="ai-workspace" />;
      },
  };
});

vi.mock('@/hooks/dashboard/useMonitoringReport', () => ({
  useMonitoringReport: vi.fn(() => ({
    data: null,
    error: null,
    isError: false,
  })),
}));

vi.mock('./ActiveAlertsModal', () => ({
  ActiveAlertsPanel: () => <div data-testid="active-alerts-panel" />,
}));

vi.mock('./alert-history/AlertHistoryModal', () => ({
  AlertHistoryPanel: (props: { initialServerId?: string | null }) => {
    alertHistoryPanelMock(props);
    return (
      <div
        data-testid="alert-history-panel"
        data-initial-server-id={props.initialServerId ?? ''}
      />
    );
  },
}));

vi.mock('./log-explorer/LogExplorerModal', () => ({
  LogExplorerPanel: ({
    initialServerId,
  }: {
    initialServerId?: string | null;
  }) => (
    <div
      data-testid="log-explorer-panel"
      data-initial-server-id={initialServerId ?? ''}
    />
  ),
}));

vi.mock('./ServerDashboard', () => ({
  default: () => <div data-testid="server-dashboard" />,
}));

vi.mock('./ServerDetailView', () => ({
  default: () => <div data-testid="server-detail-view" />,
}));

vi.mock('./TopologyModal', () => ({
  TopologyView: () => <div data-testid="topology-view" />,
}));

const servers = [
  {
    id: 'api-was-dc1-01',
    name: 'api-was-dc1-01',
    status: 'online',
  } as Server,
];

const baseProps = {
  servers,
  allServers: servers,
  totalServers: 1,
  currentPage: 1,
  totalPages: 1,
  pageSize: 6,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  onStatsUpdate: vi.fn(),
};

describe('DashboardRoutedContent route query contracts', () => {
  beforeEach(() => {
    searchParamsState.value = new URLSearchParams();
    alertHistoryPanelMock.mockClear();
  });

  it('알림 route의 server query를 AlertHistoryPanel 초기 서버 필터로 전달한다', () => {
    searchParamsState.value = new URLSearchParams('server=api-was-dc1-01');

    render(<DashboardRoutedContent {...baseProps} view="alerts" />);

    expect(screen.getByTestId('alert-history-panel')).toHaveAttribute(
      'data-initial-server-id',
      'api-was-dc1-01'
    );
    expect(alertHistoryPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialServerId: 'api-was-dc1-01',
      })
    );
  });

  it('알림 route는 legacy serverId query도 초기 서버 필터로 수용한다', () => {
    searchParamsState.value = new URLSearchParams('serverId=api-was-dc1-01');

    render(<DashboardRoutedContent {...baseProps} view="alerts" />);

    expect(alertHistoryPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialServerId: 'api-was-dc1-01',
      })
    );
  });

  it('알림 route에 서버 query가 없으면 기존 전체 서버 동작을 유지한다', () => {
    render(<DashboardRoutedContent {...baseProps} view="alerts" />);

    expect(screen.getByTestId('alert-history-panel')).toHaveAttribute(
      'data-initial-server-id',
      ''
    );
    expect(alertHistoryPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialServerId: null,
      })
    );
  });
});
