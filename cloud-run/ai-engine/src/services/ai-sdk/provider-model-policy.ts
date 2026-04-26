import type { ProviderName } from './model-provider.types';

export const CEREBRAS_QWEN_MODEL_ID = 'qwen-3-235b-a22b-instruct-2507';
export const DEPRECATED_CEREBRAS_QWEN_MODEL_ID = CEREBRAS_QWEN_MODEL_ID;
export const CEREBRAS_QWEN_DEPRECATION_DATE = '2026-05-27';
export const CEREBRAS_GPT_OSS_MODEL_ID = 'gpt-oss-120b';
export const CEREBRAS_LLAMA_FALLBACK_MODEL_ID = 'llama3.1-8b';
export const DEFAULT_CEREBRAS_MODEL = CEREBRAS_QWEN_MODEL_ID;
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

export type CerebrasRuntimeModelId =
  | typeof CEREBRAS_QWEN_MODEL_ID
  | typeof CEREBRAS_LLAMA_FALLBACK_MODEL_ID;

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
    smokeEvidence: [
      'direct text/SQL smoke passed',
      'structured output smoke passed',
      'forced tool call smoke passed',
    ],
    freeTierLimitSummary:
      'Account limit: 5 RPM / 30K TPM / 14.4K RPD / 1M TPD; primary until 2026-05-27 deprecation',
    sourceUrls: CEREBRAS_SOURCE_URLS,
    recommendedReplacement: CEREBRAS_DEPRECATION_REPLACEMENT,
  },
  [CEREBRAS_LLAMA_FALLBACK_MODEL_ID]: {
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
    smokeEvidence: [
      'chat completions smoke passed',
      'tool calling smoke passed',
      'generateObject smoke passed',
    ],
    freeTierLimitSummary:
      'Free: 30 RPM / 900 RPH / 14.4K RPD / 1M TPD; intra-Cerebras fallback only',
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
  return [CEREBRAS_QWEN_MODEL_ID, CEREBRAS_LLAMA_FALLBACK_MODEL_ID];
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
