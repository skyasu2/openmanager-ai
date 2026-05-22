import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  monitoringMetricCurrentEvidenceProvider,
  monitoringMetricRankingEvidenceProvider,
  monitoringMetricTrendEvidenceProvider,
  monitoringServerHealthEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { monitoringDomainDataSource } from './domain-pack';

function createEvidenceRequest(message: string, data?: unknown) {
  return {
    requestId: 'current-metrics-evidence-test',
    domainId: MONITORING_DOMAIN_ID,
    message,
    messages: [{ role: 'user' as const, content: message }],
    dataSource: data
      ? {
          async snapshot() {
            return {
              timestamp: '2026-05-14T12:00:00+09:00',
              data,
            };
          },
        }
      : monitoringDomainDataSource,
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

  it('resolves cache current memory frame as deterministic group metric evidence', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve({
      ...createEvidenceRequest('캐시 서버 메모리 현황', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 22,
            memory: 61,
            disk: 31,
            network: 10,
          },
          {
            id: 'cache-redis-dc1-02',
            type: 'cache',
            status: 'online',
            cpu: 18,
            memory: 55,
            disk: 29,
            network: 11,
          },
          {
            id: 'cache-redis-dc1-03',
            type: 'cache',
            status: 'online',
            cpu: 20,
            memory: 49,
            disk: 33,
            network: 12,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 30,
            memory: 40,
            disk: 25,
            network: 13,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: ['cache-redis-dc1-01'],
        metric: 'memory',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.8,
      },
    });

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metric: 'memory',
      },
    });
    expect(evidence?.fallback).toContain('캐시 서버 3대 메모리 현황');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01 61%');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('keeps exact cache server frames when the user names the server ID', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve({
      ...createEvidenceRequest('cache-redis-dc1-01 캐시 서버 메모리 현황', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 22,
            memory: 61,
            disk: 31,
            network: 10,
          },
          {
            id: 'cache-redis-dc1-02',
            type: 'cache',
            status: 'online',
            cpu: 18,
            memory: 55,
            disk: 29,
            network: 11,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'server',
        targets: ['cache-redis-dc1-01'],
        metric: 'memory',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.8,
      },
    });

    expect(evidence?.fallback).toContain('캐시 서버 1대 메모리 현황');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01 61%');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-02');
  });

  it('routes explicit server-to-server metric comparisons to deterministic current metric evidence', async () => {
    const request = createEvidenceRequest(
      'api-was-dc1-01 과 api-was-dc1-02 의 CPU 사용량을 비교해줘',
      {
        timeLabel: '07:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 82,
            memory: 62,
            disk: 41,
            network: 18,
          },
          {
            id: 'api-was-dc1-02',
            type: 'application',
            status: 'online',
            cpu: 57,
            memory: 51,
            disk: 39,
            network: 16,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 92,
            memory: 45,
            disk: 28,
            network: 11,
          },
        ],
      }
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      metric: 'cpu',
      targets: ['api-was-dc1-01', 'api-was-dc1-02'],
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      request
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metric: 'cpu',
        targets: ['api-was-dc1-01', 'api-was-dc1-02'],
      },
    });
    expect(evidence?.fallback).toContain('애플리케이션 서버 2대 CPU 현황');
    expect(evidence?.fallback).toContain('api-was-dc1-01 82%');
    expect(evidence?.fallback).toContain('api-was-dc1-02 57%');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('resolves WAS group current metric prompts through application group hints', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('WAS 서버 CPU 현황 알려줘', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 82,
            memory: 62,
            disk: 41,
            network: 18,
          },
          {
            id: 'api-was-dc1-02',
            type: 'application',
            status: 'online',
            cpu: 57,
            memory: 51,
            disk: 39,
            network: 16,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 92,
            memory: 45,
            disk: 28,
            network: 11,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metric: 'cpu',
        targets: ['application'],
      },
    });
    expect(evidence?.fallback).toContain('애플리케이션 서버 2대 CPU 현황');
    expect(evidence?.fallback).toContain('api-was-dc1-01 82%');
    expect(evidence?.fallback).toContain('api-was-dc1-02 57%');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('resolves role group metric comparisons deterministically', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('WAS와 DB 서버 CPU 비교해줘', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 82,
            memory: 62,
            disk: 41,
            network: 18,
          },
          {
            id: 'api-was-dc1-02',
            type: 'application',
            status: 'online',
            cpu: 58,
            memory: 51,
            disk: 39,
            network: 16,
          },
          {
            id: 'db-mysql-dc1-01',
            type: 'database',
            status: 'online',
            cpu: 42,
            memory: 71,
            disk: 65,
            network: 13,
          },
          {
            id: 'db-mysql-dc1-02',
            type: 'database',
            status: 'online',
            cpu: 38,
            memory: 68,
            disk: 61,
            network: 12,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 92,
            memory: 45,
            disk: 28,
            network: 11,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'cpu',
        groupTargets: ['application', 'database'],
      },
    });
    expect(evidence?.fallback).toContain('애플리케이션 서버 vs DB 서버 CPU 비교');
    expect(evidence?.fallback).toContain('애플리케이션 서버 70%');
    expect(evidence?.fallback).toContain('DB 서버 40%');
    expect(evidence?.fallback).toContain('평균 CPU 30%p 높습니다');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('resolves multi-metric AND threshold filters deterministically', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('CPU와 메모리 모두 50% 이상인 서버 알려줘', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 82,
            memory: 62,
            disk: 41,
            network: 18,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 44,
            memory: 91,
            disk: 40,
            network: 12,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 55,
            memory: 45,
            disk: 28,
            network: 11,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metrics: ['cpu', 'memory'],
        threshold: 50,
        thresholdOperator: '>=',
        filterOperator: 'AND',
      },
    });
    expect(evidence?.fallback).toContain('CPU + 메모리 50% 이상 서버');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('keeps strict greater-than multi-metric filters exclusive', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('CPU와 메모리 모두 50% 초과인 서버 알려줘', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 51,
            memory: 52,
            disk: 41,
            network: 18,
          },
          {
            id: 'api-was-dc1-02',
            type: 'application',
            status: 'online',
            cpu: 50,
            memory: 60,
            disk: 39,
            network: 16,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 44,
            memory: 91,
            disk: 40,
            network: 12,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metrics: ['cpu', 'memory'],
        threshold: 50,
        thresholdOperator: '>',
        filterOperator: 'AND',
      },
    });
    expect(evidence?.fallback).toContain('CPU + 메모리 50% 초과 서버');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('api-was-dc1-02');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
  });

  it('matches explicit server IDs case-insensitively against snapshot IDs', async () => {
    const request = createEvidenceRequest(
      'web-dc1-az1 과 web-dc1-az2 의 CPU 사용량을 비교해줘',
      {
        timeLabel: '07:50',
        servers: [
          {
            id: 'Web-DC1-AZ1',
            type: 'web',
            status: 'online',
            cpu: 44,
            memory: 52,
            disk: 31,
            network: 11,
          },
          {
            id: 'Web-DC1-AZ2',
            type: 'web',
            status: 'warning',
            cpu: 67,
            memory: 58,
            disk: 35,
            network: 15,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 92,
            memory: 45,
            disk: 28,
            network: 11,
          },
        ],
      }
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      metric: 'cpu',
      targets: ['web-dc1-az1', 'web-dc1-az2'],
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      request
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metric: 'cpu',
        targets: ['web-dc1-az1', 'web-dc1-az2'],
      },
    });
    expect(evidence?.fallback).toContain('웹 서버 2대 CPU 현황');
    expect(evidence?.fallback).toContain('Web-DC1-AZ1 44%');
    expect(evidence?.fallback).toContain('Web-DC1-AZ2 67%');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
  });

  it('resolves whole-fleet disk trend frame without drifting to CPU summary', async () => {
    const evidence = await monitoringMetricTrendEvidenceProvider.resolve({
      ...createEvidenceRequest('전체 서버 디스크 추이', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 22,
            memory: 61,
            disk: 31,
            network: 10,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'warning',
            cpu: 18,
            memory: 55,
            disk: 82,
            network: 11,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'disk',
        timeWindow: 'unknown',
        aggregation: 'unknown',
        ambiguity: 'low',
        confidence: 0.8,
      },
    });

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-trend',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        intent: 'metric_trend',
        metric: 'disk',
      },
    });
    expect(evidence?.fallback).toContain('전체 서버 디스크 추이');
    expect(evidence?.fallback).toContain('대상: 2대');
    expect(evidence?.fallback).toContain('현재 디스크 상위');
    expect(evidence?.fallback).not.toContain('CPU 평균');
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

  it('resolves server alias detail prompts without falling back to whole-fleet summaries', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('web-server-01 상태를 자세히 알려줘')
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
      },
    });
    expect(evidence?.fallback).toContain('web-nginx-dc1-01');
    expect(evidence?.fallback).toContain('요청 별칭: web-server-01');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
  });

  it('preserves raw server detail intent when metadata frame is whole-fleet server health', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve({
      ...createEvidenceRequest('web-server-01 상태를 자세히 알려줘', {
        servers: [
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 41, memory: 52, disk: 31 },
          { id: 'api-was-dc1-01', status: 'critical', cpu: 93, memory: 66, disk: 44 },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(evidence?.fallback).toContain('web-nginx-dc1-01');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
  });

  it('resolves action-needed prompts with a single deterministic conclusion', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('지금 당장 조치가 필요한 서버가 있어?', {
        servers: [
          { id: 'api-was-dc1-01', status: 'critical', cpu: 93, memory: 66, disk: 44 },
          { id: 'api-was-dc1-02', status: 'warning', cpu: 89, memory: 62, disk: 41 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 41, memory: 52, disk: 31 },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
      },
    });
    expect(evidence?.fallback).toContain('즉시 조치');
    expect(evidence?.fallback).toContain('즉시 조치 대상은 1대입니다');
    expect(evidence?.fallback).toContain('주의 관찰 대상은 1대입니다');
    expect(evidence?.fallback).not.toMatch(/즉시 조치[^\n]+없(?:습니다|음)/);
  });

  it('resolves urgent action ranking wording with a deterministic priority summary', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('지금 당장 조치 시급한 서버 순위', {
        servers: [
          {
            id: 'cache-redis-dc1-01',
            status: 'critical',
            cpu: 45,
            memory: 91,
            disk: 44,
          },
          {
            id: 'api-was-dc1-01',
            status: 'warning',
            cpu: 43,
            memory: 66,
            disk: 44,
          },
          {
            id: 'web-nginx-dc1-01',
            status: 'online',
            cpu: 41,
            memory: 52,
            disk: 31,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
      },
    });
    expect(evidence?.fallback).toContain('즉시 조치 대상은 1대입니다');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).toContain('주의 관찰 대상은 1대입니다');
    expect(evidence?.fallback).not.toContain('CPU 92%');
  });

  it('preserves raw action-needed intent when metadata frame is whole-fleet server health', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve({
      ...createEvidenceRequest('지금 당장 조치가 필요한 서버가 있어?', {
        servers: [
          { id: 'api-was-dc1-01', status: 'critical', cpu: 93, memory: 66, disk: 44 },
          { id: 'api-was-dc1-02', status: 'warning', cpu: 89, memory: 62, disk: 41 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 41, memory: 52, disk: 31 },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(evidence?.fallback).toContain('즉시 조치 대상은 1대입니다');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
  });
});
