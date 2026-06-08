import { describe, expect, it } from 'vitest';
import { MONITORING_METRIC_RANKING_CAPABILITY_ID } from './constants';
import {
  monitoringBoundaryGuardEvidenceProvider,
  monitoringMetricRankingEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: boundary guard', () => {
  it('treats network I/O wording as network metric ranking evidence', async () => {
    const request = createEvidenceRequest('네트워크 I/O 상위 서버 3대 알려줘', {
      timeLabel: '20:20',
      servers: [
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
      ],
    });

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      metric: 'network',
      rankCount: 3,
      rankOrder: 'desc',
    });

    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-ranking',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        intent: 'metric_ranking',
        metric: 'network',
        rankCount: 3,
      },
    });
    expect(evidence?.fallback).toContain('네트워크 사용률 상위 3대');
    expect(evidence?.fallback).toMatch(
      /1\. web-nginx-dc1-01[\s\S]+2\. lb-haproxy-dc1-01[\s\S]+3\. api-was-dc1-01/
    );
    expect(evidence?.fallback).not.toContain('N/A');
  });

  it('returns deterministic clarification for unsupported GPU metric requests', async () => {
    const request = createEvidenceRequest('GPU 사용률이 가장 높은 서버 3대 알려줘');

    expect(monitoringBoundaryGuardEvidenceProvider.canHandle(request)).toBe(true);

    const evidence = await monitoringBoundaryGuardEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-boundary-guard',
      metadata: {
        responsePolicy: 'deterministic_clarification',
        reason: 'unsupported_metric',
        unsupportedMetric: 'gpu',
      },
    });
    expect(evidence?.fallback).toContain('지원하지 않는 지표');
    expect(evidence?.fallback).toContain('CPU');
    expect(evidence?.fallback).toContain('메모리');
    expect(evidence?.fallback).toContain('디스크');
    expect(evidence?.fallback).toContain('네트워크');
  });

  it('returns deterministic clarification for unsupported IOPS metric requests', async () => {
    const request = createEvidenceRequest('IOPS가 높은 서버 알려줘');

    expect(monitoringBoundaryGuardEvidenceProvider.canHandle(request)).toBe(true);

    const evidence = await monitoringBoundaryGuardEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-boundary-guard',
      metadata: {
        responsePolicy: 'deterministic_clarification',
        reason: 'unsupported_metric',
        unsupportedMetric: 'iops',
      },
    });
    expect(evidence?.fallback).toContain('지원하지 않는 지표');
  });

  it('returns deterministic clarification for packet loss metric requests', async () => {
    const request = createEvidenceRequest('패킷 손실이 심한 서버는?');

    expect(monitoringBoundaryGuardEvidenceProvider.canHandle(request)).toBe(true);

    const evidence = await monitoringBoundaryGuardEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-boundary-guard',
      metadata: {
        responsePolicy: 'deterministic_clarification',
        reason: 'unsupported_metric',
        unsupportedMetric: 'packet_loss',
      },
    });
    expect(evidence?.fallback).toContain('지원하지 않는 지표');
  });

  it('returns deterministic not-found guidance for explicit unknown server ids', async () => {
    const request = createEvidenceRequest('web-nginx-dc9-99 상태 알려줘', {
      timeLabel: '20:20',
      servers: [
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
          id: 'api-was-dc1-01',
          type: 'application',
          status: 'online',
          cpu: 43,
          memory: 51,
          disk: 37,
          network: 64,
        },
      ],
    });

    expect(monitoringBoundaryGuardEvidenceProvider.canHandle(request)).toBe(true);

    const evidence = await monitoringBoundaryGuardEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-boundary-guard',
      metadata: {
        responsePolicy: 'deterministic_clarification',
        reason: 'unknown_server',
        missingTargets: ['web-nginx-dc9-99'],
      },
    });
    expect(evidence?.fallback).toContain('서버를 찾지 못했습니다');
    expect(evidence?.fallback).toContain('web-nginx-dc9-99');
    expect(evidence?.fallback).toContain('web-nginx-dc1-01');
  });

  it('asks for a server id instead of summarizing the fleet for ambiguous single-server detail prompts', async () => {
    const request = createEvidenceRequest('서버 하나만 자세히 알려줘');

    expect(monitoringBoundaryGuardEvidenceProvider.canHandle(request)).toBe(true);

    const evidence = await monitoringBoundaryGuardEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-boundary-guard',
      metadata: {
        responsePolicy: 'deterministic_clarification',
        reason: 'ambiguous_single_server',
      },
    });
    expect(evidence?.fallback).toContain('어떤 서버를 볼지 지정해 주세요');
    expect(evidence?.fallback).toContain('서버 ID');
  });

  it('does not treat explicit server ids as ambiguous single-server prompts', async () => {
    const request = createEvidenceRequest(
      'web-nginx-dc1-01 서버 하나만 자세히 알려줘',
      {
        timeLabel: '20:20',
        servers: [
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
      }
    );

    expect(monitoringBoundaryGuardEvidenceProvider.canHandle(request)).toBe(true);
    await expect(
      monitoringBoundaryGuardEvidenceProvider.resolve(request)
    ).resolves.toBeNull();
  });
});
