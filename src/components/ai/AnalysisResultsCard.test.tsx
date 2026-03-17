/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MultiServerAnalysisResponse } from '@/types/intelligent-monitoring.types';
import AnalysisResultsCard from './AnalysisResultsCard';

vi.mock('@/lib/format-date', () => ({
  formatDateTime: () => '2026-03-17 17:55:00',
}));

vi.mock('./analysis', () => ({
  SystemSummarySection: () => <div>system-summary</div>,
  ServerResultCard: ({
    server,
    defaultExpanded,
  }: {
    server: { serverName: string };
    defaultExpanded?: boolean;
  }) => (
    <div>
      <div>{server.serverName}</div>
      <div>{defaultExpanded ? '상세 분석 접기' : '상세 분석 보기'}</div>
    </div>
  ),
  AnomalySection: () => null,
  TrendSection: () => null,
  InsightSection: () => null,
}));

function createMultiServerResult(): MultiServerAnalysisResponse {
  return {
    success: true,
    isMultiServer: true,
    timestamp: '2026-03-17T08:55:00.000Z',
    summary: {
      totalServers: 3,
      healthyServers: 1,
      warningServers: 1,
      criticalServers: 1,
      overallStatus: 'critical',
      topIssues: [
        {
          serverId: 'cache-redis-dc1-01',
          serverName: 'cache-redis-dc1-01',
          metric: 'memory',
          severity: 'high',
          currentValue: 87,
        },
      ],
      predictions: [
        {
          serverId: 'api-was-dc1-01',
          serverName: 'api-was-dc1-01',
          metric: 'cpu',
          trend: 'increasing',
          currentValue: 73,
          predictedValue: 91,
          changePercent: 24.7,
          thresholdBreachMessage: '1시간 후 critical 예상',
        },
      ],
    },
    servers: [
      {
        success: true,
        serverId: 'web-nginx-dc1-01',
        serverName: 'web-nginx-dc1-01',
        analysisType: 'full',
        timestamp: '2026-03-17T08:55:00.000Z',
        overallStatus: 'online',
        anomalyDetection: {
          success: true,
          serverId: 'web-nginx-dc1-01',
          serverName: 'web-nginx-dc1-01',
          anomalyCount: 0,
          hasAnomalies: false,
          results: {},
          timestamp: '2026-03-17T08:55:00.000Z',
          _algorithm: 'test',
          _engine: 'test',
          _cached: false,
        },
      },
      {
        success: true,
        serverId: 'api-was-dc1-01',
        serverName: 'api-was-dc1-01',
        analysisType: 'full',
        timestamp: '2026-03-17T08:55:00.000Z',
        overallStatus: 'warning',
        anomalyDetection: {
          success: true,
          serverId: 'api-was-dc1-01',
          serverName: 'api-was-dc1-01',
          anomalyCount: 1,
          hasAnomalies: true,
          results: {
            cpu: {
              isAnomaly: true,
              severity: 'medium',
              confidence: 0.8,
              currentValue: 73,
              threshold: { upper: 70, lower: 0 },
            },
          },
          timestamp: '2026-03-17T08:55:00.000Z',
          _algorithm: 'test',
          _engine: 'test',
          _cached: false,
        },
        trendPrediction: {
          success: true,
          serverId: 'api-was-dc1-01',
          serverName: 'api-was-dc1-01',
          predictionHorizon: '1h',
          results: {
            cpu: {
              trend: 'increasing',
              currentValue: 73,
              predictedValue: 91,
              changePercent: 24.7,
              confidence: 0.76,
            },
          },
          summary: {
            increasingMetrics: ['cpu'],
            hasRisingTrends: true,
          },
          timestamp: '2026-03-17T08:55:00.000Z',
          _algorithm: 'test',
          _engine: 'test',
          _cached: false,
        },
      },
      {
        success: true,
        serverId: 'cache-redis-dc1-01',
        serverName: 'cache-redis-dc1-01',
        analysisType: 'full',
        timestamp: '2026-03-17T08:55:00.000Z',
        overallStatus: 'critical',
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
              confidence: 0.92,
              currentValue: 87,
              threshold: { upper: 80, lower: 0 },
            },
          },
          timestamp: '2026-03-17T08:55:00.000Z',
          _algorithm: 'test',
          _engine: 'test',
          _cached: false,
        },
      },
    ],
  };
}

describe('AnalysisResultsCard', () => {
  it('shows issue servers first and auto-expands them in multi-server mode', () => {
    render(
      <AnalysisResultsCard
        result={createMultiServerResult()}
        isLoading={false}
        error={null}
      />
    );

    const headings = screen.getAllByRole('button');
    const serverButtons = headings.filter((button) =>
      ['cache-redis-dc1-01', 'api-was-dc1-01', 'web-nginx-dc1-01'].some(
        (name) => button.textContent?.includes(name)
      )
    );

    expect(serverButtons[0]).toHaveTextContent('cache-redis-dc1-01');
    expect(serverButtons[1]).toHaveTextContent('api-was-dc1-01');
    expect(screen.getAllByText('상세 분석 접기')).toHaveLength(2);
    expect(screen.getByText('상세 분석 보기')).toBeInTheDocument();
  });

  it('filters between issue servers and healthy servers', () => {
    render(
      <AnalysisResultsCard
        result={createMultiServerResult()}
        isLoading={false}
        error={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '정상 서버 1' }));

    expect(screen.getByText('web-nginx-dc1-01')).toBeInTheDocument();
    expect(screen.queryByText('cache-redis-dc1-01')).not.toBeInTheDocument();
    expect(screen.queryByText('api-was-dc1-01')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이슈 서버 2' }));

    expect(screen.getByText('cache-redis-dc1-01')).toBeInTheDocument();
    expect(screen.getByText('api-was-dc1-01')).toBeInTheDocument();
    expect(screen.queryByText('web-nginx-dc1-01')).not.toBeInTheDocument();
  });
});
