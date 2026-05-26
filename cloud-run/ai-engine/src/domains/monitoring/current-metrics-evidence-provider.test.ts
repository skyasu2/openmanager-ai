import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
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

function createEvidenceRequest(
  message: string,
  data?: unknown,
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  return {
    requestId: 'current-metrics-evidence-test',
    domainId: MONITORING_DOMAIN_ID,
    message,
    messages: messages ?? [{ role: 'user' as const, content: message }],
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

  it('routes explicit server detail metric prompts to deterministic current metric evidence', async () => {
    const request = createEvidenceRequest(
      'cache-redis-dc1-01 메모리 상태 자세히',
      {
        timeLabel: '07:50',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 22,
            memory: 83,
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
      }
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-metric',
      metric: 'memory',
      targets: ['cache-redis-dc1-01'],
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
        sourceIntent: 'server-detail-metric',
        metric: 'memory',
        targets: ['cache-redis-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain('캐시 서버 1대 메모리 현황');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01 83%');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-02');

    const serverHealthFrameRequest = {
      ...request,
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'entity',
        targets: ['cache-redis-dc1-01'],
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.94,
      },
    };

    expect(
      parseCurrentMetricsEvidenceRequest(serverHealthFrameRequest)
    ).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-metric',
      metric: 'memory',
      targets: ['cache-redis-dc1-01'],
    });
    await expect(
      monitoringMetricCurrentEvidenceProvider.resolve(serverHealthFrameRequest)
    ).resolves.toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        sourceIntent: 'server-detail-metric',
        metric: 'memory',
        targets: ['cache-redis-dc1-01'],
      },
    });
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

  it('keeps all requested metrics for explicit server-to-server comparisons (P13)', async () => {
    const request = createEvidenceRequest(
      'api-was-dc1-01 과 api-was-dc1-02 의 CPU, 메모리, 디스크를 직접 비교해줘',
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
      sourceIntent: 'server-compare',
      metrics: ['cpu', 'memory', 'disk'],
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
        sourceIntent: 'server-compare',
        metrics: ['cpu', 'memory', 'disk'],
        targets: ['api-was-dc1-01', 'api-was-dc1-02'],
      },
    });
    expect(evidence?.fallback).toContain(
      '애플리케이션 서버 2대 CPU + 메모리 + 디스크 비교'
    );
    expect(evidence?.fallback).toContain(
      'api-was-dc1-01**: CPU 82%, 메모리 62%, 디스크 41%'
    );
    expect(evidence?.fallback).toContain(
      'api-was-dc1-02**: CPU 57%, 메모리 51%, 디스크 39%'
    );
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

  it('routes clear group-only server list prompts to deterministic server health evidence', async () => {
    const request = createEvidenceRequest('WAS 서버들', {
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
    });

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'group-server-list',
      targets: ['application'],
    });

    const evidence = await monitoringServerHealthEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
        sourceIntent: 'group-server-list',
        targets: ['application'],
      },
    });
    expect(evidence?.fallback).toContain('애플리케이션 서버 현황');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).toContain('api-was-dc1-02');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');

    const serverHealthFrameRequest = {
      ...request,
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'group',
        targets: [],
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.92,
      },
    };

    expect(
      parseCurrentMetricsEvidenceRequest(serverHealthFrameRequest)
    ).toMatchObject({
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'group-server-list',
      targets: ['application'],
    });
    await expect(
      monitoringServerHealthEvidenceProvider.resolve(serverHealthFrameRequest)
    ).resolves.toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        sourceIntent: 'group-server-list',
        targets: ['application'],
      },
    });
  });

  it('keeps group health summary prompts on the group-server-list evidence path', () => {
    expect(
      parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('애플리케이션 서버 현황 알려줘')
      )
    ).toMatchObject({
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'group-server-list',
      targets: ['application'],
    });
  });

  it('does not treat bare server wording in metric filters as a group list', () => {
    expect(
      parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('메모리 70% 이상인 서버는?')
      )
    ).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'data-filter',
      metric: 'memory',
      threshold: 70,
    });
  });

  it('scopes contextual metric issue follow-ups to prior assistant server ids', async () => {
    const query = '방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘';
    const request = createEvidenceRequest(
      query,
      {
        timeLabel: '07:50',
        servers: [
          {
            id: 'lb-haproxy-dc1-01',
            type: 'loadbalancer',
            status: 'warning',
            cpu: 55,
            memory: 61,
            disk: 39,
            network: 72.6,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 43,
            memory: 51,
            disk: 37,
            network: 64,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 21,
            memory: 45,
            disk: 28,
            network: 88,
          },
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'warning',
            cpu: 58,
            memory: 69,
            disk: 53,
            network: 91,
          },
        ],
      },
      [
        { role: 'user', content: '현재 문제 있는 서버가 무엇인지 알려줘' },
        {
          role: 'assistant',
          content:
            '주의 관찰 대상: lb-haproxy-dc1-01, api-was-dc1-01 입니다.',
        },
        { role: 'user', content: query },
      ]
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'data-filter',
      metric: 'network',
      threshold: 70,
      targets: ['lb-haproxy-dc1-01', 'api-was-dc1-01'],
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        sourceIntent: 'data-filter',
        metric: 'network',
        threshold: 70,
        targets: ['lb-haproxy-dc1-01', 'api-was-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain('대상: 지정 서버 2대 중 1대');
    expect(evidence?.fallback).toContain('lb-haproxy-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
    expect(evidence?.fallback).not.toContain('db-mysql-dc1-primary');
  });

  it('scopes pronoun metric follow-ups to the prior assistant server ids', async () => {
    const query = '그 서버들 디스크 상태는?';
    const priorTargets = [
      'cache-redis-dc1-03',
      'db-mysql-dc1-replica',
      'api-was-dc1-01',
      'lb-haproxy-dc1-01',
      'storage-nfs-dc1-01',
    ];
    const request = createEvidenceRequest(
      query,
      {
        timeLabel: '07:50',
        servers: [
          {
            id: 'cache-redis-dc1-03',
            type: 'cache',
            status: 'online',
            cpu: 20,
            memory: 74,
            disk: 33,
            network: 12,
          },
          {
            id: 'db-mysql-dc1-replica',
            type: 'database',
            status: 'warning',
            cpu: 44,
            memory: 71,
            disk: 68,
            network: 18,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 43,
            memory: 69,
            disk: 37,
            network: 64,
          },
          {
            id: 'lb-haproxy-dc1-01',
            type: 'loadbalancer',
            status: 'warning',
            cpu: 55,
            memory: 67,
            disk: 39,
            network: 72.6,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'online',
            cpu: 27,
            memory: 63,
            disk: 62,
            network: 22,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 21,
            memory: 45,
            disk: 28,
            network: 88,
          },
        ],
      },
      [
        { role: 'user', content: '현재 메모리 사용량 상위 5대 서버 알려줘' },
        {
          role: 'assistant',
          content: priorTargets
            .map((target, index) => `${index + 1}. ${target}: 메모리 상위권`)
            .join('\n'),
        },
        { role: 'user', content: query },
      ]
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'contextual-follow-up',
      metric: 'disk',
      targets: priorTargets,
    });

    const framedRequest = {
      ...request,
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'disk',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.88,
      },
    };

    expect(parseCurrentMetricsEvidenceRequest(framedRequest)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'metric_current',
      metric: 'disk',
      targets: priorTargets,
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        sourceIntent: 'contextual-follow-up',
        metric: 'disk',
        targets: priorTargets,
      },
    });
    expect(evidence?.fallback).toContain('지정 서버 5대 디스크 현황');
    expect(evidence?.fallback).toContain('• 대상: 5대');
    expect(evidence?.fallback).toContain('cache-redis-dc1-03');
    expect(evidence?.fallback).toContain('storage-nfs-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('limits pronoun follow-ups to the previous top-N result when the assistant also mentioned extra servers', async () => {
    const query = '그 서버들 디스크 상태는?';
    const priorTopTargets = [
      'cache-redis-dc1-03',
      'db-mysql-dc1-replica',
      'api-was-dc1-01',
    ];
    const extraTargets = [
      'lb-haproxy-dc1-01',
      'storage-nfs-dc1-01',
      'web-nginx-dc1-01',
      'api-was-dc1-02',
      'db-mysql-dc1-primary',
      'storage-nfs-dc1-02',
      'cache-redis-dc1-02',
    ];
    const request = createEvidenceRequest(
      query,
      {
        timeLabel: '07:50',
        servers: [...priorTopTargets, ...extraTargets].map((id, index) => ({
          id,
          type: id.startsWith('cache')
            ? 'cache'
            : id.startsWith('db')
              ? 'database'
              : id.startsWith('storage')
                ? 'storage'
                : id.startsWith('web')
                  ? 'web'
                  : id.startsWith('lb')
                    ? 'loadbalancer'
                    : 'application',
          status: 'online',
          cpu: 20 + index,
          memory: 70 - index,
          disk: 30 + index,
          network: 10 + index,
        })),
      },
      [
        { role: 'user', content: '현재 메모리 사용량 상위 3대 서버 알려줘' },
        {
          role: 'assistant',
          content: [
            '메모리 사용량 상위 3대입니다.',
            ...priorTopTargets.map(
              (target, index) => `${index + 1}. ${target}: 메모리 상위권`
            ),
            '',
            `참고로 전체 관측 서버에는 ${extraTargets.join(', ')} 도 포함됩니다.`,
          ].join('\n'),
        },
        { role: 'user', content: query },
      ]
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'contextual-follow-up',
      metric: 'disk',
      targets: priorTopTargets,
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        sourceIntent: 'contextual-follow-up',
        metric: 'disk',
        targets: priorTopTargets,
      },
    });
    expect(evidence?.fallback).toContain('지정 서버 3대 디스크 현황');
    expect(evidence?.fallback).toContain('cache-redis-dc1-03');
    expect(evidence?.fallback).not.toContain('lb-haproxy-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('preserves single metric thresholds when a current metric frame is present', async () => {
    const request = {
      ...createEvidenceRequest('DB 서버 디스크 60% 이상인 곳', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'online',
            cpu: 41,
            memory: 66,
            disk: 72,
            network: 13,
          },
          {
            id: 'db-mysql-dc1-analytics',
            type: 'database',
            status: 'warning',
            cpu: 45,
            memory: 70,
            disk: 65,
            network: 14,
          },
          {
            id: 'db-mysql-dc1-replica',
            type: 'database',
            status: 'online',
            cpu: 35,
            memory: 58,
            disk: 40,
            network: 12,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'critical',
            cpu: 30,
            memory: 45,
            disk: 95,
            network: 20,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: ['db-mysql-dc1-replica'],
        metric: 'disk',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.8,
      },
    };

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      metric: 'disk',
      threshold: 60,
      thresholdOperator: '>=',
      targets: ['database'],
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
        metric: 'disk',
        threshold: 60,
        thresholdOperator: '>=',
        targets: ['database'],
      },
    });
    expect(evidence?.fallback).toContain('DB 서버 디스크 60% 이상 서버');
    expect(evidence?.fallback).toContain('📌 **서버별 현황**');
    expect(evidence?.fallback).toContain('1. **db-mysql-dc1-primary**: 디스크 72%');
    expect(evidence?.fallback).toContain('2. **db-mysql-dc1-analytics**: 디스크 65%');
    expect(evidence?.fallback).not.toContain('• 서버별:');
    expect(evidence?.fallback).not.toContain('db-mysql-dc1-replica');
    expect(evidence?.fallback).not.toContain('storage-nfs-dc1-01');
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

  it('routes single-server generic 24h metric trend queries to deterministic trend evidence', async () => {
    const query = 'cache-redis-dc1-01 서버의 24시간 메트릭 추세 알려줘';
    const request = createEvidenceRequest(query, {
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
          id: 'api-was-dc1-01',
          type: 'application',
          status: 'online',
          cpu: 63,
          memory: 55,
          disk: 30,
          network: 64,
        },
      ],
    });

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: 'generic-metric-trend',
      metrics: ['cpu', 'memory', 'disk'],
      targets: ['cache-redis-dc1-01'],
    });

    const evidence = await monitoringMetricTrendEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-trend',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        intent: 'metric_trend',
        sourceIntent: 'generic-metric-trend',
        metrics: ['cpu', 'memory', 'disk'],
        targets: ['cache-redis-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain('캐시 서버 1대 메트릭 추이');
    expect(evidence?.fallback).toContain('서버별 24h 추세');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).toContain('24h 평균');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
  });

  it('does not let metric_current intent frames preempt single-server 24h trend parsing', async () => {
    const query = 'cache-redis-dc1-01 서버의 24시간 메트릭 추세 알려줘';
    const request = {
      ...createEvidenceRequest(query, {
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
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 63,
            memory: 55,
            disk: 30,
            network: 64,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'entity',
        targets: ['cache-redis-dc1-01'],
        metric: 'cpu',
        timeWindow: 'current',
        aggregation: 'unknown',
        ambiguity: 'low',
        confidence: 0.82,
      },
    };

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: 'generic-metric-trend',
      metrics: ['cpu', 'memory', 'disk'],
      targets: ['cache-redis-dc1-01'],
    });

    const evidence = await monitoringMetricTrendEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-trend',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        intent: 'metric_trend',
        sourceIntent: 'generic-metric-trend',
        metrics: ['cpu', 'memory', 'disk'],
        targets: ['cache-redis-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain('캐시 서버 1대 메트릭 추이');
    expect(evidence?.fallback).toContain('서버별 24h 추세');
    expect(evidence?.fallback).not.toContain('현재 CPU');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
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

  it('resolves healthy-only server list queries as deterministic server health evidence', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('현재 정상 범위인 서버 목록 보여줘', {
        timeLabel: '08:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 43,
            memory: 66,
            disk: 44,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 45,
            memory: 91,
            disk: 44,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'online',
            cpu: 22,
            memory: 61,
            disk: 89,
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
        sourceIntent: 'healthy-only',
        statusFilter: 'healthy-only',
      },
    });
    expect(evidence?.fallback).toContain('정상 범위 서버');
    expect(evidence?.fallback).toContain('📌 **서버별 현황**');
    expect(evidence?.fallback).toContain('1. **api-was-dc1-01**');
    expect(evidence?.fallback).not.toContain('• 서버별:');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).not.toContain('storage-nfs-dc1-01');
  });

  it('preserves healthy-only intent when metadata frame is whole-fleet server health', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve({
      ...createEvidenceRequest('현재 정상 범위인 서버 목록 보여줘', {
        timeLabel: '08:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 43,
            memory: 66,
            disk: 44,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 45,
            memory: 91,
            disk: 44,
          },
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

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
        sourceIntent: 'healthy-only',
        statusFilter: 'healthy-only',
      },
    });
    expect(evidence?.fallback).toContain('정상 범위 서버');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
  });

  it('resolves lowest composite load queries as deterministic ranking evidence', async () => {
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(
      createEvidenceRequest('지금 부하가 가장 낮은 서버는?', {
        timeLabel: '08:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 60,
            memory: 70,
            disk: 30,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 20,
            memory: 30,
            disk: 25,
          },
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'warning',
            cpu: 80,
            memory: 60,
            disk: 70,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-ranking',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        intent: 'metric_ranking',
        sourceIntent: 'composite-load-ranking',
        rankBasis: 'composite-load',
        rankOrder: 'asc',
        rankCount: 1,
      },
    });
    expect(evidence?.fallback).toContain('복합 부하 하위 1대');
    expect(evidence?.fallback).toMatch(/1\. web-nginx-dc1-01/s);
    expect(evidence?.fallback).toContain('CPU 20%');
    expect(evidence?.fallback).toContain('메모리 30%');
    expect(evidence?.fallback).toContain('디스크 25%');
  });

  it('resolves available-server TOP-N queries by composite load ascending', async () => {
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(
      createEvidenceRequest('여유 있는 서버 TOP 3 알려줘', {
        timeLabel: '08:50',
        servers: [
          { id: 'api-was-dc1-01', status: 'online', cpu: 60, memory: 70, disk: 30 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 20, memory: 30, disk: 25 },
          { id: 'cache-redis-dc1-01', status: 'online', cpu: 35, memory: 42, disk: 30 },
          { id: 'db-mysql-dc1-primary', status: 'warning', cpu: 80, memory: 60, disk: 70 },
        ],
      })
    );

    expect(evidence?.metadata).toMatchObject({
      rankBasis: 'composite-load',
      rankOrder: 'asc',
      rankCount: 3,
    });
    expect(evidence?.fallback).toContain('복합 부하 하위 3대');
    expect(evidence?.fallback).toMatch(
      /1\. web-nginx-dc1-01[\s\S]+2\. cache-redis-dc1-01[\s\S]+3\. api-was-dc1-01/
    );
    expect(evidence?.fallback).not.toContain('db-mysql-dc1-primary');
  });

  it('resolves current resource pressure ranking by composite load descending', async () => {
    const parsed = parseCurrentMetricsEvidenceRequest(
      createEvidenceRequest('전체 서버 리소스 압박 순위 알려줘')
    );
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve({
      ...createEvidenceRequest('전체 서버 리소스 압박 순위 알려줘', {
        timeLabel: '08:50',
        servers: [
          { id: 'api-was-dc1-01', status: 'online', cpu: 65, memory: 70, disk: 30 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 20, memory: 30, disk: 25 },
          { id: 'storage-nfs-dc1-01', status: 'critical', cpu: 70, memory: 75, disk: 93 },
          { id: 'db-mysql-dc1-primary', status: 'warning', cpu: 80, memory: 60, disk: 70 },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_peak',
        capabilityId: MONITORING_PEAK_METRIC_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'load',
        timeWindow: 'current',
        aggregation: 'peak',
        topN: 5,
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(parsed).toMatchObject({
      intent: 'metric_ranking',
      sourceIntent: 'composite-pressure-ranking',
      rankBasis: 'composite-load',
      rankOrder: 'desc',
      rankCount: 5,
    });
    expect(evidence?.metadata).toMatchObject({
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      intent: 'metric_ranking',
      sourceIntent: 'composite-pressure-ranking',
      rankBasis: 'composite-load',
      rankOrder: 'desc',
      rankCount: 5,
    });
    expect(evidence?.fallback).toContain('리소스 압박 상위 5대');
    expect(evidence?.fallback).toMatch(
      /1\. storage-nfs-dc1-01[\s\S]+2\. db-mysql-dc1-primary[\s\S]+3\. api-was-dc1-01/
    );
    expect(evidence?.fallback).not.toContain('최고 시간대');
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

  it('routes "가장 위험한 서버" wording to server health evidence via ACTION_NEEDED_PATTERN', async () => {
    for (const message of [
      '지금 현재 메트릭 기준으로 가장 위험한 서버는?',
      '어떤 서버가 가장 위험한가요?',
      '현재 어떤 서버가 가장 위험한가요?',
    ]) {
      const evidence = await monitoringServerHealthEvidenceProvider.resolve(
        createEvidenceRequest(message, {
          servers: [
            { id: 'api-was-dc1-01', status: 'warning', cpu: 84, memory: 62, disk: 41 },
            { id: 'api-was-dc1-02', status: 'online', cpu: 43, memory: 51, disk: 39 },
            { id: 'web-nginx-dc1-01', status: 'online', cpu: 21, memory: 45, disk: 28 },
          ],
        })
      );

      expect(evidence, message).toMatchObject({
        id: 'monitoring-server-health',
        metadata: {
          responsePolicy: 'deterministic_answer',
          capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
          intent: 'server_health',
          sourceIntent: 'action-needed',
        },
      });
      expect(evidence?.fallback, message).toContain('api-was-dc1-01');
      expect(evidence?.fallback, message).not.toContain('CPU 84% 창작');
    }
  });

  it('routes "문제 있는 서버" wording to server health evidence via ACTION_NEEDED_PATTERN', async () => {
    for (const message of [
      '현재 문제 있는 서버가 무엇인지 알려줘',
      '지금 문제가 있는 서버 알려줘',
      '문제 있는 서버가 어디야?',
      '이상 있는 서버 목록',
      '비정상 서버 뭐 있어?',
      '장애가 있는 서버 알려줘',
    ]) {
      const evidence = await monitoringServerHealthEvidenceProvider.resolve(
        createEvidenceRequest(message, {
          servers: [
            { id: 'lb-haproxy-dc1-01', status: 'warning', cpu: 55, memory: 61, disk: 39, network: 72.6 },
            { id: 'api-was-dc1-01', status: 'online', cpu: 43, memory: 51, disk: 37 },
            { id: 'web-nginx-dc1-01', status: 'online', cpu: 21, memory: 45, disk: 28 },
          ],
        })
      );

      expect(evidence, message).toMatchObject({
        id: 'monitoring-server-health',
        metadata: {
          responsePolicy: 'deterministic_answer',
          capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
          intent: 'server_health',
          sourceIntent: 'action-needed',
        },
      });
      expect(evidence?.fallback, message).toContain('lb-haproxy-dc1-01');
    }
  });

  it('routes "WAS 서버 그룹 상태" to server_health with application group target', async () => {
    // "WAS 서버 그룹 전체 CPU 상태 요약해줘"는 cpu 메트릭이 명시되어 metric_current로 파싱됨
    // server_health 라우팅은 특정 메트릭 없이 상태/현황을 묻는 쿼리에만 적용됨
    const parsed = parseCurrentMetricsEvidenceRequest(
      createEvidenceRequest('WAS 서버 그룹 상태 어때요?')
    );

    expect(parsed).toMatchObject({
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      intent: 'server_health',
      targets: ['application'],
    });
  });

  it('routes "CPU와 메모리 둘 다 높은" without threshold to multi-metric-no-threshold path', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('CPU와 메모리 둘 다 높은 서버 알려줘', {
        timeLabel: '08:50',
        servers: [
          { id: 'api-was-dc1-01', type: 'application', status: 'warning', cpu: 84, memory: 62, disk: 41 },
          { id: 'api-was-dc1-02', type: 'application', status: 'online', cpu: 43, memory: 78, disk: 39 },
          { id: 'web-nginx-dc1-01', type: 'web', status: 'online', cpu: 21, memory: 45, disk: 28 },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        sourceIntent: 'multi-metric-no-threshold',
        metrics: expect.arrayContaining(['cpu', 'memory']),
        filterOperator: 'AND',
      },
    });
    // 합산 점수 기준 정렬: api-was-dc1-01(84+62=146) > api-was-dc1-02(43+78=121)
    expect(evidence?.fallback).toMatch(/api-was-dc1-01.+api-was-dc1-02/s);
    expect(evidence?.fallback).toContain('CPU + 메모리');
  });

  it('routes inverse CPU-low and memory-high filters to directional multi-metric filtering', async () => {
    const parsed = parseCurrentMetricsEvidenceRequest(
      createEvidenceRequest('CPU 낮고 메모리 높은 서버 알려줘')
    );

    expect(parsed).toMatchObject({
      intent: 'metric_current',
      sourceIntent: 'multi-metric-directional-filter',
      metrics: ['cpu', 'memory'],
      metricConditions: [
        {
          metric: 'cpu',
          operator: '<=',
          threshold: 50,
          inferredThreshold: true,
        },
        {
          metric: 'memory',
          operator: '>=',
          threshold: 80,
          inferredThreshold: true,
        },
      ],
      filterOperator: 'AND',
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('CPU 낮고 메모리 높은 서버 알려줘', {
        timeLabel: '09:10',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 19,
            memory: 92,
            disk: 22,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 84,
            memory: 86,
            disk: 41,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 34,
            memory: 55,
            disk: 28,
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
        sourceIntent: 'multi-metric-directional-filter',
        metrics: ['cpu', 'memory'],
        metricConditions: expect.arrayContaining([
          expect.objectContaining({ metric: 'cpu', operator: '<=', threshold: 50 }),
          expect.objectContaining({ metric: 'memory', operator: '>=', threshold: 80 }),
        ]),
        filterOperator: 'AND',
      },
    });
    expect(evidence?.fallback).toContain('CPU <= 50%');
    expect(evidence?.fallback).toContain('메모리 >= 80%');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  describe('trend-routing: 상승/하락 트렌드 표현이 metric_trend intent로 라우팅', () => {
    const trendServers = [
      { id: 'cache-redis-dc1-01', type: 'cache', status: 'critical', cpu: 19, memory: 92, disk: 22 },
      { id: 'api-was-dc1-01', type: 'application', status: 'online', cpu: 63, memory: 55, disk: 30 },
    ];

    it.each([
      ['메모리 트렌드 상승 서버', 'memory'],
      ['최근 메모리 사용량이 계속 올라가는 서버 있어?', 'memory'],
      ['CPU가 계속 상승 중인 서버 알려줘', 'cpu'],
      ['디스크 사용량이 꾸준히 늘어나는 서버는?', 'disk'],
      ['메모리가 점점 높아지고 있는 서버', 'memory'],
      ['CPU 사용률이 지속적으로 상승하는 서버', 'cpu'],
    ])('"%s" → metric_trend (metric=%s)', (query, expectedMetric) => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest(query, { servers: trendServers })
      );
      expect(parsed).toMatchObject({
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        metric: expectedMetric,
      });
    });

    it('메모리 임계값 쿼리는 metric_trend로 분류되지 않음', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('메모리 70% 이상인 서버는?', { servers: trendServers })
      );
      expect(parsed?.intent).not.toBe('metric_trend');
    });

    it('"계속" 운영 명령은 metric_trend로 분류되지 않음', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('서버를 계속 모니터링해줘', { servers: trendServers })
      );
      expect(parsed?.intent).not.toBe('metric_trend');
    });
  });

  describe('group-compare: 두 그룹 비교 표현이 group-compare 경로로 라우팅 (P8)', () => {
    it('message-only 경로: web vs storage 메모리 비교는 group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('web 서버 그룹과 storage 서버 그룹 중 메모리를 더 많이 쓰는 쪽은?')
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'memory',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('web');
      expect(parsed?.groupTargets).toContain('storage');
    });

    it('intentFrame 경로: metric_current frame이 있어도 두 그룹 비교는 group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest({
        ...createEvidenceRequest('web 서버 그룹과 storage 서버 그룹 중 메모리를 더 많이 쓰는 쪽은?'),
        intentFrame: {
          domainId: MONITORING_DOMAIN_ID,
          intent: 'metric_current',
          metric: 'memory',
          confidence: 0.9,
        },
      });
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'memory',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('web');
      expect(parsed?.groupTargets).toContain('storage');
    });

    it('intentFrame 경로: DB vs Cache 비교도 group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest({
        ...createEvidenceRequest('DB 서버와 Cache 서버 중 어느 쪽이 메모리 더 높아?'),
        intentFrame: {
          domainId: MONITORING_DOMAIN_ID,
          intent: 'metric_current',
          metric: 'memory',
          confidence: 0.9,
        },
      });
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'memory',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('database');
      expect(parsed?.groupTargets).toContain('cache');
    });
  });

  describe('P10 regression: backup group server filter', () => {
    const backupSnapshot = {
      timeLabel: '12:00',
      servers: [
        {
          id: 'db-mysql-dc1-primary',
          type: 'database',
          status: 'online',
          cpu: 41,
          memory: 66,
          disk: 62,
          network: 13,
        },
        {
          id: 'db-mysql-dc1-backup',
          type: 'database',
          status: 'online',
          cpu: 22,
          memory: 55,
          disk: 69,
          network: 8,
        },
        {
          id: 'web-nginx-dc1-01',
          type: 'web',
          status: 'online',
          cpu: 15,
          memory: 40,
          disk: 30,
          network: 5,
        },
      ],
    };

    it('parses backup group query with target=backup', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('backup 서버들 CPU 상태는?', backupSnapshot)
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.targets).toContain('backup');
    });

    it('resolves backup group query to only the backup server', async () => {
      const request = createEvidenceRequest(
        'backup 서버들 디스크 상태 알려줘',
        backupSnapshot
      );
      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);
      expect(evidence).not.toBeNull();
      const answer = (evidence as { fallback?: string } | null)?.fallback ?? '';
      expect(answer).toContain('db-mysql-dc1-backup');
      expect(answer).not.toContain('db-mysql-dc1-primary');
      expect(answer).not.toContain('web-nginx-dc1-01');
    });
  });

  describe('P14 regression: single-group aggregate metric query', () => {
    const dbSnapshot = {
      timeLabel: '12:00',
      servers: [
        {
          id: 'db-mysql-dc1-001',
          type: 'database',
          status: 'online',
          cpu: 40,
          memory: 70,
          disk: 55,
          network: 10,
        },
        {
          id: 'db-mysql-dc1-002',
          type: 'database',
          status: 'online',
          cpu: 35,
          memory: 80,
          disk: 60,
          network: 12,
        },
        {
          id: 'web-nginx-dc1-01',
          type: 'web',
          status: 'online',
          cpu: 15,
          memory: 40,
          disk: 30,
          network: 5,
        },
      ],
    };

    it('parses single-group average query as metric_current with group target', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('db-mysql 서버들 평균 메모리 사용량은?', dbSnapshot)
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.intent).toBe('metric_current');
      expect(parsed?.metric).toBe('memory');
      expect(parsed?.targets).toContain('database');
    });

    it('resolves single-group average query to group average answer', async () => {
      const request = createEvidenceRequest(
        'db-mysql 서버들 평균 메모리 사용량은?',
        dbSnapshot
      );
      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);
      expect(evidence).not.toBeNull();
      const answer = (evidence as { fallback?: string } | null)?.fallback ?? '';
      expect(answer).toContain('메모리');
      expect(answer).toContain('db-mysql-dc1-001');
      expect(answer).toContain('db-mysql-dc1-002');
      expect(answer).not.toContain('web-nginx-dc1-01');
    });

    it('also handles web server group average query', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('웹 서버들 평균 CPU 사용률은?', dbSnapshot)
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.intent).toBe('metric_current');
      expect(parsed?.metric).toBe('cpu');
      expect(parsed?.targets).toContain('web');
    });
  });
});
