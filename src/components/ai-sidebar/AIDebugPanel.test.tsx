/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIDebugPanel } from './AIDebugPanel';

const { mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

describe('AIDebugPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks Cloud Run health timeout degraded responses as warming', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'degraded',
            recoverable: true,
            reasonCode: 'cloud_run_health_timeout',
            latency: 5001,
          }),
        })
    );

    render(<AIDebugPanel />);
    fireEvent.click(screen.getByTestId('ai-debug-check'));

    await waitFor(() => {
      expect(screen.getByText(/웜업 중/)).toBeInTheDocument();
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'AI 엔진 웜업 중입니다. 실제 질의는 재시도 경로를 사용합니다.'
    );
  });

  it('does not label non-timeout degraded responses as warming', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'degraded',
            recoverable: true,
            reasonCode: 'cloud_run_health_network_error',
            error: 'fetch failed',
          }),
        })
    );

    render(<AIDebugPanel />);
    fireEvent.click(screen.getByTestId('ai-debug-check'));

    await waitFor(() => {
      expect(screen.getByText('오프라인')).toBeInTheDocument();
    });
    expect(mockToastError).toHaveBeenCalledWith('연결 실패: fetch failed');
  });
});
