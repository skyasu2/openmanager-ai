/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAlertHistory } from '@/hooks/dashboard/useAlertHistory';
import type { Alert } from '@/services/monitoring/AlertManager';
import { AlertHistoryPanel, AlertHistoryRow } from './AlertHistoryModal';

const { routerPush, routerReplace, searchParamsState } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  searchParamsState: {
    value: new URLSearchParams(),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/alerts',
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
  useSearchParams: () => searchParamsState.value,
}));

vi.mock('@/hooks/dashboard/useAlertHistory', () => ({
  useAlertHistory: vi.fn(),
}));

const mockedUseAlertHistory = vi.mocked(useAlertHistory);

function createAlert(index: number): Alert {
  return {
    id: `alert-${index}`,
    serverId: `server-${index}`,
    instance: `server-${index}:9100`,
    labels: {},
    metric: 'cpu',
    value: 82.4,
    threshold: 70,
    severity: 'warning',
    state: 'firing',
    firedAt: '2026-03-23T00:00:00Z',
    duration: 300,
  };
}

describe('AlertHistoryModal', () => {
  beforeEach(() => {
    routerPush.mockClear();
    routerReplace.mockClear();
    searchParamsState.value = new URLSearchParams();
    mockedUseAlertHistory.mockClear();
    mockedUseAlertHistory.mockReturnValue({
      alerts: [],
      stats: {
        total: 0,
        critical: 0,
        warning: 0,
        firing: 0,
        resolved: 0,
        avgResolutionSec: 0,
      },
      isLoading: false,
      isError: false,
      errorMessage: null,
    });
  });

  it('지원 메트릭 이력도 AI 분석 버튼 없이 렌더링해야 한다', () => {
    const alert: Alert = {
      id: 'alert-1',
      serverId: 'server-1',
      instance: 'server-1:9100',
      labels: {},
      metric: 'memory',
      value: 82.4,
      threshold: 70,
      severity: 'warning',
      state: 'firing',
      firedAt: '2026-03-23T00:00:00Z',
      duration: 300,
    };
    render(
      <AlertHistoryRow
        alert={alert}
        badgeClassName="bg-amber-100 text-amber-700 border-amber-200"
        borderClassName="border-l-amber-500"
        anchorDate={new Date('2026-03-23T00:10:00Z')}
      />
    );

    expect(
      screen.queryByRole('button', {
        name: 'AI에게 server-1:9100 Memory 알림 분석 요청',
      })
    ).not.toBeInTheDocument();
  });

  it('로그 버튼은 서버 필터가 적용된 로그 페이지로 이동한다', () => {
    const alert: Alert = {
      id: 'alert-log',
      serverId: 'server-1',
      instance: 'server-1:9100',
      labels: {},
      metric: 'cpu',
      value: 82.4,
      threshold: 70,
      severity: 'warning',
      state: 'firing',
      firedAt: '2026-03-23T00:00:00Z',
      duration: 300,
    };

    render(
      <AlertHistoryRow
        alert={alert}
        badgeClassName="bg-amber-100 text-amber-700 border-amber-200"
        borderClassName="border-l-amber-500"
        anchorDate={new Date('2026-03-23T00:10:00Z')}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'server-1 로그 보기' }));

    expect(routerPush).toHaveBeenCalledWith('/dashboard/logs?server=server-1');
  });

  it('비지원 메트릭 이력은 read-only로 유지해야 한다', () => {
    const alert: Alert = {
      id: 'alert-2',
      serverId: 'server-2',
      instance: 'server-2:9100',
      labels: {},
      metric: 'network',
      value: 88.1,
      threshold: 75,
      severity: 'warning',
      state: 'resolved',
      firedAt: '2026-03-23T00:00:00Z',
      resolvedAt: '2026-03-23T00:05:00Z',
      duration: 300,
    };
    render(
      <AlertHistoryRow
        alert={alert}
        badgeClassName="bg-amber-100 text-amber-700 border-amber-200"
        borderClassName="border-l-amber-500"
        anchorDate={new Date('2026-03-23T00:10:00Z')}
      />
    );

    expect(
      screen.queryByRole('button', {
        name: 'AI에게 server-2:9100 Network I/O 알림 분석 요청',
      })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Network I\/O = 88.1%/)).toBeInTheDocument();
  });

  it('긴 알림 행은 모바일에서 viewport 밖으로 밀리지 않도록 wrap 가능한 구조를 유지해야 한다', () => {
    const alert: Alert = {
      id: 'alert-long-row',
      serverId: 'very-long-production-database-server-name-dc1-primary-01',
      instance: 'very-long-production-database-server-name-dc1-primary-01:9100',
      labels: {},
      metric: 'memory',
      value: 91.7,
      threshold: 70,
      severity: 'critical',
      state: 'firing',
      firedAt: '2026-03-23T00:00:00Z',
      duration: 7200,
    };

    render(
      <AlertHistoryRow
        alert={alert}
        badgeClassName="bg-red-100 text-red-700 border-red-200"
        borderClassName="border-l-red-500"
        anchorDate={new Date('2026-03-23T00:10:00Z')}
      />
    );

    expect(screen.getByTestId('alert-history-row-main')).toHaveClass(
      'flex-wrap'
    );
    expect(screen.getByTestId('alert-history-row-server')).toHaveClass(
      'break-words'
    );
    expect(screen.getByTestId('alert-history-row-metric')).toHaveClass(
      'break-words'
    );
  });

  it('알림 이력은 50개 청크로 렌더링하고 더 보기 버튼으로 다음 청크를 추가한다', () => {
    mockedUseAlertHistory.mockReturnValue({
      alerts: Array.from({ length: 60 }, (_, index) => createAlert(index)),
      stats: {
        total: 60,
        critical: 0,
        warning: 60,
        firing: 60,
        resolved: 0,
        avgResolutionSec: 0,
      },
      isLoading: false,
      isError: false,
      errorMessage: null,
    });

    render(<AlertHistoryPanel serverIds={['server-1']} />);

    expect(screen.getAllByTestId('alert-history-row-main')).toHaveLength(50);
    expect(
      screen.getByTestId('alert-history-load-sentinel')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '더 보기 (10건 남음)' })
    );

    expect(screen.getAllByTestId('alert-history-row-main')).toHaveLength(60);
  });

  it('초기 서버 필터가 있으면 알림 이력 API 필터와 UI 선택값에 반영한다', () => {
    render(
      <AlertHistoryPanel
        serverIds={['server-1', 'server-2']}
        initialServerId="server-2"
      />
    );

    expect(mockedUseAlertHistory).toHaveBeenCalledWith(
      expect.objectContaining({ serverId: 'server-2' })
    );
    expect(screen.getByLabelText('서버 필터')).toHaveValue('server-2');
  });

  it('초기 서버 필터가 목록에 없으면 전체 서버 동작으로 fallback한다', () => {
    render(
      <AlertHistoryPanel
        serverIds={['server-1', 'server-2']}
        initialServerId="unknown-server"
      />
    );

    expect(mockedUseAlertHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ serverId: undefined })
    );
    expect(screen.getByLabelText('서버 필터')).toHaveValue('');
  });

  it('URL query 필터를 알림 이력 API 필터와 UI 초기값에 반영한다', () => {
    searchParamsState.value = new URLSearchParams(
      'severity=critical&state=firing&server=server-2&range=6h&q=cpu'
    );

    render(<AlertHistoryPanel serverIds={['server-1', 'server-2']} />);

    expect(mockedUseAlertHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        severity: 'critical',
        state: 'firing',
        serverId: 'server-2',
        timeRangeMs: 21_600_000,
        keyword: 'cpu',
      })
    );
    expect(screen.getByLabelText('알림 검색')).toHaveValue('cpu');
    expect(screen.getByLabelText('서버 필터')).toHaveValue('server-2');
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('서버 목록 로드 전에는 URL server query를 제거하지 않는다', async () => {
    searchParamsState.value = new URLSearchParams('server=server-2');

    const { rerender } = render(<AlertHistoryPanel serverIds={[]} />);

    expect(routerReplace).not.toHaveBeenCalled();
    expect(mockedUseAlertHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        serverId: undefined,
      })
    );

    rerender(<AlertHistoryPanel serverIds={['server-1', 'server-2']} />);

    await waitFor(() => {
      expect(screen.getByLabelText('서버 필터')).toHaveValue('server-2');
    });
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('서버 필터 변경을 dashboard alerts URL query로 반영한다', async () => {
    render(<AlertHistoryPanel serverIds={['server-1', 'server-2']} />);

    fireEvent.change(screen.getByLabelText('서버 필터'), {
      target: { value: 'server-2' },
    });

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith(
        '/dashboard/alerts?server=server-2',
        { scroll: false }
      );
    });
  });

  it('URL query에서 온 서버 필터를 해제하면 필터 query를 제거한다', async () => {
    searchParamsState.value = new URLSearchParams('server=server-2');

    render(<AlertHistoryPanel serverIds={['server-1', 'server-2']} />);

    await waitFor(() => {
      expect(screen.getByLabelText('서버 필터')).toHaveValue('server-2');
    });

    fireEvent.change(screen.getByLabelText('서버 필터'), {
      target: { value: '' },
    });

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith('/dashboard/alerts', {
        scroll: false,
      });
    });
  });
});
