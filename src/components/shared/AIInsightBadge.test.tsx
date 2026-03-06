/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AIInsightBadge } from './AIInsightBadge';

describe('AIInsightBadge', () => {
  it('임계치 초과 시 Critical 배지를 표시한다', () => {
    render(<AIInsightBadge cpu={91} memory={40} disk={20} />);

    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('상승 추세와 경고 수준이 겹치면 Unusual 배지를 표시한다', () => {
    render(
      <AIInsightBadge
        cpu={80}
        memory={70}
        historyData={[
          { cpu: 20, memory: 30 },
          { cpu: 28, memory: 38 },
          { cpu: 35, memory: 45 },
          { cpu: 42, memory: 52 },
          { cpu: 50, memory: 58 },
        ]}
      />
    );

    expect(screen.getByText('Unusual')).toBeInTheDocument();
  });

  it('기본 상태에서는 Stable 배지를 표시한다', () => {
    render(<AIInsightBadge cpu={30} memory={45} disk={25} />);

    expect(screen.getByText('Stable')).toBeInTheDocument();
  });
});
