import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunAllServerAnomalyScan } = vi.hoisted(() => ({
  mockRunAllServerAnomalyScan: vi.fn(),
}));

vi.mock('../../../tools-ai-sdk/analyst-tools-detect-all', () => ({
  runAllServerAnomalyScan: mockRunAllServerAnomalyScan,
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  ANALYST_PREFETCH_PROMPT_MARKER,
  buildAnalystEvidencePrefetchPrompt,
  maybeBuildAnalystEvidencePrefetchPrompt,
} from './analyst-evidence-prefetch';

function createScanResult() {
  return {
    success: true as const,
    totalServers: 18,
    anomalies: [
      {
        server_id: 'db-mysql-dc1-01',
        server_name: 'Database Primary',
        metric: 'Memory',
        value: 95,
        severity: 'critical' as const,
      },
      {
        server_id: 'api-was-dc1-01',
        server_name: 'API Server 01',
        metric: 'CPU',
        value: 82,
        severity: 'warning' as const,
      },
    ],
    affectedServers: ['db-mysql-dc1-01', 'api-was-dc1-01'],
    summary: {
      totalServers: 18,
      onlineCount: 15,
      warningCount: 2,
      criticalCount: 1,
      offlineCount: 0,
    },
    hasAnomalies: true,
    anomalyCount: 2,
    timestamp: '2026-05-30T00:00:00.000Z',
    algorithmVersion: '2.5.0',
    decisionSource: 'threshold_scan+linear_trend_scan',
    analysisBasis: 'status-thresholds:ssot,history:last90min,horizon:30min',
    evidenceContract: {
      mode: 'deterministic_evidence',
      signalStrengthMeaning: 'evidence_strength_not_incident_probability',
    },
    risingTrendScan: {
      horizonHours: 0.5,
      method: 'linear_trend_scan',
      riskCount: 1,
      risingTrends: [
        {
          serverId: 'cache-redis-dc1-01',
          serverName: 'Cache Server 01',
          metric: 'memory',
          currentValue: 72,
          projectedValue30m: 78.4,
          warningThreshold: 75,
          riskLevel: 'medium' as const,
        },
      ],
    },
    _algorithm: 'All-Server Threshold Scan + 30min Rising Trend Scan (Cached)',
  };
}

describe('Analyst evidence prefetch prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunAllServerAnomalyScan.mockResolvedValue(createScanResult());
  });

  it('formats deterministic anomaly evidence into a compact system prompt', () => {
    const prompt = buildAnalystEvidencePrefetchPrompt(createScanResult());

    expect(prompt).toContain(ANALYST_PREFETCH_PROMPT_MARKER);
    expect(prompt).toContain('Analyst precomputed anomaly evidence');
    expect(prompt).toContain('anomalyCount: 2');
    expect(prompt).toContain('risingTrendScan');
    expect(prompt).toContain('Do not call detectAnomaliesAllServers again');
    expect(prompt).toContain('db-mysql-dc1-01');
    expect(prompt.length).toBeLessThan(2_000);
  });

  it('only prefetches for Analyst Agent and skips duplicate prefetch prompts', async () => {
    await expect(
      maybeBuildAnalystEvidencePrefetchPrompt({
        agentName: 'Advisor Agent',
      })
    ).resolves.toBeUndefined();

    await expect(
      maybeBuildAnalystEvidencePrefetchPrompt({
        agentName: 'Analyst Agent',
        existingPrompt: `${ANALYST_PREFETCH_PROMPT_MARKER}\nalready present`,
      })
    ).resolves.toBeUndefined();

    await expect(
      maybeBuildAnalystEvidencePrefetchPrompt({
        agentName: 'Analyst Agent',
        existingPrompt: '[untrusted user-provided log excerpt]\n...',
      })
    ).resolves.toContain('Analyst precomputed anomaly evidence');

    expect(mockRunAllServerAnomalyScan).toHaveBeenCalledTimes(1);
    expect(mockRunAllServerAnomalyScan).toHaveBeenCalledWith({
      metricType: 'all',
    });
  });

  it('isolates prefetch failures so Analyst can fall back to normal tool loop', async () => {
    mockRunAllServerAnomalyScan.mockRejectedValueOnce(
      new Error('cache unavailable')
    );

    await expect(
      maybeBuildAnalystEvidencePrefetchPrompt({
        agentName: 'Analyst Agent',
      })
    ).resolves.toBeUndefined();
  });
});
