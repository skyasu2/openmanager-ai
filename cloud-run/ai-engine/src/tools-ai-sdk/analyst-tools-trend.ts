import { tool } from 'ai';
import { z } from 'zod';
import { getCurrentState, type ServerSnapshot } from '../data/precomputed-state';
import { getTrendPredictor } from '../lib/ai/monitoring/TrendPredictor';
import { getDataCache } from '../lib/cache-layer';
import { MAX_PREDICTION_HORIZON } from '../lib/ai/monitoring/TrendPredictor.types';
import { buildLoadAverageThresholds } from '../config/status-thresholds';
import {
  getCurrentSlotIndex,
  getHistoryForMetric,
  getLightweightEvidenceContract,
  toTrendDataPoints,
  type TrendResultItem,
} from './analyst-tools-shared';

const TREND_METRICS = ['cpu', 'memory', 'disk', 'network', 'load1', 'load5'] as const;
type TrendMetric = (typeof TREND_METRICS)[number];

function isLoadMetric(metric: TrendMetric): metric is 'load1' | 'load5' {
  return metric === 'load1' || metric === 'load5';
}

function isPercentMetric(metric: TrendMetric): boolean {
  return metric === 'cpu' || metric === 'memory' || metric === 'disk' || metric === 'network';
}

const SingleServerHistorySchema = z.object({
  cpu: z.array(z.number()).optional(),
  memory: z.array(z.number()).optional(),
  disk: z.array(z.number()).optional(),
  network: z.array(z.number()).optional(),
  load1: z.array(z.number()).optional(),
  load5: z.array(z.number()).optional(),
});

export const predictTrends = tool({
  description:
    '서버 메트릭의 단기 위험 추세를 계산합니다. CPU/Memory/Disk/Network는 percent 임계값, load1/load5는 cpuCores 기반 임계값으로 투영값, 임계값 접근 가능성, 정상 복귀 가능성을 제공합니다.',
  inputSchema: z.object({
    serverId: z
      .string()
      .optional()
      .describe('분석할 서버 ID (선택, 미입력시 첫 번째 서버)'),
    metricType: z
      .enum(['cpu', 'memory', 'disk', 'network', 'load1', 'load5', 'all'])
      .default('all')
      .describe('분석할 메트릭 타입'),
    predictionHours: z
      .number()
      .default(1)
      .describe('추세를 계산할 시간 범위 (기본 1시간, 최대 24시간)'),
    currentMetrics: z
      .object({
        cpu: z.number().optional(),
        memory: z.number().optional(),
        disk: z.number().optional(),
        network: z.number().optional(),
        load1: z.number().optional(),
        load5: z.number().optional(),
        cpuCores: z.number().optional(),
      })
      .optional()
      .describe('현재 서버 메트릭 (실시간 데이터 주입용)'),
    history: SingleServerHistorySchema
      .optional()
      .describe('메트릭별 히스토리 (10분 간격, 오래된 순). 없으면 synthetic OTel 히스토리 사용'),
  }),
  execute: async ({
    serverId,
    metricType,
    predictionHours,
    currentMetrics,
    history,
  }: {
    serverId?: string;
    metricType: TrendMetric | 'all';
    predictionHours: number;
    currentMetrics?: {
      cpu?: number;
      memory?: number;
      disk?: number;
      network?: number;
      load1?: number;
      load5?: number;
      cpuCores?: number;
    };
    history?: {
      cpu?: number[];
      memory?: number[];
      disk?: number[];
      network?: number[];
      load1?: number[];
      load5?: number[];
    };
  }) => {
    try {
      const cache = getDataCache();
      const rawHours = predictionHours ?? 1;
      const hours = Math.max(
        1,
        Math.min(rawHours, MAX_PREDICTION_HORIZON / 3600000)
      );
      const predictionHorizonMs = hours * 3600000;
      const fixedSlot = getCurrentSlotIndex();

      return await cache.getAnalysis(
        'trend',
        {
          serverId: serverId || 'first',
          metricType,
          hours,
          slotIndex: fixedSlot,
          currentMetrics,
          history,
        },
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

          const analyzedServer = { ...server, ...currentMetrics };
          const externalHistory = history
            ? {
                [analyzedServer.id]: history,
              }
            : undefined;

          const targetMetrics: readonly TrendMetric[] =
            metricType === 'all'
              ? TREND_METRICS
              : [metricType];

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
          const skippedMetrics: string[] = [];

          for (const metric of targetMetrics) {
            const currentValue = analyzedServer[
              metric as keyof typeof analyzedServer
            ] as number | undefined;
            if (typeof currentValue !== 'number' || !Number.isFinite(currentValue)) {
              if (metricType !== 'all') {
                return {
                  success: false,
                  error: `메트릭 값을 찾을 수 없습니다: ${metric}`,
                  systemMessage: `TOOL_EXECUTION_FAILED: ${metric} 현재값이 없어 트렌드 예측에 실패했습니다.`,
                  suggestedAgentAction: `${metric} 메트릭이 수집되는 서버인지 확인하고, 가능하면 currentMetrics.${metric} 값을 포함해 다시 호출하세요.`,
                };
              }
              skippedMetrics.push(`${metric}:missing-current-value`);
              continue;
            }

            const thresholdOverride = isLoadMetric(metric)
              ? (() => {
                  const cpuCores = analyzedServer.cpuCores;
                  if (
                    typeof cpuCores !== 'number' ||
                    !Number.isFinite(cpuCores) ||
                    cpuCores <= 0
                  ) {
                    return null;
                  }
                  return buildLoadAverageThresholds(cpuCores);
                })()
              : undefined;

            if (thresholdOverride === null) {
              if (metricType !== 'all') {
                return {
                  success: false,
                  error: `load average 해석에 필요한 cpuCores 값을 찾을 수 없습니다: ${metric}`,
                  systemMessage: `TOOL_EXECUTION_FAILED: ${metric} 예측에는 서버별 cpuCores 값이 필요합니다.`,
                  suggestedAgentAction: '서버의 CPU 코어 수를 확인하거나 currentMetrics.cpuCores 값을 포함해 다시 호출하세요.',
                };
              }
              skippedMetrics.push(`${metric}:missing-cpu-cores`);
              continue;
            }

            const historyPoints = getHistoryForMetric(
              analyzedServer.id,
              metric,
              currentValue,
              fixedSlot,
              externalHistory
            );
            const trendHistory = toTrendDataPoints(historyPoints);
            const prediction = thresholdOverride
              ? predictor.predictEnhanced(
                  trendHistory,
                  metric,
                  predictionHorizonMs,
                  thresholdOverride
                )
              : predictor.predictEnhanced(
                  trendHistory,
                  metric,
                  predictionHorizonMs
                );

            const projectedValue = isPercentMetric(metric)
              ? Math.max(0, Math.min(100, prediction.prediction))
              : Math.max(0, prediction.prediction);
            const roundedProjectedValue = Math.round(projectedValue * 100) / 100;
            const signalStrength = Math.round(prediction.confidence * 100) / 100;
            const hasThresholdSignal =
              prediction.currentStatus !== 'online' ||
              prediction.thresholdBreach.willBreachWarning ||
              prediction.thresholdBreach.willBreachCritical;

            results[metric] = {
              trend: prediction.trend,
              currentValue,
              projectedValue: roundedProjectedValue,
              changePercent:
                Math.round(prediction.details.predictedChangePercent * 100) / 100,
              signalStrength,
              decisionSource: hasThresholdSignal
                ? 'linear_projection+threshold'
                : 'linear_projection',
              analysisBasis: [
                `metric:${metric}`,
                `historyPoints:${trendHistory.length}`,
                `horizonHours:${hours}`,
                `signalStrength=${signalStrength}`,
                `currentStatus=${prediction.currentStatus}`,
              ].join(', '),
              rationale: [
                `trend:${prediction.trend}`,
                `projected:${Math.round(currentValue * 100) / 100}->${roundedProjectedValue}`,
                hasThresholdSignal
                  ? `threshold-risk:${prediction.thresholdBreach.humanReadable || prediction.currentStatus}`
                  : 'threshold-risk:none',
              ],
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
            message = `📈 ${server.name}: ${increasingMetrics.join(', ')} 단기 상승 추세 (선택 범위 내 임계값 미도달 예상)`;
          } else {
            message = `✅ ${server.name}: 선택 범위 내 안정적 추세`;
          }

          return {
            success: true,
            version: '2.1.0',
            serverId: analyzedServer.id,
            serverName: analyzedServer.name,
            predictionHorizon: `${hours}시간`,
            decisionSource: 'linear_projection+threshold',
            analysisBasis: `history:metric-specific,last36slots-or-injected,horizonHours:${hours},thresholds:ssot`,
            evidenceContract: getLightweightEvidenceContract(),
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
              skippedMetrics,
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
        systemMessage: `TOOL_EXECUTION_FAILED: 단기 위험 추세 분석 도중 오류 발생. (${String(error)})`,
        suggestedAgentAction: '단기 위험 추세 계산에 실패했음을 사용자에게 알리고, 현재 시점의 실시간 메트릭 기준으로 상태 분석을 먼저 제공할지 안내하세요.',
      };
    }
  },
});
