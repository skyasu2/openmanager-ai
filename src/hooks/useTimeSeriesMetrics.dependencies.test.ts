/**
 * @vitest-environment jsdom
 */

/**
 * 🧪 useTimeSeriesMetrics 훅 테스트
 *
 * 시계열 메트릭 데이터 훅의 동작을 검증
 * - API 호출
 * - 예측/이상탐지 데이터 포함
 * - 자동 새로고침
 * - 에러 처리
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from '../../tests/utils/mock-response';
import {
  type TimeSeriesData,
  useTimeSeriesMetrics,
} from './useTimeSeriesMetrics';

// Mock fetch - 각 테스트에서 재설정됨
const mockFetch = vi.fn();

// Mock 응답 데이터 생성
function createMockTimeSeriesData(
  overrides?: Partial<TimeSeriesData>
): TimeSeriesData {
  const now = Date.now();
  return {
    serverId: 'server-1',
    serverName: 'Test Server',
    metric: 'cpu',
    history: Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(now - (10 - i) * 300000).toISOString(),
      value: 50 + Math.random() * 20,
    })),
    prediction: Array.from({ length: 5 }, (_, i) => ({
      timestamp: new Date(now + i * 300000).toISOString(),
      predicted: 55 + Math.random() * 15,
      upper: 65 + Math.random() * 15,
      lower: 45 + Math.random() * 15,
    })),
    anomalies: [
      {
        startTime: new Date(now - 3600000).toISOString(),
        endTime: new Date(now - 1800000).toISOString(),
        severity: 'high' as const,
        metric: 'cpu',
        description: 'CPU spike detected',
      },
    ],
    ...overrides,
  };
}

function createSuccessResponse(data: TimeSeriesData) {
  return createMockResponse({ success: true, data }, true, 200);
}

function createErrorResponse(status: number) {
  return createMockResponse(
    { success: false, message: 'API Error' },
    false,
    status
  );
}

describe('🎯 useTimeSeriesMetrics - 시계열 메트릭 훅 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 각 테스트 전에 fetch를 다시 모킹 (restoreAllMocks로 인한 복원 방지)
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('의존성 변경', () => {
    it('serverId가 변경되면 데이터를 다시 가져온다', async () => {
      const mockData1 = createMockTimeSeriesData({ serverId: 'server-1' });
      const mockData2 = createMockTimeSeriesData({ serverId: 'server-2' });

      mockFetch
        .mockResolvedValueOnce(createSuccessResponse(mockData1))
        .mockResolvedValueOnce(createSuccessResponse(mockData2));

      const { result, rerender } = renderHook(
        ({ serverId }) =>
          useTimeSeriesMetrics({
            serverId,
            metric: 'cpu',
          }),
        { initialProps: { serverId: 'server-1' } }
      );

      await waitFor(() => {
        expect(result.current.data?.serverId).toBe('server-1');
      });

      // serverId 변경
      rerender({ serverId: 'server-2' });

      await waitFor(() => {
        expect(result.current.data?.serverId).toBe('server-2');
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('metric이 변경되면 데이터를 다시 가져온다', async () => {
      const cpuData = createMockTimeSeriesData({ metric: 'cpu' });
      const memoryData = createMockTimeSeriesData({ metric: 'memory' });

      mockFetch
        .mockResolvedValueOnce(createSuccessResponse(cpuData))
        .mockResolvedValueOnce(createSuccessResponse(memoryData));

      const { result, rerender } = renderHook(
        ({ metric }) =>
          useTimeSeriesMetrics({
            serverId: 'server-1',
            metric,
          }),
        { initialProps: { metric: 'cpu' as const } }
      );

      await waitFor(() => {
        expect(result.current.data?.metric).toBe('cpu');
      });

      // metric 변경
      rerender({ metric: 'memory' as const });

      await waitFor(() => {
        expect(result.current.data?.metric).toBe('memory');
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('range가 변경되면 데이터를 다시 가져온다', async () => {
      const mockData = createMockTimeSeriesData();
      mockFetch.mockResolvedValue(createSuccessResponse(mockData));

      const { rerender } = renderHook(
        ({ range }) =>
          useTimeSeriesMetrics({
            serverId: 'server-1',
            metric: 'cpu',
            range,
          }),
        { initialProps: { range: '6h' as const } }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // range 변경
      rerender({ range: '24h' as const });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const secondCallUrl = mockFetch.mock.calls[1][0];
      expect(secondCallUrl).toContain('range=24h');
    });
  });

  describe('다양한 메트릭 타입', () => {
    const metricTypes = ['cpu', 'memory', 'disk', 'network'] as const;

    metricTypes.forEach((metric) => {
      it(`${metric} 메트릭 데이터를 가져올 수 있다`, async () => {
        const mockData = createMockTimeSeriesData({ metric });
        mockFetch.mockResolvedValueOnce(createSuccessResponse(mockData));

        const { result } = renderHook(() =>
          useTimeSeriesMetrics({
            serverId: 'server-1',
            metric,
          })
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data?.metric).toBe(metric);
        expect(result.current.data?.history).toBeDefined();
        expect(result.current.data?.history.length).toBeGreaterThan(0);
      });
    });
  });

  describe('다양한 시간 범위', () => {
    const timeRanges = ['1h', '6h', '24h', '7d'] as const;

    timeRanges.forEach((range) => {
      it(`${range} 시간 범위로 데이터를 요청할 수 있다`, async () => {
        const mockData = createMockTimeSeriesData();
        mockFetch.mockResolvedValueOnce(createSuccessResponse(mockData));

        renderHook(() =>
          useTimeSeriesMetrics({
            serverId: 'server-1',
            metric: 'cpu',
            range,
          })
        );

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalled();
        });

        const calledUrl = mockFetch.mock.calls[0][0];
        const expectedRange = range === '7d' ? '168h' : range;
        expect(calledUrl).toContain(`range=${expectedRange}`);
      });
    });
  });
});
