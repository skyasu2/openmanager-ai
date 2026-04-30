/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGlobalLogs } from '@/hooks/dashboard/useGlobalLogs';
import { LogExplorerModal } from './LogExplorerModal';

vi.mock('@/hooks/dashboard/useGlobalLogs', () => ({
  useGlobalLogs: vi.fn(),
}));

const mockedUseGlobalLogs = vi.mocked(useGlobalLogs);

describe('LogExplorerModal display contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGlobalLogs.mockReturnValue({
      logs: [
        {
          timestamp: '2026-02-13T10:00:00.000Z',
          level: 'error',
          message:
            'CriticalErrorWithVeryLongTokenWithoutWhitespaceThatMustWrapInsideTheTerminalPane',
          source: 'nginx',
          serverId: 'web-01',
        },
      ],
      stats: {
        total: 1,
        info: 0,
        warn: 0,
        error: 1,
      },
      sources: ['nginx'],
      serverIds: ['web-01'],
      isLoading: false,
      isError: false,
      errorMessage: null,
      retry: vi.fn(),
      windowStart: '2026-02-13T00:00:00.000Z',
      windowEnd: '2026-02-13T23:59:00.000Z',
    });
  });

  it('긴 로그 메시지는 터미널 영역 안에서 wrap 가능한 구조로 표시한다', () => {
    render(<LogExplorerModal open onClose={vi.fn()} />);

    expect(screen.getByTestId('log-explorer-terminal')).toHaveClass(
      'min-h-[320px]',
      'overflow-hidden'
    );
    expect(screen.getByTestId('log-explorer-log-message')).toHaveClass(
      'min-w-0',
      'break-words'
    );
  });

  it('ERROR 로그 행은 전체 행 배경으로 강조한다', () => {
    render(<LogExplorerModal open onClose={vi.fn()} />);

    expect(screen.getByTestId('log-explorer-log-row')).toHaveClass('bg-red-50');
  });

  it('활성 필터 요약과 초기화를 제공한다', () => {
    render(<LogExplorerModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('로그 키워드 검색'), {
      target: { value: 'critical' },
    });
    fireEvent.change(screen.getByLabelText('소스 필터'), {
      target: { value: 'nginx' },
    });
    fireEvent.change(screen.getByLabelText('서버 필터'), {
      target: { value: 'web-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: '오류' }));

    const summary = screen.getByTestId('log-explorer-filter-summary');
    expect(summary).toHaveTextContent('레벨 ERROR');
    expect(summary).toHaveTextContent('소스 nginx');
    expect(summary).toHaveTextContent('서버 web-01');
    expect(summary).toHaveTextContent('검색어 "critical"');

    fireEvent.click(screen.getByRole('button', { name: /초기화/ }));

    expect(screen.getByLabelText('로그 키워드 검색')).toHaveValue('');
    expect(summary).toHaveTextContent('없음');
  });

  it('통계 셀 클릭으로 레벨 필터를 토글한다', () => {
    render(<LogExplorerModal open onClose={vi.fn()} />);

    const errorStat = screen.getByTestId('log-stat-error');
    fireEvent.click(errorStat);

    expect(errorStat).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('log-explorer-filter-summary')).toHaveTextContent(
      '레벨 ERROR'
    );

    fireEvent.click(errorStat);

    expect(errorStat).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('log-explorer-filter-summary')).toHaveTextContent(
      '없음'
    );
  });
});
