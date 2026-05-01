/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { type ComponentType, createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGlobalLogs } from '@/hooks/dashboard/useGlobalLogs';
import { LogExplorerModal, LogExplorerPanel } from './LogExplorerModal';

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock('@/hooks/dashboard/useGlobalLogs', () => ({
  useGlobalLogs: vi.fn(),
}));

const mockedUseGlobalLogs = vi.mocked(useGlobalLogs);

function createLog(overrides: {
  timestamp?: string;
  level?: 'info' | 'warn' | 'error';
  message: string;
  source?: string;
  serverId?: string;
}) {
  return {
    timestamp: overrides.timestamp ?? '2026-02-13T10:00:00.000Z',
    level: overrides.level ?? 'warn',
    message: overrides.message,
    source: overrides.source ?? 'nginx',
    serverId: overrides.serverId ?? 'web-01',
  };
}

describe('LogExplorerModal display contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerPush.mockClear();
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

  it('로그 행은 기본 1줄 압축 상태이며 클릭하면 메시지를 확장한다', () => {
    render(<LogExplorerModal open onClose={vi.fn()} />);

    const row = screen.getByTestId('log-explorer-log-row');
    const message = screen.getByTestId('log-explorer-log-message');

    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(row).toHaveClass('flex-nowrap');
    expect(message).toHaveClass('truncate');

    fireEvent.click(row);

    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(message).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(message).not.toHaveClass('truncate');
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

  it('초기 서버 필터가 있으면 로그 API 필터와 UI 선택값에 반영한다', () => {
    render(
      createElement(
        LogExplorerPanel as ComponentType<Record<string, unknown>>,
        {
          active: true,
          initialServerId: 'web-01',
        }
      )
    );

    expect(mockedUseGlobalLogs).toHaveBeenCalledWith(
      expect.objectContaining({ serverId: 'web-01' })
    );
    expect(screen.getByLabelText('서버 필터')).toHaveValue('web-01');
    expect(screen.getByTestId('log-explorer-filter-summary')).toHaveTextContent(
      '서버 web-01'
    );
  });

  it('같은 서버의 동일 반복 패턴 로그는 하나의 그룹 행으로 축소한다', () => {
    mockedUseGlobalLogs.mockReturnValue({
      logs: [
        createLog({
          timestamp: '2026-02-13T10:00:00.000Z',
          message: 'nfsd WARNING pressure cpu=65% mem=40% disk=83%',
          serverId: 'storage-nfs-dc1-01',
          source: 'nfsd',
        }),
        createLog({
          timestamp: '2026-02-13T10:00:10.000Z',
          message: 'nfsd WARNING pressure cpu=67% mem=41% disk=84%',
          serverId: 'storage-nfs-dc1-01',
          source: 'nfsd',
        }),
      ],
      stats: {
        total: 2,
        info: 0,
        warn: 2,
        error: 0,
      },
      sources: ['nfsd'],
      serverIds: ['storage-nfs-dc1-01'],
      isLoading: false,
      isError: false,
      errorMessage: null,
      retry: vi.fn(),
      windowStart: '2026-02-13T00:00:00.000Z',
      windowEnd: '2026-02-13T23:59:00.000Z',
    });

    render(<LogExplorerModal open onClose={vi.fn()} />);

    expect(screen.getAllByTestId('log-explorer-log-row')).toHaveLength(1);
    expect(screen.getByTestId('log-explorer-log-row')).toHaveTextContent('×2');

    fireEvent.click(screen.getByTestId('log-explorer-log-row'));

    expect(
      screen.getByTestId('log-explorer-log-group-details')
    ).toHaveTextContent('cpu=67%');
  });

  it('로그 결과는 50개 청크로 렌더링하고 더 보기로 다음 청크를 추가한다', () => {
    mockedUseGlobalLogs.mockReturnValue({
      logs: Array.from({ length: 60 }, (_, index) =>
        createLog({
          timestamp: `2026-02-13T10:${String(index).padStart(2, '0')}:00.000Z`,
          message: `unique log message ${index}`,
          source: 'app',
          serverId: `web-${index}`,
        })
      ),
      stats: {
        total: 60,
        info: 0,
        warn: 60,
        error: 0,
      },
      sources: ['app'],
      serverIds: Array.from({ length: 60 }, (_, index) => `web-${index}`),
      isLoading: false,
      isError: false,
      errorMessage: null,
      retry: vi.fn(),
      windowStart: '2026-02-13T00:00:00.000Z',
      windowEnd: '2026-02-13T23:59:00.000Z',
    });

    render(<LogExplorerModal open onClose={vi.fn()} />);

    expect(screen.getAllByTestId('log-explorer-log-row')).toHaveLength(50);
    expect(
      screen.getByTestId('log-explorer-load-sentinel')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '더 보기 (10건 남음)' })
    );

    expect(screen.getAllByTestId('log-explorer-log-row')).toHaveLength(60);
  });

  it('로그 행 알림 버튼은 서버 필터가 적용된 알림 페이지로 이동한다', () => {
    render(<LogExplorerModal open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'web-01 알림 이력 보기' })
    );

    expect(routerPush).toHaveBeenCalledWith('/dashboard/alerts?server=web-01');
  });

  it('로그 행 알림 버튼은 서버 ID를 URL 안전하게 인코딩한다', () => {
    mockedUseGlobalLogs.mockReturnValue({
      logs: [
        createLog({
          message: 'server id needs encoding',
          serverId: 'api was/dc1-01',
        }),
      ],
      stats: {
        total: 1,
        info: 0,
        warn: 1,
        error: 0,
      },
      sources: ['nginx'],
      serverIds: ['api was/dc1-01'],
      isLoading: false,
      isError: false,
      errorMessage: null,
      retry: vi.fn(),
      windowStart: '2026-02-13T00:00:00.000Z',
      windowEnd: '2026-02-13T23:59:00.000Z',
    });

    render(<LogExplorerModal open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'api was/dc1-01 알림 이력 보기' })
    );

    expect(routerPush).toHaveBeenCalledWith(
      '/dashboard/alerts?server=api%20was%2Fdc1-01'
    );
  });

  it('반복 그룹 상세 행도 알림 페이지 링크를 제공한다', () => {
    mockedUseGlobalLogs.mockReturnValue({
      logs: [
        createLog({
          timestamp: '2026-02-13T10:00:00.000Z',
          message: 'nfsd WARNING pressure cpu=65% mem=40% disk=83%',
          serverId: 'storage-nfs-dc1-01',
          source: 'nfsd',
        }),
        createLog({
          timestamp: '2026-02-13T10:00:10.000Z',
          message: 'nfsd WARNING pressure cpu=67% mem=41% disk=84%',
          serverId: 'storage-nfs-dc1-01',
          source: 'nfsd',
        }),
      ],
      stats: {
        total: 2,
        info: 0,
        warn: 2,
        error: 0,
      },
      sources: ['nfsd'],
      serverIds: ['storage-nfs-dc1-01'],
      isLoading: false,
      isError: false,
      errorMessage: null,
      retry: vi.fn(),
      windowStart: '2026-02-13T00:00:00.000Z',
      windowEnd: '2026-02-13T23:59:00.000Z',
    });

    render(<LogExplorerModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('log-explorer-log-row'));

    expect(
      screen.getAllByRole('button', {
        name: 'storage-nfs-dc1-01 알림 이력 보기',
      })
    ).toHaveLength(2);

    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'storage-nfs-dc1-01 알림 이력 보기',
      })[1]
    );

    expect(routerPush).toHaveBeenCalledWith(
      '/dashboard/alerts?server=storage-nfs-dc1-01'
    );
  });
});
