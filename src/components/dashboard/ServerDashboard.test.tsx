/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import ServerDashboard from './ServerDashboard';
import type { DashboardTimeRange } from './types/dashboard.types';

const { routerPush, improvedServerCardMock } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  improvedServerCardMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock('@/components/dashboard/ImprovedServerCard', () => ({
  default: ({
    server,
    onClick,
    onOpenLogs,
    metricsTimeRange,
  }: {
    server: Server;
    onClick?: (server: Server) => void;
    onOpenLogs?: (server: Server) => void;
    metricsTimeRange?: DashboardTimeRange;
  }) =>
    (() => {
      improvedServerCardMock({ server, onClick, onOpenLogs, metricsTimeRange });
      return (
        <div data-testid={`server-card-${server.id}`}>
          <button
            type="button"
            aria-label={`${server.name} 상세 보기`}
            onClick={() => onClick?.(server)}
          >
            <span data-server-card-name>{server.name}</span>
          </button>
          <button
            type="button"
            aria-label={`${server.name} 로그 보기`}
            onClick={() => onOpenLogs?.(server)}
          >
            로그
          </button>
        </div>
      );
    })(),
}));

vi.mock('@/components/error/ServerCardErrorBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/utils/performance', () => ({
  usePerformanceTracking: () => ({
    getRenderCount: () => 1,
    getAverageRenderTime: () => 0,
  }),
}));

function createServer(
  id: string,
  name: string,
  overrides: Partial<Server> = {}
): Server {
  return {
    id,
    name,
    status: 'online',
    cpu: 10,
    memory: 20,
    disk: 30,
    network: 5,
    uptime: '1h',
    location: 'seoul-dc1',
    alerts: 0,
    ...overrides,
  };
}

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe('ServerDashboard', () => {
  it('서버 카드 클릭은 상세 모달 대신 서버 상세 route로 이동한다', () => {
    routerPush.mockClear();

    render(
      <ServerDashboard
        servers={[createServer('server-1', 'API Server')]}
        totalServers={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'API Server 상세 보기' })
    );

    expect(routerPush).toHaveBeenCalledWith('/dashboard/servers/server-1');
    expect(
      screen.queryByTestId('enhanced-server-modal')
    ).not.toBeInTheDocument();
  });

  it('서버 목록은 목록/그리드 보기 토글을 제공하고 그리드 보기는 와이드 화면에서 과확장을 막는다', () => {
    render(
      <ServerDashboard
        servers={[
          createServer('server-1', 'API Server'),
          createServer('server-2', 'DB Server'),
        ]}
        totalServers={2}
        currentPage={1}
        totalPages={1}
        pageSize={2}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('server-dashboard-list')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '그리드 보기' }));

    expect(screen.getByRole('button', { name: '그리드 보기' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('server-dashboard-grid').className).toContain(
      'sm:grid-cols-[repeat(auto-fill,minmax(320px,320px))]'
    );
    expect(screen.getByTestId('server-dashboard-grid').className).toContain(
      'justify-center'
    );
  });

  it('그리드 보기의 표시 개수는 xl 3열 레이아웃과 일치한다', () => {
    setViewportWidth(1280);

    render(
      <ServerDashboard
        servers={[
          createServer('server-1', 'API Server 1'),
          createServer('server-2', 'API Server 2'),
          createServer('server-3', 'API Server 3'),
          createServer('server-4', 'API Server 4'),
          createServer('server-5', 'API Server 5'),
        ]}
        totalServers={5}
        currentPage={1}
        totalPages={1}
        pageSize={5}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        initialVisibleRows={1}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '그리드 보기' }));

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(3);
    expect(screen.getByText('3/5대 서버 표시')).toBeInTheDocument();
  });

  it('개요용 서버 카드는 1줄만 먼저 보여주고 더 보기로 아래에 추가한다', () => {
    setViewportWidth(1280);

    render(
      <ServerDashboard
        servers={[
          createServer('server-1', 'API Server 1'),
          createServer('server-2', 'API Server 2'),
          createServer('server-3', 'API Server 3'),
          createServer('server-4', 'API Server 4'),
          createServer('server-5', 'API Server 5'),
        ]}
        totalServers={5}
        currentPage={1}
        totalPages={1}
        pageSize={5}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        initialVisibleRows={1}
        surface="overview"
      />
    );

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(4);
    expect(screen.getByText('상위 알림 서버 4개 표시')).toBeInTheDocument();
    expect(screen.getByText('위험도 우선')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }));

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(5);
    expect(
      screen.queryByRole('button', { name: '접기' })
    ).not.toBeInTheDocument();
  });

  it('초기 더보기 가능 상태에서는 카드 클리핑 없이 하단 fade divider를 표시한다', () => {
    setViewportWidth(1280);

    render(
      <ServerDashboard
        servers={Array.from({ length: 9 }, (_, index) =>
          createServer(`server-${index + 1}`, `API Server ${index + 1}`)
        )}
        totalServers={9}
        currentPage={1}
        totalPages={1}
        pageSize={9}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        initialVisibleRows={2}
      />
    );

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(8);
    expect(
      screen.getByTestId('server-dashboard-peek-container')
    ).not.toHaveStyle({ overflow: 'hidden' });
    expect(
      screen.getByTestId('server-dashboard-more-fade')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '그리드 보기' }));

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(6);
    expect(
      screen.getByTestId('server-dashboard-peek-container')
    ).not.toHaveStyle({ overflow: 'hidden' });
    expect(
      screen.getByTestId('server-dashboard-more-fade')
    ).toBeInTheDocument();
  });

  it('더 보기는 클리핑/접기 없이 다음 행을 추가하고 모두 표시하면 fade divider를 제거한다', () => {
    setViewportWidth(1280);

    render(
      <ServerDashboard
        servers={Array.from({ length: 9 }, (_, index) =>
          createServer(`server-${index + 1}`, `API Server ${index + 1}`)
        )}
        totalServers={9}
        currentPage={1}
        totalPages={1}
        pageSize={9}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        initialVisibleRows={2}
      />
    );

    expect(
      screen.getByTestId('server-dashboard-more-fade')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }));

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(9);
    expect(
      screen.queryByTestId('server-dashboard-more-fade')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('server-dashboard-peek-container')
    ).not.toHaveStyle({ overflow: 'hidden' });
    expect(
      screen.queryByRole('button', { name: '접기' })
    ).not.toBeInTheDocument();
  });

  it('숨길 서버가 없으면 서버 카드 peek 오버레이를 표시하지 않는다', () => {
    setViewportWidth(1280);

    render(
      <ServerDashboard
        servers={Array.from({ length: 4 }, (_, index) =>
          createServer(`server-${index + 1}`, `API Server ${index + 1}`)
        )}
        totalServers={4}
        currentPage={1}
        totalPages={1}
        pageSize={4}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        initialVisibleRows={2}
      />
    );

    expect(
      screen.queryByTestId('server-dashboard-more-fade')
    ).not.toBeInTheDocument();
  });

  it('모바일 1열에서도 서버 카드는 온전한 행 단위로 표시된다', () => {
    setViewportWidth(375);

    render(
      <ServerDashboard
        servers={Array.from({ length: 3 }, (_, index) =>
          createServer(`server-${index + 1}`, `API Server ${index + 1}`)
        )}
        totalServers={3}
        currentPage={1}
        totalPages={1}
        pageSize={3}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        initialVisibleRows={2}
      />
    );

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(2);
    expect(
      screen.getByTestId('server-dashboard-peek-container')
    ).not.toHaveStyle({ overflow: 'hidden' });
    expect(
      screen.getByTestId('server-dashboard-more-fade')
    ).toBeInTheDocument();
  });

  it('서버 표시 탭은 호스트 맵을 렌더링하고 hex node 클릭을 상세 route로 연결한다', () => {
    routerPush.mockClear();

    render(
      <ServerDashboard
        servers={[
          createServer('server-1', 'API Server 1', { cpu: 75, memory: 64 }),
          createServer('server-2', 'DB Server 1', {
            status: 'warning',
            cpu: 88,
            memory: 79,
          }),
        ]}
        totalServers={2}
        currentPage={1}
        totalPages={1}
        pageSize={2}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const viewTabs = screen.getByRole('tablist', { name: '서버 표시 방식' });

    expect(
      within(viewTabs).getByRole('tab', { name: '서버 카드' })
    ).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(within(viewTabs).getByRole('tab', { name: '호스트 맵' }));

    expect(
      within(viewTabs).getByRole('tab', { name: '호스트 맵' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('hexagonal-host-map')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^hex-host-node-/)).toHaveLength(2);
    expect(
      screen.queryByTestId('server-dashboard-list')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'API Server 1 호스트 맵 상세 보기' })
    );

    expect(routerPush).toHaveBeenCalledWith('/dashboard/servers/server-1');
  });

  it('지원 브라우저에서는 서버 표시 탭 전환을 View Transition API로 실행한다', () => {
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {};
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });

    render(
      <ServerDashboard
        servers={[createServer('server-1', 'API Server 1')]}
        totalServers={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: '호스트 맵' }));

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('hexagonal-host-map')).toBeInTheDocument();

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: undefined,
    });
  });

  it('서버 탭 더 보기는 페이지 크기를 늘려 다음 줄을 같은 화면에 붙인다', () => {
    setViewportWidth(1280);
    const onPageSizeChange = vi.fn();

    render(
      <ServerDashboard
        servers={Array.from({ length: 9 }, (_, index) =>
          createServer(`server-${index + 1}`, `API Server ${index + 1}`)
        )}
        totalServers={18}
        currentPage={1}
        totalPages={2}
        pageSize={9}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        initialVisibleRows={3}
      />
    );

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(9);

    fireEvent.click(screen.getByRole('button', { name: /모든 서버 보기/ }));

    expect(onPageSizeChange).toHaveBeenCalledWith(18);
  });

  it('로드된 서버만 더 펼칠 때는 모든 서버 보기로 과장하지 않는다', () => {
    setViewportWidth(1280);

    render(
      <ServerDashboard
        servers={Array.from({ length: 18 }, (_, index) =>
          createServer(`server-${index + 1}`, `API Server ${index + 1}`)
        )}
        totalServers={30}
        currentPage={1}
        totalPages={2}
        pageSize={18}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        initialVisibleRows={3}
      />
    );

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(12);
    expect(screen.getByRole('button', { name: /더 보기/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /모든 서버 보기/ })
    ).not.toBeInTheDocument();
  });

  it('서버 정렬 세그먼트 버튼은 선택 상태를 표시하고 native select를 렌더링하지 않는다', () => {
    render(
      <ServerDashboard
        servers={[
          createServer('server-1', 'API Server'),
          createServer('server-2', 'DB Server'),
        ]}
        totalServers={2}
        currentPage={1}
        totalPages={1}
        pageSize={2}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const sortGroup = screen.getByRole('group', { name: '서버 정렬' });

    expect(
      within(sortGroup).getByRole('button', { name: '상태 정렬' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(sortGroup).getByRole('button', { name: 'CPU 정렬' })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(sortGroup).getByRole('button', { name: 'MEM 정렬' })
    ).toBeInTheDocument();
    expect(
      within(sortGroup).getByRole('button', { name: '이름 정렬' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: '서버 정렬' })
    ).not.toBeInTheDocument();
  });

  it('서버 정렬 세그먼트 버튼으로 CPU, 메모리, 이름 기준 순서를 바꿀 수 있다', () => {
    render(
      <ServerDashboard
        servers={[
          createServer('server-1', 'API Server', { cpu: 20, memory: 80 }),
          createServer('server-2', 'DB Server', { cpu: 91, memory: 35 }),
          createServer('server-3', 'Cache Server', { cpu: 54, memory: 70 }),
        ]}
        totalServers={3}
        currentPage={1}
        totalPages={1}
        pageSize={3}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'CPU 정렬' }));

    expect(
      screen
        .getAllByTestId(/^server-card-/)
        .map(
          (node) => node.querySelector('[data-server-card-name]')?.textContent
        )
    ).toEqual(['DB Server', 'Cache Server', 'API Server']);

    expect(screen.getByRole('button', { name: 'CPU 정렬' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: '이름 정렬' }));

    expect(
      screen
        .getAllByTestId(/^server-card-/)
        .map(
          (node) => node.querySelector('[data-server-card-name]')?.textContent
        )
    ).toEqual(['API Server', 'Cache Server', 'DB Server']);
  });

  it('서버 검색은 이름, ID, 위치, IP로 목록을 필터링하고 지우면 전체를 복구한다', () => {
    render(
      <ServerDashboard
        servers={[
          createServer('api-was-dc1-01', 'API Server', {
            location: 'Seoul DC1',
            ip: '10.0.1.10',
          }),
          createServer('db-postgres-dc2-01', 'Postgres DB', {
            location: 'Busan DC2',
            ip: '10.0.2.20',
          }),
          createServer('cache-redis-dc1-01', 'Redis Cache', {
            location: 'Seoul DC1',
            ip: '10.0.3.30',
          }),
        ]}
        totalServers={3}
        currentPage={1}
        totalPages={1}
        pageSize={3}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const searchInput = screen.getByLabelText('서버 검색');

    fireEvent.change(searchInput, { target: { value: 'postgres' } });
    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(1);
    expect(screen.getByText('Postgres DB')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'cache-redis' } });
    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(1);
    expect(screen.getByText('Redis Cache')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Seoul DC1' } });
    expect(
      screen
        .getAllByTestId(/^server-card-/)
        .map(
          (node) => node.querySelector('[data-server-card-name]')?.textContent
        )
    ).toEqual(['API Server', 'Redis Cache']);

    fireEvent.change(searchInput, { target: { value: '10.0.2.20' } });
    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(1);
    expect(screen.getByText('Postgres DB')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(3);
  });

  it('서버 검색 결과가 없으면 일반 no-data와 다른 empty state를 표시한다', () => {
    render(
      <ServerDashboard
        servers={[
          createServer('server-1', 'API Server'),
          createServer('server-2', 'DB Server'),
        ]}
        totalServers={2}
        currentPage={1}
        totalPages={1}
        pageSize={2}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('서버 검색'), {
      target: { value: 'not-found' },
    });

    expect(screen.queryAllByTestId(/^server-card-/)).toHaveLength(0);
    expect(screen.getByText('검색 결과 없음')).toBeInTheDocument();
    expect(screen.queryByText('서버 정보 없음')).not.toBeInTheDocument();
  });

  it('서버 검색 결과에도 기존 정렬 기준을 적용한다', () => {
    render(
      <ServerDashboard
        servers={[
          createServer('server-1', 'Seoul API', {
            cpu: 20,
            location: 'Seoul DC1',
          }),
          createServer('server-2', 'Seoul DB', {
            cpu: 91,
            location: 'Seoul DC1',
          }),
          createServer('server-3', 'Busan Cache', {
            cpu: 54,
            location: 'Busan DC2',
          }),
        ]}
        totalServers={3}
        currentPage={1}
        totalPages={1}
        pageSize={3}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('서버 검색'), {
      target: { value: 'Seoul' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'CPU 정렬' }));

    expect(
      screen
        .getAllByTestId(/^server-card-/)
        .map(
          (node) => node.querySelector('[data-server-card-name]')?.textContent
        )
    ).toEqual(['Seoul DB', 'Seoul API']);
  });

  it('페이지네이션된 일부 서버가 아니라 전체 표시 대상 기준으로 상태 우선 정렬한다', () => {
    render(
      <ServerDashboard
        servers={[
          createServer('online-1', 'Online 1', { status: 'online' }),
          createServer('online-2', 'Online 2', { status: 'online' }),
        ]}
        allServers={[
          createServer('online-1', 'Online 1', { status: 'online' }),
          createServer('online-2', 'Online 2', { status: 'online' }),
          createServer('warning-1', 'Warning 1', { status: 'warning' }),
          createServer('critical-1', 'Critical 1', { status: 'critical' }),
        ]}
        totalServers={4}
        currentPage={1}
        totalPages={2}
        pageSize={2}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(
      screen
        .getAllByTestId(/^server-card-/)
        .map(
          (node) => node.querySelector('[data-server-card-name]')?.textContent
        )
    ).toEqual(['Critical 1', 'Warning 1', 'Online 1', 'Online 2']);
    expect(
      screen.queryByRole('button', { name: /0대 남음/ })
    ).not.toBeInTheDocument();
  });

  it('서버 카드의 로그 버튼은 서버 필터가 포함된 로그 페이지로 이동한다', () => {
    routerPush.mockClear();

    render(
      <ServerDashboard
        servers={[createServer('server-1', 'API Server')]}
        totalServers={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'API Server 로그 보기' })
    );

    expect(routerPush).toHaveBeenCalledWith('/dashboard/logs?server=server-1');
  });

  it('선택된 스파크라인 시간 범위를 서버 카드에 전달한다', () => {
    improvedServerCardMock.mockClear();

    render(
      <ServerDashboard
        servers={[createServer('server-1', 'API Server')]}
        totalServers={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        metricsTimeRange="12h"
      />
    );

    expect(improvedServerCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metricsTimeRange: '12h',
      })
    );
  });
});
