/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealTimeDisplay } from './RealTimeDisplay';

describe('RealTimeDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T03:04:05.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('default variant는 KST 날짜와 시간을 모두 표시한다', () => {
    render(<RealTimeDisplay />);

    expect(screen.getByText('2026.05.21 12:04:05')).toBeInTheDocument();
    expect(screen.getByText('(목)')).toBeInTheDocument();
  });

  it('compact variant는 모바일 헤더용 HH:mm만 표시하고 전체 시간은 접근성 라벨로 유지한다', () => {
    render(<RealTimeDisplay variant="compact" />);

    expect(screen.getByText('12:04')).toBeInTheDocument();
    expect(screen.queryByText('2026.05.21 12:04:05')).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('현재 시간 2026.05.21 12:04:05 (목)')
    ).toBeInTheDocument();
  });
});
