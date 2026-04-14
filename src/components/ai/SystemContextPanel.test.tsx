/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
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
});
