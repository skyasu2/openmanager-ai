/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatNsTimestamp,
  formatTimestamp,
  getLogLevelStyles,
  LegacyLogView,
  StreamsView,
  ViewButton,
} from './EnhancedServerModal.LogsTab.parts';

describe('EnhancedServerModal.LogsTab.parts', () => {
  it('잘못된 일반 타임스탬프를 현재 시각으로 위장하지 않아야 한다', () => {
    expect(formatTimestamp('not-a-real-date')).toBe('--:--:--');
  });

  it('잘못된 나노초 타임스탬프를 현재 시각으로 위장하지 않아야 한다', () => {
    expect(formatNsTimestamp('not-a-real-ns')).toBe('--:--:--.---');
  });

  it('토글 버튼 상태를 aria 속성으로 노출해야 한다', () => {
    render(<ViewButton active={true} onClick={vi.fn()} label="Streams" />);

    expect(screen.getByRole('button', { name: 'Streams' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('stream 확장 버튼은 aria-expanded 상태를 노출해야 한다', () => {
    render(
      <StreamsView
        logqlQuery={'{hostname="web-01"}'}
        availableLabels={{ jobs: ['nginx'], levels: ['error'] }}
        labelFilters={{ job: 'nginx', level: 'error' }}
        toggleFilter={vi.fn()}
        streams={[
          {
            stream: {
              job: 'nginx',
              hostname: 'web-01',
              level: 'error',
              environment: 'prod',
              datacenter: 'dc1',
              server_type: 'web',
            },
            values: [['1713170000000000000', 'fatal error']],
          },
        ]}
        expandedStreams={new Set<string>()}
        toggleStream={vi.fn()}
        ctx={{
          hostname: 'web-01',
          environment: 'prod',
          datacenter: 'dc1',
          serverType: 'web',
        }}
      />
    );

    const streamToggle = screen.getByRole('button', {
      name: /ERROR.*nginx/i,
    });
    expect(streamToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(streamToggle);
  });

  it('legacy log terminal keeps bounded internal scrolling for long logs', () => {
    render(
      <LegacyLogView
        activeView="syslog"
        displayLogs={[
          {
            timestamp: '2026-03-23T00:00:00Z',
            level: 'error',
            source: 'kernel',
            message: 'x'.repeat(240),
          },
        ]}
      />
    );

    const terminal = screen.getByTestId('server-log-terminal-scroll');
    const message = screen.getByTestId('server-log-message');

    expect(terminal).toHaveClass('overflow-y-auto');
    expect(terminal).toHaveClass('max-h-[500px]');
    expect(message).toHaveClass('break-words');
  });

  it('legacy log terminal uses light theme classes, not dark terminal remnants', () => {
    render(
      <LegacyLogView
        activeView="syslog"
        displayLogs={[
          {
            timestamp: '2026-03-23T00:00:00Z',
            level: 'error',
            source: 'kernel',
            message: 'kernel error',
          },
        ]}
      />
    );

    const terminal = screen.getByTestId('server-log-terminal-scroll');
    const message = screen.getByTestId('server-log-message');

    expect(terminal).toHaveClass('bg-white');
    expect(message).toHaveClass('text-red-700');
    expect(terminal.parentElement?.className).not.toContain('border-slate-700');
    expect(terminal.parentElement?.innerHTML).not.toContain('from-gray-900');
  });

  it('log level text colors are readable on a light background', () => {
    expect(getLogLevelStyles('error').textClass).toBe('text-red-700');
    expect(getLogLevelStyles('warn').textClass).toBe('text-amber-700');
    expect(getLogLevelStyles('info').textClass).toBe('text-green-700');
  });

  it('streams view uses light surfaces and Korean empty state copy', () => {
    render(
      <StreamsView
        logqlQuery={'{hostname="web-01"}'}
        availableLabels={{ jobs: ['nginx'], levels: ['error'] }}
        labelFilters={{}}
        toggleFilter={vi.fn()}
        streams={[]}
        expandedStreams={new Set<string>()}
        toggleStream={vi.fn()}
        ctx={{
          hostname: 'web-01',
          environment: 'prod',
          datacenter: 'dc1',
          serverType: 'web',
        }}
      />
    );

    expect(screen.getByText('일치하는 스트림 없음')).toBeInTheDocument();
    expect(
      screen.getByText('레이블 필터를 조정하면 로그 스트림이 표시됩니다')
    ).toBeInTheDocument();
    expect(screen.queryByText('No matching streams')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('from-gray-900');
    expect(document.body.innerHTML).not.toContain('bg-white/5');
  });
});
