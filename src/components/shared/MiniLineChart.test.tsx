/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MiniLineChart } from './MiniLineChart';

vi.mock('recharts', () => ({
  AreaChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => (
    <div data-testid="area-chart" data-count={data.length}>
      {children}
    </div>
  ),
  Area: () => <div data-testid="area" />,
  Tooltip: () => <div data-testid="tooltip" />,
  YAxis: () => <div data-testid="y-axis" />,
}));

describe('MiniLineChart', () => {
  it('유효한 포인트가 2개 미만이면 placeholder로 후퇴해야 한다', () => {
    render(<MiniLineChart data={[Number.NaN, Number.POSITIVE_INFINITY]} />);

    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });

  it('비정상 포인트를 제외하고 유효한 시작/끝 레이블만 표시해야 한다', () => {
    render(
      <MiniLineChart
        data={[Number.NaN, 42, Number.POSITIVE_INFINITY, 58]}
        showLabels
      />
    );

    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '2');
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });
});
