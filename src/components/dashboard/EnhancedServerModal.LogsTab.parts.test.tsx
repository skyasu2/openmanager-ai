/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatNsTimestamp,
  formatTimestamp,
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
});
