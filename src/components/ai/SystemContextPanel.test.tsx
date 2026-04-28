/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemContextPanel from './SystemContextPanel';

const mockCheck = vi.fn();
const mockUseHealthCheck = vi.fn();

vi.mock('@/hooks/system/useHealthCheck', () => ({
  useHealthCheck: () => mockUseHealthCheck(),
}));

vi.mock('@/components/ai-sidebar/AIDebugPanel', () => ({
  AIDebugPanel: () => <div data-testid="ai-debug-panel">debug</div>,
}));

describe('SystemContextPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('error 상태를 Checking으로 오인하지 않고 Error로 표시해야 한다', () => {
    mockUseHealthCheck.mockReturnValue({
      providers: [],
      status: 'error',
      lastChecked: new Date('2026-04-14T04:00:00.000Z'),
      isChecking: false,
      check: mockCheck,
      error: 'HTTP 503',
    });

    render(<SystemContextPanel />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Checking')).not.toBeInTheDocument();
  });

  it('새로고침 버튼은 health check를 다시 요청해야 한다', () => {
    mockUseHealthCheck.mockReturnValue({
      providers: [],
      status: 'healthy',
      lastChecked: new Date('2026-04-14T04:00:00.000Z'),
      isChecking: false,
      check: mockCheck,
      error: null,
    });

    render(<SystemContextPanel />);

    fireEvent.click(screen.getByTitle('새로고침'));
    expect(mockCheck).toHaveBeenCalled();
  });

  it('provider 세부 상태가 없으면 Configured 배지와 라우팅 안내를 표시해야 한다', () => {
    mockUseHealthCheck.mockReturnValue({
      providers: [],
      status: 'healthy',
      lastChecked: new Date('2026-04-14T04:00:00.000Z'),
      isChecking: false,
      check: mockCheck,
      error: null,
    });

    render(<SystemContextPanel />);

    expect(screen.getByText('Provider Routing')).toBeInTheDocument();
    expect(screen.getAllByText('Configured').length).toBeGreaterThanOrEqual(4);
    expect(
      screen.getByText(/표시 역할은 현재 라우팅 정책 기준이며/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
  });

  it('AI Engine health badge를 단일 3-state badge로 노출해야 한다', () => {
    mockUseHealthCheck.mockReturnValue({
      providers: [],
      status: 'unknown',
      lastChecked: new Date('2026-04-14T04:00:00.000Z'),
      isChecking: false,
      check: mockCheck,
      error: null,
    });

    render(<SystemContextPanel />);

    expect(screen.getByTestId('ai-engine-health-badge')).toHaveAttribute(
      'data-status',
      'unknown'
    );
    expect(screen.getAllByText(/AI Engine|AI 엔진 상태/)).toHaveLength(1);
  });

  it('health refresh target은 desktop 24px 이상 계약을 가져야 한다', () => {
    mockUseHealthCheck.mockReturnValue({
      providers: [],
      status: 'healthy',
      lastChecked: new Date('2026-04-14T04:00:00.000Z'),
      isChecking: false,
      check: mockCheck,
      error: null,
    });

    render(<SystemContextPanel />);

    const refreshButton = screen.getByTitle('새로고침');
    expect(refreshButton).toHaveClass('min-h-6');
    expect(refreshButton).toHaveClass('min-w-6');
  });

  it('finalProvider가 있으면 해당 provider chip만 활성 fill로 강조해야 한다', () => {
    mockUseHealthCheck.mockReturnValue({
      providers: [],
      status: 'healthy',
      lastChecked: new Date('2026-04-14T04:00:00.000Z'),
      isChecking: false,
      check: mockCheck,
      error: null,
    });

    const props = {
      finalProvider: 'groq',
    } as unknown as ComponentProps<typeof SystemContextPanel>;

    render(<SystemContextPanel {...props} />);

    expect(screen.getByTestId('provider-chip-groq')).toHaveAttribute(
      'data-active-provider',
      'true'
    );
    expect(screen.getByTestId('provider-chip-groq')).toHaveClass('bg-primary');
    expect(screen.getByTestId('provider-chip-cerebras')).toHaveAttribute(
      'data-active-provider',
      'false'
    );
  });
});
