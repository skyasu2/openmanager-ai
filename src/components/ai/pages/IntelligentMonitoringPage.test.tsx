/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntelligentMonitoringPage from './IntelligentMonitoringPage';

const mockFetch = vi.fn();
const mockUseServerQuery = vi.fn();

vi.mock('@/hooks/useServerQuery', () => ({
  useServerQuery: () => mockUseServerQuery(),
}));

vi.mock('@/components/ai/AnalysisResultsCard', () => ({
  default: ({ error, result }: { error: string | null; result: unknown }) =>
    error ? (
      <div>
        <p>{error}</p>
        <a href="/login">로그인하기</a>
      </div>
    ) : (
      <div>{result ? 'has-result' : 'empty'}</div>
    ),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('IntelligentMonitoringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockUseServerQuery.mockReturnValue({
      data: [
        {
          id: 'server-1',
          name: '웹 서버 01',
          cpu: 10,
          memory: 20,
          disk: 30,
          network: 40,
        },
      ],
    });
  });

  it('shows login CTA when analysis API returns 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    render(<IntelligentMonitoringPage />);

    fireEvent.change(screen.getByLabelText('분석 대상'), {
      target: { value: 'server-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '분석 시작' }));

    await waitFor(() => {
      expect(
        screen.getByText('로그인이 필요합니다. 게스트 로그인 후 이용해주세요.')
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: '로그인하기' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('keeps selected server and RAG toggle state after analysis and reset', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          success: true,
          serverId: 'server-1',
          serverName: '웹 서버 01',
          analysisType: 'full',
          timestamp: '2026-03-18T14:10:00.000Z',
          anomalyDetection: {
            success: true,
            serverId: 'server-1',
            serverName: '웹 서버 01',
            anomalyCount: 0,
            hasAnomalies: false,
            results: {},
            timestamp: '2026-03-18T14:10:00.000Z',
            _algorithm: 'test',
            _engine: 'test',
            _cached: false,
          },
          trendPrediction: {
            success: true,
            serverId: 'server-1',
            serverName: '웹 서버 01',
            predictionHorizon: '1h',
            results: {},
            summary: {
              increasingMetrics: [],
              hasRisingTrends: false,
            },
            timestamp: '2026-03-18T14:10:00.000Z',
            _algorithm: 'test',
            _engine: 'test',
            _cached: false,
          },
          patternAnalysis: {
            success: true,
            patterns: [],
            detectedIntent: 'analysis',
            analysisResults: [],
            _mode: 'test',
          },
        },
      }),
    });

    render(<IntelligentMonitoringPage />);

    fireEvent.change(screen.getByLabelText('분석 대상'), {
      target: { value: 'server-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /RAG/i }));
    fireEvent.click(screen.getByRole('button', { name: '분석 시작' }));

    await waitFor(() => {
      expect(screen.getByText('has-result')).toBeInTheDocument();
    });

    const request = mockFetch.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toMatchObject({
      action: 'analyze_server',
      serverId: 'server-1',
      enableRAG: true,
    });

    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    expect(screen.getByText('empty')).toBeInTheDocument();
    expect(screen.getByLabelText('분석 대상')).toHaveValue('server-1');
    expect(screen.getByRole('button', { name: /RAG/i })).toHaveAttribute(
      'title',
      'RAG 검색 끄기'
    );
  });
});
