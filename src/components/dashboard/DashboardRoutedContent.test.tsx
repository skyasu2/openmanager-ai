/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import DashboardRoutedContent from './DashboardRoutedContent';

const {
  searchParamsState,
  activeAlertsPanelMock,
  alertHistoryPanelMock,
  useMonitoringReportMock,
  aiWorkspaceMock,
  serverDashboardMock,
  serverDetailViewMock,
} = vi.hoisted(() => ({
  searchParamsState: {
    value: new URLSearchParams(),
  },
  activeAlertsPanelMock: vi.fn(),
  alertHistoryPanelMock: vi.fn(),
  useMonitoringReportMock: vi.fn(),
  aiWorkspaceMock: vi.fn(),
  serverDashboardMock: vi.fn(),
  serverDetailViewMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsState.value,
}));

vi.mock('next/dynamic', () => {
  return {
    default: () =>
      function MockDynamicComponent(props: Record<string, unknown>) {
        aiWorkspaceMock(props);
        const queryAsOfDataSlot = props.queryAsOfDataSlot as
          | { slotIndex?: number }
          | undefined;
        return (
          <div
            data-testid="ai-workspace"
            data-slot-index={queryAsOfDataSlot?.slotIndex ?? ''}
          />
        );
      },
  };
});

vi.mock('@/hooks/dashboard/useMonitoringReport', () => ({
  useMonitoringReport: useMonitoringReportMock,
}));

vi.mock('./ActiveAlertsModal', () => ({
  ActiveAlertsPanel: (props: Record<string, unknown>) => {
    activeAlertsPanelMock(props);
    return (
      <div
        data-testid="active-alerts-panel"
        data-alert-count={
          Array.isArray(props.alerts) ? String(props.alerts.length) : '0'
        }
        data-error={String(Boolean(props.isError))}
        data-error-message={
          typeof props.errorMessage === 'string' ? props.errorMessage : ''
        }
        data-loading={String(Boolean(props.isLoading))}
      />
    );
  },
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
  default: (props: Record<string, unknown>) => {
    serverDashboardMock(props);
    return <div data-testid="server-dashboard" />;
  },
}));

vi.mock('./ServerDetailView', () => ({
  default: (props: Record<string, unknown>) => {
    serverDetailViewMock(props);
    return <div data-testid="server-detail-view" />;
  },
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
    activeAlertsPanelMock.mockClear();
    alertHistoryPanelMock.mockClear();
    aiWorkspaceMock.mockClear();
    serverDashboardMock.mockClear();
    serverDetailViewMock.mockClear();
    useMonitoringReportMock.mockReturnValue({
      data: null,
      error: null,
      isError: false,
      isLoading: false,
    });
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

  it('알림 route는 모니터링 조회 상태를 ActiveAlertsPanel로 전달한다', () => {
    useMonitoringReportMock.mockReturnValue({
      data: null,
      error: new Error('network down'),
      isError: true,
      isLoading: true,
    });

    render(<DashboardRoutedContent {...baseProps} view="alerts" />);

    expect(screen.getByTestId('active-alerts-panel')).toHaveAttribute(
      'data-loading',
      'true'
    );
    expect(screen.getByTestId('active-alerts-panel')).toHaveAttribute(
      'data-error',
      'true'
    );
    expect(screen.getByTestId('active-alerts-panel')).toHaveAttribute(
      'data-error-message',
      'network down'
    );
    expect(activeAlertsPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: [],
        errorMessage: 'network down',
        isError: true,
        isLoading: true,
      })
    );
  });

  it('core monitoring route에는 per-entity AI prefill handler를 전달하지 않는다', () => {
    render(<DashboardRoutedContent {...baseProps} view="servers" />);

    expect(serverDashboardMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        onAskAI: expect.any(Function),
      })
    );

    render(
      <DashboardRoutedContent
        {...baseProps}
        view="server-detail"
        initialFocusServerId="api-was-dc1-01"
      />
    );

    expect(serverDetailViewMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        onAskAI: expect.any(Function),
      })
    );

    render(<DashboardRoutedContent {...baseProps} view="alerts" />);

    expect(activeAlertsPanelMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        onAskAIAboutAlert: expect.any(Function),
      })
    );
    expect(alertHistoryPanelMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        onAskAIAboutAlert: expect.any(Function),
      })
    );
  });

  it('AI 어시스턴트 route에 대시보드 데이터 슬롯을 전달한다', () => {
    render(
      <DashboardRoutedContent
        {...baseProps}
        view="ai-assistant"
        dataSlotInfo={{
          hour: 7,
          slotIndex: 0,
          globalSlotIndex: 42,
          minuteOfDay: 420,
        }}
      />
    );

    expect(screen.getByTestId('ai-workspace')).toHaveAttribute(
      'data-slot-index',
      '42'
    );
    expect(aiWorkspaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        embedded: true,
        serverContextServers: servers,
        queryAsOfDataSlot: {
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        },
      })
    );
  });

  it('AI 어시스턴트 route는 외부 page scroll 대신 고정 높이 workspace를 사용한다', () => {
    render(<DashboardRoutedContent {...baseProps} view="ai-assistant" />);

    const routeFrame = screen.getByRole('main');
    const workspaceFrame = screen.getByTestId('ai-workspace').parentElement;

    expect(routeFrame).toHaveClass('overflow-hidden');
    expect(routeFrame).not.toHaveClass('overflow-y-auto');
    expect(workspaceFrame).toHaveClass(
      'flex',
      'min-h-0',
      'flex-1',
      'overflow-hidden'
    );
    expect(
      screen.queryByRole('heading', { name: 'AI 어시스턴트' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('질의, Reporter, Analyst 기능을 한 화면에서 실행')
    ).not.toBeInTheDocument();
  });
});
