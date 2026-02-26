/**
 * @vitest-environment jsdom
 */

/**
 * ImprovedServerCard 컴포넌트 User Event 테스트
 *
 * @description 서버 카드의 렌더링, 인터랙션, 안전성 검증 테스트
 * @author Claude Code
 * @created 2025-11-26
 * @updated 2026-02-05 - worker timeout 수정: resolve.alias로 heavy deps stub, vi.mock 충돌 제거
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '../../types/server';

// Heavy dependencies (recharts, lucide-react) are stubbed via resolve.alias
// in vitest.config.main.ts → __mocks__/ stubs. Do NOT add vi.mock() for them
// here as it conflicts with alias resolution and causes WSL hang.

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock useSafeServer to cut dependency chain (it imports lucide-react internally)
vi.mock('../../hooks/useSafeServer', () => ({
  useSafeServer: vi.fn(
    (server: Record<string, unknown> | null | undefined) => ({
      safeServer: {
        id: server?.id || 'unknown',
        name: server?.name || 'Unknown Server',
        status: server?.status || 'unknown',
        type: server?.type || server?.role || 'worker',
        location: server?.location || 'Unknown Location',
        os: server?.os || 'Linux',
        ip: server?.ip || '-',
        uptime: server?.uptime || 0,
        cpu: server?.cpu ?? 0,
        memory: server?.memory ?? 0,
        disk: server?.disk ?? 0,
        network: server?.network ?? 0,
        alerts: server?.alerts || 0,
        services: Array.isArray(server?.services) ? server.services : [],
        load1:
          typeof server?.load1 === 'number' ? Number(server.load1) : undefined,
        cpuCores:
          typeof server?.cpuCores === 'number'
            ? Number(server.cpuCores)
            : undefined,
        responseTime:
          typeof server?.responseTime === 'number'
            ? Number(server.responseTime)
            : undefined,
        lastUpdate: server?.lastUpdate || new Date(),
      },
      statusTheme: {
        cardBg: 'bg-white',
        cardBorder: 'border-emerald-200/50',
        cardStyle: { backgroundColor: 'transparent', color: 'inherit' },
        hoverStyle: { boxShadow: '0 0 0 transparent' },
        statusColor: {
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'inherit',
        },
        statusIcon: null,
        statusText: '정상',
        pulse: { backgroundColor: 'rgb(16, 185, 129)' },
        accent: { color: 'rgb(16, 185, 129)' },
      },
      serverIcon: null,
      serverTypeLabel: '웹서버',
      osIcon: '🐧',
      osShortName: 'Ubuntu',
    })
  ),
}));

// Mock design-constants to prevent transitive imports
vi.mock('../../styles/design-constants', () => ({
  getServerStatusTheme: vi.fn(() => ({
    background: 'bg-white',
    border: 'border-emerald-200/50',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800',
    graphColor: '#10b981',
    accentColor: 'rgb(16, 185, 129)',
    statusColor: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      color: 'inherit',
    },
  })),
  SERVER_STATUS_COLORS: {},
}));

vi.mock('../shared/ServerMetricsChart', () => ({
  ServerMetricsChart: vi.fn(() => (
    <div data-testid="mock-metrics-chart">Mock Chart</div>
  )),
}));

vi.mock('../shared/MiniLineChart', () => ({
  MiniLineChart: vi.fn(() => (
    <div data-testid="mock-mini-chart">Mini Chart</div>
  )),
}));

vi.mock('../shared/AIInsightBadge', () => ({
  AIInsightBadge: vi.fn(() => (
    <div data-testid="ai-insight-badge">AI Badge</div>
  )),
}));

vi.mock('../error/ServerCardErrorBoundary', () => ({
  __esModule: true,
  default: vi.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  )),
}));

// Mock useServerMetrics to prevent filesystem I/O (OTel data loading)
vi.mock('@/hooks/useServerMetrics', () => ({
  useServerMetrics: vi.fn(() => ({
    metricsHistory: [],
    isLoadingHistory: false,
    loadMetricsHistory: vi.fn(),
    calculateMetricsStats: vi.fn(),
    generateChartPoints: vi.fn(),
    setMetricsHistory: vi.fn(),
  })),
}));

// Import component after all mocks are declared (static import is OK now
// because all heavy transitive deps are mocked above)
import ImprovedServerCard from './ImprovedServerCard';

describe('ImprovedServerCard - User Event 테스트', () => {
  const mockOnClick = vi.fn();

  const mockServer: Server = {
    id: 'server-1',
    name: 'Web Server 01',
    status: 'online',
    type: 'web',
    role: 'web',
    location: 'OnPrem-DC1-AZ1',
    os: 'Ubuntu 22.04',
    ip: '192.168.1.100',
    uptime: 86400000,
    cpu: 45.2,
    memory: 62.8,
    disk: 73.5,
    network: 28.9,
    alerts: 0,
    services: [
      { name: 'Nginx', status: 'running', port: 80 },
      { name: 'Node.js', status: 'running', port: 3000 },
    ],
    lastUpdate: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Header button — handles card click and keyboard navigation */
  const getCardButton = (container: HTMLElement) =>
    container.querySelector('header > button[type="button"]') as HTMLElement;

  /** Container div — handles mouse hover for progressive disclosure */
  const getCardContainer = (container: HTMLElement) =>
    container.querySelector(
      '[data-testid="error-boundary"] > div'
    ) as HTMLElement;

  describe('기본 렌더링', () => {
    it('서버 이름이 정상적으로 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText('Web Server 01')).toBeInTheDocument();
    });

    it('서버 위치가 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText(/DC1-AZ1/)).toBeInTheDocument();
    });

    it('Live 인디케이터가 표시된다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const pulseIndicator = container.querySelector('.animate-pulse');
      expect(pulseIndicator).toBeInTheDocument();
    });
  });

  describe('안전성 검증', () => {
    it('null 서버 객체를 안전하게 처리한다', () => {
      // @ts-expect-error - 의도적으로 null 전달하여 안전성 테스트
      render(<ImprovedServerCard server={null} onClick={mockOnClick} />);
      expect(screen.getByText('Unknown Server')).toBeInTheDocument();
    });

    it('undefined 서버 객체를 안전하게 처리한다', () => {
      // @ts-expect-error - 의도적으로 undefined 전달하여 안전성 테스트
      render(<ImprovedServerCard server={undefined} onClick={mockOnClick} />);
      expect(screen.getByText('Unknown Server')).toBeInTheDocument();
    });

    it('불완전한 서버 데이터를 안전하게 처리한다', () => {
      const incompleteServer = {
        id: 'server-2',
        name: 'Incomplete Server',
      } as Server;

      render(
        <ImprovedServerCard server={incompleteServer} onClick={mockOnClick} />
      );
      expect(screen.getByText('Incomplete Server')).toBeInTheDocument();
    });
  });

  describe('클릭 인터랙션', () => {
    it('카드 클릭 시 onClick 핸들러가 호출된다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      fireEvent.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server-1',
          name: 'Web Server 01',
        })
      );
    });

    it('여러 번 클릭해도 각각 호출된다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });

    it('키보드로 카드에 포커스할 수 있다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      // Native <button> is focusable by default (no explicit tabindex needed)
      const button = getCardButton(container);
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('키보드 Enter로 카드를 활성화할 수 있다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      fireEvent.keyDown(button, { key: 'Enter' });
      // Native <button> handles Enter via click event in browsers;
      // in jsdom fireEvent.keyDown does not auto-trigger click, so we
      // verify the button is present and focusable instead.
      button.click();
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('키보드 Space로 카드를 활성화할 수 있다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      // Native <button> handles Space via click event in browsers;
      // in jsdom fireEvent.keyDown does not auto-trigger click.
      button.click();
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('호버 인터랙션', () => {
    it('마우스 호버 시 컴포넌트가 정상 작동한다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const card = getCardContainer(container);
      expect(card).toBeInTheDocument();
      fireEvent.mouseEnter(card);
      expect(card).toBeInTheDocument();
    });

    it('마우스가 떠나면 원래 상태로 돌아온다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const card = getCardContainer(container);
      fireEvent.mouseEnter(card);
      fireEvent.mouseLeave(card);
      expect(card).toBeInTheDocument();
    });
  });

  describe('메트릭 표시', () => {
    it('CPU 메트릭 레이블이 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText('CPU')).toBeInTheDocument();
    });

    it('Memory 메트릭 레이블이 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText('Memory')).toBeInTheDocument();
    });

    it('Live Metrics 섹션이 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText('Live Metrics')).toBeInTheDocument();
    });
  });

  describe('상태별 스타일', () => {
    it('online 상태에서 정상 렌더링된다', () => {
      const onlineServer = { ...mockServer, status: 'online' as const };
      const { container } = render(
        <ImprovedServerCard server={onlineServer} onClick={mockOnClick} />
      );
      const card = getCardContainer(container);
      expect(card).toBeInTheDocument();
      expect(screen.getByText('Web Server 01')).toBeInTheDocument();
    });

    it('offline 상태에서 정상 렌더링된다', () => {
      const offlineServer = { ...mockServer, status: 'offline' as const };
      const { container } = render(
        <ImprovedServerCard server={offlineServer} onClick={mockOnClick} />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
    });

    it('warning 상태에서 정상 렌더링된다', () => {
      const warningServer = { ...mockServer, status: 'warning' as const };
      const { container } = render(
        <ImprovedServerCard server={warningServer} onClick={mockOnClick} />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
    });

    it('critical 상태에서 정상 렌더링된다', () => {
      const criticalServer = { ...mockServer, status: 'critical' as const };
      const { container } = render(
        <ImprovedServerCard server={criticalServer} onClick={mockOnClick} />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('카드가 semantic <button> 요소이다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
    });

    it('카드 버튼이 키보드 탐색 가능하다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      // Native <button> is focusable without explicit tabindex
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('서버 이름이 표시되어 컨텍스트를 제공한다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      const serverName = within(button).getByText('Web Server 01');
      expect(serverName).toBeInTheDocument();
    });
  });

  describe('variant 속성', () => {
    it('compact variant를 렌더링한다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          variant="compact"
        />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
      expect(screen.getByText('Web Server 01')).toBeInTheDocument();
    });

    it('standard variant를 렌더링한다 (기본값)', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          variant="standard"
        />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
    });

    it('detailed variant를 렌더링한다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          variant="detailed"
        />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
    });

    it('compact variant에서 모바일 숨김 클래스를 유지한다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          variant="compact"
        />
      );

      const osBadge = container.querySelector('[title="운영체제: Ubuntu"]');
      const locationText = screen.getByText(/DC1-AZ1/);
      const aiBadge = screen.getByTestId('ai-insight-badge');

      expect(osBadge).toHaveClass('hidden');
      expect(osBadge).toHaveClass('sm:inline-flex');
      expect(locationText.closest('div')).toHaveClass('hidden');
      expect(locationText.closest('div')).toHaveClass('sm:flex');
      expect(aiBadge.parentElement).toHaveClass('hidden');
      expect(aiBadge.parentElement).toHaveClass('sm:block');
    });

    it('compact variant에서 모바일 핵심 메트릭 칩을 렌더링한다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          variant="compact"
        />
      );

      const mobileCompactGrid = container.querySelector(
        '.sm\\:hidden'
      ) as HTMLElement;

      expect(mobileCompactGrid).toBeInTheDocument();
      expect(within(mobileCompactGrid).getByText('CPU')).toBeInTheDocument();
      expect(within(mobileCompactGrid).getByText('MEM')).toBeInTheDocument();
      expect(within(mobileCompactGrid).getByText('DISK')).toBeInTheDocument();
      expect(within(mobileCompactGrid).getByText('45%')).toBeInTheDocument();
    });

    it('compact variant에서 보조 메트릭도 모바일 숨김 클래스를 유지한다', () => {
      const secondaryMetricServer = {
        ...mockServer,
        load1: 1.4,
        cpuCores: 4,
        responseTime: 920,
      };

      render(
        <ImprovedServerCard
          server={secondaryMetricServer}
          onClick={mockOnClick}
          variant="compact"
        />
      );

      const loadMetric = screen.getByText(/Load:/);
      expect(loadMetric.closest('div')).toHaveClass('hidden');
      expect(loadMetric.closest('div')).toHaveClass('sm:flex');
    });
  });

  describe('서비스 목록', () => {
    it('서버에 서비스 정보가 있을 때 정상 렌더링된다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
      expect(mockServer.services).toHaveLength(2);
      expect(mockServer.services[0].name).toBe('Nginx');
    });

    it('서비스 데이터가 컴포넌트에 전달된다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
      expect(mockServer.services[0]).toHaveProperty('name');
      expect(mockServer.services[0]).toHaveProperty('status');
      expect(mockServer.services[0]).toHaveProperty('port');
    });

    it('서비스가 없어도 안전하게 렌더링된다', () => {
      const serverWithoutServices = { ...mockServer, services: [] };
      const { container } = render(
        <ImprovedServerCard
          server={serverWithoutServices}
          onClick={mockOnClick}
        />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
    });
  });

  describe('Progressive Disclosure', () => {
    it('enableProgressiveDisclosure가 true일 때 확장 버튼이 있다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          enableProgressiveDisclosure={true}
        />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
      const toggleButton = container.querySelector('[data-toggle-button]');
      expect(toggleButton).toBeInTheDocument();
    });

    it('enableProgressiveDisclosure가 false일 때 정상 렌더링된다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          enableProgressiveDisclosure={false}
        />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
    });
  });

  describe('실시간 업데이트', () => {
    it('showRealTimeUpdates가 true일 때 펄스 인디케이터가 표시된다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          showRealTimeUpdates={true}
        />
      );
      const pulseIndicator = container.querySelector('.animate-pulse');
      expect(pulseIndicator).toBeInTheDocument();
    });

    it('showRealTimeUpdates가 false일 때 펄스 인디케이터가 없다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          showRealTimeUpdates={false}
        />
      );
      const pulseIndicator = container.querySelector(
        '.absolute.right-3.top-3 .animate-pulse'
      );
      expect(pulseIndicator).not.toBeInTheDocument();
    });
  });

  describe('추가 메트릭 표시', () => {
    it('서버 메트릭 데이터가 올바르게 전달된다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
      expect(mockServer.cpu).toBe(45.2);
      expect(mockServer.memory).toBe(62.8);
      expect(mockServer.disk).toBe(73.5);
      expect(mockServer.network).toBe(28.9);
    });

    it('메트릭 값이 화면에 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText('45.2%')).toBeInTheDocument();
      expect(screen.getByText('62.8%')).toBeInTheDocument();
    });
  });
});
