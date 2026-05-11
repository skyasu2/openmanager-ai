import { describe, expect, it } from 'vitest';
import { monitoringDomainPack } from '../../domains/monitoring/domain-pack';
import { sampleDomainPack } from '../../test-fixtures/sample-domain-pack';
import type { SupervisorRequest } from './supervisor-types';
import {
  resolveDomainEvidenceForStream,
  resolveDomainEvidenceSupport,
} from './supervisor-domain-evidence';

const monitoringMetricPeakFrame = {
  domainId: monitoringDomainPack.id,
  intent: 'metric_peak',
  capabilityId: 'monitoring.metric_peak',
  scope: 'whole_fleet',
  targets: [],
  metric: 'load',
  timeWindow: '24h',
  aggregation: 'peak',
  topN: 3,
  ambiguity: 'low',
  confidence: 96,
} as const;

function readCapabilities(domain: unknown) {
  return (domain as { capabilities?: unknown }).capabilities;
}

function createEvidenceRequest(message: string) {
  return {
    requestId: 'test',
    domainId: monitoringDomainPack.id,
    message,
    messages: [{ role: 'user' as const, content: message }],
    ...(monitoringDomainPack.dataSource && {
      dataSource: monitoringDomainPack.dataSource,
    }),
  };
}

describe('supervisor domain evidence support', () => {
  it('lets the monitoring domain decide which peak-load questions it handles', () => {
    const provider = monitoringDomainPack.evidenceProviders?.[0];

    expect(
      provider?.canHandle(
        createEvidenceRequest('지난 24시간 중 가장 부하가 높았던 시간대는 언제야?')
      )
    ).toBe(true);
    expect(
      provider?.canHandle(
        createEvidenceRequest(
          '24h 기준 load1 peak가 언제였고 어떤 서버가 가장 영향을 줬어?'
        )
      )
    ).toBe(true);
    expect(
      provider?.canHandle(
        createEvidenceRequest(
          '서버명은 일부러 안 줄게. 전체 기준으로 최근 하루 중 1분 load가 제일 튄 시각이 언제야? 근거 숫자도.'
        )
      )
    ).toBe(true);
    expect(
      provider?.canHandle(
        createEvidenceRequest(
          '최근 하루 동안 전체 서버가 제일 버거웠던 때가 언제야? CPU 말고 시스템 load 기준으로, 주범 서버까지.'
        )
      )
    ).toBe(true);
    expect(
      provider?.canHandle(createEvidenceRequest('부하가 높으면 조치 방법 알려줘'))
    ).toBe(false);
  });

  it('exposes monitoring peak metric as a domain capability instead of a provider name', () => {
    expect(readCapabilities(monitoringDomainPack)).toMatchObject({
      domainId: monitoringDomainPack.id,
      capabilities: [
        expect.objectContaining({
          id: 'monitoring.metric_peak',
          intents: ['metric_peak'],
          requiredSlots: ['metric', 'timeWindow', 'aggregation'],
        }),
      ],
    });
  });

  it('passes metadata intent frames into providers before raw message fallback', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'frame only request without load keywords',
      domain: monitoringDomainPack,
      sessionId: 'session-frame-peak',
      metadata: {
        intentFrame: monitoringMetricPeakFrame,
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support?.id).toBe('monitoring-peak-metric');
    expect(support?.metadata).toMatchObject({
      capabilityId: 'monitoring.metric_peak',
      intent: 'metric_peak',
      metric: 'load',
      windowHours: 24,
    });
  });

  it('passes stream request metadata frames into domain evidence resolution', async () => {
    const support = await resolveDomainEvidenceForStream({
      request: {
        messages: [
          { role: 'user', content: 'frame only request without load keywords' },
        ],
        sessionId: 'session-stream-frame-peak',
        metadata: {
          intentFrame: monitoringMetricPeakFrame,
        },
      } as SupervisorRequest,
      query: 'frame only request without load keywords',
      domain: monitoringDomainPack,
    });

    expect(support?.id).toBe('monitoring-peak-metric');
    expect(support?.metadata).toMatchObject({
      capabilityId: 'monitoring.metric_peak',
      intent: 'metric_peak',
    });
  });

  it('lets providers handle capability intent frames without matching raw regex text', () => {
    const provider = monitoringDomainPack.evidenceProviders?.[0];
    const request = {
      ...createEvidenceRequest('frame only request without load keywords'),
      intentFrame: monitoringMetricPeakFrame,
      capability: {
        id: 'monitoring.metric_peak',
        description: 'Peak metric evidence',
        intents: ['metric_peak'],
        requiredSlots: ['metric', 'timeWindow', 'aggregation'],
      },
    };

    expect(provider?.canHandle(request)).toBe(true);
  });

  it('resolves exact domain evidence while leaving short analysis to the LLM', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '지난 24시간 중 가장 부하가 높았던 시간대는 언제야?',
      domain: monitoringDomainPack,
      sessionId: 'session-peak-metric',
      traceId: 'trace-peak-metric',
    });

    expect(support?.id).toBe('monitoring-peak-metric');
    expect(support?.prompt).toContain('[결정적 monitoring 피크 지표 근거]');
    expect(support?.prompt).toContain('첫 문장에 결론');
    expect(support?.prompt).toContain('1-2문장으로 운영 관점 해석');
    expect(support?.fallback).toContain('최고 시간대');
    expect(support?.fallback).toContain('상위 서버');
    expect(support?.fallback).toContain('운영 해석');
    expect(support?.metadata).toMatchObject({
      metric: 'load',
      windowHours: 24,
    });
  });

  it('keeps natural load phrasing on the load peak evidence path instead of generic CPU metrics', async () => {
    const queries = [
      '서버명은 일부러 안 줄게. 전체 기준으로 최근 하루 중 1분 load가 제일 튄 시각이 언제야? 근거 숫자도.',
      '최근 하루 동안 전체 서버가 제일 버거웠던 때가 언제야? CPU 말고 시스템 load 기준으로, 주범 서버까지.',
    ];

    for (const query of queries) {
      const support = await resolveDomainEvidenceSupport({
        query,
        domain: monitoringDomainPack,
        sessionId: 'fragile-load-phrasing',
      });

      expect(support?.id).toBe('monitoring-peak-metric');
      expect(support?.prompt).toContain('1분 평균 로드(load1)');
      expect(support?.prompt).not.toContain('CPU 사용률');
      expect(support?.metadata).toMatchObject({
        metric: 'load',
        sourceMetric: 'load1',
        windowHours: 24,
      });
    }
  });

  it('keeps raw-only, frame-only, and frame-plus-raw peak evidence in parity', async () => {
    const rawQuery = '지난 24시간 중 가장 부하가 높았던 시간대는 언제야?';
    const rawOnly = await resolveDomainEvidenceSupport({
      query: rawQuery,
      domain: monitoringDomainPack,
      sessionId: 'raw-only',
    });
    const frameOnly = await resolveDomainEvidenceSupport({
      query: 'frame only request without load keywords',
      domain: monitoringDomainPack,
      sessionId: 'frame-only',
      metadata: {
        intentFrame: monitoringMetricPeakFrame,
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });
    const framePlusRaw = await resolveDomainEvidenceSupport({
      query: rawQuery,
      domain: monitoringDomainPack,
      sessionId: 'frame-plus-raw',
      metadata: {
        intentFrame: monitoringMetricPeakFrame,
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(frameOnly?.metadata).toMatchObject({
      slotIndex: rawOnly?.metadata?.slotIndex,
      timestamp: rawOnly?.metadata?.timestamp,
      sourceMetric: rawOnly?.metadata?.sourceMetric,
      windowHours: rawOnly?.metadata?.windowHours,
    });
    expect(framePlusRaw?.metadata).toMatchObject({
      slotIndex: rawOnly?.metadata?.slotIndex,
      timestamp: rawOnly?.metadata?.timestamp,
      sourceMetric: rawOnly?.metadata?.sourceMetric,
      windowHours: rawOnly?.metadata?.windowHours,
    });
  });

  it('records semantic query trace metadata when deterministic evidence is validated', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'frame only request without load keywords',
      domain: monitoringDomainPack,
      sessionId: 'semantic-trace',
      metadata: {
        intentFrame: monitoringMetricPeakFrame,
        semanticQueryTrace: {
          originalQuery: '최근 24시간 load1 피크 알려줘',
          reasonCodes: [],
        },
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support?.metadata).toMatchObject({
      semanticQueryTrace: {
        originalQuery: '최근 24시간 load1 피크 알려줘',
        selectedDomain: monitoringDomainPack.id,
        selectedCapability: 'monitoring.metric_peak',
        selectedEvidenceProvider: 'monitoring-peak-metric',
        evidenceAvailable: true,
        reasonCodes: expect.arrayContaining([
          'semantic_frame_evidence_validated',
        ]),
      },
    });
  });

  it('uses the same runtime hook for a non-monitoring sample domain', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'Which account has the highest renewal risk?',
      domain: sampleDomainPack,
      sessionId: 'sample-session',
    });

    expect(support?.id).toBe('sample-renewal-risk-evidence');
    expect(support?.prompt).toContain(
      '[Deterministic sample renewal-risk evidence]'
    );
    expect(support?.fallback).toContain('acct-123');
    expect(support?.metadata).toEqual({
      accountId: 'acct-123',
      risk: 'high',
      source: 'sample-fixture',
    });
  });

  it('uses the same capability frame contract for a non-monitoring sample domain', async () => {
    expect(readCapabilities(sampleDomainPack)).toMatchObject({
      domainId: sampleDomainPack.id,
      capabilities: [
        expect.objectContaining({
          id: 'sample.renewal_risk',
          intents: ['renewal_risk'],
        }),
      ],
    });

    const support = await resolveDomainEvidenceSupport({
      query: 'frame only sample request',
      domain: sampleDomainPack,
      sessionId: 'sample-frame-session',
      metadata: {
        intentFrame: {
          domainId: sampleDomainPack.id,
          intent: 'renewal_risk',
          capabilityId: 'sample.renewal_risk',
          scope: 'entity',
          targets: ['acct-123'],
          aggregation: 'max',
          ambiguity: 'low',
          confidence: 93,
        },
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support?.id).toBe('sample-renewal-risk-evidence');
    expect(support?.metadata).toMatchObject({
      capabilityId: 'sample.renewal_risk',
      accountId: 'acct-123',
      risk: 'high',
    });
  });
});
