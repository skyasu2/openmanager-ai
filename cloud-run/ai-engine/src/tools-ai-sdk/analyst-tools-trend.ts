import { tool } from 'ai';
import { z } from 'zod';
import { getCurrentState, type ServerSnapshot } from '../data/precomputed-state';
import { getTrendPredictor } from '../lib/ai/monitoring/TrendPredictor';
import { getDataCache } from '../lib/cache-layer';
import {
  getCurrentSlotIndex,
  getHistoryForMetric,
  toTrendDataPoints,
  type TrendResultItem,
} from './analyst-tools-shared';

export const predictTrends = tool({
  description:
    '🆕 v2.0: 서버 메트릭의 트렌드를 예측합니다. 임계값 도달 시간과 정상 복귀 시간을 포함한 향상된 예측을 제공합니다.',
  inputSchema: z.object({
    serverId: z
      .string()
      .optional()
      .describe('분석할 서버 ID (선택, 미입력시 첫 번째 서버)'),
    metricType: z
      .enum(['cpu', 'memory', 'disk', 'all'])
      .default('all')
      .describe('분석할 메트릭 타입'),
    predictionHours: z
      .number()
      .default(1)
      .describe('예측 시간 (기본 1시간)'),
  }),
  execute: async ({
    serverId,
    metricType,
    predictionHours,
  }: {
    serverId?: string;
    metricType: 'cpu' | 'memory' | 'disk' | 'all';
    predictionHours: number;
  }) => {
    try {
      const cache = getDataCache();
      const hours = predictionHours ?? 1;

      return await cache.getAnalysis(
        'trend',
        { serverId: serverId || 'first', metricType, hours },
        async () => {
          const state = getCurrentState();
          const server: ServerSnapshot | undefined = serverId
            ? state.servers.find((entry) => entry.id === serverId)
            : state.servers[0];

          if (!server) {
            return {
              success: false,
              error: `서버를 찾을 수 없습니다: ${serverId || 'none'}`,
              systemMessage: `TOOL_EXECUTION_FAILED: 대상 서버(${serverId || 'none'})를 찾을 수 없어 트렌드 예측에 실패했습니다.`,
              suggestedAgentAction: `요청하신 서버 ID(${serverId})가 올바른지 사용자에게 다시 확인해달라고 정중히 요청하세요.`,
            };
          }

          const metrics = ['cpu', 'memory', 'disk'] as const;
          const targetMetrics =
            metricType === 'all'
              ? metrics
              : [metricType as (typeof metrics)[number]];

          interface EnhancedTrendResult extends TrendResultItem {
            currentStatus: 'online' | 'warning' | 'critical';
            thresholdBreach: {
              willBreachWarning: boolean;
              timeToWarning: number | null;
              willBreachCritical: boolean;
              timeToCritical: number | null;
              humanReadable: string;
            };
            recovery: {
              willRecover: boolean;
              timeToRecovery: number | null;
              humanReadable: string | null;
            };
          }

          const results: Record<string, EnhancedTrendResult> = {};
          const predictor = getTrendPredictor();
          const warnings: string[] = [];
          const criticalAlerts: string[] = [];
          const recoveryPredictions: string[] = [];
          const fixedSlot = getCurrentSlotIndex();

          for (const metric of targetMetrics) {
            const currentValue = server[metric as keyof typeof server] as number;
            const history = getHistoryForMetric(server.id, metric, currentValue, fixedSlot);
            const trendHistory = toTrendDataPoints(history);
            const prediction = predictor.predictEnhanced(trendHistory, metric);

            const clampedPrediction = Math.max(
              0,
              Math.min(100, prediction.prediction)
            );

            results[metric] = {
              trend: prediction.trend,
              currentValue,
              predictedValue: Math.round(clampedPrediction * 100) / 100,
              changePercent:
                Math.round(prediction.details.predictedChangePercent * 100) / 100,
              confidence: Math.round(prediction.confidence * 100) / 100,
              currentStatus: prediction.currentStatus,
              thresholdBreach: prediction.thresholdBreach,
              recovery: prediction.recovery,
            };

            if (prediction.thresholdBreach.willBreachCritical) {
              criticalAlerts.push(
                `${metric.toUpperCase()}: ${prediction.thresholdBreach.humanReadable}`
              );
            } else if (prediction.thresholdBreach.willBreachWarning) {
              warnings.push(
                `${metric.toUpperCase()}: ${prediction.thresholdBreach.humanReadable}`
              );
            }

            if (prediction.currentStatus !== 'online' && prediction.recovery.willRecover) {
              recoveryPredictions.push(
                `${metric.toUpperCase()}: ${prediction.recovery.humanReadable}`
              );
            }
          }

          const increasingMetrics = Object.entries(results)
            .filter(([, result]) => result.trend === 'increasing')
            .map(([metric]) => metric);

          let message = '';
          if (criticalAlerts.length > 0) {
            message = `🚨 ${server.name}: ${criticalAlerts.join('; ')} (포화 근처에서 비선형 동작 가능)`;
          } else if (warnings.length > 0) {
            message = `⚠️ ${server.name}: ${warnings.join('; ')}`;
          } else if (recoveryPredictions.length > 0) {
            message = `✅ ${server.name}: ${recoveryPredictions.join('; ')}`;
          } else if (increasingMetrics.length > 0) {
            message = `📈 ${server.name}: ${increasingMetrics.join(', ')} 상승 추세 (임계값 미도달 예상)`;
          } else {
            message = `✅ ${server.name}: 안정적 추세`;
          }

          return {
            success: true,
            version: '2.0.0',
            serverId: server.id,
            serverName: server.name,
            predictionHorizon: `${hours}시간`,
            results,
            summary: {
              increasingMetrics,
              hasRisingTrends: increasingMetrics.length > 0,
              hasWarningPredictions: warnings.length > 0,
              hasCriticalPredictions: criticalAlerts.length > 0,
              hasRecoveryPredictions: recoveryPredictions.length > 0,
              warnings,
              criticalAlerts,
              recoveryPredictions,
            },
            message,
            timestamp: new Date().toISOString(),
          };
        }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        systemMessage: `TOOL_EXECUTION_FAILED: 트렌드 예측 분석 도중 오류 발생. (${String(error)})`,
        suggestedAgentAction: '트렌드 예측에 실패했음을 사용자에게 알리고, 이 대신 현재 시점의 실시간 서버 모니터링 수치를 바탕으로 분석해드릴지 여쭤보세요.',
      };
    }
  },
});
