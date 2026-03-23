/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MonitoringAlert } from '@/schemas/api.monitoring-report.schema';
import { ActiveAlertsModal } from './ActiveAlertsModal';

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
  it('지원되는 메트릭 알림은 AI prefill 버튼으로 렌더링한다', () => {
    const onAskAIAboutAlert = vi.fn();
    const alert = createAlert();

    render(
      <ActiveAlertsModal
        open
        onClose={vi.fn()}
        alerts={[alert]}
        onAskAIAboutAlert={onAskAIAboutAlert}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'AI에게 api-was-dc1-01 CPU 경고 분석 요청',
      })
    );

    expect(onAskAIAboutAlert).toHaveBeenCalledWith(alert);
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
        onAskAIAboutAlert={vi.fn()}
      />
    );

    expect(
      screen.queryByRole('button', {
        name: 'AI에게 api-was-dc1-01 Network I/O 경고 분석 요청',
      })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Network I/O = 82.0%')).toBeInTheDocument();
  });
});
