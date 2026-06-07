import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
} from './constants';
import {
  monitoringMetricCurrentEvidenceProvider,
  monitoringMetricRankingEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: parsing basics', () => {
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

  it('keeps metric-specific load wording on the requested metric ranking path', () => {
    const parsed = parseCurrentMetricsEvidenceRequest(
      createEvidenceRequest('현재 가장 CPU 부하가 높은 서버 TOP 3')
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

  it.each([
    'api-was-dc1-01 CPU 81% 이유가 뭐야?',
    'cache-redis-dc1-01 메모리 사용률 91% 때문에 느린 거야?',
    'storage-nfs-dc1-01 disk 88% why so high?',
  ])(
    'does not claim explicit RCA current-metric questions as deterministic evidence: %s',
    (message) => {
      const request = {
        ...createEvidenceRequest(message),
        intentFrame: {
          domainId: MONITORING_DOMAIN_ID,
          intent: 'metric_current',
          capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
          scope: 'entity',
          targets: ['api-was-dc1-01'],
          metric: 'cpu',
          timeWindow: 'current',
          aggregation: 'summary',
          ambiguity: 'low',
          executionMode: 'single',
          confidence: 0.93,
        },
      };

      expect(parseCurrentMetricsEvidenceRequest(request)).toBeNull();
      expect(monitoringMetricCurrentEvidenceProvider.canHandle(request)).toBe(
        false
      );
    }
  );

  it('does not claim single-server performance advice as metric ranking evidence', async () => {
    const request = {
      ...createEvidenceRequest(
        'db-mysql-dc1-primary 서버 디스크 사용량이 높은데 성능 개선 조언 해줘'
      ),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_ranking',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        scope: 'entity',
        targets: ['db-mysql-dc1-primary'],
        metric: 'disk',
        timeWindow: 'current',
        aggregation: 'top_n',
        topN: 3,
        ambiguity: 'low',
        executionMode: 'single',
        confidence: 0.93,
      },
    };

    expect(parseCurrentMetricsEvidenceRequest(request)).toBeNull();
    expect(monitoringMetricRankingEvidenceProvider.canHandle(request)).toBe(
      false
    );
    await expect(
      monitoringMetricRankingEvidenceProvider.resolve(request)
    ).resolves.toBeNull();
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
});
