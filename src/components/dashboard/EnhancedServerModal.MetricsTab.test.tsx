/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MetricsTab } from './EnhancedServerModal.MetricsTab';
import type { RealtimeData, ServerData } from './EnhancedServerModal.types';

vi.mock('@/components/charts/NivoTimeSeriesChart', () => ({
  NivoTimeSeriesChart: () => <div data-testid="nivo-time-series-chart" />,
}));

vi.mock('@/hooks/useTimeSeriesMetrics', () => ({
  useTimeSeriesMetrics: () => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('./EnhancedServerModal.components', () => ({
  RealtimeChart: ({ label }: { label: string }) => (
    <div data-testid={`realtime-chart-${label}`} />
  ),
}));

const server: ServerData = {
  id: 'api-was-dc1-01',
  hostname: 'api-was-dc1-01',
  name: 'api-was-dc1-01',
  type: 'application',
  environment: 'production',
  location: 'DC1-AZ1',
  provider: 'onprem',
  status: 'online',
  cpu: 30,
  memory: 45,
  disk: 55,
  network: 12,
  uptime: '24h',
  lastUpdate: new Date('2026-05-09T00:00:00Z'),
  alerts: 0,
  services: [],
};

const realtimeData: RealtimeData = {
  cpu: [20, 30],
  memory: [40, 45],
  disk: [50, 55],
  network: [10, 12],
  logs: [],
};

describe('MetricsTab', () => {
  it('성능 분석 서브모드는 활성 상태를 aria-pressed와 강한 배경으로 표시한다', () => {
    render(
      <MetricsTab
        server={server}
        realtimeData={realtimeData}
        isRealtime
        onToggleRealtime={vi.fn()}
      />
    );

    const simpleButton = screen.getByRole('button', { name: /기본/i });
    const advancedButton = screen.getByRole('button', { name: /분석/i });

    expect(simpleButton).toHaveAttribute('aria-pressed', 'true');
    expect(simpleButton).toHaveClass('bg-blue-600');
    expect(advancedButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(advancedButton);

    expect(advancedButton).toHaveAttribute('aria-pressed', 'true');
    expect(advancedButton).toHaveClass('bg-blue-600');
  });

  it('실시간 제어 버튼은 일시정지 액션을 명확한 접근성 이름으로 제공한다', () => {
    const onToggleRealtime = vi.fn();

    const { rerender } = render(
      <MetricsTab
        server={server}
        realtimeData={realtimeData}
        isRealtime
        onToggleRealtime={onToggleRealtime}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '실시간 메트릭 일시정지' })
    );

    expect(onToggleRealtime).toHaveBeenCalledTimes(1);

    rerender(
      <MetricsTab
        server={server}
        realtimeData={realtimeData}
        isRealtime={false}
        onToggleRealtime={onToggleRealtime}
      />
    );

    expect(
      screen.getByRole('button', { name: '실시간 메트릭 시작' })
    ).toBeInTheDocument();
  });
});
