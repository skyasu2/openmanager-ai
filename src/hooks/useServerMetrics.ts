import { useCallback, useState } from 'react';
import { logger } from '@/lib/logging';
import { otelTimeSeriesToHistory } from '@/services/metrics/otel-direct-transform';
import type { MetricsHistory } from '@/types/server';

export interface MetricsStats {
  cpuAvg: number;
  memoryAvg: number;
  diskAvg: number;
  responseTimeAvg: number;
  cpuMax: number;
  memoryMax: number;
  diskMax: number;
  responseTimeMax: number;
}

type LoadMetricsHistoryOptions = {
  apiFallback?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function toSafeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Math.max(...arr) 대체 — 빈 배열 시 -Infinity 방지 + 큰 배열 stack overflow 방지 */
const safeMax = (arr: number[]) => arr.reduce((a, b) => Math.max(a, b), 0);

export function generateChartPointsFromData(
  data: number[],
  maxHeight: number = 140,
  chartWidth: number = 300
): string {
  if (data.length === 0) return '';

  if (data.length === 1) {
    return `0,${maxHeight / 2}`;
  }

  const max = safeMax(data);
  const min = data.reduce((a, b) => Math.min(a, b), data[0] ?? 0);
  const range = max - min || 1;

  return data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * chartWidth;
      const y = maxHeight - ((value - min) / range) * maxHeight;
      return `${x},${y}`;
    })
    .join(' ');
}

/**
 * 서버 상세 응답에서 히스토리 메트릭을 추출한다.
 * 표준 포맷: data.history.data_points
 */
export function parseMetricsHistoryFromResponse(
  payload: unknown
): MetricsHistory[] | null {
  if (!isRecord(payload)) return null;

  // 표준 포맷: data.history.data_points
  const dataNode = payload.data;
  if (isRecord(dataNode)) {
    const historyNode = dataNode.history;
    if (isRecord(historyNode) && Array.isArray(historyNode.data_points)) {
      const mapped = historyNode.data_points
        .map((point): MetricsHistory | null => {
          if (!isRecord(point)) return null;
          const timestamp = point.timestamp;
          const metrics = point.metrics;
          if (typeof timestamp !== 'string' || !isRecord(metrics)) return null;

          const networkIn = toSafeNumber(metrics.network_in);
          const networkOut = toSafeNumber(metrics.network_out);

          return {
            timestamp,
            cpu: toSafeNumber(metrics.cpu_usage),
            memory: toSafeNumber(metrics.memory_usage),
            disk: toSafeNumber(metrics.disk_usage),
            network: Math.round(networkIn + networkOut),
            responseTime: toSafeNumber(metrics.response_time),
            connections: 0,
          };
        })
        .filter((item): item is MetricsHistory => item !== null);

      return mapped.length > 0 ? mapped : null;
    }
  }

  return null;
}

export function useServerMetrics() {
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadMetricsHistory = useCallback(
    async (
      serverId: string,
      range: string = '24h',
      options?: LoadMetricsHistoryOptions
    ) => {
      setIsLoadingHistory(true);
      try {
        // OTel timeseries 데이터 직접 읽기 우선
        const rangeHours =
          range === '1h' ? 1 : range === '6h' ? 6 : range === '24h' ? 24 : 168;
        const otelHistory = await otelTimeSeriesToHistory(serverId, rangeHours);
        if (otelHistory.length > 0) {
          setMetricsHistory(otelHistory);
          return;
        }

        const useApiFallback =
          options?.apiFallback !== false && process.env.NODE_ENV !== 'test';
        if (!useApiFallback) {
          setMetricsHistory([]);
          return;
        }

        // API fallback
        const response = await fetch(
          `/api/servers/${serverId}?history=true&range=${range}`
        );
        if (!response.ok) {
          throw new Error(`히스토리 API 오류: ${response.status}`);
        }

        const data = await response.json();
        const parsedHistory = parseMetricsHistoryFromResponse(data);

        if (parsedHistory) {
          setMetricsHistory(parsedHistory);
        } else {
          setMetricsHistory([]);
        }
      } catch (error) {
        logger.error('히스토리 데이터 로드 실패:', error);
        setMetricsHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    []
  );

  const calculateMetricsStats = useCallback(
    (history: MetricsHistory[]): MetricsStats | null => {
      if (history.length === 0) return null;

      const cpuAvg = Math.round(
        history.reduce((sum, m) => sum + m.cpu, 0) / history.length
      );
      const memoryAvg = Math.round(
        history.reduce((sum, m) => sum + m.memory, 0) / history.length
      );
      const diskAvg = Math.round(
        history.reduce((sum, m) => sum + m.disk, 0) / history.length
      );
      const responseTimeAvg = Math.round(
        history.reduce((sum, m) => sum + (m.responseTime ?? 0), 0) /
          history.length
      );

      const cpuMax = safeMax(history.map((m) => m.cpu));
      const memoryMax = safeMax(history.map((m) => m.memory));
      const diskMax = safeMax(history.map((m) => m.disk));
      const responseTimeMax = safeMax(history.map((m) => m.responseTime ?? 0));

      return {
        cpuAvg,
        memoryAvg,
        diskAvg,
        responseTimeAvg,
        cpuMax,
        memoryMax,
        diskMax,
        responseTimeMax,
      };
    },
    []
  );

  const generateChartPoints = useCallback(
    (data: number[], maxHeight: number = 140) => {
      return generateChartPointsFromData(data, maxHeight);
    },
    []
  );

  return {
    metricsHistory,
    isLoadingHistory,
    loadMetricsHistory,
    calculateMetricsStats,
    generateChartPoints,
    setMetricsHistory,
  };
}
