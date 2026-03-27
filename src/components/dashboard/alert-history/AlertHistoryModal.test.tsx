/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Alert } from '@/services/monitoring/AlertManager';
import { AlertHistoryRow } from './AlertHistoryModal';

describe('AlertHistoryModal', () => {
  it('지원 메트릭 이력은 AI 분석 버튼으로 렌더링해야 한다', () => {
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
    const onAskAIAboutAlert = vi.fn();

    render(
      <AlertHistoryRow
        alert={alert}
        badgeClassName="bg-amber-100 text-amber-700 border-amber-200"
        borderClassName="border-l-amber-500"
        anchorDate={new Date('2026-03-23T00:10:00Z')}
        onAskAIAboutAlert={onAskAIAboutAlert}
      />
    );

    const button = screen.getByRole('button', {
      name: 'AI에게 server-1:9100 Memory 알림 분석 요청',
    });
    fireEvent.click(button);

    expect(onAskAIAboutAlert).toHaveBeenCalledWith(alert);
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
        onAskAIAboutAlert={vi.fn()}
      />
    );

    expect(
      screen.queryByRole('button', {
        name: 'AI에게 server-2:9100 Network I/O 알림 분석 요청',
      })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Network I\/O = 88.1%/)).toBeInTheDocument();
  });
});
