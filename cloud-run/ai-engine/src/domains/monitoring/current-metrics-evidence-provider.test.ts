import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  monitoringMetricRankingEvidenceProvider,
  monitoringServerHealthEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { monitoringDomainDataSource } from './domain-pack';

function createEvidenceRequest(message: string) {
  return {
    requestId: 'current-metrics-evidence-test',
    domainId: MONITORING_DOMAIN_ID,
    message,
    messages: [{ role: 'user' as const, content: message }],
    dataSource: monitoringDomainDataSource,
  };
}

describe('current metrics domain evidence providers', () => {
  it('parses current metric Top-N queries as deterministic metric ranking', () => {
    const parsed = parseCurrentMetricsEvidenceRequest(
      createEvidenceRequest('현재 CPU 사용률 상위 3대 알려줘')
    );

    expect(parsed).toMatchObject({
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      metric: 'cpu',
      rankCount: 3,
      rankOrder: 'desc',
    });
  });

  it('does not claim historical ranking questions as current metric evidence', () => {
    expect(
      parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('지난 24시간 CPU 사용률 상위 3대 알려줘')
      )
    ).toBeNull();
  });

  it('resolves current metric ranking with deterministic answer metadata', async () => {
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(
      createEvidenceRequest('현재 CPU 사용률 상위 3대 알려줘')
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-ranking',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        intent: 'metric_ranking',
        metric: 'cpu',
        rankCount: 3,
      },
    });
    expect(evidence?.fallback).toContain('CPU 사용률 상위 3대');
    expect(evidence?.fallback).toContain('서버별 확인 항목');
    expect(evidence?.prompt).toContain('[결정적 monitoring 현재 지표 근거]');
  });

  it('resolves frame-only metric ranking without raw ranking keywords', async () => {
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve({
      ...createEvidenceRequest('frame only metric current request'),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'memory',
        timeWindow: 'current',
        aggregation: 'top_n',
        topN: 2,
        ambiguity: 'low',
        confidence: 0.93,
      },
    });

    expect(evidence?.id).toBe('monitoring-metric-ranking');
    expect(evidence?.fallback).toContain('메모리 사용률 상위 2대');
    expect(evidence?.metadata).toMatchObject({
      sourceIntent: 'metric_current',
      metric: 'memory',
      rankCount: 2,
    });
  });

  it('resolves current server health summaries as deterministic evidence', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('현재 모든 서버 상태 요약해줘')
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
      },
    });
    expect(evidence?.fallback).toContain('서버 현황 요약');
    expect(evidence?.fallback).toContain('전체');
    expect(evidence?.prompt).toContain('현재 서버 상태');
  });
});
