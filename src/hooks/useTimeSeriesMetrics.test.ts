/**
 * @vitest-environment jsdom
 *
 * useTimeSeriesMetrics 단위 테스트
 *
 * Legacy (timeseries) 응답 포맷과 Server History 포맷 양쪽을 검증.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type UseTimeSeriesMetricsOptions,
  useTimeSeriesMetrics,
} from './useTimeSeriesMetrics';

vi.mock('@/lib/logging', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const BASE_OPTS: UseTimeSeriesMetricsOptions = {
  serverId: 'server-001',
  metric: 'cpu',
  range: '1h',
};

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const legacyResponse = (opts?: { metric?: string }) => ({
  success: true,
  data: {
    serverId: 'server-001',
    serverName: 'web-01',
    metric: opts?.metric ?? 'cpu',
    history: [
      { timestamp: '2026-01-01T00:00:00Z', value: 42 },
      { timestamp: '2026-01-01T00:10:00Z', value: 55 },
    ],
    prediction: [
      {
        timestamp: '2026-01-01T01:00:00Z',
        predicted: 60,
        upper: 70,
        lower: 50,
      },
    ],
  },
});

const serverHistoryResponse = () => ({
  success: true,
  data: {
    server_info: { id: 'server-001', hostname: 'web-01' },
    history: {
      data_points: [
        {
          timestamp: '2026-01-01T00:00:00Z',
          metrics: {
            cpu_usage: 30,
            memory_usage: 60,
            disk_usage: 40,
            network_in: 5,
            network_out: 3,
          },
        },
      ],
    },
    alerts: [
      {
        metric: 'cpu',
        severity: 'high',
        message: 'CPU 과부하',
        firedAt: '2026-01-01T00:05:00Z',
        resolvedAt: '2026-01-01T00:15:00Z',
      },
    ],
  },
});

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // vi.useFakeTimers()는 waitFor()와 충돌 — Auto refresh 테스트에만 로컬 적용
  fetchSpy = vi.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
  vi.useRealTimers();
});

describe('useTimeSeriesMetrics', () => {
  describe('초기 상태 및 로딩', () => {
    it('초기에는 isLoading=true, data=null을 반환한다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(legacyResponse()));

      const { result } = renderHook(() => useTimeSeriesMetrics(BASE_OPTS));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  describe('Legacy 응답 포맷', () => {
    it('legacy 형식 응답을 TimeSeriesData로 정규화한다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(legacyResponse()));

      const { result } = renderHook(() => useTimeSeriesMetrics(BASE_OPTS));

      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(result.current.data?.serverId).toBe('server-001');
      expect(result.current.data?.serverName).toBe('web-01');
      expect(result.current.data?.history).toHaveLength(2);
      expect(result.current.data?.history[0].value).toBe(42);
      expect(result.current.error).toBeNull();
    });

    it('includePrediction=true 시 예측 데이터가 포함된다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(legacyResponse()));

      const { result } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, includePrediction: true })
      );

      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(result.current.data?.prediction).toHaveLength(1);
    });

    it('includePrediction=false 시 예측 데이터가 제외된다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(legacyResponse()));

      const { result } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, includePrediction: false })
      );

      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(result.current.data?.prediction).toBeUndefined();
    });
  });

  describe('Server History 응답 포맷', () => {
    it('server history 형식 응답을 TimeSeriesData로 정규화한다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(serverHistoryResponse()));

      const { result } = renderHook(() => useTimeSeriesMetrics(BASE_OPTS));

      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(result.current.data?.serverId).toBe('server-001');
      expect(result.current.data?.history).toHaveLength(1);
      expect(result.current.data?.history[0].value).toBe(30); // cpu_usage
    });

    it('includeAnomalies=true 시 alerts를 anomalies로 변환한다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(serverHistoryResponse()));

      const { result } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, includeAnomalies: true })
      );

      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(result.current.data?.anomalies).toHaveLength(1);
      expect(result.current.data?.anomalies?.[0].severity).toBe('high');
    });

    it('includeAnomalies=false 시 anomalies가 undefined다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(serverHistoryResponse()));

      const { result } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, includeAnomalies: false })
      );

      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(result.current.data?.anomalies).toBeUndefined();
    });
  });

  describe('메트릭 매핑', () => {
    it.each([
      ['cpu', 30],
      ['memory', 60],
      ['disk', 40],
    ] as const)('%s 메트릭을 올바르게 추출한다', async (metric, expected) => {
      fetchSpy.mockResolvedValueOnce(ok(serverHistoryResponse()));

      const { result } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, metric })
      );

      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(result.current.data?.history[0].value).toBe(expected);
    });

    it('network 메트릭은 in+out 합산을 반환한다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(serverHistoryResponse()));

      const { result } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, metric: 'network' })
      );

      await waitFor(() => expect(result.current.data).not.toBeNull());
      // network_in(5) + network_out(3) = 8
      expect(result.current.data?.history[0].value).toBe(8);
    });
  });

  describe('에러 처리', () => {
    it('HTTP 에러 시 error 상태가 설정된다', async () => {
      fetchSpy.mockResolvedValueOnce(new Response('error', { status: 500 }));

      const { result } = renderHook(() => useTimeSeriesMetrics(BASE_OPTS));

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.error).toContain('500');
      expect(result.current.isLoading).toBe(false);
    });

    it('404 응답은 에러 없이 data=null로 처리한다 (Graceful Degradation)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('not found', { status: 404 })
      );

      const { result } = renderHook(() => useTimeSeriesMetrics(BASE_OPTS));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('네트워크 에러 시 error 상태가 설정된다', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('fetch failed'));

      const { result } = renderHook(() => useTimeSeriesMetrics(BASE_OPTS));

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.error).toBe('fetch failed');
    });

    it('success=false 응답 시 error가 설정된다', async () => {
      fetchSpy.mockResolvedValueOnce(
        ok({ success: false, message: '서버 오류' })
      );

      const { result } = renderHook(() => useTimeSeriesMetrics(BASE_OPTS));

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.error).toBe('서버 오류');
    });
  });

  describe('refetch', () => {
    it('refetch() 호출 시 fetch를 다시 보낸다', async () => {
      fetchSpy
        .mockResolvedValueOnce(ok(legacyResponse()))
        .mockResolvedValueOnce(ok(legacyResponse()));

      const { result } = renderHook(() => useTimeSeriesMetrics(BASE_OPTS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.refetch();
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('URL 구성', () => {
    it('올바른 API URL로 요청한다', async () => {
      fetchSpy.mockResolvedValueOnce(ok(legacyResponse()));

      renderHook(() =>
        useTimeSeriesMetrics({
          ...BASE_OPTS,
          serverId: 'my-server',
          range: '24h',
        })
      );

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('/api/servers/my-server');
      expect(url).toContain('range=24h');
      expect(url).toContain('history=true');
    });

    it('serverId가 없으면 fetch를 하지 않는다', async () => {
      const { result } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, serverId: '' })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.current.data).toBeNull();
    });
  });

  describe('Auto refresh', () => {
    it('refreshInterval > 0 이면 interval이 등록된다', async () => {
      vi.useFakeTimers();
      fetchSpy.mockResolvedValue(ok(legacyResponse()));

      const { unmount } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, refreshInterval: 5000 })
      );

      // 초기 fetch 완료 대기 (microtask flush)
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // interval 경과 후 추가 fetch
      await act(async () => {
        vi.advanceTimersByTime(5001);
        await Promise.resolve();
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      unmount();
      vi.useRealTimers();
    });

    it('refreshInterval=0이면 초기 fetch 이후 추가 갱신 없다', async () => {
      fetchSpy.mockResolvedValue(ok(legacyResponse()));

      const { unmount } = renderHook(() =>
        useTimeSeriesMetrics({ ...BASE_OPTS, refreshInterval: 0 })
      );

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
      // 추가 fetch 없음을 확인
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      unmount();
    });
  });
});
