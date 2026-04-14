/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IncidentHistoryPage } from './IncidentHistoryPage';

const useIncidentHistoryMock = vi.fn();

vi.mock('./useIncidentHistory', () => ({
  useIncidentHistory: () => useIncidentHistoryMock(),
}));

describe('IncidentHistoryPage', () => {
  it('보고서가 없을 때 footer 범위를 0 - 0으로 표시해야 한다', () => {
    useIncidentHistoryMock.mockReturnValue({
      reports: [],
      loading: false,
      error: null,
      selectedReport: null,
      filters: {
        severity: 'all',
        status: 'all',
        dateRange: '30d',
        search: '',
      },
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
      showFilters: false,
      searchInput: '',
      handleRefresh: vi.fn(),
      handleSearchChange: vi.fn(),
      handleSeverityChange: vi.fn(),
      handleStatusChange: vi.fn(),
      handleDateRangeChange: vi.fn(),
      toggleFilters: vi.fn(),
      handlePrevPage: vi.fn(),
      handleNextPage: vi.fn(),
      handleReportSelect: vi.fn(),
      handleCloseDetail: vi.fn(),
      clearFilters: vi.fn(),
      formatDate: vi.fn(),
    });

    render(<IncidentHistoryPage />);

    expect(screen.getByText('총 0개 보고서')).toBeInTheDocument();
    expect(screen.getByText('0 - 0 표시 중')).toBeInTheDocument();
  });
});
