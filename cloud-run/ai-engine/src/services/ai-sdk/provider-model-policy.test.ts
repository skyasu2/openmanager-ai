import { describe, expect, it } from 'vitest';
import {
  CEREBRAS_GPT_OSS_MODEL_ID,
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  CEREBRAS_QWEN_DEPRECATION_DATE,
  CEREBRAS_QWEN_MODEL_ID,
  getCerebrasModelPolicy,
  getCerebrasModelQuota,
  getCerebrasRuntimeModelIds,
  getCerebrasRuntimeModelPolicies,
  getDeprecatedProviderModelPolicyFindings,
} from './provider-model-policy';

describe('provider model policy SSOT', () => {
  it('defines Cerebras Qwen primary and llama3.1-8b fallback with account-limit quotas', () => {
    expect(getCerebrasRuntimeModelIds()).toEqual([
      CEREBRAS_QWEN_MODEL_ID,
      CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
    ]);

    expect(getCerebrasRuntimeModelPolicies()).toHaveLength(2);
    expect(getCerebrasModelPolicy(CEREBRAS_QWEN_MODEL_ID)).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_QWEN_MODEL_ID,
      role: 'primary',
      lifecycle: 'preview',
      enabled: true,
      toolCallingEnabled: true,
      structuredOutputEnabled: true,
      contextWindowTokens: 65_536,
      quota: {
        requestsPerMinute: 5,
        tokensPerMinute: 30_000,
        requestsPerDay: 14_400,
        tokensPerDay: 1_000_000,
      },
      deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
      blockAfterDeprecation: true,
      smokeStatus: 'green',
    });

    expect(getCerebrasModelPolicy(CEREBRAS_LLAMA_FALLBACK_MODEL_ID)).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      role: 'fallback',
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
      deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
      blockAfterDeprecation: true,
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
    expect(getCerebrasModelQuota(CEREBRAS_QWEN_MODEL_ID)).toEqual({
      requestsPerMinute: 5,
      tokensPerMinute: 30_000,
      requestsPerDay: 14_400,
      tokensPerDay: 1_000_000,
    });
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
    ).toEqual([
      {
        provider: 'cerebras',
        modelId: CEREBRAS_QWEN_MODEL_ID,
        severity: 'P1',
        reason: `${CEREBRAS_QWEN_MODEL_ID} is blocked for cerebras after ${CEREBRAS_QWEN_DEPRECATION_DATE}`,
        replacement: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      },
      {
        provider: 'cerebras',
        modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
        severity: 'P1',
        reason: `${CEREBRAS_LLAMA_FALLBACK_MODEL_ID} is blocked for cerebras after ${CEREBRAS_QWEN_DEPRECATION_DATE}`,
        replacement: CEREBRAS_QWEN_MODEL_ID,
      },
    ]);
  });
});
