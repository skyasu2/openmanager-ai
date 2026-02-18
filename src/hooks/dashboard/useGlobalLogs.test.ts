/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGlobalLogs } from './useGlobalLogs';

const mockApiResponse = {
  success: true,
  data: [
    {
      timestamp: '2026-02-13T10:00:00.000Z',
      level: 'info',
      message: 'Server started',
      source: 'systemd',
      serverId: 'web-01',
    },
    {
      timestamp: '2026-02-13T10:01:00.000Z',
      level: 'warn',
      message: 'High memory usage',
      source: 'monitor',
      serverId: 'db-01',
    },
    {
      timestamp: '2026-02-13T10:02:00.000Z',
      level: 'error',
      message: 'Connection refused',
      source: 'nginx',
      serverId: 'web-02',
    },
  ],
  pagination: { page: 1, limit: 100, total: 3, totalPages: 1 },
  metadata: {
    logWindow: { start: '2026-02-13T00:00:00Z', end: '2026-02-13T23:59:00Z' },
    availableSources: ['systemd', 'monitor', 'nginx'],
    availableServers: ['web-01', 'web-02', 'db-01'],
  },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useGlobalLogs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        } as Response)
      )
    );
  });

  it('fetches logs from API and returns correct structure', async () => {
    const { result } = renderHook(() => useGlobalLogs({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.logs).toHaveLength(3);
    expect(result.current.stats.total).toBe(3);
    expect(result.current.stats.info).toBe(1);
    expect(result.current.stats.warn).toBe(1);
    expect(result.current.stats.error).toBe(1);
    expect(result.current.sources).toEqual(['systemd', 'monitor', 'nginx']);
    expect(result.current.serverIds).toEqual(['web-01', 'web-02', 'db-01']);
    expect(result.current.windowStart).toBeTruthy();
    expect(result.current.windowEnd).toBeTruthy();
  });

  it('passes filter params as query parameters', async () => {
    const fetchSpy = vi.mocked(fetch);

    renderHook(
      () =>
        useGlobalLogs({ level: 'warn', source: 'monitor', keyword: 'high' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('level=warn');
    expect(url).toContain('logSource=monitor');
    expect(url).toContain('logKeyword=high');
  });

  it('handles API errors gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        } as Response)
      )
    );

    const { result } = renderHook(() => useGlobalLogs({}), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 10_000 }
    );

    expect(result.current.errorMessage).toContain('500');
    expect(result.current.logs).toHaveLength(0);
  });
});
