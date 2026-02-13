import { useCallback, useState } from 'react';
import { logger } from '@/lib/logging';
import type { MetricsHistory } from '../types/server';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function toSafeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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
            network: Math.round((networkIn + networkOut) / 2),
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

  const generateSimulatedHistory = useCallback(
    (range: string): MetricsHistory[] => {
      const history: MetricsHistory[] = [];
      const now = new Date();

      // 시간 범위에 따른 데이터 포인트 수
      const hours =
        range === '1h' ? 1 : range === '6h' ? 6 : range === '24h' ? 24 : 168; // 7d = 168h
      const interval =
        range === '1h' ? 5 : range === '6h' ? 30 : range === '24h' ? 60 : 360; // 분 단위
      const points = Math.floor((hours * 60) / interval);

      for (let i = points - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * interval * 60 * 1000);

        // 시간대별 패턴 적용
        const hour = timestamp.getHours();
        let baseLoad = 0.3;

        if (hour >= 9 && hour <= 18) {
          baseLoad = 0.7;
        } else if (hour >= 19 && hour <= 23) {
          baseLoad = 0.5;
        }

        const variation = (Math.random() - 0.5) * 0.3;
        const load = Math.max(0.1, Math.min(0.9, baseLoad + variation));

        history.push({
          timestamp: timestamp.toISOString(),
          cpu: Math.round(load * 100),
          memory: Math.round((load * 0.8 + Math.random() * 0.2) * 100),
          disk: Math.round((0.4 + Math.random() * 0.3) * 100),
          network: Math.round(load * 100),
          responseTime: Math.round(100 + load * 200 + Math.random() * 100),
          connections: Math.round(50 + load * 200),
        });
      }

      return history;
    },
    []
  );

  const loadMetricsHistory = useCallback(
    async (serverId: string, range: string = '24h') => {
      setIsLoadingHistory(true);
      try {
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
          setMetricsHistory(generateSimulatedHistory(range));
        }
      } catch (error) {
        if (
          process.env.NEXT_PUBLIC_NODE_ENV ||
          process.env.NODE_ENV === 'development'
        ) {
          logger.error('히스토리 데이터 로드 실패:', error);
        }
        setMetricsHistory(generateSimulatedHistory(range));
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [generateSimulatedHistory]
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

      const cpuMax = Math.max(...history.map((m) => m.cpu));
      const memoryMax = Math.max(...history.map((m) => m.memory));
      const diskMax = Math.max(...history.map((m) => m.disk));
      const responseTimeMax = Math.max(
        ...history.map((m) => m.responseTime ?? 0)
      );

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
      if (data.length === 0) return '';

      const max = Math.max(...data);
      const min = Math.min(...data);
      const range = max - min || 1;

      return data
        .map((value, index) => {
          const x = (index / (data.length - 1)) * 300;
          const y = maxHeight - ((value - min) / range) * maxHeight;
          return `${x},${y}`;
        })
        .join(' ');
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
