/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOTelHourlyData = vi.fn();

vi.mock('@/data/otel-data', () => ({
  getOTelHourlyData: (...args: unknown[]) => mockGetOTelHourlyData(...args),
}));

import { LogTimeline } from './LogTimeline';

describe('LogTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOTelHourlyData.mockResolvedValue({
      slots: [
        {
          logs: [
            {
              timeUnixNano: 1714557600000000000,
              severityText: 'WARN',
              body: 'memory pressure increased',
              resource: 'api-01',
            },
            {
              timeUnixNano: 1714557900000000000,
              severityText: 'ERROR',
              body: 'worker crashed during deploy',
              resource: 'api-01',
            },
            {
              timeUnixNano: 1714558200000000000,
              severityText: 'INFO',
              body: 'worker restarted successfully',
              resource: 'api-01',
            },
          ],
        },
      ],
    });
  });

  it('보고서 상세에서 로그 타임라인 토글을 열면 로그 항목을 표시한다', async () => {
    render(
      <LogTimeline
        timestamp={new Date('2026-04-19T10:15:00.000Z')}
        affectedServerIds={['api-01']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '로그 타임라인 보기' }));

    await waitFor(() => {
      expect(
        screen.getByText('worker crashed during deploy')
      ).toBeInTheDocument();
    });
  });

  it('ERROR/WARN/INFO 로그 배지에 severity별 색상을 적용한다', async () => {
    render(
      <LogTimeline
        timestamp={new Date('2026-04-19T10:15:00.000Z')}
        affectedServerIds={['api-01']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '로그 타임라인 보기' }));

    const errorBadge = await screen.findByText('ERROR');
    const warnBadge = await screen.findByText('WARN');
    const infoBadge = await screen.findByText('INFO');

    expect(errorBadge.className).toContain('bg-red-100');
    expect(warnBadge.className).toContain('bg-amber-100');
    expect(infoBadge.className).toContain('bg-slate-100');
  });
});
