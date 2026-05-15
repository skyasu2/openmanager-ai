/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import ServerDashboard from './ServerDashboard';

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
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
  }: {
    server: Server;
    onClick?: (server: Server) => void;
    onOpenLogs?: (server: Server) => void;
  }) => (
    <div data-testid={`server-card-${server.id}`}>
      <button type="button" onClick={() => onClick?.(server)}>
        {server.name}
      </button>
      <button
        type="button"
        aria-label={`${server.name} 로그 보기`}
        onClick={() => onOpenLogs?.(server)}
      >
        로그
      </button>
    </div>
  ),
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

    fireEvent.click(screen.getByRole('button', { name: 'API Server' }));

    expect(routerPush).toHaveBeenCalledWith('/dashboard/servers/server-1');
    expect(
      screen.queryByTestId('enhanced-server-modal')
    ).not.toBeInTheDocument();
  });

  it('서버 목록은 촘촘히/넓게 보기 토글을 제공하고 넓게 보기는 와이드 화면에서 과확장을 막는다', () => {
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

    expect(screen.getByRole('button', { name: '촘촘히 보기' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('server-dashboard-list')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '넓게 보기' }));

    expect(screen.getByRole('button', { name: '넓게 보기' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('server-dashboard-grid')).toHaveClass(
      'sm:grid-cols-2'
    );
    expect(screen.getByTestId('server-dashboard-grid')).toHaveClass(
      'xl:grid-cols-3'
    );
    expect(screen.getByTestId('server-dashboard-grid')).toHaveClass(
      '3xl:grid-cols-4'
    );
  });

  it('넓게 보기의 표시 개수는 xl 3열 레이아웃과 일치한다', () => {
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

    fireEvent.click(screen.getByRole('button', { name: '넓게 보기' }));

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

    fireEvent.click(screen.getByRole('button', { name: '접기' }));

    expect(screen.getAllByTestId(/^server-card-/)).toHaveLength(4);
  });

  it('초기 더보기 가능 상태에서는 서버 그리드를 1.5행 높이로 클리핑하고 페이드 힌트를 표시한다', () => {
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
    expect(screen.getByTestId('server-dashboard-peek-container')).toHaveStyle({
      maxHeight: '237px',
    });
    expect(
      screen.getByTestId('server-dashboard-peek-fade')
    ).toBeInTheDocument();
  });

  it('더 보기와 접기 전환에 맞춰 서버 카드 peek 페이드를 숨기고 복원한다', () => {
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
      screen.getByTestId('server-dashboard-peek-fade')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }));

    expect(
      screen.queryByTestId('server-dashboard-peek-fade')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('server-dashboard-peek-container')
    ).not.toHaveStyle({
      maxHeight: '237px',
    });

    fireEvent.click(screen.getByRole('button', { name: '접기' }));

    expect(
      screen.getByTestId('server-dashboard-peek-fade')
    ).toBeInTheDocument();
    expect(screen.getByTestId('server-dashboard-peek-container')).toHaveStyle({
      maxHeight: '237px',
    });
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
      screen.queryByTestId('server-dashboard-peek-fade')
    ).not.toBeInTheDocument();
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

  it('서버 정렬 셀렉트로 CPU, 메모리, 이름 기준 순서를 바꿀 수 있다', () => {
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

    fireEvent.change(screen.getByLabelText('서버 정렬'), {
      target: { value: 'cpu' },
    });

    expect(
      screen
        .getAllByTestId(/^server-card-/)
        .map((node) => node.querySelector('button')?.textContent)
    ).toEqual(['DB Server', 'Cache Server', 'API Server']);

    fireEvent.change(screen.getByLabelText('서버 정렬'), {
      target: { value: 'name' },
    });

    expect(
      screen
        .getAllByTestId(/^server-card-/)
        .map((node) => node.querySelector('button')?.textContent)
    ).toEqual(['API Server', 'Cache Server', 'DB Server']);
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
});
