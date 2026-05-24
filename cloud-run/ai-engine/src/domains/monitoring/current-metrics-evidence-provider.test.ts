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
});
