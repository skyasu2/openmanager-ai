/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockEnhancedServerModal({
      server,
      onClose,
    }: {
      server?: Server;
      onClose?: () => void;
    }) {
      if (!server) return null;

      return (
        <div data-testid="enhanced-server-modal">
          <span>{server.name}</span>
          <button type="button" onClick={onClose}>
            close-modal
          </button>
        </div>
      );
    },
}));

vi.mock('@/components/dashboard/ImprovedServerCard', () => ({
  default: ({
    server,
    onClick,
  }: {
    server: Server;
    onClick?: (server: Server) => void;
  }) => (
    <button
      type="button"
      data-testid={`server-card-${server.id}`}
      onClick={() => onClick?.(server)}
    >
      {server.name}
    </button>
  ),
}));

vi.mock('@/components/dashboard/ServerDashboardPaginationControls', () => ({
  default: () => <div data-testid="pagination-controls">pagination</div>,
}));

vi.mock('@/components/dashboard/VirtualizedServerList', () => ({
  default: () => <div data-testid="virtualized-server-list">virtualized</div>,
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

describe('ServerDashboard', () => {
  it('서버 카드 클릭은 상세 모달 대신 서버 상세 route로 이동한다', () => {
    routerPush.mockClear();

    render(
      <ServerDashboard
        servers={[createServer('server-1', 'API Server')]}
        allServers={[createServer('server-1', 'API Server')]}
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

  it('initialFocusServerId가 있으면 전체 서버 목록에서 찾아 모달을 연다', async () => {
    render(
      <ServerDashboard
        servers={[createServer('server-2', 'DB Server')]}
        allServers={[
          createServer('server-1', 'API Server'),
          createServer('server-2', 'DB Server'),
        ]}
        initialFocusServerId="server-1"
        totalServers={2}
        currentPage={1}
        totalPages={2}
        pageSize={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('enhanced-server-modal')).toBeInTheDocument();
    });

    expect(screen.getByText('API Server')).toBeInTheDocument();
  });

  it('초기 포커스 모달을 닫은 뒤 같은 serverId로 다시 자동 재오픈하지 않는다', async () => {
    render(
      <ServerDashboard
        servers={[createServer('server-1', 'API Server')]}
        allServers={[createServer('server-1', 'API Server')]}
        initialFocusServerId="server-1"
        totalServers={1}
        currentPage={1}
        totalPages={1}
        pageSize={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('enhanced-server-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'close-modal' }));

    await waitFor(() => {
      expect(
        screen.queryByTestId('enhanced-server-modal')
      ).not.toBeInTheDocument();
    });
  });

  it('서버 목록은 리스트/그리드 뷰 토글을 제공하고 그리드는 2열 레이아웃으로 전환된다', () => {
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

    expect(screen.getByRole('button', { name: '리스트 보기' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('server-dashboard-list')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '그리드 보기' }));

    expect(screen.getByRole('button', { name: '그리드 보기' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('server-dashboard-grid')).toHaveClass(
      'sm:grid-cols-2'
    );
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
      screen.getAllByTestId(/^server-card-/).map((node) => node.textContent)
    ).toEqual(['DB Server', 'Cache Server', 'API Server']);

    fireEvent.change(screen.getByLabelText('서버 정렬'), {
      target: { value: 'name' },
    });

    expect(
      screen.getAllByTestId(/^server-card-/).map((node) => node.textContent)
    ).toEqual(['API Server', 'Cache Server', 'DB Server']);
  });
});
