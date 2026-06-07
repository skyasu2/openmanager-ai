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

describe('current metrics domain evidence providers: contextual follow-ups', () => {
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
      contextualTargets: true,
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

  it('labels homogeneous single-type contextual follow-ups as 지정 서버, not the group type', async () => {
    // Q5 회귀: 직전 turn이 로드밸런서 1대만 언급한 경우에도 컨텍스트 팔로업은
    // "지정 서버 1대"로 표기되어야 한다. "로드밸런서 1대"는 일반 그룹 조회와
    // 구분되지 않아 컨텍스트 스코핑이 무시된 것처럼 오인된다.
    const query = '방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘';
    const request = createEvidenceRequest(
      query,
      {
        timeLabel: '20:40',
        servers: [
          {
            id: 'lb-haproxy-dc1-01',
            type: 'loadbalancer',
            status: 'warning',
            cpu: 74,
            memory: 61,
            disk: 39,
            network: 73.8,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 31,
            memory: 41,
            disk: 29,
            network: 1,
          },
        ],
      },
      [
        { role: 'user', content: '지금 당장 조치가 필요한 서버가 있어?' },
        {
          role: 'assistant',
          content: '주의 관찰 대상은 1대입니다: lb-haproxy-dc1-01 (CPU 74%).',
        },
        { role: 'user', content: query },
      ]
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      metric: 'network',
      threshold: 70,
      targets: ['lb-haproxy-dc1-01'],
      contextualTargets: true,
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);

    expect(evidence?.fallback).toContain('지정 서버 1대');
    expect(evidence?.fallback).not.toContain('로드밸런서 1대');
    expect(evidence?.fallback).toContain('lb-haproxy-dc1-01');
  });

  it('scopes contextual metric ranking follow-ups to prior assistant targets', async () => {
    const query = '그중 CPU가 높은 것만 알려줘';
    const request = createEvidenceRequest(
      query,
      {
        timeLabel: '20:20',
        servers: [
          {
            id: 'lb-haproxy-dc1-01',
            type: 'loadbalancer',
            status: 'warning',
            cpu: 69,
            memory: 61,
            disk: 39,
            network: 73.8,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 92,
            memory: 41,
            disk: 29,
            network: 11,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 88,
            memory: 51,
            disk: 37,
            network: 16,
          },
        ],
      },
      [
        { role: 'user', content: '지금 당장 조치 필요한 서버 알려줘' },
        {
          role: 'assistant',
          content:
            '주의 관찰 대상은 1대입니다.\n1. lb-haproxy-dc1-01: CPU 69%, warning',
        },
        { role: 'user', content: query },
      ]
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      sourceIntent: 'data-ranking',
      metric: 'cpu',
      targets: ['lb-haproxy-dc1-01'],
      contextualTargets: true,
    });

    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-ranking',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        intent: 'metric_ranking',
        metric: 'cpu',
        targets: ['lb-haproxy-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain('지정 서버 1대');
    expect(evidence?.fallback).toContain('lb-haproxy-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
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
});
