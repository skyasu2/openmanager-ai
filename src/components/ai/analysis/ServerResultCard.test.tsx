/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ServerAnalysisResult } from '@/types/intelligent-monitoring.types';
import { ServerResultCard } from './ServerResultCard';

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    ChevronDown: () => <svg data-testid="chevron-down" />,
    ChevronRight: () => <svg data-testid="chevron-right" />,
    Server: () => <svg data-testid="server-icon" />,
    Cpu: () => <svg data-testid="cpu-icon" />,
    MemoryStick: () => <svg data-testid="memory-icon" />,
    HardDrive: () => <svg data-testid="disk-icon" />,
  };
});

vi.mock('./AnomalySection', () => ({
  AnomalySection: () => <div>현재 상태</div>,
}));

vi.mock('./TrendSection', () => ({
  TrendSection: () => <div>1h 후 예측</div>,
}));

vi.mock('./InsightSection', () => ({
  InsightSection: () => <div>AI 인사이트</div>,
}));

function createServerResult(): ServerAnalysisResult {
  return {
    success: true,
    serverId: 'cache-redis-dc1-01',
    serverName: 'cache-redis-dc1-01',
    analysisType: 'full',
    timestamp: '2026-03-18T12:00:00.000Z',
    overallStatus: 'warning',
    anomalyDetection: {
      success: true,
      serverId: 'cache-redis-dc1-01',
      serverName: 'cache-redis-dc1-01',
      anomalyCount: 1,
      hasAnomalies: true,
      results: {
        memory: {
          isAnomaly: true,
          severity: 'high',
          confidence: 0.91,
          currentValue: 83,
          threshold: { upper: 80, lower: 0 },
        },
      },
      timestamp: '2026-03-18T12:00:00.000Z',
      _algorithm: 'test',
      _engine: 'test',
      _cached: false,
    },
    trendPrediction: {
      success: true,
      serverId: 'cache-redis-dc1-01',
      serverName: 'cache-redis-dc1-01',
      predictionHorizon: '1h',
      results: {
        memory: {
          trend: 'increasing',
          currentValue: 83,
          predictedValue: 89,
          changePercent: 7.2,
          confidence: 0.76,
        },
      },
      summary: {
        increasingMetrics: ['memory'],
        hasRisingTrends: true,
      },
      timestamp: '2026-03-18T12:00:00.000Z',
      _algorithm: 'test',
      _engine: 'test',
      _cached: false,
    },
    patternAnalysis: {
      success: true,
      patterns: ['memory saturation'],
      detectedIntent: 'analysis',
      analysisResults: [
        {
          pattern: 'memory saturation',
          confidence: 0.81,
          insights: 'Redis memory trend is rising.',
        },
      ],
      _mode: 'test',
    },
  };
}

describe('ServerResultCard', () => {
  it('toggles drilldown sections from the card header', () => {
    render(<ServerResultCard server={createServerResult()} />);

    const toggleButton = screen.getByRole('button', {
      name: /cache-redis-dc1-01/i,
    });

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('이상 1')).toBeInTheDocument();
    expect(screen.getByText('상승 추세 1')).toBeInTheDocument();
    expect(screen.queryByText('현재 상태')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('현재 상태')).toBeInTheDocument();
    expect(screen.getByText('1h 후 예측')).toBeInTheDocument();
    expect(screen.getByText('AI 인사이트')).toBeInTheDocument();
  });

  it('respects defaultExpanded for issue-first drilldown UX', () => {
    render(
      <ServerResultCard server={createServerResult()} defaultExpanded={true} />
    );

    const toggleButton = screen.getByRole('button', {
      name: /cache-redis-dc1-01/i,
    });

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('현재 상태')).toBeInTheDocument();
  });
});
