/**
 * Analyst Tools — All-Server Anomaly Detection + 1h Forecast
 *
 * Scans all servers and returns detailed anomaly information
 * with linear projection-based risk forecast.
 *
 * @version 2.3.0
 */

import { tool } from 'ai';
import { z } from 'zod';

import { getCurrentState } from '../data/precomputed-state';
import { getDataCache } from '../lib/cache-layer';
import { getCurrentSlotIndex, getHistoryForMetric } from './analyst-tools-shared';
import { STATUS_THRESHOLDS } from '../config/status-thresholds';

import type {
  ForecastBreachItem,
  ServerAnomalyItem,
  SystemSummary,
} from '../types/analysis-results';

// ============================================================================
// 1h Linear Projection
// ============================================================================

function projectOneHourValue(history: number[]): number {
  if (history.length === 0) return 0;
  if (history.length === 1) return history[0];

  const n = history.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = history[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // 10분 간격 데이터 기준 1시간 = 6 step ahead
  const predicted = intercept + slope * (n - 1 + 6);
  return Math.max(0, Math.min(100, predicted));
}

// ============================================================================
// detectAnomaliesAllServers Tool
// ============================================================================

export const detectAnomaliesAllServers = tool({
  description:
    '전체 서버의 이상치를 한번에 탐지합니다. "이상 있는 서버?", "서버 분석해줘" 등의 질문에 이 도구를 먼저 호출하세요. 1회 호출로 모든 서버를 스캔합니다.',
  inputSchema: z.object({
    metricType: z
      .enum(['cpu', 'memory', 'disk', 'all'])
      .default('all')
      .describe('분석할 메트릭 타입'),
  }),
  execute: async ({
    metricType,
  }: {
    metricType: 'cpu' | 'memory' | 'disk' | 'all';
  }) => {
    try {
      const cache = getDataCache();

      return await cache.getAnalysis(
        'anomaly-all',
        { metricType },
        async () => {
          const state = getCurrentState();
          const allServers = state.servers;

          const metrics = ['cpu', 'memory', 'disk'] as const;
          const targetMetrics =
            metricType === 'all'
              ? metrics
              : [metricType as (typeof metrics)[number]];

          // Collect all anomalies across all servers
          const allAnomalies: ServerAnomalyItem[] = [];
          const predictedBreaches: ForecastBreachItem[] = [];

          let healthyCount = 0;
          let warningCount = 0;
          let criticalCount = 0;
          const affectedServers: string[] = [];
          const fixedSlot = getCurrentSlotIndex();

          for (const server of allServers) {
            let serverHasAnomaly = false;
            let serverIsCritical = false;
            let serverIsWarning = false;

            for (const metric of targetMetrics) {
              const currentValue = server[metric as keyof typeof server] as number;
              const threshold = STATUS_THRESHOLDS[metric as keyof typeof STATUS_THRESHOLDS];

              const isCritical = currentValue >= threshold.critical;
              const isWarning = currentValue >= threshold.warning;

              const history = getHistoryForMetric(server.id, metric, currentValue, fixedSlot);
              const predictedValue1h = Math.round(projectOneHourValue(history.map((p) => p.value)) * 10) / 10;
              const isFutureWarning = currentValue < threshold.warning && predictedValue1h >= threshold.warning;
              if (isFutureWarning) {
                predictedBreaches.push({
                  serverId: server.id,
                  serverName: server.name,
                  metric,
                  currentValue: Math.round(currentValue * 10) / 10,
                  predictedValue1h,
                  warningThreshold: threshold.warning,
                  riskLevel: predictedValue1h >= threshold.critical ? 'high' : 'medium',
                });
              }

              if (isCritical || isWarning) {
                serverHasAnomaly = true;
                if (isCritical) serverIsCritical = true;
                else if (isWarning) serverIsWarning = true;

                allAnomalies.push({
                  server_id: server.id,
                  server_name: server.name,
                  metric: metric.charAt(0).toUpperCase() + metric.slice(1),
                  value: Math.round(currentValue * 10) / 10,
                  severity: isCritical ? 'critical' : 'warning',
                });
              }
            }

            if (serverHasAnomaly) {
              affectedServers.push(server.id);
              if (serverIsCritical) {
                criticalCount++;
              } else if (serverIsWarning) {
                warningCount++;
              }
            } else {
              healthyCount++;
            }
          }

          const summary: SystemSummary = {
            totalServers: allServers.length,
            healthyCount,
            warningCount,
            criticalCount,
          };

          const sortedPredictedBreaches = predictedBreaches
            .sort((a, b) => {
              const aGap = a.predictedValue1h - a.warningThreshold;
              const bGap = b.predictedValue1h - b.warningThreshold;
              return bGap - aGap;
            })
            .slice(0, 10);

          return {
            success: true as const,
            totalServers: allServers.length,
            anomalies: allAnomalies,
            affectedServers,
            summary,
            hasAnomalies: allAnomalies.length > 0,
            anomalyCount: allAnomalies.length,
            timestamp: new Date().toISOString(),
            algorithmVersion: '2.3.0',
            decisionSource: 'threshold_scan+linear_projection',
            confidenceBasis: 'status-thresholds:ssot,history:last6h',
            riskForecast: {
              horizonHours: 1,
              model: 'lightweight_linear_projection_v1',
              breachCount: sortedPredictedBreaches.length,
              predictedBreaches: sortedPredictedBreaches,
            },
            _algorithm: 'All-Server Threshold Scan + 1h Linear Projection (Cached)',
          };
        }
      );
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : String(error),
        systemMessage: `TOOL_EXECUTION_FAILED: 전체 서버 이상 스캔 중 오류가 발생했습니다. (${String(error)})`,
        suggestedAgentAction: '전체 서버 분석 도구 오류가 발생했음을 사용자에게 안내하고, 특정 단일 서버(예: 문제가 된 서버)를 지정해서 스캔하도록 유도하세요.',
      };
    }
  },
});
