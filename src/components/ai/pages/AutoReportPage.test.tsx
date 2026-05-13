/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AutoReportPage from './auto-report/AutoReportPage';

const mockFetch = vi.fn();
const mockUseServerQuery = vi.fn();
const mockExecuteChatArtifact = vi.fn();
const mockSaveArtifactExecutionReplayPack = vi.fn();

const reportArtifact = {
  kind: 'incident-report',
  generatedAt: '2026-05-13T00:00:00.000Z',
  report: {
    id: 'report-1',
    title: 'API 서버 CPU 사용률 급증',
    severity: 'critical',
    timestamp: new Date('2026-03-18T14:00:00.000Z'),
    affectedServers: ['api-was-dc1-01'],
    description: 'CPU 사용률이 임계치를 초과했습니다.',
    status: 'active',
    systemSummary: {
      totalServers: 1,
      healthyServers: 0,
      warningServers: 0,
      criticalServers: 1,
    },
    recommendations: [
      {
        action: '트래픽 분산을 확인하세요.',
        priority: 'high',
        expected_impact: '응답 지연 완화',
      },
    ],
  },
} as const;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('lucide-react', () => ({
  AlertCircle: () => <svg data-testid="icon-alert-circle" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  X: () => <svg data-testid="icon-x" />,
}));

vi.mock('@/hooks/useServerQuery', () => ({
  useServerQuery: () => mockUseServerQuery(),
}));

vi.mock('@/lib/ai/chat-artifacts/artifact-execution', () => ({
  executeChatArtifact: (...args: unknown[]) => mockExecuteChatArtifact(...args),
  saveArtifactExecutionReplayPack: (...args: unknown[]) =>
    mockSaveArtifactExecutionReplayPack(...args),
}));

vi.mock('@/config/rules/loader', () => ({
  rulesLoader: {
    getServerStatus: vi.fn(() => 'online'),
    isWarning: vi.fn(() => false),
    isCritical: vi.fn(() => false),
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/ai/pages/auto-report/ReportCard', () => ({
  default: ({
    report,
    onResolve,
  }: {
    report: { id: string; title: string; severity: string; status: string };
    onResolve: (id: string) => void;
  }) => (
    <article>
      <h3>{report.title}</h3>
      <p>{report.severity}</p>
      <p>{report.status}</p>
      <button type="button" onClick={() => onResolve(report.id)}>
        해결 완료
      </button>
    </article>
  ),
}));

describe('AutoReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockExecuteChatArtifact.mockResolvedValue(reportArtifact);
    mockSaveArtifactExecutionReplayPack.mockReturnValue({ saved: true });
    mockUseServerQuery.mockReturnValue({
      data: [
        {
          id: 'server-1',
          name: 'api-was-dc1-01',
          cpu: 74,
          memory: 68,
          disk: 45,
          network: 12,
        },
      ],
      isLoading: false,
    });
  });

  it('빈 상태에서 Reporter 빠른 시작 칩을 제공하고 선택한 힌트를 요청에 포함한다', async () => {
    render(<AutoReportPage />);

    expect(
      screen.getByRole('button', { name: /장애 보고서/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /정기 운영 보고서/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /이상감지 요약/ })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /정기 운영 보고서/ }));

    await waitFor(() => {
      expect(mockExecuteChatArtifact).toHaveBeenCalledTimes(1);
    });

    expect(mockExecuteChatArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'incident-report',
        query: '최근 24시간 운영 상태를 정기 운영 보고서로 요약해줘',
      })
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps generated reports visible after the page remounts', async () => {
    const { unmount } = render(<AutoReportPage />);

    fireEvent.click(screen.getByTestId('report-generate-btn'));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'API 서버 CPU 사용률 급증' })
      ).toBeInTheDocument();
    });
    expect(mockExecuteChatArtifact).toHaveBeenCalledTimes(1);
    expect(mockSaveArtifactExecutionReplayPack).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: reportArtifact,
        workspaceId: expect.stringContaining('surface:incident-report:'),
      })
    );

    unmount();

    render(<AutoReportPage />);

    expect(
      screen.getByRole('heading', { name: 'API 서버 CPU 사용률 급증' })
    ).toBeInTheDocument();
  });

  it('renders a client-side login link when the report API requires auth', async () => {
    mockExecuteChatArtifact.mockRejectedValue(
      new Error('로그인이 필요합니다. 게스트 로그인 후 이용해주세요.')
    );

    render(<AutoReportPage />);

    expect(
      screen.queryByRole('button', { name: /RAG/i })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('report-generate-btn'));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '로그인하기' })).toHaveAttribute(
        'href',
        '/login'
      );
    });
  });

  it('sends dashboard queryAsOf data slot when generating a report', async () => {
    render(
      <AutoReportPage
        queryAsOfDataSlot={{
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        }}
      />
    );

    fireEvent.click(screen.getByTestId('report-generate-btn'));

    await waitFor(() => {
      expect(mockExecuteChatArtifact).toHaveBeenCalledTimes(1);
    });

    expect(mockExecuteChatArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'incident-report',
        queryAsOfDataSlot: {
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        },
      })
    );
  });

  it('does not render the persistent history tab', () => {
    render(<AutoReportPage />);

    expect(
      screen.queryByRole('button', { name: /히스토리/ })
    ).not.toBeInTheDocument();
  });

  it('marks a report resolved locally without PATCH persistence', async () => {
    mockExecuteChatArtifact.mockResolvedValue({
      ...reportArtifact,
      report: {
        ...reportArtifact.report,
        id: 'report-local-resolve',
        title: '세션 내 보고서',
        severity: 'warning',
        description: '세션 내 상태 변경 검증',
      },
    });

    render(<AutoReportPage />);

    fireEvent.click(screen.getByTestId('report-generate-btn'));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: '세션 내 보고서' })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: '해결 완료' })[0]);

    expect(screen.getByText('resolved')).toBeInTheDocument();
    expect(mockExecuteChatArtifact).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
