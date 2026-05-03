import type { ProviderName } from './model-provider.types';

export const CEREBRAS_QWEN_MODEL_ID = 'qwen-3-235b-a22b-instruct-2507';
export const DEPRECATED_CEREBRAS_QWEN_MODEL_ID = CEREBRAS_QWEN_MODEL_ID;
export const CEREBRAS_QWEN_DEPRECATION_DATE = '2026-05-27';
export const CEREBRAS_GPT_OSS_MODEL_ID = 'gpt-oss-120b';
export const CEREBRAS_LLAMA_FALLBACK_MODEL_ID = 'llama3.1-8b';
export const CEREBRAS_LLAMA_DEPRECATION_DATE = '2026-05-27';
export const DEFAULT_CEREBRAS_MODEL = CEREBRAS_LLAMA_FALLBACK_MODEL_ID;
export const CEREBRAS_DEPRECATION_REPLACEMENT =
  'groq:meta-llama/llama-4-scout-17b-16e-instruct';

export type ProviderModelRole = 'primary' | 'fallback' | 'vision' | 'excluded';
export type ProviderModelLifecycle = 'production' | 'preview' | 'custom';
export type ProviderModelSmokeStatus = 'green' | 'red' | 'unknown';

export interface ProviderModelQuota {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay: number;
  tokensPerDay: number;
}

export interface ProviderModelPolicy {
  provider: ProviderName;
  modelId: string;
  role: ProviderModelRole;
  lifecycle: ProviderModelLifecycle;
  enabled: boolean;
  toolCallingEnabled: boolean;
  structuredOutputEnabled: boolean;
  contextWindowTokens?: number;
  quota: ProviderModelQuota;
  deprecationDate?: string;
  blockAfterDeprecation: boolean;
  smokeStatus: ProviderModelSmokeStatus;
  smokeEvidence: string[];
  freeTierLimitSummary: string;
  sourceUrls: string[];
  recommendedReplacement?: string;
}

export interface DeprecatedProviderModelPolicyFinding {
  provider: ProviderName;
  modelId: string;
  severity: 'P1' | 'P2';
  reason: string;
  replacement: string;
}

export type StaleProviderModelPolicyFinding = {
  provider: ProviderName;
  modelId: string;
  severity: 'P2';
  reason: string;
  lastVerifiedAt?: string;
};

export type ProviderModelPolicyFreshnessOptions = {
  asOf?: Date;
  maxAgeDays?: number;
};

export type CerebrasRuntimeModelId =
  typeof CEREBRAS_LLAMA_FALLBACK_MODEL_ID;

const DEFAULT_PROVIDER_SMOKE_MAX_AGE_DAYS = 14;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const CEREBRAS_SOURCE_URLS = [
  'https://inference-docs.cerebras.ai/models/overview',
  'https://inference-docs.cerebras.ai/support/rate-limits',
  'https://inference-docs.cerebras.ai/capabilities/tool-use',
];

const EMPTY_QUOTA: ProviderModelQuota = {
  requestsPerMinute: 0,
  tokensPerMinute: 0,
  requestsPerDay: 0,
  tokensPerDay: 0,
};

export const CEREBRAS_MODEL_POLICIES = {
  [CEREBRAS_QWEN_MODEL_ID]: {
    provider: 'cerebras',
    modelId: CEREBRAS_QWEN_MODEL_ID,
    role: 'excluded',
    lifecycle: 'preview',
    enabled: false,
    toolCallingEnabled: false,
    structuredOutputEnabled: true,
    contextWindowTokens: 65_536,
    quota: EMPTY_QUOTA,
    deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
    blockAfterDeprecation: true,
    smokeStatus: 'red',
    smokeEvidence: [
      '2026-04-30 account smoke returned 429 high traffic',
      'official Cerebras docs list this as a Preview model, not Production',
    ],
    freeTierLimitSummary:
      'Preview model retained for explicit override detection only; not a production runtime default',
    sourceUrls: CEREBRAS_SOURCE_URLS,
    recommendedReplacement: CEREBRAS_DEPRECATION_REPLACEMENT,
  },
  [CEREBRAS_LLAMA_FALLBACK_MODEL_ID]: {
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
    deprecationDate: CEREBRAS_LLAMA_DEPRECATION_DATE,
    blockAfterDeprecation: false,
    smokeStatus: 'green',
    smokeEvidence: [
      '2026-05-02 smoke passed llama3.1-8b chat completions HTTP 200',
      'tool calling smoke passed',
      'generateObject smoke passed',
    ],
    freeTierLimitSummary:
      `Free: 30 RPM / 60K TPM / 14.4K RPD / 1M TPD; ~2200 t/s; deprecated ${CEREBRAS_LLAMA_DEPRECATION_DATE}`,
    sourceUrls: CEREBRAS_SOURCE_URLS,
    recommendedReplacement: CEREBRAS_DEPRECATION_REPLACEMENT,
  },
  [CEREBRAS_GPT_OSS_MODEL_ID]: {
    provider: 'cerebras',
    modelId: CEREBRAS_GPT_OSS_MODEL_ID,
    role: 'excluded',
    lifecycle: 'production',
    enabled: false,
    toolCallingEnabled: true,
    structuredOutputEnabled: true,
    quota: EMPTY_QUOTA,
    blockAfterDeprecation: false,
    smokeStatus: 'red',
    smokeEvidence: [
      'current account chat completions smoke returned 404',
      'not shown in account free-tier Limits list',
    ],
    freeTierLimitSummary:
      'not in free-tier runtime candidates; current key chat smoke returned 404',
    sourceUrls: CEREBRAS_SOURCE_URLS,
    recommendedReplacement: CEREBRAS_QWEN_MODEL_ID,
  },
} as const satisfies Record<string, ProviderModelPolicy>;

export function getCerebrasRuntimeModelIds(): CerebrasRuntimeModelId[] {
  return [CEREBRAS_LLAMA_FALLBACK_MODEL_ID];
}

export function getCerebrasRuntimeModelPolicies(): ProviderModelPolicy[] {
  return getCerebrasRuntimeModelIds().map((modelId) => CEREBRAS_MODEL_POLICIES[modelId]);
}

export function getCerebrasModelPolicy(modelId = DEFAULT_CEREBRAS_MODEL): ProviderModelPolicy {
  return (
    CEREBRAS_MODEL_POLICIES[modelId as keyof typeof CEREBRAS_MODEL_POLICIES] ?? {
      provider: 'cerebras',
      modelId,
      role: 'fallback',
      lifecycle: 'custom',
      enabled: false,
      toolCallingEnabled: false,
      structuredOutputEnabled: false,
      quota: EMPTY_QUOTA,
      blockAfterDeprecation: false,
      smokeStatus: 'unknown',
      smokeEvidence: ['custom override requires entitlement smoke before production use'],
      freeTierLimitSummary: 'custom override; verify account entitlement before production use',
      sourceUrls: CEREBRAS_SOURCE_URLS,
      recommendedReplacement: DEFAULT_CEREBRAS_MODEL,
    }
  );
}

export function getCerebrasModelQuota(modelId = DEFAULT_CEREBRAS_MODEL): ProviderModelQuota {
  return getCerebrasModelPolicy(modelId).quota;
}

function isPastPolicyBlockDate(policy: ProviderModelPolicy, asOf: Date): boolean {
  if (!policy.deprecationDate || !policy.blockAfterDeprecation) return false;
  const startOfNextDayUtc = new Date(`${policy.deprecationDate}T00:00:00Z`);
  startOfNextDayUtc.setUTCDate(startOfNextDayUtc.getUTCDate() + 1);
  return asOf >= startOfNextDayUtc;
}

export function getDeprecatedProviderModelPolicyFindings(
  policies: ProviderModelPolicy[] = getCerebrasRuntimeModelPolicies(),
  asOf: Date = new Date()
): DeprecatedProviderModelPolicyFinding[] {
  return policies
    .filter((policy) => isPastPolicyBlockDate(policy, asOf))
    .map((policy) => ({
      provider: policy.provider,
      modelId: policy.modelId,
      severity: 'P1',
      reason: `${policy.modelId} is blocked for ${policy.provider} after ${policy.deprecationDate}`,
      replacement: policy.recommendedReplacement || DEFAULT_CEREBRAS_MODEL,
    }));
}

export function getStaleProviderModelPolicyFindings(
  policies: readonly ProviderModelPolicy[] = getCerebrasRuntimeModelPolicies(),
  options: ProviderModelPolicyFreshnessOptions = {}
): StaleProviderModelPolicyFinding[] {
  const asOf = options.asOf ?? new Date();
  const maxAgeDays =
    normalizePositiveInteger(options.maxAgeDays) ??
    DEFAULT_PROVIDER_SMOKE_MAX_AGE_DAYS;

  return policies.flatMap((policy) => {
    const lastVerifiedAt = readLatestSmokeEvidenceDate(policy.smokeEvidence);
    if (!lastVerifiedAt) {
      return [
        {
          provider: policy.provider,
          modelId: policy.modelId,
          severity: 'P2' as const,
          reason: 'provider smoke metadata has no verifiable date',
        },
      ];
    }

    const lastVerifiedTime = Date.parse(`${lastVerifiedAt}T00:00:00Z`);
    if (!Number.isFinite(lastVerifiedTime)) {
      return [
        {
          provider: policy.provider,
          modelId: policy.modelId,
          severity: 'P2' as const,
          reason: `provider smoke metadata has an invalid date: ${lastVerifiedAt}`,
          lastVerifiedAt,
        },
      ];
    }

    if (asOf.getTime() - lastVerifiedTime <= maxAgeDays * DAY_IN_MS) {
      return [];
    }

    return [
      {
        provider: policy.provider,
        modelId: policy.modelId,
        severity: 'P2' as const,
        reason: `provider smoke metadata is older than ${maxAgeDays} days: last verified ${lastVerifiedAt}`,
        lastVerifiedAt,
      },
    ];
  });
}

function readLatestSmokeEvidenceDate(
  smokeEvidence: readonly string[]
): string | undefined {
  return smokeEvidence
    .flatMap((entry) =>
      Array.from(entry.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g), (match) =>
        match[1]
      )
    )
    .filter((value): value is string => typeof value === 'string')
    .sort()
    .at(-1);
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value ?? 1));
}
