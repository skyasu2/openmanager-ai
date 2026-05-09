/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonitoringAlert } from '@/schemas/api.monitoring-report.schema';
import { ActiveAlertsModal } from './ActiveAlertsModal';

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

function createAlert(
  overrides: Partial<MonitoringAlert> = {}
): MonitoringAlert {
  return {
    id: 'alert-1',
    serverId: 'server-1',
    instance: 'api-was-dc1-01',
    labels: {},
    metric: 'cpu',
    value: 91,
    threshold: 85,
    severity: 'critical',
    state: 'firing',
    firedAt: '2026-03-23T01:20:00Z',
    duration: 600,
    ...overrides,
  };
}

describe('ActiveAlertsModal', () => {
  beforeEach(() => {
    routerPush.mockClear();
  });

  it('지원되는 메트릭 알림도 AI prefill 버튼 없이 렌더링한다', () => {
    const alert = createAlert();

    render(<ActiveAlertsModal open onClose={vi.fn()} alerts={[alert]} />);

    expect(
      screen.queryByRole('button', {
        name: 'AI에게 api-was-dc1-01 CPU 경고 분석 요청',
      })
    ).not.toBeInTheDocument();
  });

  it('로그 버튼은 서버 필터가 적용된 로그 페이지로 이동한다', () => {
    render(
      <ActiveAlertsModal open onClose={vi.fn()} alerts={[createAlert()]} />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'api-was-dc1-01 로그 보기' })
    );

    expect(routerPush).toHaveBeenCalledWith(
      '/dashboard/logs?server=api-was-dc1-01'
    );
  });

  it('지원되지 않는 메트릭 알림은 읽기 전용으로 유지한다', () => {
    render(
      <ActiveAlertsModal
        open
        onClose={vi.fn()}
        alerts={[
          createAlert({
            metric: 'network',
            value: 82,
            severity: 'warning',
          }),
        ]}
      />
    );

    expect(
      screen.queryByRole('button', {
        name: 'AI에게 api-was-dc1-01 Network I/O 경고 분석 요청',
      })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Network I/O = 82.0%')).toBeInTheDocument();
  });

  it('60초 미만 활성 알림은 0분 경과 대신 방금 전으로 표시해야 한다', () => {
    render(
      <ActiveAlertsModal
        open
        onClose={vi.fn()}
        alerts={[
          createAlert({
            duration: 25,
            value: 88,
          }),
        ]}
      />
    );

    expect(screen.getByText('방금 전')).toBeInTheDocument();
    expect(screen.queryByText('0분 경과')).not.toBeInTheDocument();
  });

  it('로딩 중에는 0건 empty state 대신 로딩 상태를 표시한다', () => {
    render(<ActiveAlertsModal open onClose={vi.fn()} alerts={[]} isLoading />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.getByText('활성 알림을 불러오는 중입니다')
    ).toBeInTheDocument();
    expect(
      screen.getByText('최근 알림 상태를 준비하고 있습니다')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('현재 활성 알림이 없습니다')
    ).not.toBeInTheDocument();
  });

  it('에러 상태에서는 empty state 대신 실패 메시지를 표시한다', () => {
    render(
      <ActiveAlertsModal
        open
        onClose={vi.fn()}
        alerts={[]}
        isError
        errorMessage="모니터링 리포트를 불러오지 못했습니다."
      />
    );

    expect(
      screen.getByText('활성 알림을 불러오지 못했습니다')
    ).toBeInTheDocument();
    expect(
      screen.getByText('모니터링 리포트를 불러오지 못했습니다.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('현재 활성 알림이 없습니다')
    ).not.toBeInTheDocument();
  });
});
