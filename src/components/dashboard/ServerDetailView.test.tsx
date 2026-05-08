/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import ServerDetailView from './ServerDetailView';

const serverMetricsMock = vi.hoisted(() => ({
  metricsHistory: [] as Array<{
    timestamp: string;
    cpu: number;
    memory: number;
    disk: number;
    network?: number;
  }>,
  loadMetricsHistory: vi.fn(),
}));

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
    metricsHistory: serverMetricsMock.metricsHistory,
    loadMetricsHistory: serverMetricsMock.loadMetricsHistory,
  }),
}));

vi.mock('./EnhancedServerModal.OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab" />,
}));

vi.mock('./EnhancedServerModal.MetricsTab', () => ({
  MetricsTab: ({
    realtimeData,
  }: {
    realtimeData: {
      cpu: number[];
      memory: number[];
      disk: number[];
      network: number[];
    };
  }) => (
    <div data-testid="metrics-tab">
      <span data-testid="metrics-latest">
        {[
          realtimeData.cpu.at(-1),
          realtimeData.memory.at(-1),
          realtimeData.disk.at(-1),
          realtimeData.network.at(-1),
        ].join('/')}
      </span>
    </div>
  ),
}));

vi.mock('./EnhancedServerModal.ProcessesTab', () => ({
  ProcessesTab: () => <div data-testid="processes-tab" />,
}));

vi.mock('./EnhancedServerModal.LogsTab', () => ({
  LogsTab: ({
    serverMetrics,
  }: {
    serverMetrics: {
      cpu: number;
      memory: number;
      disk: number;
      network: number;
    };
  }) => (
    <div data-testid="logs-tab">
      <span data-testid="logs-metrics">
        {[
          serverMetrics.cpu,
          serverMetrics.memory,
          serverMetrics.disk,
          serverMetrics.network,
        ].join('/')}
      </span>
    </div>
  ),
}));

vi.mock('./EnhancedServerModal.NetworkTab', () => ({
  NetworkTab: ({
    realtimeData,
  }: {
    realtimeData: {
      network: number[];
    };
  }) => (
    <div data-testid="network-tab">
      <span data-testid="network-latest">{realtimeData.network.at(-1)}</span>
    </div>
  ),
}));

vi.mock('./ServerModalTabNav', () => ({
  ServerModalTabNav: ({
    tabs,
    onTabSelect,
  }: {
    tabs: Array<{ id: string; label: string }>;
    onTabSelect: (id: 'overview' | 'metrics' | 'logs') => void;
  }) => (
    <div data-testid="server-modal-tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabSelect(tab.id as 'overview' | 'metrics' | 'logs')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
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
    serverMetricsMock.metricsHistory = [];
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

  it('warning 서버 상세 헤더는 상태 배지와 AI 질문 버튼을 제공한다', () => {
    const onAskAI = vi.fn();

    render(
      <ServerDetailView
        server={{ ...baseServer, status: 'warning' }}
        onAskAI={onAskAI}
      />
    );

    expect(screen.getByText('주의')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'AI에게 물어보기' }));

    expect(onAskAI).toHaveBeenCalledWith(
      expect.objectContaining({ id: baseServer.id })
    );
  });

  it('overview 탭은 별도 핵심 성능 지표 그리드를 반복 렌더링하지 않는다', () => {
    render(<ServerDetailView server={baseServer} />);

    expect(screen.queryByText('핵심 성능 지표')).not.toBeInTheDocument();
  });

  it('히스토리 tail이 stale이어도 성능/로그/네트워크 탭은 current slot 값을 사용한다', () => {
    serverMetricsMock.metricsHistory = [
      {
        timestamp: '2026-05-05T00:00:00Z',
        cpu: 43,
        memory: 57,
        disk: 35,
        network: 25,
      },
    ];

    render(
      <ServerDetailView
        server={{
          ...baseServer,
          cpu: 84,
          memory: 71,
          disk: 31,
          network: 20,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '성능 분석' }));
    expect(screen.getByTestId('metrics-latest')).toHaveTextContent(
      '84/71/31/20'
    );

    fireEvent.click(screen.getByRole('button', { name: '로그 & 네트워크' }));
    expect(screen.getByTestId('logs-metrics')).toHaveTextContent('84/71/31/20');
    expect(screen.getByTestId('network-latest')).toHaveTextContent('20');
  });
});
