import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  monitoringMetricRankingEvidenceProvider,
  monitoringServerHealthEvidenceProvider,
} from './current-metrics-evidence-provider';

const PORTFOLIO_DEMO_SNAPSHOT = {
  timeLabel: '08:50',
  servers: [
    {
      id: 'api-was-dc1-01',
      type: 'application',
      status: 'critical',
      cpu: 93,
      memory: 66,
      disk: 44,
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
      cpu: 20,
      memory: 30,
      disk: 25,
      network: 11,
    },
    {
      id: 'cache-redis-dc1-01',
      type: 'cache',
      status: 'warning',
      cpu: 45,
      memory: 91,
      disk: 44,
      network: 14,
    },
    {
      id: 'storage-nfs-dc1-01',
      type: 'storage',
      status: 'online',
      cpu: 22,
      memory: 61,
      disk: 89,
      network: 12,
    },
  ],
};

function createEvidenceRequest(message: string) {
  return {
    requestId: 'portfolio-demo-evidence-test',
    domainId: MONITORING_DOMAIN_ID,
    message,
    messages: [{ role: 'user' as const, content: message }],
    dataSource: {
      async snapshot() {
        return {
          timestamp: '2026-05-24T08:50:00+09:00',
          data: PORTFOLIO_DEMO_SNAPSHOT,
        };
      },
    },
  };
}

describe('portfolio standalone monitoring demo evidence', () => {
  it('keeps whole-fleet health summaries deterministic without persistent session memory', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('현재 서버 전체 상태를 요약해줘')
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
    expect(evidence?.fallback).toContain('api-was-dc1-01');
  });

  it('keeps healthy-only server lists deterministic without prior conversation context', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('현재 정상 범위인 서버 목록 보여줘')
    );

    expect(evidence?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      intent: 'server_health',
      sourceIntent: 'healthy-only',
      statusFilter: 'healthy-only',
    });
    expect(evidence?.fallback).toContain('정상 범위 서버 목록');
    expect(evidence?.fallback).toContain('📌 **서버별 현황**');
    expect(evidence?.fallback).not.toContain('• 서버별:');
    expect(evidence?.fallback).toContain('web-nginx-dc1-01');
    expect(evidence?.fallback).toContain('api-was-dc1-02');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
  });

  it('keeps lowest-load server prompts on the composite ranking path', async () => {
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(
      createEvidenceRequest('지금 부하가 가장 낮은 서버는?')
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
  });

  it('keeps common server aliases on specific server detail evidence', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('web-server-01 상태를 자세히 알려줘')
    );

    expect(evidence?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      intent: 'server_health',
    });
    expect(evidence?.fallback).toContain('web-nginx-dc1-01');
    expect(evidence?.fallback).toContain('요청 별칭: web-server-01');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
  });

  it('keeps action-needed prompts on deterministic priority evidence', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('지금 당장 조치가 필요한 서버가 있어?')
    );

    expect(evidence?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      intent: 'server_health',
      sourceIntent: 'action-needed',
    });
    expect(evidence?.fallback).toContain('즉시 조치 대상은 1대입니다');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).toContain('주의 관찰 대상은 1대입니다');
  });
});
