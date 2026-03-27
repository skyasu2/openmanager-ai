/**
 * 시계열 메트릭 데이터 Hook
 *
 * 특정 서버의 시계열 메트릭 데이터, 예측, 이상탐지 결과를 가져옵니다.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { logger } from '@/lib/logging';

// ============================================================================
// Types
// ============================================================================

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface PredictionDataPoint {
  timestamp: string;
  predicted: number;
  upper: number;
  lower: number;
}

export interface AnomalyDataPoint {
  startTime: string;
  endTime: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  description: string;
}

export interface TimeSeriesData {
  serverId: string;
  serverName: string;
  metric: string;
  history: MetricDataPoint[];
  prediction?: PredictionDataPoint[];
  anomalies?: AnomalyDataPoint[];
}

export interface UseTimeSeriesMetricsOptions {
  serverId: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  range?: '1h' | '6h' | '24h' | '7d';
  includePrediction?: boolean;
  includeAnomalies?: boolean;
  refreshInterval?: number; // ms, 0 = no auto refresh
}

export interface UseTimeSeriesMetricsResult {
  data: TimeSeriesData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const rangeToServerRange: Record<
  NonNullable<UseTimeSeriesMetricsOptions['range']>,
  string
> = {
  '1h': '1h',
  '6h': '6h',
  '24h': '24h',
  '7d': '168h',
};

const legacyTimeSeriesResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      serverId: z.string(),
      serverName: z.string(),
      metric: z.string(),
      history: z.array(
        z.object({
          timestamp: z.string(),
          value: z.number(),
        })
      ),
      prediction: z
        .array(
          z.object({
            timestamp: z.string(),
            predicted: z.number(),
            upper: z.number(),
            lower: z.number(),
          })
        )
        .optional(),
      anomalies: z
        .array(
          z.object({
            startTime: z.string(),
            endTime: z.string(),
            severity: z.enum(['low', 'medium', 'high', 'critical']),
            metric: z.string(),
            description: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
  message: z.string().optional(),
});

const serverHistoryResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      server_info: z
        .object({
          id: z.string().optional(),
          hostname: z.string().optional(),
        })
        .optional(),
      history: z
        .object({
          data_points: z
            .array(
              z.object({
                timestamp: z.string(),
                metrics: z
                  .object({
                    cpu_usage: z.number().optional(),
                    memory_usage: z.number().optional(),
                    disk_usage: z.number().optional(),
                    network_in: z.number().optional(),
                    network_out: z.number().optional(),
                  })
                  .passthrough(),
              })
            )
            .optional(),
        })
        .optional(),
      alerts: z
        .array(
          z.object({
            metric: z.string().optional(),
            severity: z.string().optional(),
            message: z.string().optional(),
            firedAt: z.string().optional(),
            resolvedAt: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  message: z.string().optional(),
});

function mapMetricValue(
  metric: UseTimeSeriesMetricsOptions['metric'],
  metrics: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_in?: number;
    network_out?: number;
  }
): number {
  switch (metric) {
    case 'cpu':
      return metrics.cpu_usage ?? 0;
    case 'memory':
      return metrics.memory_usage ?? 0;
    case 'disk':
      return metrics.disk_usage ?? 0;
    case 'network': {
      const inValue = metrics.network_in ?? 0;
      const outValue = metrics.network_out ?? 0;
      return Math.min(100, Math.max(0, inValue + outValue));
    }
    default:
      return 0;
  }
}

function normalizeAlertSeverity(value?: string): AnomalyDataPoint['severity'] {
  switch (value) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'warning':
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

function normalizeToTimeSeriesData(
  payload: unknown,
  options: {
    serverId: string;
    metric: UseTimeSeriesMetricsOptions['metric'];
    includePrediction: boolean;
    includeAnomalies: boolean;
  }
): TimeSeriesData {
  const legacyParsed = legacyTimeSeriesResponseSchema.safeParse(payload);
  if (
    legacyParsed.success &&
    legacyParsed.data.success &&
    legacyParsed.data.data
  ) {
    return {
      ...legacyParsed.data.data,
      prediction: options.includePrediction
        ? legacyParsed.data.data.prediction
        : undefined,
    };
  }

  const serverParsed = serverHistoryResponseSchema.safeParse(payload);
  if (
    serverParsed.success &&
    serverParsed.data.success &&
    serverParsed.data.data
  ) {
    const serverData = serverParsed.data.data;
    const historyPoints = serverData.history?.data_points ?? [];
    const history = historyPoints.map((point) => ({
      timestamp: point.timestamp,
      value: mapMetricValue(options.metric, point.metrics),
    }));

    const anomalies = options.includeAnomalies
      ? (serverData.alerts ?? []).map((alert) => {
          const startTime = alert.firedAt ?? new Date().toISOString();
          const endTime = alert.resolvedAt ?? startTime;
          return {
            startTime,
            endTime,
            severity: normalizeAlertSeverity(alert.severity),
            metric: alert.metric ?? options.metric,
            description:
              alert.message ?? `${options.metric.toUpperCase()} 이상치 감지`,
          };
        })
      : undefined;

    return {
      serverId: serverData.server_info?.id ?? options.serverId,
      serverName: serverData.server_info?.hostname ?? options.serverId,
      metric: options.metric,
      history,
      anomalies,
    };
  }

  throw new Error('시계열 API 응답 형식이 올바르지 않습니다.');
}

// ============================================================================
// Hook
// ============================================================================

export function useTimeSeriesMetrics({
  serverId,
  metric,
  range = '6h',
  includePrediction = true,
  includeAnomalies = true,
  refreshInterval = 0,
}: UseTimeSeriesMetricsOptions): UseTimeSeriesMetricsResult {
  const [data, setData] = useState<TimeSeriesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔧 AbortController를 사용한 안전한 fetch
  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (!serverId || !metric) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          history: 'true',
          range: rangeToServerRange[range],
          format: 'enhanced',
          include_metrics: 'true',
        });

        const response = await fetch(
          `/api/servers/${encodeURIComponent(serverId)}?${params.toString()}`,
          {
            signal, // 🔧 AbortController signal 전달
          }
        );

        if (!response.ok) {
          // 404는 데이터 없음 - 에러로 취급하지 않음 (Graceful Degradation)
          if (response.status === 404) {
            setData(null);
            setIsLoading(false);
            return;
          }
          throw new Error(`API 오류: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '데이터 조회 실패');
        }

        setData(
          normalizeToTimeSeriesData(result, {
            serverId,
            metric,
            includePrediction,
            includeAnomalies,
          })
        );
      } catch (err) {
        // 🔧 AbortError는 정상적인 cleanup이므로 무시
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // 예상 가능한 에러는 debug로 처리
        const message = err instanceof Error ? err.message : '알 수 없는 오류';
        if (message.includes('404')) {
          logger.debug('시계열 데이터 없음:', message);
        } else {
          logger.warn('시계열 데이터 조회 실패:', err);
        }
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [serverId, metric, range, includePrediction, includeAnomalies]
  );

  // 🔧 Initial fetch with AbortController
  useEffect(() => {
    const abortController = new AbortController();
    void fetchData(abortController.signal);

    return () => {
      abortController.abort(); // 컴포넌트 unmount 시 fetch 취소
    };
  }, [fetchData]);

  // 🔧 Auto refresh with AbortController
  useEffect(() => {
    if (refreshInterval <= 0) return;

    let abortController: AbortController | null = null;

    const interval = setInterval(() => {
      abortController = new AbortController();
      void fetchData(abortController.signal);
    }, refreshInterval);

    return () => {
      clearInterval(interval);
      abortController?.abort(); // 진행 중인 fetch 취소
    };
  }, [fetchData, refreshInterval]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
