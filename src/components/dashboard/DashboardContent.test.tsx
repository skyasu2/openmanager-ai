/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardStats } from '@/hooks/dashboard/useDashboardStats';
import type { Server } from '@/types/server';
import { toDashboardAlertContext } from './alert-ai-context';
import DashboardContent from './DashboardContent';

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock('next/dynamic', async () => {
  const React = await import('react');

  return {
    default: (
      loader: () =>
        | Promise<{
            default?: React.ComponentType<Record<string, unknown>>;
          }>
        | Promise<React.ComponentType<Record<string, unknown>>>,
      options?: { loading?: () => React.ReactNode }
    ) => {
      return function MockDynamicComponent(props: Record<string, unknown>) {
        const [LoadedComponent, setLoadedComponent] =
          React.useState<React.ComponentType<Record<string, unknown>> | null>(
            null
          );

        React.useEffect(() => {
          let isMounted = true;

          void loader().then((loadedModuleOrComponent) => {
            if (!isMounted) {
              return;
            }

            const resolvedComponent =
              typeof loadedModuleOrComponent === 'function'
                ? loadedModuleOrComponent
                : (loadedModuleOrComponent.default ?? null);

            setLoadedComponent(() => resolvedComponent);
          });

          return () => {
            isMounted = false;
          };
        }, []);

        if (!LoadedComponent) {
          return (
            options?.loading?.() ?? <div data-testid="dynamic-component" />
          );
        }

        return <LoadedComponent {...props} />;
      };
    },
  };
});

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
      onOpenAlertHistory,
      onOpenLogExplorer,
    }: {
      onOpenAlertHistory?: () => void;
      onOpenLogExplorer?: () => void;
    }) => (
      <div data-testid="dashboard-summary">
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
      </div>
    )
  ),
}));

vi.mock('./SystemOverviewSection', () => ({
  SystemOverviewSection: vi.fn(() => <div data-testid="system-overview" />),
}));

vi.mock('./ServerDashboard', () => ({
  default: vi.fn(({ onAskAI }: { onAskAI?: (server: Server) => void }) => (
    <div data-testid="server-dashboard">
      {onAskAI && (
        <button
          type="button"
          aria-label="ask ai about server"
          onClick={() =>
            onAskAI({
              id: 's1',
              name: 'server-1',
              status: 'warning',
              cpu: 81,
              memory: 64,
              disk: 77,
            } as Server)
          }
        >
          ask ai
        </button>
      )}
    </div>
  )),
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

const mockedUseDashboardStats = vi.mocked(useDashboardStats);

beforeEach(() => {
  routerPush.mockClear();
  mockedUseDashboardStats.mockReturnValue({
    total: 15,
    online: 15,
    offline: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
  });
});

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

  it('빈 결과셋에서도 0 통계를 부모로 전달해야 한다', () => {
    const onStatsUpdate = vi.fn();

    mockedUseDashboardStats.mockReturnValue({
      total: 0,
      online: 0,
      offline: 0,
      warning: 0,
      critical: 0,
      unknown: 0,
    });

    render(
      <DashboardContent
        {...createProps({
          onStatsUpdate,
        })}
      />
    );

    expect(onStatsUpdate).toHaveBeenCalledWith({
      total: 0,
      online: 0,
      offline: 0,
      warning: 0,
      critical: 0,
      unknown: 0,
    });
  });

  it('요약 액션은 모달 상태 대신 대시보드 route navigation으로 연결한다', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'open alert history' }));
    expect(routerPush).toHaveBeenCalledWith('/dashboard/alerts');

    fireEvent.click(screen.getByRole('button', { name: 'open log explorer' }));
    expect(routerPush).toHaveBeenCalledWith('/dashboard/logs');
  });

  it('서버 카드 AI 요청을 최고 사용률 메트릭으로 변환해 브리지해야 한다', async () => {
    const onAskAIAboutAlert = vi.fn();

    render(
      <DashboardContent
        {...createProps({
          servers: [
            { id: 's1', name: 'server-1', status: 'warning' } as Server,
          ],
          allServers: [
            { id: 's1', name: 'server-1', status: 'warning' } as Server,
          ],
          totalServers: 1,
          onAskAIAboutAlert,
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('server-dashboard')).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'ask ai about server' })
    );

    expect(onAskAIAboutAlert).toHaveBeenCalledWith({
      serverId: 's1',
      serverName: 'server-1',
      metricLabel: 'CPU',
      metricValue: 81,
    });
  });

  it('활성 알림을 DashboardAlertContext로 정규화해야 한다', () => {
    expect(
      toDashboardAlertContext({
        serverId: 's1',
        instance: 'server-1',
        metric: 'memory',
        value: 78.2,
      })
    ).toEqual({
      serverId: 's1',
      serverName: 'server-1',
      metricLabel: 'MEM',
      metricValue: 78,
    });

    expect(
      toDashboardAlertContext({
        serverId: 's2',
        instance: 'server-2',
        metric: 'network',
        value: 82,
      })
    ).toBeNull();
  });

  it('resolved 알림 이력은 재발 방지 promptOverride로 정규화해야 한다', () => {
    expect(
      toDashboardAlertContext({
        serverId: 's3',
        instance: 'server-3',
        metric: 'disk',
        value: 91.4,
        state: 'resolved',
      })
    ).toEqual(
      expect.objectContaining({
        serverId: 's3',
        serverName: 'server-3',
        metricLabel: 'DISK',
        metricValue: 91,
        promptOverride: expect.stringContaining('해소된 알림 이력'),
      })
    );
  });
});
