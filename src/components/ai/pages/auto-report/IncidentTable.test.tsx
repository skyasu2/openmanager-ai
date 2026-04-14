/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IncidentTable } from './IncidentTable';
import type { IncidentReport } from './types';

vi.mock('./IncidentTimeline', () => ({
  IncidentTimeline: () => <div data-testid="incident-timeline" />,
}));

vi.mock('./formatters', () => ({
  copyReportAsMarkdown: vi.fn(async () => true),
  downloadReport: vi.fn(),
}));

function createReport(overrides: Partial<IncidentReport> = {}): IncidentReport {
  return {
    id: 'report-1',
    title: 'CPU 이상 급증',
    severity: 'critical',
    timestamp: new Date('2026-04-14T10:00:00Z'),
    affectedServers: ['server-1'],
    description: 'CPU가 임계치를 초과했습니다.',
    status: 'active',
    recommendations: [
      {
        action: '프로세스를 점검하세요',
        priority: 'high',
        expected_impact: '부하 완화',
      },
    ],
    timeline: [
      {
        timestamp: '2026-04-14T10:00:00Z',
        event: 'CPU threshold exceeded',
        severity: 'critical',
      },
    ],
    ...overrides,
  };
}

describe('IncidentTable', () => {
  it('icon-only pagination 버튼과 상세 닫기 버튼은 accessible name을 가져야 한다', () => {
    const report = createReport();
    const onPrevPage = vi.fn();
    const onNextPage = vi.fn();
    const onCloseDetail = vi.fn();

    render(
      <IncidentTable
        reports={[report]}
        loading={false}
        selectedReport={report}
        pagination={{
          page: 2,
          limit: 10,
          total: 30,
          totalPages: 3,
        }}
        formatDate={() => '2026-04-14 10:00'}
        onReportSelect={vi.fn()}
        onCloseDetail={onCloseDetail}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    fireEvent.click(screen.getByRole('button', { name: '보고서 상세 닫기' }));

    expect(onPrevPage).toHaveBeenCalledTimes(1);
    expect(onNextPage).toHaveBeenCalledTimes(1);
    expect(onCloseDetail).toHaveBeenCalledTimes(1);
  });
});
