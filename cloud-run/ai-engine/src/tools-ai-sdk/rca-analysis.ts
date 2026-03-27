/**
 * RCA (Root Cause Analysis) Tools (AI SDK Format)
 *
 * Converted from LangChain tools to Vercel AI SDK format.
 * Simplified version focusing on core RCA functionality.
 *
 * @version 1.0.0
 * @updated 2025-12-28
 */

import { tool } from 'ai';
import { z } from 'zod';

// Data sources - precomputed-state 기반 분석
import {
  getRecentHistory,
} from '../data/precomputed-state';

// ============================================================================
// 1. Types
// ============================================================================

interface TimelineEvent {
  timestamp: string;
  eventType: string;
  metric?: string;
  value?: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

interface RootCauseHypothesis {
  cause: string;
  confidence: number;
  evidence: string[];
  suggestedFix: string;
}

// ============================================================================
// 2. Helper Functions
// ============================================================================

function calculateCorrelation(arr1: number[], arr2: number[]): number {
  if (arr1.length !== arr2.length || arr1.length === 0) return 0;

  const n = arr1.length;
  const mean1 = arr1.reduce((a, b) => a + b, 0) / n;
  const mean2 = arr2.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator1 = 0;
  let denominator2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = arr1[i] - mean1;
    const diff2 = arr2[i] - mean2;
    numerator += diff1 * diff2;
    denominator1 += diff1 * diff1;
    denominator2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(denominator1 * denominator2);
  return denominator === 0 ? 0 : numerator / denominator;
}

// ============================================================================
// 3. AI SDK Tools
// ============================================================================

/**
 * Build Incident Timeline
 */
export const buildIncidentTimeline = tool({
  description:
    '서버의 장애 타임라인을 구성합니다. 메트릭 임계값 초과 이벤트를 시간순으로 정렬합니다.',
  inputSchema: z.object({
    serverId: z.string().describe('분석할 서버 ID'),
    timeRangeHours: z.number().default(6).describe('분석 시간 범위 (시간)'),
  }),
  execute: async ({
    serverId,
    timeRangeHours,
  }: {
    serverId: string;
    timeRangeHours: number;
  }) => {
    try {
      const events: TimelineEvent[] = [];
      const now = new Date();
      const slotsNeeded = Math.min(144, timeRangeHours * 6);

      // precomputed-state 기반 분석 - 임계값 초과 감지
      const history = getRecentHistory(slotsNeeded);
      const thresholds: Record<string, number> = {
        cpu: 80,
        memory: 85,
        disk: 90,
        network: 85,
      };

      for (const [metric, threshold] of Object.entries(thresholds)) {
        for (let i = 0; i < history.length; i++) {
          const server = history[i].servers.find((s) => s.id === serverId);
          if (!server) continue;

          const value = server[metric as keyof typeof server] as number;
          if (value >= threshold) {
            const eventTime = new Date(now);
            eventTime.setMinutes(eventTime.getMinutes() - i * 10);

            events.push({
              timestamp: eventTime.toISOString(),
              eventType: 'threshold_breach',
              metric,
              value,
              severity: value >= 90 ? 'critical' : 'warning',
              description: `${metric.toUpperCase()} breached ${threshold}%: ${value.toFixed(1)}%`,
            });
            break; // Only first breach per metric
          }
        }
      }

      // Sort by timestamp (newest first)
      events.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const criticalCount = events.filter(
        (e) => e.severity === 'critical'
      ).length;

      return {
        success: true,
        serverId,
        eventCount: events.length,
        criticalEvents: criticalCount,
        events: events.slice(0, 10), // Top 10 events
        summary:
          events.length > 0
            ? `${serverId}: ${events.length} events (${criticalCount} critical) in last ${timeRangeHours}h`
            : `${serverId}: No significant events`,
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

/**
 * Correlate Metrics
 */
export const correlateMetrics = tool({
  description:
    '메트릭 간 상관관계를 분석합니다. 피어슨 상관계수를 계산하여 잠재적 인과관계를 식별합니다.',
  inputSchema: z.object({
    serverId: z.string().describe('분석할 서버 ID'),
    targetMetric: z
      .enum(['cpu', 'memory', 'disk', 'network'])
      .describe('분석 대상 메트릭'),
  }),
  execute: async ({
    serverId,
    targetMetric,
  }: {
    serverId: string;
    targetMetric: 'cpu' | 'memory' | 'disk' | 'network';
  }) => {
    try {
      // 최근 2시간(12슬롯) 히스토리에서 상관관계 분석
      const history = getRecentHistory(12);
      const allMetrics = ['cpu', 'memory', 'disk', 'network'] as const;
      const otherMetrics = allMetrics.filter((m) => m !== targetMetric);

      // Extract values from precomputed slots
      const targetValues = history
        .map((h) => h.servers.find((s) => s.id === serverId)?.[targetMetric])
        .filter((v): v is number => v !== undefined);

      if (targetValues.length === 0) {
        return { success: false, error: `Server not found: ${serverId}` };
      }

      const correlations = otherMetrics.map((metric) => {
        const metricValues = history
          .map((h) => h.servers.find((s) => s.id === serverId)?.[metric])
          .filter((v): v is number => v !== undefined);
        const coefficient = calculateCorrelation(targetValues, metricValues);

        return {
          metric1: targetMetric,
          metric2: metric,
          coefficient: Math.round(coefficient * 100) / 100,
          relationship:
            coefficient > 0.5
              ? 'positive'
              : coefficient < -0.5
                ? 'negative'
                : 'none',
        };
      });

      // Sort by absolute correlation
      correlations.sort(
        (a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient)
      );

      const strongestCause = correlations.find(
        (c) => Math.abs(c.coefficient) > 0.7
      );

      return {
        success: true,
        serverId,
        targetMetric,
        correlations,
        strongestCorrelation: strongestCause
          ? `${targetMetric} ↔ ${strongestCause.metric2} (r=${strongestCause.coefficient})`
          : 'No strong correlations',
        summary: strongestCause
          ? `Strong ${strongestCause.relationship} correlation with ${strongestCause.metric2}`
          : `No strong correlations found for ${targetMetric}`,
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

/**
 * Find Root Cause
 */
export const findRootCause = tool({
  description:
    '증상을 기반으로 근본 원인 가설을 생성합니다. 메트릭 패턴 매칭과 키워드 분석을 사용합니다.',
  inputSchema: z.object({
    serverId: z.string().describe('문제가 발생한 서버 ID'),
    symptom: z.string().describe('증상 설명 (예: "CPU 급증", "메모리 부족")'),
  }),
  execute: async ({
    serverId,
    symptom,
  }: {
    serverId: string;
    symptom: string;
  }) => {
    try {
      const hypotheses: RootCauseHypothesis[] = [];
      const symptomLower = symptom.toLowerCase();

      // precomputed-state 기반 분석 - 최근 1시간 메트릭 조회
      const recentHistory = getRecentHistory(6);
      const serverMetrics = recentHistory
        .map((h) => h.servers.find((s) => s.id === serverId))
        .filter((s): s is NonNullable<typeof s> => s !== undefined);

      if (serverMetrics.length > 0) {
        const avgMetrics = {
          cpu: serverMetrics.reduce((sum, s) => sum + s.cpu, 0) / serverMetrics.length,
          memory: serverMetrics.reduce((sum, s) => sum + s.memory, 0) / serverMetrics.length,
          disk: serverMetrics.reduce((sum, s) => sum + s.disk, 0) / serverMetrics.length,
          network: serverMetrics.reduce((sum, s) => sum + s.network, 0) / serverMetrics.length,
        };

        // 메트릭 임계값 기반 가설 생성
        const thresholds = { cpu: 80, memory: 85, disk: 90, network: 85 };
        const metricNames: Record<string, string> = {
          cpu: 'CPU 과부하',
          memory: '메모리 부족',
          disk: '디스크 용량 부족',
          network: '네트워크 병목',
        };

        for (const [metric, threshold] of Object.entries(thresholds)) {
          const value = avgMetrics[metric as keyof typeof avgMetrics];
          if (value >= threshold && symptomLower.includes(metric)) {
            const severity = value >= 90 ? 'critical' : 'warning';
            hypotheses.push({
              cause: metricNames[metric],
              confidence: value >= 90 ? 0.9 : 0.75,
              evidence: [
                `현재 ${metric.toUpperCase()}: ${value.toFixed(1)}%`,
                `임계값 초과: ${threshold}%`,
                `심각도: ${severity}`,
              ],
              suggestedFix: metric === 'cpu' ? '프로세스 정리 또는 스케일아웃'
                : metric === 'memory' ? '메모리 누수 점검 또는 증설'
                : metric === 'disk' ? '불필요 파일 정리 또는 용량 확장'
                : '네트워크 대역폭 확인 또는 트래픽 제한',
            });
          }
        }
      }

      // Keyword-based fallback
      if (hypotheses.length === 0) {
        const categories: Record<string, string[]> = {
          cpu: ['cpu', 'load', '부하', '프로세서'],
          memory: ['memory', '메모리', 'oom', '누수'],
          disk: ['disk', '디스크', '용량', 'storage'],
          network: ['network', '네트워크', '트래픽', '지연'],
        };

        for (const [category, keywords] of Object.entries(categories)) {
          if (keywords.some((kw) => symptomLower.includes(kw))) {
            hypotheses.push({
              cause: `${category.toUpperCase()} 관련 문제`,
              confidence: 0.5,
              evidence: [`Keyword match: ${category}`],
              suggestedFix: `${category} 리소스 점검 및 최적화 필요`,
            });
          }
        }
      }

      // Default if no matches
      if (hypotheses.length === 0) {
        hypotheses.push({
          cause: '원인 불명 - 추가 분석 필요',
          confidence: 0.3,
          evidence: [`Symptom: ${symptom}`, `Server: ${serverId}`],
          suggestedFix: '수동 로그 분석 및 메트릭 상세 검토 필요',
        });
      }

      // Sort by confidence
      hypotheses.sort((a, b) => b.confidence - a.confidence);

      return {
        success: true,
        serverId,
        symptom,
        hypotheses: hypotheses.slice(0, 3),
        mostLikelyCause: hypotheses[0].cause,
        confidence: hypotheses[0].confidence,
        suggestedFix: hypotheses[0].suggestedFix,
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
