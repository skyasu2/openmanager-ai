/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReportCard from './ReportCard';
import type { IncidentReport } from './types';

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  const Icon = () => <svg data-testid="icon" />;
  return {
    ...actual,
    Activity: Icon,
    CheckSquare: Icon,
    ClipboardCopy: Icon,
    Clock: Icon,
    Download: Icon,
    Eye: Icon,
    Server: Icon,
    TrendingUp: Icon,
  };
});

vi.mock('./formatters', () => ({
  copyReportAsMarkdown: vi.fn(async () => true),
  downloadReport: vi.fn(),
}));

vi.mock('./LogTimeline', () => ({
  LogTimeline: () => <div data-testid="log-timeline" />,
}));

function createReport(overrides: Partial<IncidentReport> = {}): IncidentReport {
  return {
    id: 'report-1',
    title: 'Redis 서버 메모리 과부하 경고',
    severity: 'warning',
    timestamp: new Date('2026-04-27T03:52:00Z'),
    affectedServers: ['cache-redis-dc1-01'],
    description: '메모리 사용량 증가',
    status: 'active',
    systemSummary: {
      totalServers: 18,
      healthyServers: 17,
      warningServers: 1,
      criticalServers: 0,
    },
    recommendations: [
      {
        action: 'Redis 메모리 사용량과 eviction 정책을 점검하세요',
        priority: 'high',
        expected_impact: '메모리 안정화',
      },
    ],
    ...overrides,
  };
}

describe('ReportCard', () => {
  it('shows impact and next action while collapsed', () => {
    render(
      <ReportCard
        report={createReport()}
        index={0}
        isSelected={false}
        downloadMenuId={null}
        onToggleDetail={vi.fn()}
        onResolve={vi.fn()}
        onSetDownloadMenuId={vi.fn()}
      />
    );

    expect(screen.getByText('원인: 메모리 사용량 증가')).toBeInTheDocument();
    expect(screen.getByText('영향: 주의 1대 · 위험 0대')).toBeInTheDocument();
    expect(
      screen.getByText(
        '다음 조치: Redis 메모리 사용량과 eviction 정책을 점검하세요'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('메모리 사용량 증가')).not.toBeInTheDocument();
  });

  it('exposes visible markdown copy and download actions', () => {
    render(
      <ReportCard
        report={createReport()}
        index={0}
        isSelected={false}
        downloadMenuId={null}
        onToggleDetail={vi.fn()}
        onResolve={vi.fn()}
        onSetDownloadMenuId={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /MD 복사/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /보고서 다운로드/i })
    ).toBeInTheDocument();
  });
});
