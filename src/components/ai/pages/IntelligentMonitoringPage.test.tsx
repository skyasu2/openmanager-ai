/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntelligentMonitoringPage from './IntelligentMonitoringPage';

const mockFetch = vi.fn();
const mockUseServerQuery = vi.fn();
const mockExecuteChatArtifact = vi.fn();
const mockSaveArtifactExecutionReplayPack = vi.fn();

const monitoringArtifact = {
  kind: 'monitoring-analysis',
  generatedAt: '2026-05-13T00:00:00.000Z',
  title: '전체 서버 이상감지/추세 분석',
  summary: '1대 서버에서 risk signal이 감지되었습니다.',
  serverCount: 2,
  riskSignalCount: 1,
  warningServers: 1,
  criticalServers: 0,
  analysis: {
    success: true,
    sourceMode: 'replay-json',
    queryAsOf: '2026-04-30T00:00:00.000Z',
    slot: {
      slotIndex: 42,
      hour: 7,
      slotInHour: 0,
      minuteOfDay: 420,
      timeLabel: '07:00',
      startTime: '2026-04-30T00:00:00.000Z',
      endTime: '2026-04-30T00:10:00.000Z',
    },
    summary: '1대 서버에서 risk signal이 감지되었습니다.',
    servers: [
      {
        id: 'server-1',
        name: '웹 서버 01',
        type: 'web',
        status: 'warning',
        cpu: 86,
        memory: 51,
        disk: 33,
        network: 12,
      },
      {
        id: 'server-2',
        name: 'DB 서버 01',
        type: 'database',
        status: 'online',
        cpu: 38,
        memory: 44,
        disk: 57,
        network: 9,
      },
    ],
    riskSignals: [
      {
        id: 'risk-server-1-cpu',
        serverId: 'server-1',
        serverName: '웹 서버 01',
        serverType: 'web',
        metric: 'cpu',
        value: 86,
        threshold: 80,
        trend: 'up',
        severity: 'warning',
        evidenceRefId: 'evidence-risk-server-1-cpu',
      },
    ],
    evidenceRefs: [
      {
        id: 'evidence-risk-server-1-cpu',
        kind: 'metric',
        serverId: 'server-1',
        metric: 'cpu',
        timeRange: {
          from: '2026-04-30T00:00:00.000Z',
          to: '2026-04-30T00:10:00.000Z',
        },
        summary: '웹 서버 01 cpu warning threshold exceeded',
        value: 86,
        threshold: 80,
        severity: 'warning',
      },
    ],
    dataFreshness: {
      generatedAt: '2026-02-15T03:56:41.821Z',
      sourceUpdatedAt: '2026-02-15T03:56:41.821Z',
      stale: false,
    },
  },
} as const;

vi.mock('@/hooks/useServerQuery', () => ({
  useServerQuery: () => mockUseServerQuery(),
}));

vi.mock('@/lib/ai/chat-artifacts/artifact-execution', () => ({
  executeChatArtifact: (...args: unknown[]) => mockExecuteChatArtifact(...args),
  saveArtifactExecutionReplayPack: (...args: unknown[]) =>
    mockSaveArtifactExecutionReplayPack(...args),
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
    mockExecuteChatArtifact.mockResolvedValue(monitoringArtifact);
    mockSaveArtifactExecutionReplayPack.mockReturnValue({ saved: true });
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

  it('서버 목록이 비어도 legacy fallback 서버 옵션을 노출하지 않는다', () => {
    mockUseServerQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<IntelligentMonitoringPage />);

    expect(
      screen.getByRole('option', { name: '전체 시스템 (서버 목록 없음)' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: '웹 서버 01' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/단일 서버 분석 옵션은 숨겼습니다/)
    ).toBeInTheDocument();
  });

  it('분석 대상 선택 필드가 분석 범위 목적을 설명한다', () => {
    render(<IntelligentMonitoringPage />);

    expect(screen.getByLabelText('분석 대상')).toHaveAccessibleDescription(
      '전체 시스템 또는 특정 서버를 선택해 이상감지·추세 분석 범위를 정합니다.'
    );
  });

  it('탭 진입 시 전체 시스템 분석을 1회 자동 실행한다', async () => {
    const { rerender } = render(
      <IntelligentMonitoringPage
        autoAnalyzeOnVisible
        queryAsOfDataSlot={{
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('has-result')).toBeInTheDocument();
    });

    expect(mockExecuteChatArtifact).toHaveBeenCalledTimes(1);
    expect(mockExecuteChatArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'monitoring-analysis',
        query: '전체 시스템 이상감지/추세 분석',
      })
    );
    expect(mockSaveArtifactExecutionReplayPack).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: monitoringArtifact,
        workspaceId: expect.stringContaining('surface:monitoring-analysis:'),
      })
    );
    expect(mockFetch).not.toHaveBeenCalled();

    rerender(
      <IntelligentMonitoringPage
        autoAnalyzeOnVisible
        queryAsOfDataSlot={{
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        }}
      />
    );

    expect(mockExecuteChatArtifact).toHaveBeenCalledTimes(1);
  });

  it('shows login CTA when analysis API returns 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    render(
      <IntelligentMonitoringPage
        queryAsOfDataSlot={{
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        }}
      />
    );

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

  it('keeps selected server after analysis and reset without exposing a RAG toggle', async () => {
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

    render(
      <IntelligentMonitoringPage
        queryAsOfDataSlot={{
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        }}
      />
    );

    fireEvent.change(screen.getByLabelText('분석 대상'), {
      target: { value: 'server-1' },
    });
    expect(
      screen.queryByRole('button', { name: /RAG/i })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '분석 시작' }));

    await waitFor(() => {
      expect(screen.getByText('has-result')).toBeInTheDocument();
    });

    const request = mockFetch.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toMatchObject({
      action: 'analyze_server',
      serverId: 'server-1',
    });
    expect(JSON.parse(String(request?.body))).not.toHaveProperty('enableRAG');

    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    expect(screen.getByText('empty')).toBeInTheDocument();
    expect(screen.getByLabelText('분석 대상')).toHaveValue('server-1');
    expect(
      screen.queryByRole('button', { name: /RAG/i })
    ).not.toBeInTheDocument();
  });

  it('전체 시스템 분석은 서버별 fan-out 없이 batch 요청 1회만 보낸다', async () => {
    mockUseServerQuery.mockReturnValue({
      data: [
        {
          id: 'server-1',
          name: '웹 서버 01',
          cpu: 86,
          memory: 51,
          disk: 33,
          network: 12,
        },
        {
          id: 'server-2',
          name: 'DB 서버 01',
          cpu: 38,
          memory: 44,
          disk: 57,
          network: 9,
        },
      ],
    });
    render(
      <IntelligentMonitoringPage
        queryAsOfDataSlot={{
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '전체 분석' }));

    await waitFor(() => {
      expect(screen.getByText('has-result')).toBeInTheDocument();
    });

    expect(mockExecuteChatArtifact).toHaveBeenCalledTimes(1);
    expect(mockExecuteChatArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'monitoring-analysis',
        queryAsOfDataSlot: {
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        },
      })
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
