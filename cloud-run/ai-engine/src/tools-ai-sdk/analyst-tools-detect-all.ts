/**
 * Analyst Tools — All-Server Anomaly Detection + 30min Rising Trend Scan
 *
 * Scans all servers and returns detailed anomaly information
 * with linear projection-based rising trend scan (not a prediction engine).
 *
 * Backtest-tuned params (18 servers × 144 slots):
 *   window=9 slots (90min), horizon=3 slots (30min)
 *   CPU  F1=65.5% vs prod 39.8% (+26pp)
 *   Mem  F1=72.1% vs prod 41.8% (+30pp)
 *
 * @version 2.5.0
 */

import { tool } from 'ai';
import { z } from 'zod';

import { getCurrentState } from '../data/precomputed-state';
import { getDataCache } from '../lib/cache-layer';
import { getCurrentSlotIndex, getHistoryForMetric } from './analyst-tools-shared';
import { STATUS_THRESHOLDS } from '../config/status-thresholds';

import type {
  ForecastBreachItem,
  RisingTrendScan,
  ServerAnomalyItem,
  SystemSummary,
} from '../types/analysis-results';

// ============================================================================
// 30min Linear Projection
// Backtest result: window=9(90min) horizon=3(30min) → CPU F1 65.5%, Mem F1 72.1%
// Previous (window=36, horizon=6=60min): CPU F1 39.8%, Mem F1 41.8%
// ============================================================================

const TREND_WINDOW_SLOTS = 9;  // 90분 (backtest 최적값)
const TREND_HORIZON_SLOTS = 3; // 30분 (backtest 최적값)

function projectValue(history: number[], aheadSlots: number): number {
  if (history.length === 0) return 0;
  if (history.length === 1) return history[0] ?? 0;

  const n = history.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const y = history[i] ?? 0;
    sumX += i; sumY += y; sumXY += i * y; sumXX += i * i;
  }
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return Math.max(0, Math.min(100, intercept + slope * (n - 1 + aheadSlots)));
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
          const risingTrends: ForecastBreachItem[] = [];

          let onlineCount = 0;
          let warningCount = 0;
          let criticalCount = 0;
          let offlineCount = 0;
          const affectedServers: string[] = [];
          const fixedSlot = getCurrentSlotIndex();

          for (const server of allServers) {
            let serverHasAnomaly = false;

            for (const metric of targetMetrics) {
              const currentValue = server[metric as keyof typeof server] as number;
              const threshold = STATUS_THRESHOLDS[metric as keyof typeof STATUS_THRESHOLDS];

              const isMetricCritical = currentValue >= threshold.critical;
              const isMetricWarning = currentValue >= threshold.warning;

              const history = getHistoryForMetric(server.id, metric, currentValue, fixedSlot);
              // window=9(90min) — backtest 최적값; 전체 36슬롯보다 단기 창이 F1 +26pp 우수
              const recentHistory = history.slice(-TREND_WINDOW_SLOTS).map((p) => p.value);
              const projectedValue30m = Math.round(projectValue(recentHistory, TREND_HORIZON_SLOTS) * 10) / 10;
              const isFutureWarning = currentValue < threshold.warning && projectedValue30m >= threshold.warning;
              if (isFutureWarning) {
                risingTrends.push({
                  serverId: server.id,
                  serverName: server.name,
                  metric,
                  currentValue: Math.round(currentValue * 10) / 10,
                  projectedValue30m,
                  warningThreshold: threshold.warning,
                  riskLevel: projectedValue30m >= threshold.critical ? 'high' : 'medium',
                });
              }

              if (isMetricCritical || isMetricWarning) {
                serverHasAnomaly = true;

                allAnomalies.push({
                  server_id: server.id,
                  server_name: server.name,
                  metric: metric.charAt(0).toUpperCase() + metric.slice(1),
                  value: Math.round(currentValue * 10) / 10,
                  severity: isMetricCritical ? 'critical' : 'warning',
                });
              }
            }

            if (serverHasAnomaly) {
              affectedServers.push(server.id);
            }

            // 🎯 Use pre-calculated srv.status for summary counts to ensure parity
            if (server.status === 'critical') {
              criticalCount++;
            } else if (server.status === 'warning') {
              warningCount++;
            } else if (server.status === 'offline') {
              offlineCount++;
            } else {
              onlineCount++;
            }
          }

          const summary: SystemSummary = {
            totalServers: allServers.length,
            onlineCount,
            warningCount,
            criticalCount,
            offlineCount,
          } as any; // Cast until type is updated in analysis-results.ts

          const sortedRisingTrends = risingTrends
            .sort((a, b) => {
              const aGap = a.projectedValue30m - a.warningThreshold;
              const bGap = b.projectedValue30m - b.warningThreshold;
              return bGap - aGap;
            })
            .slice(0, 10);

          const risingTrendScan: RisingTrendScan = {
            horizonHours: 0.5,
            method: 'linear_trend_scan',
            riskCount: sortedRisingTrends.length,
            risingTrends: sortedRisingTrends,
          };

          return {
            success: true as const,
            totalServers: allServers.length,
            anomalies: allAnomalies,
            affectedServers,
            summary,
            hasAnomalies: allAnomalies.length > 0,
            anomalyCount: allAnomalies.length,
            timestamp: new Date().toISOString(),
            algorithmVersion: '2.5.0',
            decisionSource: 'threshold_scan+linear_trend_scan',
            analysisBasis: 'status-thresholds:ssot,history:last90min,horizon:30min',
            risingTrendScan,
            _algorithm: 'All-Server Threshold Scan + 30min Rising Trend Scan (Cached)',
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
