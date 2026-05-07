/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SvgSparkline } from './SvgSparkline';

describe('SvgSparkline', () => {
  it('유효한 포인트가 2개 미만이면 placeholder로 후퇴한다', () => {
    render(<SvgSparkline data={[Number.NaN, Number.POSITIVE_INFINITY]} />);

    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.queryByTestId('svg-sparkline')).not.toBeInTheDocument();
  });

  it('비정상 포인트를 제외하고 유효한 시작/끝 레이블만 표시한다', () => {
    render(
      <SvgSparkline
        data={[Number.NaN, 42, Number.POSITIVE_INFINITY, 58]}
        showLabels
      />
    );

    expect(screen.getByTestId('svg-sparkline')).toHaveAttribute(
      'data-point-count',
      '2'
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });

  it('fill=true이면 영역 path를 함께 렌더링한다', () => {
    render(<SvgSparkline data={[10, 50, 90]} fill color="#10b981" />);

    const area = screen.getByTestId('svg-sparkline-area');
    expect(area).toHaveAttribute('fill', '#10b981');
    expect(area).toHaveAttribute('fill-opacity', '0.15');
  });

  it('시간 데이터와 tooltip title을 지원한다', () => {
    render(
      <SvgSparkline
        data={[
          { time: '10:00', value: 45 },
          { time: '10:05', value: 52 },
        ]}
        showTooltip
      />
    );

    expect(screen.getByTestId('svg-sparkline')).toBeInTheDocument();
    expect(screen.getByText('10:00 45.0% -> 10:05 52.0%')).toBeInTheDocument();
  });
});
