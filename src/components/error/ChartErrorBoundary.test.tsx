/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { Component } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartErrorBoundary } from './ChartErrorBoundary';

vi.mock('@/lib/logging', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

class ThrowingChart extends Component<{ shouldThrow: boolean }> {
  render() {
    if (this.props.shouldThrow) {
      throw new Error('chart crashed');
    }

    return <div data-testid="chart-content">healthy chart</div>;
  }
}

describe('ChartErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('retry 버튼으로 같은 차트 트리를 다시 시도할 수 있다', () => {
    const { rerender } = render(
      <ChartErrorBoundary chartName="CPU">
        <ThrowingChart shouldThrow={true} />
      </ChartErrorBoundary>
    );

    expect(screen.getByText('CPU 차트 로드 실패')).toBeInTheDocument();

    rerender(
      <ChartErrorBoundary chartName="CPU">
        <ThrowingChart shouldThrow={false} />
      </ChartErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByTestId('chart-content')).toBeInTheDocument();
  });

  it('resetKey가 바뀌면 새 데이터 기준으로 자동 복구해야 한다', () => {
    const { rerender } = render(
      <ChartErrorBoundary chartName="CPU" resetKey="server-a">
        <ThrowingChart shouldThrow={true} />
      </ChartErrorBoundary>
    );

    expect(screen.getByText('CPU 차트 로드 실패')).toBeInTheDocument();

    rerender(
      <ChartErrorBoundary chartName="CPU" resetKey="server-b">
        <ThrowingChart shouldThrow={false} />
      </ChartErrorBoundary>
    );

    expect(screen.getByTestId('chart-content')).toBeInTheDocument();
  });
});
