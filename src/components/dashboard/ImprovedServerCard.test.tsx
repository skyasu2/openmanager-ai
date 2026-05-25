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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '../../types/server';

const serverMetricsMock = vi.hoisted(() => ({
  metricsHistory: [] as Array<{
    timestamp: string;
    cpu: number;
    memory: number;
    disk: number;
  }>,
  loadMetricsHistory: vi.fn(),
}));

// Heavy dependencies (chart libraries, lucide-react) are stubbed via resolve.alias
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
        uptimePercent:
          typeof server?.uptimePercent === 'number'
            ? Number(server.uptimePercent)
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
      osDisplayName:
        typeof server?.os === 'string' && server.os.toLowerCase() === 'linux'
          ? 'Linux'
          : (server?.os as string) || 'Ubuntu 22.04',
      osIcon: '🐧',
      osShortName:
        typeof server?.os === 'string' && server.os.toLowerCase() === 'linux'
          ? 'Linux'
          : 'Ubuntu',
    })
  ),
}));

// Mock design-constants to prevent transitive imports
vi.mock('../../styles/design-constants', () => ({
  DASHBOARD_STATUS_GRADIENTS: {
    online: {
      gradient: 'from-emerald-500 via-green-500 to-emerald-600',
      inlineGlow: 'rgba(16, 185, 129, 0.3)',
    },
    warning: {
      gradient: 'from-amber-500 via-orange-500 to-amber-600',
      inlineGlow: 'rgba(245, 158, 11, 0.4)',
    },
    critical: {
      gradient: 'from-red-500 via-rose-500 to-red-600',
      inlineGlow: 'rgba(239, 68, 68, 0.4)',
    },
    offline: {
      gradient: 'from-gray-500 via-slate-500 to-gray-600',
      inlineGlow: 'rgba(107, 114, 128, 0.3)',
    },
    maintenance: {
      gradient: 'from-blue-500 via-indigo-500 to-blue-600',
      inlineGlow: 'rgba(59, 130, 246, 0.3)',
    },
    unknown: {
      gradient: 'from-purple-500 via-violet-500 to-purple-600',
      inlineGlow: 'rgba(139, 92, 246, 0.3)',
    },
  },
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
  SERVER_CARD_HOVER_SHADOW_CLASSES: {
    critical: 'hover:shadow-red-500/30',
    warning: 'hover:shadow-amber-500/30',
    online: 'hover:shadow-emerald-500/30',
    offline: 'hover:shadow-gray-500/20',
    maintenance: 'hover:shadow-blue-500/30',
    unknown: 'hover:shadow-purple-500/20',
  },
  SERVER_CARD_STATUS_ACCENT_BORDER_CLASSES: {
    critical: 'border-l-4 border-l-red-500',
    warning: 'border-l-4 border-l-orange-500',
    online: 'border-l-4 border-l-green-500',
    offline: 'border-l-4 border-l-slate-400',
    maintenance: 'border-l-4 border-l-blue-500',
    unknown: 'border-l-4 border-l-purple-500',
  },
  SERVER_STATUS_COLORS: {},
}));

vi.mock('../shared/ServerMetricsChart', () => ({
  ServerMetricsChart: vi.fn(() => (
    <div data-testid="mock-metrics-chart">Mock Chart</div>
  )),
}));

vi.mock('../shared/SvgSparkline', () => ({
  SvgSparkline: vi.fn(
    ({
      data,
      height,
      color,
    }: {
      data?: number[];
      height?: number;
      color?: string;
    }) => (
      <div
        data-testid="mock-mini-chart"
        data-points={data?.join(',') ?? ''}
        data-height={height}
        data-color={color}
      >
        Mini Chart
      </div>
    )
  ),
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
    metricsHistory: serverMetricsMock.metricsHistory,
    isLoadingHistory: false,
    loadMetricsHistory: serverMetricsMock.loadMetricsHistory,
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
    serverMetricsMock.metricsHistory = [];
  });

  /** Card root — handles card click and keyboard navigation */
  const getCardButton = (container: HTMLElement) =>
    container.querySelector(
      '[data-testid="error-boundary"] button[aria-label="Web Server 01 상세 보기"]'
    ) as HTMLElement;

  /** Container div — handles mouse hover effects */
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
      const liveIndicator = container.querySelector(
        '.absolute.right-3.top-3 span'
      );
      expect(liveIndicator).toBeInTheDocument();
    });

    it('compact 카드 컨테이너는 fixed height 대신 min-height로 내용 확장을 허용한다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          variant="compact"
        />
      );

      const cardContainer = getCardContainer(container);
      const cardClassTokens = cardContainer.className.split(/\s+/);

      expect(cardContainer).toHaveClass('min-h-[192px]');
      expect(cardClassTokens).not.toContain('h-[192px]');
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
      button.click();
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('키보드 Space로 카드를 활성화할 수 있다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      fireEvent.keyDown(button, { key: ' ' });
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
    it('전달된 스파크라인 시간 범위로 히스토리를 로드한다', async () => {
      render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          metricsTimeRange="6h"
        />
      );

      await waitFor(() => {
        expect(serverMetricsMock.loadMetricsHistory).toHaveBeenCalledWith(
          'server-1',
          '6h'
        );
      });
    });

    it('CPU 메트릭 레이블이 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText('CPU')).toBeInTheDocument();
    });

    it('MEM 메트릭 레이블이 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText('MEM')).toBeInTheDocument();
    });

    it('Live Metrics 섹션이 표시된다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);
      expect(screen.getByText('Live Metrics')).toBeInTheDocument();
    });

    it('상세 OS 메타에서도 정규화된 Linux 표기를 사용한다', () => {
      const linuxServer = { ...mockServer, os: 'linux' };

      const { container } = render(
        <ImprovedServerCard server={linuxServer} onClick={mockOnClick} />
      );

      const card = getCardContainer(container);
      fireEvent.mouseEnter(card);

      expect(screen.getAllByText('Linux')).toHaveLength(1);
      expect(screen.queryByText(/^linux$/)).not.toBeInTheDocument();
    });

    it('서버 카드 상세에는 IP 주소를 노출하지 않는다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );

      const card = getCardContainer(container);
      fireEvent.mouseEnter(card);

      expect(screen.queryByText(/^IP$/)).not.toBeInTheDocument();
      expect(screen.queryByText('192.168.1.100')).not.toBeInTheDocument();
    });

    it('system-rules 임계치 이상 핵심 메트릭 수치를 텍스트 색상과 weight로 강조한다', () => {
      const stressedServer = {
        ...mockServer,
        cpu: 85,
        memory: 91,
        disk: 92,
      };

      render(
        <ImprovedServerCard server={stressedServer} onClick={mockOnClick} />
      );

      expect(screen.getByText('85.0%')).toHaveClass(
        'text-amber-700',
        'font-medium'
      );
      expect(screen.getByText('92.0%')).toHaveClass(
        'text-red-700',
        'font-semibold'
      );
      expect(screen.getByText('91.0%')).toHaveClass(
        'text-red-700',
        'font-semibold'
      );
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

    it('상태별 좌측 accent border를 제공한다', () => {
      const criticalServer = { ...mockServer, status: 'critical' as const };
      const { container } = render(
        <ImprovedServerCard server={criticalServer} onClick={mockOnClick} />
      );

      expect(getCardContainer(container)).toHaveClass(
        'border-l-4',
        'border-l-red-500'
      );
    });
  });

  describe('접근성', () => {
    it('카드 전체를 덮는 상세 보기 버튼이 있다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-label', 'Web Server 01 상세 보기');
    });

    it('카드 버튼이 키보드 탐색 가능하다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('서버 이름이 표시되어 컨텍스트를 제공한다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );
      const button = getCardButton(container);
      expect(screen.getByText('Web Server 01')).toBeInTheDocument();
      expect(button).toHaveAccessibleName('Web Server 01 상세 보기');
    });

    it('긴 서버명은 title로 전체 이름을 확인할 수 있다', () => {
      const longName = 'cache-redis-dc1-01-primary-write-node';

      render(
        <ImprovedServerCard
          server={{ ...mockServer, name: longName }}
          onClick={mockOnClick}
          variant="compact"
        />
      );

      expect(screen.getByText(longName)).toHaveAttribute('title', longName);
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

    it('compact variant는 하단 여백을 위해 카드 min-height와 padding을 확보한다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          variant="compact"
        />
      );

      const card = getCardContainer(container);
      expect(card).toHaveClass('min-h-[192px]', 'p-3', 'pb-4');
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

    it('미니 차트는 트렌드 delta와 함께 카드 안에서 안정적인 세로 공간을 사용한다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);

      const charts = screen.getAllByTestId('mock-mini-chart');
      expect(charts[0]).toHaveAttribute('data-height', '42');
      expect(charts[0].parentElement).toHaveClass('h-12');
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
      const statusBadge = screen.getByTestId('metric-status-badge');

      expect(osBadge).toHaveClass('hidden');
      expect(osBadge).toHaveClass('sm:inline-flex');
      expect(locationText.closest('div')).toHaveClass('hidden');
      expect(locationText.closest('div')).toHaveClass('sm:flex');
      expect(statusBadge.closest('div.hidden')).toHaveClass('hidden');
      expect(statusBadge.closest('div.hidden')).toHaveClass('sm:block');
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

  describe('상세 정보 접힘 제거', () => {
    it('enableProgressiveDisclosure가 true여도 확장 버튼을 노출하지 않는다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          enableProgressiveDisclosure={true}
        />
      );
      expect(getCardContainer(container)).toBeInTheDocument();
      const toggleButton = container.querySelector('[data-toggle-button]');
      expect(toggleButton).not.toBeInTheDocument();
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
    it('showRealTimeUpdates가 true여도 정상 서버는 정적 인디케이터로 표시된다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={mockServer}
          onClick={mockOnClick}
          showRealTimeUpdates={true}
        />
      );
      const liveIndicator = container.querySelector(
        '.absolute.right-3.top-3 span'
      );
      expect(liveIndicator).toBeInTheDocument();
      expect(liveIndicator).not.toHaveClass('animate-pulse');
    });

    it('warning/critical 서버는 펄스 인디케이터로 조치 필요 상태를 강조한다', () => {
      const { container } = render(
        <ImprovedServerCard
          server={{ ...mockServer, status: 'warning' }}
          onClick={mockOnClick}
          showRealTimeUpdates={true}
        />
      );
      const liveIndicator = container.querySelector(
        '.absolute.right-3.top-3 span'
      );
      expect(liveIndicator).toHaveClass('animate-pulse');
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
    it('explicit uptimePercent가 있으면 standard 카드에 24h 가동률을 표시한다', () => {
      render(
        <ImprovedServerCard
          server={{ ...mockServer, uptimePercent: 99.84 }}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('가동률')).toBeInTheDocument();
      expect(screen.getByText('99.8% / 24h')).toBeInTheDocument();
    });

    it('uptimePercent가 없고 uptime이 24h 이상이면 100.0% / 24h를 표시한다', () => {
      render(
        <ImprovedServerCard
          server={{ ...mockServer, uptime: 172800 }}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('100.0% / 24h')).toBeInTheDocument();
    });

    it('유효한 uptime 데이터가 없으면 가동률 fallback dash를 표시한다', () => {
      render(
        <ImprovedServerCard
          server={{ ...mockServer, uptime: 'unknown' }}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('— / 24h')).toBeInTheDocument();
    });

    it('compact variant에서는 uptime 행을 렌더링하지 않는다', () => {
      render(
        <ImprovedServerCard
          server={{ ...mockServer, uptimePercent: 99.84 }}
          onClick={mockOnClick}
          variant="compact"
        />
      );

      expect(screen.queryByText('가동률')).not.toBeInTheDocument();
      expect(screen.queryByText('99.8% / 24h')).not.toBeInTheDocument();
    });

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

    it('미니 차트 history 마지막 포인트를 서버 카드 current 값으로 정렬한다', () => {
      serverMetricsMock.metricsHistory = [
        {
          timestamp: '2026-05-05T00:00:00Z',
          cpu: 10,
          memory: 20,
          disk: 30,
        },
        {
          timestamp: '2026-05-05T00:10:00Z',
          cpu: 11,
          memory: 21,
          disk: 31,
        },
      ];

      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);

      const charts = screen.getAllByTestId('mock-mini-chart');
      expect(charts[0]).toHaveAttribute('data-points', '10,45.2');
      expect(charts[1]).toHaveAttribute('data-points', '20,62.8');
      expect(charts[2]).toHaveAttribute('data-points', '30,73.5');
    });

    it('최근 히스토리 평균 대비 메트릭 트렌드 방향과 delta를 표시한다', () => {
      serverMetricsMock.metricsHistory = [
        {
          timestamp: '2026-05-05T00:00:00Z',
          cpu: 50,
          memory: 80,
          disk: 70,
        },
        {
          timestamp: '2026-05-05T00:10:00Z',
          cpu: 50,
          memory: 80,
          disk: 70,
        },
        {
          timestamp: '2026-05-05T00:20:00Z',
          cpu: 50,
          memory: 80,
          disk: 70,
        },
        {
          timestamp: '2026-05-05T00:30:00Z',
          cpu: 50,
          memory: 80,
          disk: 70,
        },
        {
          timestamp: '2026-05-05T00:40:00Z',
          cpu: 50,
          memory: 80,
          disk: 70,
        },
        {
          timestamp: '2026-05-05T00:50:00Z',
          cpu: 0,
          memory: 0,
          disk: 0,
        },
      ];

      render(
        <ImprovedServerCard
          server={{
            ...mockServer,
            cpu: 70,
            memory: 60,
            disk: 70,
          }}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByLabelText('CPU 추세 상승 +20.0%')).toHaveTextContent(
        '↑ +20%'
      );
      expect(screen.getByLabelText('MEM 추세 하락 -20.0%')).toHaveTextContent(
        '↓ -20%'
      );
      expect(screen.getByLabelText('Disk 추세 변화 없음')).toHaveTextContent(
        '—'
      );
    });

    it('메트릭 색상은 system-rules 임계값과 동일하게 판단한다', () => {
      render(
        <ImprovedServerCard
          server={{
            ...mockServer,
            cpu: 85,
            memory: 70,
            disk: 70,
          }}
          onClick={mockOnClick}
        />
      );

      const charts = screen.getAllByTestId('mock-mini-chart');
      expect(charts[0]).toHaveAttribute('data-color', '#f97316');
      expect(charts[1]).toHaveAttribute('data-color', '#10b981');
      expect(charts[2]).toHaveAttribute('data-color', '#10b981');
    });

    it('호버나 펼치기 버튼 없이 보조 서비스 정보를 노출하지 않는다', () => {
      const { container } = render(
        <ImprovedServerCard server={mockServer} onClick={mockOnClick} />
      );

      expect(screen.queryByText('Nginx')).not.toBeInTheDocument();

      fireEvent.mouseEnter(getCardContainer(container));
      expect(screen.queryByText('Nginx')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '상세 정보 펼치기' })
      ).not.toBeInTheDocument();
    });
  });

  describe('core monitoring surface boundary', () => {
    it('warning 서버도 카드 안에 AI 요청 버튼을 노출하지 않는다', () => {
      const warningServer = { ...mockServer, status: 'warning' as const };

      render(
        <ImprovedServerCard server={warningServer} onClick={mockOnClick} />
      );

      expect(
        screen.queryByRole('button', {
          name: `AI에게 ${warningServer.name} 경고 분석 요청`,
        })
      ).not.toBeInTheDocument();
    });

    it('로그 버튼 클릭 시 서버 상세 클릭과 분리되어 로그 요청만 호출해야 한다', () => {
      const mockOnOpenLogs = vi.fn();
      const props = {
        server: mockServer,
        onClick: mockOnClick,
        onOpenLogs: mockOnOpenLogs,
      } as ComponentProps<typeof ImprovedServerCard> & {
        onOpenLogs: (server: Server) => void;
      };

      render(<ImprovedServerCard {...props} />);

      fireEvent.click(
        screen.getByRole('button', {
          name: `${mockServer.name} 로그 보기`,
        })
      );

      expect(mockOnOpenLogs).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockServer.id })
      );
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('online 서버도 AI 요청 배지를 노출하지 않아야 한다', () => {
      render(<ImprovedServerCard server={mockServer} onClick={mockOnClick} />);

      expect(
        screen.queryByRole('button', {
          name: `AI에게 ${mockServer.name} 경고 분석 요청`,
        })
      ).not.toBeInTheDocument();
    });
  });
});
