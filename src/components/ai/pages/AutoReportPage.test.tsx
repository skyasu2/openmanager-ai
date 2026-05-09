/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AutoReportPage from './auto-report/AutoReportPage';

const mockFetch = vi.fn();
const mockUseServerQuery = vi.fn();

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
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        message: 'stop after request assertion',
      }),
    });

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
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const request = mockFetch.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      action: 'generate',
      query: '최근 24시간 운영 상태를 정기 운영 보고서로 요약해줘',
      category: 'operations',
      severity: 'info',
    });
  });

  it('keeps generated reports visible after the page remounts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        report: {
          id: 'report-1',
          title: 'API 서버 CPU 사용률 급증',
          severity: 'critical',
          created_at: '2026-03-18T14:00:00.000Z',
          affected_servers: ['api-was-dc1-01'],
          description: 'CPU 사용률이 임계치를 초과했습니다.',
          system_summary: {
            total_servers: 1,
            healthy_servers: 0,
            warning_servers: 0,
            critical_servers: 1,
          },
          recommendations: [
            {
              action: '트래픽 분산을 확인하세요.',
              priority: 'high',
            },
          ],
        },
      }),
    });

    const { unmount } = render(<AutoReportPage />);

    fireEvent.click(screen.getByTestId('report-generate-btn'));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'API 서버 CPU 사용률 급증' })
      ).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    unmount();

    render(<AutoReportPage />);

    expect(
      screen.getByRole('heading', { name: 'API 서버 CPU 사용률 급증' })
    ).toBeInTheDocument();
  });

  it('renders a client-side login link when the report API requires auth', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

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
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        message: 'stop after request assertion',
      }),
    });

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
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const request = mockFetch.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      action: 'generate',
      queryAsOf: {
        source: 'vercel-static-otel',
        datasetVersion: '24h-rotating-v1.0.0',
        dataSlot: {
          slotIndex: 42,
          minuteOfDay: 420,
          timeLabel: '07:00 KST',
        },
      },
    });
    expect(JSON.parse(String(request?.body))).not.toHaveProperty('enableRAG');
  });

  it('does not render the persistent history tab', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    render(<AutoReportPage />);

    expect(
      screen.queryByRole('button', { name: /히스토리/ })
    ).not.toBeInTheDocument();
  });

  it('marks a report resolved locally without PATCH persistence', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        report: {
          id: 'report-local-resolve',
          title: '세션 내 보고서',
          severity: 'warning',
          created_at: '2026-03-18T14:00:00.000Z',
          affected_servers: ['api-was-dc1-01'],
          description: '세션 내 상태 변경 검증',
        },
      }),
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
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  });
});
