import { describe, expect, it } from 'vitest';
import type { ServerAnalysisResult } from '@/types/intelligent-monitoring.types';
import { createSystemAnalysisSummary } from './system-summary';

function createServerResult(
  overrides: Partial<ServerAnalysisResult>
): ServerAnalysisResult {
  return {
    success: true,
    serverId: 'server-1',
    serverName: 'server-1',
    analysisType: 'full',
    timestamp: '2026-04-27T00:00:00.000Z',
    overallStatus: 'online',
    ...overrides,
  };
}

describe('createSystemAnalysisSummary', () => {
  it('does not promote benign low severity anomalies into top issues', () => {
    const summary = createSystemAnalysisSummary([
      createServerResult({
        serverId: 'storage-nfs-dc1-02',
        serverName: 'storage-nfs-dc1-02',
        anomalyDetection: {
          success: true,
          serverId: 'storage-nfs-dc1-02',
          serverName: 'storage-nfs-dc1-02',
          anomalyCount: 1,
          hasAnomalies: true,
          timestamp: '2026-04-27T00:00:00.000Z',
          _algorithm: 'zscore',
          _engine: 'test',
          _cached: false,
          results: {
            cpu: {
              isAnomaly: true,
              severity: 'low',
              confidence: 0.51,
              currentValue: 24,
              threshold: { lower: 0, upper: 100 },
            },
          },
        },
      }),
    ]);

    expect(summary.topIssues).toEqual([]);
  });

  it('ranks actionable issues by severity and threshold distance', () => {
    const summary = createSystemAnalysisSummary([
      createServerResult({
        serverId: 'api-was-dc1-01',
        serverName: 'api-was-dc1-01',
        overallStatus: 'warning',
        anomalyDetection: {
          success: true,
          serverId: 'api-was-dc1-01',
          serverName: 'api-was-dc1-01',
          anomalyCount: 1,
          hasAnomalies: true,
          timestamp: '2026-04-27T00:00:00.000Z',
          _algorithm: 'zscore',
          _engine: 'test',
          _cached: false,
          results: {
            disk: {
              isAnomaly: true,
              severity: 'medium',
              confidence: 0.8,
              currentValue: 86,
              threshold: { lower: 0, upper: 80 },
            },
          },
        },
      }),
      createServerResult({
        serverId: 'cache-redis-dc1-01',
        serverName: 'cache-redis-dc1-01',
        overallStatus: 'critical',
        anomalyDetection: {
          success: true,
          serverId: 'cache-redis-dc1-01',
          serverName: 'cache-redis-dc1-01',
          anomalyCount: 1,
          hasAnomalies: true,
          timestamp: '2026-04-27T00:00:00.000Z',
          _algorithm: 'zscore',
          _engine: 'test',
          _cached: false,
          results: {
            memory: {
              isAnomaly: true,
              severity: 'high',
              confidence: 0.91,
              currentValue: 91,
              threshold: { lower: 0, upper: 80 },
            },
          },
        },
      }),
    ]);

    expect(summary.topIssues[0]).toMatchObject({
      serverName: 'cache-redis-dc1-01',
      metric: 'memory',
      severity: 'high',
      reason: '상한 80% 초과',
      confidence: 0.91,
    });
  });

  it('keeps threshold breach predictions even when the numeric target is missing', () => {
    const summary = createSystemAnalysisSummary([
      createServerResult({
        serverId: 'api-was-dc1-01',
        serverName: 'api-was-dc1-01',
        trendPrediction: {
          success: true,
          serverId: 'api-was-dc1-01',
          serverName: 'api-was-dc1-01',
          predictionHorizon: '24h',
          timestamp: '2026-04-27T00:00:00.000Z',
          _algorithm: 'linear-regression',
          _engine: 'test',
          _cached: false,
          summary: {
            increasingMetrics: ['cpu'],
            hasRisingTrends: true,
          },
          results: {
            cpu: {
              trend: 'increasing',
              currentValue: 69,
              predictedValue: Number.NaN,
              changePercent: 6,
              confidence: 0.78,
              thresholdBreach: {
                willBreachWarning: true,
                timeToWarning: 18,
                willBreachCritical: false,
                timeToCritical: null,
                humanReadable: '18시간 내 warning 임계값 도달 예상',
              },
            },
          },
        },
      }),
    ]);

    expect(summary.predictions[0]).toMatchObject({
      serverName: 'api-was-dc1-01',
      metric: 'cpu',
      currentValue: 69,
      predictedValue: null,
      predictionState: 'missing',
      thresholdBreachMessage: '18시간 내 warning 임계값 도달 예상',
    });
  });
});
