/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardSummary } from './DashboardSummary';
import type {
  DashboardStats,
  DashboardTimeRange,
} from './types/dashboard.types';

vi.mock('lucide-react', () => {
  const MockIcon = () => <svg aria-hidden="true" />;

  return {
    Activity: MockIcon,
    AlertOctagon: MockIcon,
    AlertTriangle: MockIcon,
    CheckCircle2: MockIcon,
    FileSearch: MockIcon,
    Network: MockIcon,
    Server: MockIcon,
    ShieldAlert: MockIcon,
    XCircle: MockIcon,
  };
});

const mockStats: DashboardStats = {
  total: 6,
  online: 3,
  warning: 2,
  critical: 1,
  offline: 0,
  unknown: 0,
};

describe('DashboardSummary status filter cards', () => {
  it('상태 카드를 button으로 렌더링하고 필터 변경을 호출한다', () => {
    const onFilterChange = vi.fn();

    render(
      <DashboardSummary stats={mockStats} onFilterChange={onFilterChange} />
    );

    const onlineButton = screen.getByRole('button', {
      name: '온라인 3대 필터',
    });
    expect(onlineButton).toBeEnabled();

    fireEvent.click(onlineButton);
    expect(onFilterChange).toHaveBeenCalledWith('online');
  });

  it('활성 필터를 aria-pressed로 표시한다', () => {
    render(
      <DashboardSummary
        stats={mockStats}
        activeFilter="online"
        onFilterChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: '온라인 3대 필터' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: '경고 2대 필터' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('필터 핸들러가 없으면 상태 카드를 비활성화한다', () => {
    render(<DashboardSummary stats={mockStats} />);

    expect(
      screen.getByRole('button', { name: '온라인 3대 필터' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '위험 1대 필터' })
    ).toBeDisabled();
  });

  it('모바일 상태 카드 레이아웃은 유지하면서 상태 카드 밀도를 낮춘다', () => {
    render(<DashboardSummary stats={mockStats} onFilterChange={vi.fn()} />);

    const onlineButton = screen.getByTestId('status-card-online');
    const statusGrid = screen.getByTestId('dashboard-status-grid');

    expect(statusGrid).toHaveClass('grid-cols-2');
    expect(statusGrid).toHaveClass('sm:grid-cols-4');
    expect(onlineButton).toHaveClass('min-h-[72px]');
    expect(within(onlineButton).getByText('3')).toHaveClass('text-2xl');
  });

  it('모바일에서 위험/경고/오프라인을 우선 순서로 배치한다', () => {
    render(<DashboardSummary stats={mockStats} onFilterChange={vi.fn()} />);

    expect(screen.getByTestId('dashboard-system-status-card')).toHaveClass(
      'order-1'
    );
    expect(screen.getByTestId('dashboard-status-grid')).toHaveClass('order-2');
    expect(screen.getByTestId('dashboard-total-card')).toHaveClass('order-3');

    expect(screen.getByTestId('status-card-critical')).toHaveClass('order-1');
    expect(screen.getByTestId('status-card-warning')).toHaveClass('order-2');
    expect(screen.getByTestId('status-card-offline')).toHaveClass('order-3');
    expect(screen.getByTestId('status-card-online')).toHaveClass('order-4');
  });

  it('모바일 액션 버튼 터치 영역 클래스를 유지한다', () => {
    render(
      <DashboardSummary
        stats={mockStats}
        onOpenAlertHistory={vi.fn()}
        onOpenLogExplorer={vi.fn()}
      />
    );

    const alertsButton = screen.getByRole('button', {
      name: '알림 보기',
    });
    const logSearchButton = screen.getByRole('button', {
      name: '로그 검색 보기',
    });

    expect(alertsButton).toHaveClass('h-12');
    expect(alertsButton).toHaveClass('min-w-12');
    expect(logSearchButton).toHaveClass('h-12');
    expect(logSearchButton).toHaveClass('min-w-12');
  });

  it('상태 헤더 액션을 하나의 버튼 그룹으로 묶는다', () => {
    render(
      <DashboardSummary
        stats={mockStats}
        onOpenAlertHistory={vi.fn()}
        onOpenLogExplorer={vi.fn()}
      />
    );

    const group = screen.getByRole('group', { name: '상태 헤더 도구' });

    expect(group).toHaveClass('divide-x');
    expect(
      within(group).getByRole('button', { name: '알림 보기' })
    ).toBeInTheDocument();
    expect(
      within(group).getByRole('button', { name: '로그 검색 보기' })
    ).toBeInTheDocument();
  });

  it('모바일 기준 액션 버튼 레이블을 숨기는 클래스를 유지한다', () => {
    render(
      <DashboardSummary
        stats={mockStats}
        onOpenAlertHistory={vi.fn()}
        onOpenLogExplorer={vi.fn()}
      />
    );

    expect(
      within(screen.getByRole('button', { name: '알림 보기' })).getByText(
        '알림'
      )
    ).toHaveClass('hidden');
    expect(
      within(screen.getByRole('button', { name: '알림 보기' })).getByText(
        '알림'
      )
    ).toHaveClass('md:inline');
    expect(
      within(screen.getByRole('button', { name: '로그 검색 보기' })).getByText(
        '로그'
      )
    ).toHaveClass('hidden');
  });

  it('시스템 상태 카드에는 중복 상태 카운트 열을 표시하지 않는다', () => {
    render(<DashboardSummary stats={mockStats} />);

    const systemStatusCard = screen.getByTestId('dashboard-system-status-card');
    expect(
      within(systemStatusCard).queryByText('위험')
    ).not.toBeInTheDocument();
    expect(
      within(systemStatusCard).queryByText('오프라인')
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('오프라인')).toHaveLength(1);
  });

  it('오프라인 서버만 있어도 시스템 상태 카드는 문제 상태 색상을 사용한다', () => {
    render(
      <DashboardSummary
        stats={{
          total: 1,
          online: 0,
          warning: 0,
          critical: 0,
          offline: 1,
          unknown: 0,
        }}
      />
    );

    expect(screen.getByTestId('dashboard-system-status-card')).toHaveClass(
      'border-rose-200/50'
    );
    expect(screen.getByText('문제 발생')).toBeInTheDocument();
  });

  it('OpenTelemetry snapshot data slot 메타데이터를 표시한다', () => {
    render(
      <DashboardSummary
        stats={mockStats}
        dataSlotInfo={{
          hour: 12,
          slotIndex: 2,
          globalSlotIndex: 74,
          minuteOfDay: 740,
        }}
        dataSourceInfo={{
          scopeName: 'openmanager-ai-otel-pipeline',
          scopeVersion: '1.0.0',
          catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
          hour: 12,
        }}
      />
    );

    expect(
      screen.getByText('OpenTelemetry snapshot · 12:20 KST (slot 74/143)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Telemetry catalog v1.0.0 · updated 2026-02-15 03:56Z')
    ).toBeInTheDocument();
  });

  it('snapshot slot 라벨은 현재 시각이 아니라 전달된 데이터 슬롯을 유지한다', () => {
    render(
      <DashboardSummary
        stats={mockStats}
        dataSlotInfo={{
          hour: 17,
          slotIndex: 2,
          globalSlotIndex: 104,
          minuteOfDay: 1040,
        }}
      />
    );

    expect(
      screen.getByText('OpenTelemetry snapshot · 17:20 KST (slot 104/143)')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('OpenTelemetry snapshot · 17:30 KST (slot 105/143)')
    ).not.toBeInTheDocument();
  });

  it('시간 범위 Quick Picker 옵션과 활성 상태를 표시하고 변경을 호출한다', () => {
    const onTimeRangeChange = vi.fn<[DashboardTimeRange], void>();

    render(
      <DashboardSummary
        stats={mockStats}
        timeRange="24h"
        onTimeRangeChange={onTimeRangeChange}
      />
    );

    const picker = screen.getByRole('group', {
      name: '스파크라인 시간 범위',
    });

    expect(
      within(picker).getByRole('button', { name: '2시간' })
    ).toBeInTheDocument();
    expect(
      within(picker).getByRole('button', { name: '6시간' })
    ).toBeInTheDocument();
    expect(
      within(picker).getByRole('button', { name: '12시간' })
    ).toBeInTheDocument();
    expect(
      within(picker).getByRole('button', { name: '24시간' })
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(picker).getByRole('button', { name: '6시간' }));

    expect(onTimeRangeChange).toHaveBeenCalledWith('6h');
  });
});
