/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonitoringReportResponse } from '@/schemas/api.monitoring-report.schema';
import { useMonitoringReport } from './useMonitoringReport';

const mockFetch = vi.fn();

function createValidMonitoringResponse(): MonitoringReportResponse {
  return {
    success: true,
    timestamp: '2026-02-13T10:00:00.000Z',
    health: {
      score: 89,
      grade: 'B',
      penalties: {
        criticalAlerts: 0,
        warningAlerts: 5,
        highCpuAvg: 1,
        highMemoryAvg: 0,
        highDiskAvg: 0,
        longFiringAlerts: 0,
      },
    },
    aggregated: {
      statusCounts: {
        total: 15,
        online: 14,
        warning: 1,
        critical: 0,
        offline: 0,
      },
      byServerType: [
        {
          serverType: 'web',
          count: 5,
          avgCpu: 45,
          avgMemory: 40,
          avgDisk: 30,
          avgNetwork: 20,
          maxCpu: 70,
          maxMemory: 65,
          onlineCount: 5,
          warningCount: 0,
          criticalCount: 0,
        },
      ],
      topCpu: [
        {
          serverId: 'web-1',
          instance: 'web-1:9100',
          serverType: 'web',
          value: 70,
        },
      ],
      topMemory: [
        {
          serverId: 'web-1',
          instance: 'web-1:9100',
          serverType: 'web',
          value: 65,
        },
      ],
      avgCpu: 45,
      avgMemory: 40,
      avgDisk: 30,
      avgNetwork: 20,
    },
    firingAlerts: [],
    resolvedAlerts: [],
    metadata: {
      dataSource: 'hourly-data',
      processingTime: 5,
    },
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
}

describe('useMonitoringReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('성공 응답을 파싱해 데이터를 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createValidMonitoringResponse(),
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result, unmount } = renderHook(() => useMonitoringReport(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.health.score).toBe(89);

    unmount();
    queryClient.clear();
  });

  it('HTTP 오류 + 표준 에러 응답이면 message를 노출한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Monitoring report failed',
        message: 'backend unavailable',
        code: 'MONITORING_DATA_SOURCE_TIMEOUT',
      }),
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result, unmount } = renderHook(() => useMonitoringReport(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      '모니터링 데이터 소스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
    );

    unmount();
    queryClient.clear();
  });

  it('HTTP 200이라도 success=false면 에러로 처리한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        error: 'Monitoring report failed',
        message: 'data source timeout',
        code: 'MONITORING_CONTEXT_ERROR',
      }),
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result, unmount } = renderHook(() => useMonitoringReport(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      '모니터링 데이터를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    );

    unmount();
    queryClient.clear();
  });

  it('비표준 응답은 포맷 에러로 처리한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ foo: 'bar' }),
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result, unmount } = renderHook(() => useMonitoringReport(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      'Invalid monitoring report response format'
    );

    unmount();
    queryClient.clear();
  });
});
