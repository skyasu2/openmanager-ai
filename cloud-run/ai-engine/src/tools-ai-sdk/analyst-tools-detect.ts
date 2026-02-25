/**
 * Analyst Tools — Single-Server Anomaly Detection
 *
 * Hybrid approach combining:
 * 1. Fixed thresholds (Dashboard compatible) - Primary
 * 2. Statistical (6-hour moving average + 2σ) - Secondary
 * 3. Enhanced Metrics (Load Avg, Network) - Tertiary
 *
 * @version 2.1.0
 */

import { tool } from 'ai';
import { z } from 'zod';

import {
  getCurrentState,
  type ServerSnapshot,
} from '../data/precomputed-state';
import {
  getAnomalyDetector,
} from '../lib/ai/monitoring/SimpleAnomalyDetector';
import { getDataCache } from '../lib/cache-layer';
import {
  getCurrentSlotIndex,
  getHistoryForMetric,
  type AnomalyResultItem,
} from './analyst-tools-shared';
import { STATUS_THRESHOLDS } from '../config/status-thresholds';

// ============================================================================
// Decision Metadata (Explainability)
// ============================================================================

type DecisionSource = 'threshold' | 'statistical' | 'threshold+statistical';

interface AnomalyDecisionMetadata {
  decisionSource: DecisionSource;
  confidenceBasis: string;
  rationale: string[];
}

function buildAnomalyDecisionMetadata(
  metric: string,
  currentValue: number,
  threshold: { warning: number; critical: number },
  detection: {
    isAnomaly: boolean;
    confidence: number;
    details: {
      deviation: number;
      mean: number;
      upperThreshold: number;
      lowerThreshold: number;
    };
  }
): AnomalyDecisionMetadata {
  const thresholdExceeded = currentValue >= threshold.warning;
  const rationale: string[] = [];
  const roundedDeviation = Math.abs(detection.details.deviation);
  const confidenceBasisParts = [
    `metric:${metric}`,
    `mean:${Math.round(detection.details.mean * 10) / 10}`,
    `stdWindowUpper:${Math.round(detection.details.upperThreshold * 10) / 10}`,
    `stdWindowLower:${Math.round(detection.details.lowerThreshold * 10) / 10}`,
    `deviation:${roundedDeviation.toFixed(2)}σ`,
  ];

  if (thresholdExceeded) {
    rationale.push(
      `threshold-breach:${currentValue.toFixed(1)}>=warning(${threshold.warning})`
    );
    if (currentValue >= threshold.critical) {
      rationale.push(
        `critical-threshold:${currentValue.toFixed(1)}>=critical(${threshold.critical})`
      );
    }
  }

  if (detection.isAnomaly) {
    rationale.push(
      `zscore:${roundedDeviation.toFixed(2)} (windowStd based)`
    );
  } else {
    rationale.push('zscore-within-band');
  }

  const decisionSource: DecisionSource = thresholdExceeded && detection.isAnomaly
    ? 'threshold+statistical'
    : thresholdExceeded
      ? 'threshold'
      : detection.isAnomaly
        ? 'statistical'
        : 'statistical';

  const confidenceBasis = [
    ...confidenceBasisParts,
    `rule=threshold-${thresholdExceeded ? 'break' : 'ok'}`,
    `ruleConfidence=${Math.round(detection.confidence * 100)}%`,
    `source=${decisionSource}`,
    `detection.deviation=${roundedDeviation.toFixed(2)}`
  ].join(', ');

  return {
    decisionSource,
    confidenceBasis,
    rationale,
  };
}

// ============================================================================
// detectAnomalies Tool (Single Server)
// ============================================================================

export const detectAnomalies = tool({
  description:
    '특정 서버 1대의 메트릭 이상치를 탐지합니다 (단일 서버 전용). 반드시 serverId를 지정하세요. 전체 서버를 스캔하려면 detectAnomaliesAllServers를 사용하세요.',
  inputSchema: z.object({
    serverId: z
      .string()
      .optional()
      .describe('분석할 서버 ID (필수 권장 — 미입력시 첫 번째 서버만 반환)'),
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
              systemMessage: `TOOL_EXECUTION_FAILED: 대상 서버(${serverId || 'none'})를 목록에서 찾을 수 없어 이상 탐지를 수행하지 못했습니다.`,
              suggestedAgentAction: `사용자에게 요청하신 서버(${serverId})가 존재하지 않음을 알리고 올바른 서버 ID를 다시 확인해 달라고 요청하세요.`,
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
          const fixedSlot = getCurrentSlotIndex();

          // 1. Basic Metrics Analysis (CPU, Memory, Disk)
          for (const metric of targetMetrics) {
            const currentValue = analyzedServer[metric as keyof typeof analyzedServer] as number;
            const history = getHistoryForMetric(analyzedServer.id, metric, currentValue, fixedSlot);
            const threshold = STATUS_THRESHOLDS[metric as keyof typeof STATUS_THRESHOLDS];

            // Statistical detection
            const detection = detector.detectAnomaly(currentValue, history);
            const decisionMetadata = buildAnomalyDecisionMetadata(metric, currentValue, threshold, {
              isAnomaly: detection.isAnomaly,
              confidence: detection.confidence,
              details: {
                deviation: detection.details.deviation,
                mean: detection.details.mean,
                upperThreshold: detection.details.upperThreshold,
                lowerThreshold: detection.details.lowerThreshold,
              },
            });

            // Fixed threshold check
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
              decisionSource: decisionMetadata.decisionSource,
              confidenceBasis: decisionMetadata.confidenceBasis,
              rationale: decisionMetadata.rationale,
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
                  decisionSource: 'threshold',
                  confidenceBasis: `rule=network-threshold, value=${netValue}, warning=${netThreshold.warning}, critical=${netThreshold.critical}`,
                  rationale: [
                    `network-threshold-breach:${netValue}>=warning(${netThreshold.warning})`,
                    netValue >= netThreshold.critical
                      ? `network-threshold-breach:${netValue}>=critical(${netThreshold.critical})`
                      : 'network-threshold-ok-at-critical',
                  ],
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
              const loadWarning = cores * 1.0;
              const loadCritical = cores * 1.5;

              if (load1 >= loadWarning) {
                const isLoadCritical = load1 >= loadCritical;
                results['load_average'] = {
                  isAnomaly: true,
                  severity: isLoadCritical ? 'high' : 'medium',
                  confidence: 0.85,
                  currentValue: load1,
                  decisionSource: 'threshold',
                  confidenceBasis: `rule=load-threshold, value=${load1}, warning=${loadWarning}, critical=${loadCritical}`,
                  rationale: [
                    `load-warning:${load1}>=warning(${loadWarning})`,
                    isLoadCritical ? `load-critical:${load1}>=critical(${loadCritical})` : 'load-below-critical',
                  ],
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
        systemMessage: `TOOL_EXECUTION_FAILED: 메트릭 데이터 분석 중 알 수 없는 오류가 발생했습니다. (${String(error)})`,
        suggestedAgentAction: '사용자에게 분석 도구 실행 중 일시적인 오류가 발생했음을 안내하고, 대신 서버 로그 등 다른 방식으로 분석할 수 있는지 대안을 제시하세요.',
      };
    }
  },
});
