import { describe, expect, it } from 'vitest';
import {
  CEREBRAS_GPT_OSS_MODEL_ID,
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  CEREBRAS_QWEN_DEPRECATION_DATE,
  CEREBRAS_QWEN_MODEL_ID,
  DEFAULT_CEREBRAS_MODEL,
  getStaleProviderModelPolicyFindings,
  getCerebrasModelPolicy,
  getCerebrasModelQuota,
  getCerebrasRuntimeModelIds,
  getCerebrasRuntimeModelPolicies,
  getDeprecatedProviderModelPolicyFindings,
} from './provider-model-policy';

describe('provider model policy SSOT', () => {
  it('uses Cerebras llama3.1-8b as the only runtime default after Qwen preview de-scope', () => {
    expect(DEFAULT_CEREBRAS_MODEL).toBe(CEREBRAS_LLAMA_FALLBACK_MODEL_ID);
    expect(getCerebrasRuntimeModelIds()).toEqual([CEREBRAS_LLAMA_FALLBACK_MODEL_ID]);

    expect(getCerebrasRuntimeModelPolicies()).toHaveLength(1);
    expect(getCerebrasModelPolicy(CEREBRAS_QWEN_MODEL_ID)).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_QWEN_MODEL_ID,
      role: 'excluded',
      lifecycle: 'preview',
      enabled: false,
      toolCallingEnabled: false,
      structuredOutputEnabled: true,
      contextWindowTokens: 65_536,
      deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
      blockAfterDeprecation: true,
      smokeStatus: 'red',
    });

    expect(getCerebrasModelPolicy(CEREBRAS_LLAMA_FALLBACK_MODEL_ID)).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      role: 'primary',
      lifecycle: 'production',
      enabled: true,
      toolCallingEnabled: true,
      structuredOutputEnabled: true,
      contextWindowTokens: 8_192,
      quota: {
        requestsPerMinute: 30,
        tokensPerMinute: 60_000,
        requestsPerDay: 14_400,
        tokensPerDay: 1_000_000,
      },
      blockAfterDeprecation: false,
      smokeStatus: 'green',
    });
  });

  it('keeps gpt-oss-120b out of runtime candidates because the account free tier cannot use it', () => {
    expect(getCerebrasRuntimeModelIds()).not.toContain(CEREBRAS_GPT_OSS_MODEL_ID);
    expect(getCerebrasModelPolicy(CEREBRAS_GPT_OSS_MODEL_ID)).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_GPT_OSS_MODEL_ID,
      role: 'excluded',
      enabled: false,
      smokeStatus: 'red',
      blockAfterDeprecation: false,
    });
  });

  it('exposes quota from the same policy object used by metadata and selectors', () => {
    expect(getCerebrasModelQuota(CEREBRAS_LLAMA_FALLBACK_MODEL_ID)).toEqual({
      requestsPerMinute: 30,
      tokensPerMinute: 60_000,
      requestsPerDay: 14_400,
      tokensPerDay: 1_000_000,
    });
  });

  it('reports runtime model deprecation only after the scheduled block date', () => {
    expect(
      getDeprecatedProviderModelPolicyFindings(
        getCerebrasRuntimeModelPolicies(),
        new Date('2026-04-26T00:00:00Z')
      )
    ).toEqual([]);

    expect(
      getDeprecatedProviderModelPolicyFindings(
        getCerebrasRuntimeModelPolicies(),
        new Date('2026-05-28T00:00:00Z')
      )
    ).toEqual([]);
  });

  it('does not recommend another same-date blocked Cerebras runtime model', () => {
    const blockedRuntimeModelIds = new Set(
      getCerebrasRuntimeModelPolicies()
        .filter(
          (policy) =>
            policy.blockAfterDeprecation &&
            policy.deprecationDate === CEREBRAS_QWEN_DEPRECATION_DATE
        )
        .map((policy) => policy.modelId)
    );

    for (const policy of getCerebrasRuntimeModelPolicies()) {
      expect(blockedRuntimeModelIds).not.toContain(policy.recommendedReplacement);
    }
  });

  it('detects stale provider smoke metadata without making an external provider call', () => {
    const stalePolicy = {
      ...getCerebrasModelPolicy(CEREBRAS_LLAMA_FALLBACK_MODEL_ID),
      smokeEvidence: [
        '2026-04-01 smoke passed llama3.1-8b chat completions HTTP 200',
      ],
    };

    expect(
      getStaleProviderModelPolicyFindings([stalePolicy], {
        asOf: new Date('2026-05-03T00:00:00Z'),
        maxAgeDays: 14,
      })
    ).toEqual([
      {
        provider: 'cerebras',
        modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
        severity: 'P2',
        reason:
          'provider smoke metadata is older than 14 days: last verified 2026-04-01',
        lastVerifiedAt: '2026-04-01',
      },
    ]);

    expect(
      getStaleProviderModelPolicyFindings(getCerebrasRuntimeModelPolicies(), {
        asOf: new Date('2026-05-03T00:00:00Z'),
        maxAgeDays: 14,
      })
    ).toEqual([]);
  });
});
