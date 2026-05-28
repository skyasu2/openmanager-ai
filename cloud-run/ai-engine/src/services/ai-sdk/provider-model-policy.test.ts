import { describe, expect, it } from 'vitest';
import * as providerModelPolicy from './provider-model-policy';
import {
  CEREBRAS_MODEL_POLICIES,
  CEREBRAS_DEPRECATION_CONTINGENCY,
  CEREBRAS_GPT_OSS_MODEL_ID,
  CEREBRAS_LLAMA_DEPRECATION_DATE,
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  CEREBRAS_QWEN_DEPRECATION_DATE,
  CEREBRAS_QWEN_MODEL_ID,
  CEREBRAS_ZAI_GLM_MODEL_ID,
  DEFAULT_CEREBRAS_MODEL,
  getStaleProviderModelPolicyFindings,
  getCerebrasModelPolicy,
  getCerebrasModelQuota,
  getCerebrasRuntimeModelIds,
  getCerebrasRuntimeModelPolicies,
  getDeprecatedProviderModelPolicyFindings,
  isCerebrasExpiredByDate,
} from './provider-model-policy';

type ReasoningCapabilityStatusOptions = {
  asOf?: Date;
  optIn?: boolean;
};

type ReasoningCapabilityStatus = {
  enabled: boolean;
  reasonCode: string;
  publicMetadata: Record<string, unknown>;
};

type ReasoningCapabilityFinding = {
  provider: string;
  modelId: string;
  severity: 'P1' | 'P2';
  reason: string;
};

const providerReasoningPolicyModule = providerModelPolicy as typeof providerModelPolicy & {
  getProviderReasoningCapabilityStatus?: (
    policy: unknown,
    options?: ReasoningCapabilityStatusOptions
  ) => ReasoningCapabilityStatus;
  getProviderReasoningCapabilityFindings?: (
    policies: readonly unknown[],
    options?: ReasoningCapabilityStatusOptions
  ) => ReasoningCapabilityFinding[];
};

describe('provider model policy SSOT', () => {
  it('uses gpt-oss-120b as the default primary and removes blocked llama3.1-8b from active runtime', () => {
    expect(DEFAULT_CEREBRAS_MODEL).toBe(CEREBRAS_GPT_OSS_MODEL_ID);
    expect(
      getCerebrasRuntimeModelIds({
        asOf: new Date('2026-05-27T23:59:59Z'),
      })
    ).toEqual([
      CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      CEREBRAS_GPT_OSS_MODEL_ID,
    ]);
    expect(
      getCerebrasRuntimeModelIds({
        asOf: new Date('2026-05-28T00:00:00Z'),
      })
    ).toEqual([CEREBRAS_GPT_OSS_MODEL_ID]);

    expect(
      getCerebrasRuntimeModelPolicies({
        asOf: new Date('2026-05-28T00:00:00Z'),
      })
    ).toHaveLength(1);
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
      role: 'fallback',
      lifecycle: 'production',
      enabled: true,
      toolCallingEnabled: true,
      structuredOutputEnabled: true,
      contextWindowTokens: 8_192,
      quota: {
        requestsPerMinute: 5,
        tokensPerMinute: 30_000,
        requestsPerDay: 2_400,
        tokensPerDay: 1_000_000,
      },
      deprecationDate: CEREBRAS_LLAMA_DEPRECATION_DATE,
      blockAfterDeprecation: true,
      smokeStatus: 'green',
    });
  });

  it('gpt-oss-120b is now the Cerebras primary model (switchover 2026-05-21)', () => {
    expect(getCerebrasRuntimeModelIds()).toContain(CEREBRAS_GPT_OSS_MODEL_ID);
    expect(getCerebrasModelPolicy(CEREBRAS_GPT_OSS_MODEL_ID)).toMatchObject({
      provider: 'cerebras',
      modelId: CEREBRAS_GPT_OSS_MODEL_ID,
      role: 'primary',
      enabled: true,
      smokeStatus: 'green',
      quota: {
        requestsPerMinute: 5,
        tokensPerMinute: 30_000,
        requestsPerDay: 2_400,
        tokensPerDay: 1_000_000,
      },
      blockAfterDeprecation: false,
    });
  });

  it('records the 2026-05-13 Cerebras account smoke matrix, including non-runtime visible models', () => {
    expect(
      getCerebrasModelPolicy(CEREBRAS_LLAMA_FALLBACK_MODEL_ID).smokeEvidence
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('2026-05-13'),
        expect.stringContaining('chat completion HTTP 200'),
      ])
    );
    expect(
      getCerebrasModelPolicy(CEREBRAS_QWEN_MODEL_ID).smokeEvidence
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('2026-05-13'),
        expect.stringContaining('429 queue/quota'),
      ])
    );
    expect(
      getCerebrasModelPolicy(CEREBRAS_GPT_OSS_MODEL_ID).smokeEvidence
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('2026-05-16'),
        expect.stringContaining('HTTP 200'),
      ])
    );

    expect(CEREBRAS_DEPRECATION_CONTINGENCY.visibleButExcludedModels).toContain(
      CEREBRAS_ZAI_GLM_MODEL_ID
    );
    expect(CEREBRAS_DEPRECATION_CONTINGENCY.fallbackChainAfterDeprecation).toEqual([
      'cerebras:gpt-oss-120b',
      'mistral',
      'groq',
      'zai',
    ]);
  });

  it('exposes quota from the same policy object used by metadata and selectors', () => {
    expect(getCerebrasModelQuota(CEREBRAS_LLAMA_FALLBACK_MODEL_ID)).toEqual({
      requestsPerMinute: 5,
      tokensPerMinute: 30_000,
      requestsPerDay: 2_400,
      tokensPerDay: 1_000_000,
    });
  });

  it('reports runtime model deprecation only after the scheduled block date', () => {
    expect(
      getDeprecatedProviderModelPolicyFindings(
        getCerebrasRuntimeModelPolicies({
          asOf: new Date('2026-04-26T00:00:00Z'),
          includeBlocked: true,
        }),
        new Date('2026-04-26T00:00:00Z')
      )
    ).toEqual([]);

    expect(
      getDeprecatedProviderModelPolicyFindings(
        getCerebrasRuntimeModelPolicies({
          asOf: new Date('2026-05-28T00:00:00Z'),
          includeBlocked: true,
        }),
        new Date('2026-05-28T00:00:00Z')
      )
    ).toEqual([
      {
        provider: 'cerebras',
        modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
        severity: 'P1',
        reason: `${CEREBRAS_LLAMA_FALLBACK_MODEL_ID} is blocked for cerebras after ${CEREBRAS_LLAMA_DEPRECATION_DATE}`,
        replacement: 'cerebras:gpt-oss-120b',
      },
    ]);
  });

  it('exposes the Cerebras runtime expiry date helper for request-time provider gating', () => {
    expect(isCerebrasExpiredByDate(new Date('2026-05-27T00:00:00Z'))).toBe(false);
    expect(isCerebrasExpiredByDate(new Date('2026-05-27T23:59:59Z'))).toBe(false);
    expect(isCerebrasExpiredByDate(new Date('2026-05-28T00:00:00Z'))).toBe(true);
  });

  it('does not recommend another same-date blocked Cerebras runtime model', () => {
    const blockedRuntimeModelIds = new Set(
      getCerebrasRuntimeModelPolicies({
        asOf: new Date('2026-05-28T00:00:00Z'),
        includeBlocked: true,
      })
        .filter(
          (policy) =>
            policy.blockAfterDeprecation &&
            policy.deprecationDate === CEREBRAS_QWEN_DEPRECATION_DATE
        )
        .map((policy) => policy.modelId)
    );

    for (const policy of getCerebrasRuntimeModelPolicies({
      asOf: new Date('2026-05-28T00:00:00Z'),
      includeBlocked: true,
    })) {
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
      getStaleProviderModelPolicyFindings(
        getCerebrasRuntimeModelPolicies({
          asOf: new Date('2026-05-03T00:00:00Z'),
        }),
        {
          asOf: new Date('2026-05-03T00:00:00Z'),
          maxAgeDays: 14,
        }
      )
    ).toEqual([]);
  });

  it('requires every provider policy entry to expose public-safe reasoning capability metadata', () => {
    const allPolicies = [
      ...Object.values(CEREBRAS_MODEL_POLICIES),
      getCerebrasModelPolicy('custom-override-model'),
    ].map((policy) => policy as { reasoningCapability?: Record<string, unknown> });

    for (const policy of allPolicies) {
      expect(policy.reasoningCapability).toMatchObject({
        kind: expect.stringMatching(/^(none|provider-native)$/),
        defaultEnabled: false,
        smokeSource: expect.stringMatching(
          /^(mock-contract|manual-smoke|provider-doc)$/
        ),
        publicSummary: expect.any(String),
      });

      expect(JSON.stringify(policy.reasoningCapability)).not.toMatch(
        /(?:sk-|api[_-]?key|bearer\s+|rawProvider|stackTrace)/i
      );
    }
  });

  it('keeps app-level thinking out of provider-native reasoning capability defaults', () => {
    const runtimePolicy = getCerebrasModelPolicy(CEREBRAS_LLAMA_FALLBACK_MODEL_ID) as {
      reasoningCapability?: Record<string, unknown>;
    };

    expect(runtimePolicy.reasoningCapability).toMatchObject({
      kind: 'none',
      defaultEnabled: false,
      requiresOptIn: false,
      optionShape: 'unknown',
    });
  });

  it('disables expired provider-native reasoning capability even when explicitly opted in', () => {
    expect(
      providerReasoningPolicyModule.getProviderReasoningCapabilityStatus
    ).toEqual(expect.any(Function));
    expect(
      providerReasoningPolicyModule.getProviderReasoningCapabilityFindings
    ).toEqual(expect.any(Function));

    const expiredNativeReasoningPolicy = {
      ...getCerebrasModelPolicy(CEREBRAS_LLAMA_FALLBACK_MODEL_ID),
      reasoningCapability: {
        kind: 'provider-native',
        defaultEnabled: false,
        requiresOptIn: true,
        lastVerified: '2026-04-01',
        expiresAt: '2026-04-15',
        smokeSource: 'manual-smoke',
        optionShape: 'reasoning_effort',
        publicSummary: 'Manual smoke only; disabled after verification expiry.',
      },
    };

    expect(
      providerReasoningPolicyModule.getProviderReasoningCapabilityStatus?.(
        expiredNativeReasoningPolicy,
        {
          asOf: new Date('2026-05-06T00:00:00Z'),
          optIn: true,
        }
      )
    ).toMatchObject({
      enabled: false,
      reasonCode: 'expired',
      publicMetadata: {
        kind: 'provider-native',
        enabled: false,
        expiresAt: '2026-04-15',
      },
    });

    expect(
      providerReasoningPolicyModule.getProviderReasoningCapabilityFindings?.(
        [expiredNativeReasoningPolicy],
        {
          asOf: new Date('2026-05-06T00:00:00Z'),
          optIn: true,
        }
      )
    ).toEqual([
      {
        provider: 'cerebras',
        modelId: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
        severity: 'P2',
        reason:
          'provider-native reasoning capability expired on 2026-04-15; disabled until re-verified',
      },
    ]);

    expect(
      providerReasoningPolicyModule.getProviderReasoningCapabilityStatus?.(
        {
          ...expiredNativeReasoningPolicy,
          reasoningCapability: {
            ...expiredNativeReasoningPolicy.reasoningCapability,
            expiresAt: undefined,
          },
        },
        {
          asOf: new Date('2026-05-06T00:00:00Z'),
          optIn: true,
        }
      )
    ).toMatchObject({
      enabled: false,
      reasonCode: 'expired',
    });
  });
});
