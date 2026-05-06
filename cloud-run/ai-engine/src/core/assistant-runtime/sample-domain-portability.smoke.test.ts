import { describe, expect, it } from 'vitest';
import {
  createAssistantRuntime,
  createInMemoryAssistantRuntimeAdapters,
} from './index';
import {
  createSampleDomainRequest,
  sampleDomainPack,
  sampleDomainToolInput,
  sampleRawArtifact,
} from '../../test-fixtures/sample-domain-pack';

describe('sample domain pack portability smoke', () => {
  it('runs a mock domain pack through portable runtime without monitoring code', async () => {
    const runtime = createAssistantRuntime({
      domain: sampleDomainPack,
      adapters: createInMemoryAssistantRuntimeAdapters(),
    });
    const request = createSampleDomainRequest('summarize account health');

    const result = await runtime.handle(request);

    expect(result).toMatchObject({
      domainId: 'sample-customer-success',
      route: {
        kind: 'artifact',
        executionPath: 'client-artifact',
        executionMode: 'deterministic',
        domainId: 'sample-customer-success',
        reasonCodes: ['sample_health_summary_requested'],
      },
    });
    expect(runtime.listTools(request).map((tool) => tool.name)).toEqual([
      'sampleLookupAccount',
    ]);
    await expect(
      Promise.resolve(
        runtime.resolveTool('sampleLookupAccount', request)?.execute?.(
          sampleDomainToolInput,
          result.context
        )
      )
    ).resolves.toMatchObject({
      accountId: 'acct-123',
      health: 'warning',
    });
    expect(sampleDomainPack.artifacts?.classify(result.context)).toEqual({
      kind: 'sample-health-summary',
      version: '2026-05-05-test',
    });
    expect(sampleDomainPack.artifacts?.normalize(sampleRawArtifact)).toEqual({
      kind: 'sample-health-summary',
      version: '2026-05-05-test',
      payload: sampleRawArtifact,
    });
  });

  it('registers sample agent roles without monitoring imports or runtime bindings', () => {
    expect(sampleDomainPack.agentRoles?.listRoles()).toEqual([
      {
        id: 'account-health',
        name: 'Account Health Agent',
        description: 'Reviews deterministic account health facts.',
        matchPatterns: ['account health', 'health summary'],
        capabilities: ['sample-account-health'],
      },
      {
        id: 'follow-up-advisor',
        name: 'Follow-up Advisor Agent',
        description: 'Suggests deterministic customer follow-up actions.',
        matchPatterns: ['follow up', 'next action'],
        capabilities: ['sample-follow-up'],
      },
    ]);
    expect(
      sampleDomainPack.agentRoles?.resolveRole('account-health')
    ).toMatchObject({
      id: 'account-health',
      name: 'Account Health Agent',
    });
    expect(
      sampleDomainPack.agentRoles?.resolveRole('unknown-role')
    ).toBeUndefined();
  });
});
