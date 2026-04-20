/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import ServerDashboard from './ServerDashboard';

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
    <button type="button" onClick={() => onClick?.(server)}>
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

function createServer(id: string, name: string): Server {
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
  };
}

describe('ServerDashboard', () => {
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
});
