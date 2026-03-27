/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AIContentArea from './AIContentArea';

const autoReportEffectStart = vi.fn();
const autoReportEffectCleanup = vi.fn();
const analystEffectStart = vi.fn();
const analystEffectCleanup = vi.fn();

vi.mock('@/components/ai/pages/AutoReportPage', () => ({
  default: function AutoReportPageMock() {
    const [count, setCount] = useState(0);

    useEffect(() => {
      autoReportEffectStart();

      return () => {
        autoReportEffectCleanup();
      };
    }, []);

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

    useEffect(() => {
      analystEffectStart();

      return () => {
        analystEffectCleanup();
      };
    }, []);

    return (
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        analyst-count:{count}
      </button>
    );
  },
}));

describe('AIContentArea', () => {
  beforeEach(() => {
    autoReportEffectStart.mockClear();
    autoReportEffectCleanup.mockClear();
    analystEffectStart.mockClear();
    analystEffectCleanup.mockClear();
  });

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

  it('restarts page effects when Activity returns a hidden tab to visible mode', async () => {
    const { rerender } = render(
      <AIContentArea selectedFunction="auto-report" />
    );

    await screen.findByText('report-count:0');
    expect(autoReportEffectStart).toHaveBeenCalledTimes(1);
    expect(autoReportEffectCleanup).not.toHaveBeenCalled();

    rerender(<AIContentArea selectedFunction="intelligent-monitoring" />);

    await screen.findByText('analyst-count:0');
    await waitFor(() => {
      expect(autoReportEffectCleanup).toHaveBeenCalledTimes(1);
    });
    expect(analystEffectStart).toHaveBeenCalledTimes(1);

    rerender(<AIContentArea selectedFunction="auto-report" />);

    await screen.findByText('report-count:0');
    await waitFor(() => {
      expect(autoReportEffectStart).toHaveBeenCalledTimes(2);
      expect(analystEffectCleanup).toHaveBeenCalledTimes(1);
    });
  });
});
