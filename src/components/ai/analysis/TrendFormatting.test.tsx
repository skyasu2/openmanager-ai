/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  MetricTrendResult,
  SystemAnalysisSummary,
} from '@/types/intelligent-monitoring.types';
import { SystemSummarySection } from './SystemSummarySection';
import { TrendCard } from './TrendCard';

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    ArrowUp: () => <svg data-testid="arrow-up" />,
    ArrowDown: () => <svg data-testid="arrow-down" />,
    ArrowRight: () => <svg data-testid="arrow-right" />,
    Cpu: () => <svg data-testid="cpu-icon" />,
    HardDrive: () => <svg data-testid="disk-icon" />,
    MemoryStick: () => <svg data-testid="memory-icon" />,
    Server: () => <svg data-testid="server-icon" />,
  };
});

describe('analysis trend formatting', () => {
  it('renders fallback labels when trend values are NaN', () => {
    const trendData: MetricTrendResult = {
      trend: 'increasing',
      currentValue: 72,
      predictedValue: Number.NaN,
      changePercent: Number.NaN,
      confidence: 0.8,
    };

    render(<TrendCard metric="cpu" data={trendData} />);

    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(2);
    expect(screen.queryByText(/NaN%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+NaN/)).not.toBeInTheDocument();
  });

  it('renders fallback prediction labels in the system summary', () => {
    const summary: SystemAnalysisSummary = {
      totalServers: 18,
      healthyServers: 16,
      warningServers: 2,
      criticalServers: 0,
      overallStatus: 'warning',
      topIssues: [],
      predictions: [
        {
          serverId: 'api-was-dc1-01',
          serverName: 'api-was-dc1-01',
          metric: 'cpu',
          trend: 'increasing',
          currentValue: 86,
          predictedValue: Number.NaN,
          changePercent: 0,
          thresholdBreachMessage: '24시간 내 warning 임계값 재도달 예상',
        },
      ],
    };

    render(<SystemSummarySection summary={summary} />);

    expect(screen.getByText('86% → --')).toBeInTheDocument();
    expect(screen.queryByText(/NaN%/)).not.toBeInTheDocument();
  });
});
