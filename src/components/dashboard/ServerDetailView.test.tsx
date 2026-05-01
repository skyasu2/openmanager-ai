/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import ServerDetailView from './ServerDetailView';

vi.mock('lucide-react', () => {
  const MockIcon = () => <svg aria-hidden="true" />;

  return {
    Activity: MockIcon,
    ArrowLeft: MockIcon,
    BarChart3: MockIcon,
    Cpu: MockIcon,
    FileText: MockIcon,
    Network: MockIcon,
  };
});

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/useServerMetrics', () => ({
  useServerMetrics: () => ({
    metricsHistory: [],
    loadMetricsHistory: vi.fn(),
  }),
}));

vi.mock('./EnhancedServerModal.OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab" />,
}));

vi.mock('./EnhancedServerModal.MetricsTab', () => ({
  MetricsTab: () => <div data-testid="metrics-tab" />,
}));

vi.mock('./EnhancedServerModal.ProcessesTab', () => ({
  ProcessesTab: () => <div data-testid="processes-tab" />,
}));

vi.mock('./EnhancedServerModal.LogsTab', () => ({
  LogsTab: () => <div data-testid="logs-tab" />,
}));

vi.mock('./EnhancedServerModal.NetworkTab', () => ({
  NetworkTab: () => <div data-testid="network-tab" />,
}));

vi.mock('./ServerModalTabNav', () => ({
  ServerModalTabNav: () => <div data-testid="server-modal-tab-nav" />,
}));

const baseServer: Server = {
  id: 'api-was-dc1-01',
  name: 'api-was-dc1-01',
  status: 'warning',
  cpu: 82,
  memory: 64,
  disk: 70,
  network: 20,
  uptime: '24h',
  location: 'DC1-AZ1',
};

describe('ServerDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('서버 type=application을 사람이 읽기 쉬운 레이블로 표시한다', () => {
    render(
      <ServerDetailView server={{ ...baseServer, type: 'application' }} />
    );

    expect(screen.getByText('Application · DC1-AZ1')).toBeInTheDocument();
  });

  it('type이 비어 있어도 api-was 서버는 Application으로 표시한다', () => {
    render(<ServerDetailView server={{ ...baseServer, type: undefined }} />);

    expect(screen.getByText('Application · DC1-AZ1')).toBeInTheDocument();
    expect(screen.queryByText('unknown · DC1-AZ1')).not.toBeInTheDocument();
  });

  it('type이 unknown이어도 api-was 서버는 Application으로 표시한다', () => {
    render(
      <ServerDetailView
        server={{ ...baseServer, type: 'unknown' as Server['type'] }}
      />
    );

    expect(screen.getByText('Application · DC1-AZ1')).toBeInTheDocument();
    expect(screen.queryByText('unknown · DC1-AZ1')).not.toBeInTheDocument();
  });
});
