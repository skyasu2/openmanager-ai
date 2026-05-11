import { describe, expect, it } from 'vitest';
import { monitoringDomainPack } from '../../domains/monitoring/domain-pack';
import { sampleDomainPack } from '../../test-fixtures/sample-domain-pack';
import { resolveDomainEvidenceSupport } from './supervisor-domain-evidence';

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
      provider?.canHandle(createEvidenceRequest('부하가 높으면 조치 방법 알려줘'))
    ).toBe(false);
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
});
