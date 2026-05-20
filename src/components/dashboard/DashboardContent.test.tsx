/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardStats } from '@/hooks/dashboard/useDashboardStats';
import type { Server } from '@/types/server';
import DashboardContent from './DashboardContent';
import { SystemOverviewSection } from './SystemOverviewSection';

const { routerPush, serverDashboardMock } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  serverDashboardMock: vi.fn(),
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
  default: (props: Record<string, unknown>) => {
    serverDashboardMock(props);
    return <div data-testid="server-dashboard" />;
  },
}));

const mockedUseDashboardStats = vi.mocked(useDashboardStats);
const mockedSystemOverviewSection = vi.mocked(SystemOverviewSection);

beforeEach(() => {
  routerPush.mockClear();
  serverDashboardMock.mockClear();
  mockedSystemOverviewSection.mockClear();
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

  it('개요 서버 목록은 기본 2줄 밀도로 표시한다', async () => {
    render(
      <DashboardContent
        {...createProps({
          servers: [{ id: 's1', name: 'server-1', status: 'online' } as Server],
          allServers: [
            { id: 's1', name: 'server-1', status: 'online' } as Server,
          ],
          totalServers: 18,
        })}
      />
    );

    await waitFor(() => {
      expect(serverDashboardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          initialVisibleRows: 2,
          surface: 'overview',
        })
      );
    });
  });

  it('시스템 리소스 평균은 현재 페이지가 아니라 전체 서버 목록 기준으로 표시한다', () => {
    const visibleServers = [
      {
        id: 'page-1',
        name: 'page-server-1',
        status: 'online',
        cpu: 90,
        memory: 90,
        disk: 90,
      } as Server,
    ];
    const allServers = [
      ...visibleServers,
      {
        id: 'page-2',
        name: 'page-server-2',
        status: 'online',
        cpu: 10,
        memory: 10,
        disk: 10,
      } as Server,
    ];

    render(
      <DashboardContent
        {...createProps({
          servers: visibleServers,
          allServers,
          totalServers: allServers.length,
        })}
      />
    );

    expect(mockedSystemOverviewSection).toHaveBeenCalledWith(
      expect.objectContaining({
        servers: allServers,
      }),
      undefined
    );
  });

  it('서버 카드는 필터가 반영된 전체 목록을 기준으로 정렬할 수 있게 전달한다', async () => {
    const visibleServers = [
      { id: 'warning-1', name: 'warning-1', status: 'warning' } as Server,
    ];
    const allServers = [
      { id: 'online-1', name: 'online-1', status: 'online' } as Server,
      ...visibleServers,
    ];

    render(
      <DashboardContent
        {...createProps({
          servers: visibleServers,
          allServers,
          displayServers: visibleServers,
          totalServers: visibleServers.length,
        })}
      />
    );

    await waitFor(() => {
      expect(serverDashboardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          allServers: visibleServers,
        })
      );
    });
  });

  it('서버 카드에는 AI prefill 핸들러를 전달하지 않는다', async () => {
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
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('server-dashboard')).toBeInTheDocument();
    });
    expect(serverDashboardMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        onAskAI: expect.any(Function),
      })
    );
  });
});
