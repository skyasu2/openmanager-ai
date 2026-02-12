/**
 * Analyst Tools (AI SDK Format)
 *
 * Converted from LangChain tools to Vercel AI SDK format.
 * Includes anomaly detection, trend prediction, and pattern analysis.
 *
 * @version 1.0.0
 * @updated 2025-12-28
 */

import { tool } from 'ai';
import { z } from 'zod';

// Data sources
import {
  getCurrentState,
  getStateBySlot,
  type ServerSnapshot,
} from '../data/precomputed-state';

// AI/ML modules
import {
  getAnomalyDetector,
  type MetricDataPoint,
} from '../lib/ai/monitoring/SimpleAnomalyDetector';
import {
  getTrendPredictor,
  type TrendDataPoint,
} from '../lib/ai/monitoring/TrendPredictor';
import {
  getHybridAnomalyDetector,
  type ServerMetrics,
} from '../lib/ai/monitoring/HybridAnomalyDetector';
import { getAdaptiveThreshold } from '../lib/ai/monitoring/AdaptiveThreshold';
import {
  getUnifiedAnomalyEngine,
  type ServerMetricInput,
} from '../lib/ai/monitoring/UnifiedAnomalyEngine';
import { getDataCache } from '../lib/cache-layer';

// Config (SSOT)
import { STATUS_THRESHOLDS } from '../config/status-thresholds';

// Types
import type {
  ServerAnomalyItem,
  SystemSummary,
} from '../types/analysis-results';

// ============================================================================
// 1. Types
// ============================================================================

interface AnomalyResultItem {
  isAnomaly: boolean;
  severity: string;
  confidence: number;
  currentValue: number;
  threshold: { upper: number; lower: number };
}

interface TrendResultItem {
  trend: string;
  currentValue: number;
  predictedValue: number;
  changePercent: number;
  confidence: number;
}

// ============================================================================
// 2. Helper Functions
// ============================================================================

function getCurrentMinuteOfDay(): number {
  const koreaTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Seoul',
  });
  const koreaDate = new Date(koreaTime);
  return koreaDate.getHours() * 60 + koreaDate.getMinutes();
}

function toTrendDataPoints(metricPoints: MetricDataPoint[]): TrendDataPoint[] {
  return metricPoints.map((p) => ({ timestamp: p.timestamp, value: p.value }));
}

function getHistoryForMetric(
  serverId: string,
  metric: string,
  currentValue: number
): MetricDataPoint[] {
  const currentSlot = getCurrentSlotIndex();
  const now = Date.now();
  const baseTime = now - (now % (10 * 60 * 1000));
  const points: MetricDataPoint[] = [];

  for (let i = 35; i >= 0; i--) {
    const slotIdx = ((currentSlot - i) % 144 + 144) % 144;
    const slot = getStateBySlot(slotIdx);
    const server = slot?.servers.find((s) => s.id === serverId);
    if (server) {
      points.push({
        timestamp: baseTime - i * 600000,
        value: (server[metric as keyof typeof server] as number) ?? 0,
      });
    } else {
      points.push({
        timestamp: baseTime - i * 600000,
        value: currentValue,
      });
    }
  }

  return points;
}

function getCurrentSlotIndex(): number {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + kstOffset) % 1440;
  return Math.floor(kstMinutes / 10);
}

// Pattern analysis constants
const PATTERN_INSIGHTS: Record<string, string> = {
  system_performance:
    '시스템 성능 분석: CPU 사용률, 프로세스 수, 로드 평균 확인 필요',
  memory_status:
    '메모리 상태 분석: 사용량, 캐시, 스왑 사용률 확인 필요',
  storage_info:
    '스토리지 분석: 디스크 사용량, I/O 대기, 파티션 상태 확인 필요',
  server_status:
    '서버 상태 분석: 가동 시간, 서비스 상태, 네트워크 연결 확인',
  trend_analysis:
    '트렌드 분석: 시계열 데이터 기반 패턴 인식 및 예측 모델 적용',
  anomaly_detection:
    '이상 탐지: 통계적 이상치 감지, 임계값 기반 알림 확인',
};

// ============================================================================
// 3. AI SDK Tools
// ============================================================================

// ============================================================================
// 3.0 Threshold-based Check Tool (NEW) + AdaptiveThreshold Integration
// ============================================================================
// NOTE: Using STATUS_THRESHOLDS from config/status-thresholds.ts (SSOT)



// ============================================================================
// 3.1 Statistical + Threshold Anomaly Detection (Dashboard Compatible)
// ============================================================================

/**
 * Detect Anomalies Tool v2.0
 *
 * Hybrid approach combining:
 * 1. Fixed thresholds (Dashboard compatible) - Primary
 * 2. Statistical (6-hour moving average + 2σ) - Secondary
 *
 * Dashboard 일관성: 임계값 초과 시 무조건 이상으로 판정
 */
// ============================================================================
// 3.1 Statistical + Threshold Anomaly Detection (Dashboard Compatible)
// ============================================================================

/**
 * Detect Anomalies Tool v2.1
 *
 * Hybrid approach combining:
 * 1. Fixed thresholds (Dashboard compatible) - Primary
 * 2. Statistical (6-hour moving average + 2σ) - Secondary
 * 3. Enhanced Metrics (Load Avg, Network) - Tertiary (Aligned with Docs)
 *
 * Dashboard 일관성: 임계값 초과 시 무조건 이상으로 판정
 */
export const detectAnomalies = tool({
  description:
    '서버 메트릭의 이상치를 탐지합니다. Dashboard와 동일한 임계값 + 통계적 분석을 결합합니다. Load Average 및 Network 상태도 분석합니다.',
  inputSchema: z.object({
    serverId: z
      .string()
      .optional()
      .describe('분석할 서버 ID (선택, 미입력시 첫 번째 서버)'),
    metricType: z
      .enum(['cpu', 'memory', 'disk', 'all'])
      .default('all')
      .describe('분석할 메트릭 타입'),
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
  }),
  execute: async ({
    serverId,
    metricType,
    currentMetrics,
  }: {
    serverId?: string;
    metricType: 'cpu' | 'memory' | 'disk' | 'all';
    currentMetrics?: {
      cpu?: number;
      memory?: number;
      disk?: number;
      network?: number;
      load1?: number;
      load5?: number;
      cpuCores?: number;
    };
  }) => {
    try {
      const cache = getDataCache();

      return await cache.getAnalysis(
        'anomaly',
        { serverId: serverId || 'first', metricType, currentMetrics },
        async () => {
          const state = getCurrentState();
          const server: ServerSnapshot | undefined = serverId
            ? state.servers.find((s) => s.id === serverId)
            : state.servers[0];

          if (!server) {
            return {
              success: false,
              error: `서버를 찾을 수 없습니다: ${serverId || 'none'}`,
            };
          }

          // Merge currentMetrics with server snapshot if provided
          const analyzedServer = { ...server, ...currentMetrics };

          // Basic metrics to scan
          const metrics = ['cpu', 'memory', 'disk'] as const;
          const targetMetrics =
            metricType === 'all'
              ? metrics
              : [metricType as (typeof metrics)[number]];

          const results: Record<string, AnomalyResultItem & { thresholdExceeded?: boolean }> = {};
          const detector = getAnomalyDetector();

          // 1. Basic Metrics Analysis (CPU, Memory, Disk)
          for (const metric of targetMetrics) {
            const currentValue = analyzedServer[metric as keyof typeof analyzedServer] as number;
            const history = getHistoryForMetric(analyzedServer.id, metric, currentValue);

            // Statistical detection
            const detection = detector.detectAnomaly(currentValue, history);

            // Fixed threshold check
            const threshold = STATUS_THRESHOLDS[metric as keyof typeof STATUS_THRESHOLDS];
            const thresholdExceeded = currentValue >= threshold.warning;
            const isCritical = currentValue >= threshold.critical;

            // Combine
            const isAnomaly = thresholdExceeded || detection.isAnomaly;

            let severity = detection.severity;
            if (isCritical) {
              severity = 'high';
            } else if (thresholdExceeded) {
              severity = 'medium';
            }

            results[metric] = {
              isAnomaly,
              severity,
              confidence: thresholdExceeded ? 0.95 : Math.round(detection.confidence * 100) / 100,
              currentValue,
              threshold: {
                upper: threshold.warning,
                lower: Math.round(detection.details.lowerThreshold * 100) / 100,
              },
              thresholdExceeded,
            };
          }

          // 2. Enhanced Metrics Analysis (Network, Load Avg) - if in 'all' mode
          if (metricType === 'all') {
            // Network Analysis (using threshold)
            if (typeof analyzedServer.network === 'number') {
              const netValue = analyzedServer.network;
              const netThreshold = STATUS_THRESHOLDS.network;
              const netExceeded = netValue >= netThreshold.warning;
              
              if (netExceeded) {
                const isNetCritical = netValue >= netThreshold.critical;
                results['network'] = {
                  isAnomaly: true,
                  severity: isNetCritical ? 'high' : 'medium',
                  confidence: 0.9,
                  currentValue: netValue,
                  threshold: { upper: netThreshold.warning, lower: 0 },
                  thresholdExceeded: true
                };
              }
            }

            // Load Average Analysis
            if (
              analyzedServer.load1 !== undefined &&
              analyzedServer.cpuCores !== undefined &&
              analyzedServer.cpuCores > 0
            ) {
              const load1 = analyzedServer.load1;
              const cores = analyzedServer.cpuCores;
              
              // Rule: Load > Cores (Warning), Load > Cores * 1.5 (Critical)
              // Note: Adjusted rule for demo sensitivity
              const loadWarning = cores * 1.0; 
              const loadCritical = cores * 1.5;

              if (load1 >= loadWarning) {
                const isLoadCritical = load1 >= loadCritical;
                 results['load_average'] = {
                  isAnomaly: true,
                  severity: isLoadCritical ? 'high' : 'medium',
                  confidence: 0.85,
                  currentValue: load1,
                  threshold: { upper: loadWarning, lower: 0 },
                  thresholdExceeded: true
                };
              }
            }
          }

          const anomalyCount = Object.values(results).filter(
            (r) => r.isAnomaly
          ).length;

          // Determine overall status
          const hasCritical = Object.values(results).some(
            (r) => r.isAnomaly && r.severity === 'high'
          );
          const hasWarning = Object.values(results).some(
            (r) => r.isAnomaly && r.severity === 'medium'
          );
          const overallStatus = hasCritical ? 'critical' : hasWarning ? 'warning' : 'online';

          // Calculate system-wide summary (all servers)
          const allServers = state.servers;
          let healthyCount = 0;
          let warningCount = 0;
          let criticalCount = 0;

          for (const srv of allServers) {
            const srvCpu = srv.cpu as number;
            const srvMemory = srv.memory as number;
            const srvDisk = srv.disk as number;

            const isCriticalSrv =
              srvCpu >= STATUS_THRESHOLDS.cpu.critical ||
              srvMemory >= STATUS_THRESHOLDS.memory.critical ||
              srvDisk >= STATUS_THRESHOLDS.disk.critical;
            const isWarningSrv =
              srvCpu >= STATUS_THRESHOLDS.cpu.warning ||
              srvMemory >= STATUS_THRESHOLDS.memory.warning ||
              srvDisk >= STATUS_THRESHOLDS.disk.warning;

            if (isCriticalSrv) {
              criticalCount++;
            } else if (isWarningSrv) {
              warningCount++;
            } else {
              healthyCount++;
            }
          }

          // Format details string for included enhanced metrics
          let details = `${analyzedServer.name}: ${anomalyCount}개 메트릭에서 이상 감지 (${overallStatus})`;
          if (results['load_average']?.isAnomaly) {
            details += ` | Load Avg high (${results['load_average'].currentValue})`;
          }
          if (results['network']?.isAnomaly) {
            details += ` | Network high (${results['network'].currentValue}%)`;
          }

          return {
            success: true,
            serverId: analyzedServer.id,
            serverName: analyzedServer.name,
            status: overallStatus,
            anomalyCount,
            hasAnomalies: anomalyCount > 0,
            results,
            // v2.1: Return both message and structured summary
            summaryMessage: anomalyCount > 0
              ? details
              : `${analyzedServer.name}: 정상 (이상 없음)`,
            summary: {
              totalServers: allServers.length,
              healthyCount,
              warningCount,
              criticalCount,
            },
            timestamp: new Date().toISOString(),
            _algorithm: 'Threshold + Statistical + Enhanced Metrics',
          };
        }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});




/**
 * Predict Trends Tool v2.0
 *
 * 🆕 Enhanced Prediction (상용 도구 수준):
 * - 임계값 도달 시간 예측 (Prometheus predict_linear 스타일)
 * - 정상 복귀 시간 예측 (Datadog Recovery Forecast 스타일)
 * - 현재 상태 + 미래 상태 예측
 *
 * @version 2.0.0
 * @date 2026-01-12
 */
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
            ? state.servers.find((s) => s.id === serverId)
            : state.servers[0];

          if (!server) {
            return {
              success: false,
              error: `서버를 찾을 수 없습니다: ${serverId || 'none'}`,
            };
          }

          const metrics = ['cpu', 'memory', 'disk'] as const;
          const targetMetrics =
            metricType === 'all'
              ? metrics
              : [metricType as (typeof metrics)[number]];

          // 🆕 Enhanced Results Interface
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

          // 🆕 Alerts for critical predictions
          const warnings: string[] = [];
          const criticalAlerts: string[] = [];
          const recoveryPredictions: string[] = [];

          for (const metric of targetMetrics) {
            const currentValue = server[metric as keyof typeof server] as number;
            const history = getHistoryForMetric(server.id, metric, currentValue);
            const trendHistory = toTrendDataPoints(history);

            // 🆕 Use enhanced prediction
            const prediction = predictor.predictEnhanced(trendHistory, metric);

            // 백분율 메트릭은 0-100 범위로 클램핑 (이중 안전장치)
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
              // 🆕 Enhanced fields
              currentStatus: prediction.currentStatus,
              thresholdBreach: prediction.thresholdBreach,
              recovery: prediction.recovery,
            };

            // 🆕 Collect alerts
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
            .filter(([, r]) => r.trend === 'increasing')
            .map(([m]) => m);

          // 🆕 Build enhanced message
          let message = '';
          if (criticalAlerts.length > 0) {
            message = `🚨 ${server.name}: ${criticalAlerts.join('; ')}`;
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
              // 🆕 Enhanced summary
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
      };
    }
  },
});

/**
 * Analyze Pattern Tool
 * Classifies user query intent
 */
export const analyzePattern = tool({
  description:
    '사용자 질문의 패턴을 분석하여 의도를 파악하고 관련 인사이트를 제공합니다.',
  inputSchema: z.object({
    query: z.string().describe('분석할 사용자 질문'),
  }),
  execute: async ({ query }: { query: string }) => {
    try {
      const patterns: string[] = [];
      const q = query.toLowerCase();

      // Pattern matching
      if (/cpu|프로세서|성능/i.test(q)) patterns.push('system_performance');
      if (/메모리|ram|memory/i.test(q)) patterns.push('memory_status');
      if (/디스크|저장소|용량/i.test(q)) patterns.push('storage_info');
      if (/서버|시스템|상태/i.test(q)) patterns.push('server_status');
      if (/트렌드|추세|예측/i.test(q)) patterns.push('trend_analysis');
      if (/이상|anomaly|alert/i.test(q)) patterns.push('anomaly_detection');

      if (patterns.length === 0) {
        return {
          success: false,
          message: '매칭되는 패턴 없음',
          query,
        };
      }

      const analysisResults = patterns.map((pattern) => ({
        pattern,
        confidence: 0.8 + Math.random() * 0.2,
        insights: PATTERN_INSIGHTS[pattern] || '일반 분석 수행',
      }));

      return {
        success: true,
        patterns,
        detectedIntent: patterns[0],
        analysisResults,
        summary: `${patterns.length}개 패턴 감지: ${patterns.join(', ')}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// ============================================================================
// 3.4 Detect Anomalies for All Servers (Incident Report)
// ============================================================================

/**
 * Detect Anomalies for All Servers
 *
 * Scans all servers and returns detailed anomaly information.
 * Used for incident reports to provide complete system overview.
 *
 * @version 1.0.0
 * @date 2026-01-25
 */
export const detectAnomaliesAllServers = tool({
  description:
    '전체 서버의 이상치를 탐지합니다. 장애보고서용으로 모든 서버를 스캔합니다.',
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

          let healthyCount = 0;
          let warningCount = 0;
          let criticalCount = 0;
          const affectedServers: string[] = [];

          for (const server of allServers) {
            let serverHasAnomaly = false;
            let serverIsCritical = false;
            let serverIsWarning = false;

            for (const metric of targetMetrics) {
              const currentValue = server[metric as keyof typeof server] as number;
              const threshold = STATUS_THRESHOLDS[metric as keyof typeof STATUS_THRESHOLDS];

              const isCritical = currentValue >= threshold.critical;
              const isWarning = currentValue >= threshold.warning;

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

          return {
            success: true as const,
            totalServers: allServers.length,
            anomalies: allAnomalies,
            affectedServers,
            summary,
            hasAnomalies: allAnomalies.length > 0,
            anomalyCount: allAnomalies.length,
            timestamp: new Date().toISOString(),
            _algorithm: 'All-Server Threshold Scan (Cached)',
          };
        }
      );
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
