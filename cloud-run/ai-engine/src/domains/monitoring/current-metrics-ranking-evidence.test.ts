import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
} from './constants';
import {
  monitoringMetricRankingEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: ranking evidence', () => {
  it('keeps stable-server frame rankings ascending', async () => {
    const request = {
      ...createEvidenceRequest('가장 안정적인 서버 알려줘', {
        timeLabel: '08:50',
        servers: [
          { id: 'api-was-dc1-01', status: 'online', cpu: 66, memory: 55, disk: 40 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 20, memory: 30, disk: 25 },
          { id: 'cache-redis-dc1-01', status: 'online', cpu: 35, memory: 42, disk: 30 },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_ranking',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        metric: 'cpu',
        timeWindow: 'current',
        aggregation: 'top_n',
        topN: 3,
        ambiguity: 'low',
        executionMode: 'single',
        confidence: 0.93,
      },
    };

    const parsed = parseCurrentMetricsEvidenceRequest(request);
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(request);

    expect(parsed).toMatchObject({
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      metric: 'cpu',
      rankCount: 3,
      rankOrder: 'asc',
    });
    expect(evidence?.metadata).toMatchObject({
      rankOrder: 'asc',
      rankCount: 3,
    });
    expect(evidence?.fallback).toContain('CPU 사용률 하위 3대');
    expect(evidence?.fallback).toMatch(
      /1\. web-nginx-dc1-01[\s\S]+2\. cache-redis-dc1-01[\s\S]+3\. api-was-dc1-01/
    );
    expect(evidence?.fallback).toContain('안정적 수치');
    expect(evidence?.fallback).not.toMatch(/유휴|예비|트래픽 분산/);
    expect(evidence?.fallback).not.toContain('CPU 사용률 상위');
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

  it('P23: 그룹 + 최저 메트릭 랭킹은 그룹 필터를 보존한다', async () => {
    const request = createEvidenceRequest('cache 서버 중 메모리 최저 알려줘', {
      timeLabel: '15:20',
      servers: [
        {
          id: 'cache-redis-dc1-01',
          type: 'cache',
          status: 'warning',
          cpu: 38,
          memory: 91,
          disk: 41,
        },
        {
          id: 'cache-redis-dc1-02',
          type: 'cache',
          status: 'online',
          cpu: 22,
          memory: 74,
          disk: 35,
        },
        {
          id: 'web-nginx-dc1-01',
          type: 'web',
          status: 'online',
          cpu: 16,
          memory: 31,
          disk: 24,
        },
      ],
    });

    const parsed = parseCurrentMetricsEvidenceRequest(request);
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(request);

    expect(parsed).toMatchObject({
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      metric: 'memory',
      rankOrder: 'asc',
      rankCount: 1,
      targets: ['cache'],
    });
    expect(evidence?.metadata).toMatchObject({
      intent: 'metric_ranking',
      sourceIntent: 'data-ranking',
      metric: 'memory',
      rankOrder: 'asc',
      rankCount: 1,
      targets: ['cache'],
    });
    expect(evidence?.fallback).toContain('캐시 서버 메모리 사용률 하위 1대');
    expect(evidence?.fallback).toContain('1. cache-redis-dc1-02: 메모리 74%');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('P23: semantic frame metric_ranking도 raw 메시지의 그룹 힌트를 적용한다', async () => {
    const request = {
      ...createEvidenceRequest('cache 서버 중 메모리 최저 알려줘', {
        timeLabel: '15:20',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 38,
            memory: 91,
            disk: 41,
          },
          {
            id: 'cache-redis-dc1-02',
            type: 'cache',
            status: 'online',
            cpu: 22,
            memory: 74,
            disk: 35,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 16,
            memory: 31,
            disk: 24,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_ranking',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'memory',
        timeWindow: 'current',
        aggregation: 'top_n',
        topN: 1,
        ambiguity: 'low',
        executionMode: 'single',
        confidence: 0.93,
      },
    };

    const parsed = parseCurrentMetricsEvidenceRequest(request);
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(request);

    expect(parsed).toMatchObject({
      intent: 'metric_ranking',
      metric: 'memory',
      rankOrder: 'asc',
      rankCount: 1,
      targets: ['cache'],
    });
    expect(evidence?.fallback).toContain('캐시 서버 메모리 사용률 하위 1대');
    expect(evidence?.fallback).toContain('cache-redis-dc1-02');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });
});
