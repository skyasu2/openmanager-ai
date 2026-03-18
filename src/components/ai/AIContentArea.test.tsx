/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import AIContentArea from './AIContentArea';

vi.mock('@/components/ai/pages/AutoReportPage', () => ({
  default: function AutoReportPageMock() {
    const [count, setCount] = useState(0);
    return (
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        report-count:{count}
      </button>
    );
  },
}));

vi.mock('@/components/ai/pages/IntelligentMonitoringPage', () => ({
  default: function IntelligentMonitoringPageMock() {
    const [count, setCount] = useState(0);
    return (
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        analyst-count:{count}
      </button>
    );
  },
}));

describe('AIContentArea', () => {
  it('lazy-mounts Reporter and Analyst pages only after selection', async () => {
    const { rerender } = render(<AIContentArea selectedFunction="chat" />);

    expect(screen.queryByTestId('auto-report-page')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('intelligent-monitoring-page')
    ).not.toBeInTheDocument();

    rerender(<AIContentArea selectedFunction="auto-report" />);

    expect(screen.getByTestId('auto-report-page')).toBeInTheDocument();
    expect(await screen.findByText('report-count:0')).toBeInTheDocument();
    expect(
      screen.queryByTestId('intelligent-monitoring-page')
    ).not.toBeInTheDocument();

    rerender(<AIContentArea selectedFunction="intelligent-monitoring" />);

    expect(
      screen.getByTestId('intelligent-monitoring-page')
    ).toBeInTheDocument();
    expect(await screen.findByText('analyst-count:0')).toBeInTheDocument();
    expect(screen.getByTestId('auto-report-page')).toBeInTheDocument();
  });

  it('preserves Reporter and Analyst page state across tab switches', async () => {
    const { rerender } = render(
      <AIContentArea selectedFunction="auto-report" />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'report-count:0' })
    );
    expect(screen.getByText('report-count:1')).toBeInTheDocument();

    rerender(<AIContentArea selectedFunction="intelligent-monitoring" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'analyst-count:0' })
    );
    expect(screen.getByText('analyst-count:1')).toBeInTheDocument();

    rerender(<AIContentArea selectedFunction="auto-report" />);

    expect(screen.getByText('report-count:1')).toBeInTheDocument();
    expect(screen.getByText('analyst-count:1')).toBeInTheDocument();
  });
});
