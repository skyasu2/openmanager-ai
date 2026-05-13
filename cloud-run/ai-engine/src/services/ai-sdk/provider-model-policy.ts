import type { ProviderName } from './model-provider.types';

export const CEREBRAS_QWEN_MODEL_ID = 'qwen-3-235b-a22b-instruct-2507';
export const DEPRECATED_CEREBRAS_QWEN_MODEL_ID = CEREBRAS_QWEN_MODEL_ID;
export const CEREBRAS_QWEN_DEPRECATION_DATE = '2026-05-27';
export const CEREBRAS_GPT_OSS_MODEL_ID = 'gpt-oss-120b';
export const CEREBRAS_LLAMA_FALLBACK_MODEL_ID = 'llama3.1-8b';
export const CEREBRAS_LLAMA_DEPRECATION_DATE = '2026-05-27';
export const CEREBRAS_ZAI_GLM_MODEL_ID = 'zai-glm-4.7';
export const DEFAULT_CEREBRAS_MODEL = CEREBRAS_LLAMA_FALLBACK_MODEL_ID;
export const CEREBRAS_DEPRECATION_REPLACEMENT =
  'groq:meta-llama/llama-4-scout-17b-16e-instruct';
export const CEREBRAS_DEPRECATION_CONTINGENCY = {
  date: CEREBRAS_LLAMA_DEPRECATION_DATE,
  affectedRuntimeAgents: ['Analyst Agent', 'Reporter Agent', 'Advisor Agent'],
  fallbackChainAfterDeprecation: ['groq', 'mistral'],
  visibleButExcludedModels: [CEREBRAS_ZAI_GLM_MODEL_ID],
  action:
    'Confirm replacement model entitlement before 2026-05-27; Mistral 2 RPM cannot absorb Cerebras burst fallback.',
} as const;

export type ProviderModelRole = 'primary' | 'fallback' | 'vision' | 'excluded';
export type ProviderModelLifecycle = 'production' | 'preview' | 'custom';
export type ProviderModelSmokeStatus = 'green' | 'red' | 'unknown';
export type ProviderReasoningCapabilityKind = 'none' | 'provider-native';
export type ProviderReasoningCapabilitySmokeSource =
  | 'mock-contract'
  | 'manual-smoke'
  | 'provider-doc';
export type ProviderReasoningCapabilityOptionShape =
  | 'reasoning_effort'
  | 'reasoning_format'
  | 'thinking_config'
  | 'provider_options'
  | 'unknown';
export type ProviderReasoningCapabilityReasonCode =
  | 'enabled'
  | 'not-supported'
  | 'policy-disabled'
  | 'opt-in-required'
  | 'expired';

export interface ProviderModelQuota {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay: number;
  tokensPerDay: number;
}

export interface ProviderReasoningCapability {
  kind: ProviderReasoningCapabilityKind;
  defaultEnabled: false;
  requiresOptIn: boolean;
  lastVerified?: string;
  expiresAt?: string;
  smokeSource: ProviderReasoningCapabilitySmokeSource;
  optionShape: ProviderReasoningCapabilityOptionShape;
  publicSummary: string;
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
  reasoningCapability: ProviderReasoningCapability;
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

export type ProviderReasoningCapabilityStatusOptions = {
  asOf?: Date;
  optIn?: boolean;
};

export interface ProviderReasoningCapabilityStatus {
  provider: ProviderName;
  modelId: string;
  kind: ProviderReasoningCapabilityKind;
  enabled: boolean;
  reasonCode: ProviderReasoningCapabilityReasonCode;
  publicSummary: string;
  publicMetadata: {
    provider: ProviderName;
    modelId: string;
    kind: ProviderReasoningCapabilityKind;
    enabled: boolean;
    defaultEnabled: false;
    requiresOptIn: boolean;
    lastVerified?: string;
    expiresAt?: string;
    smokeSource: ProviderReasoningCapabilitySmokeSource;
    optionShape: ProviderReasoningCapabilityOptionShape;
    publicSummary: string;
  };
}

export interface ProviderReasoningCapabilityFinding {
  provider: ProviderName;
  modelId: string;
  severity: 'P2';
  reason: string;
}

export type CerebrasRuntimeModelId =
  typeof CEREBRAS_LLAMA_FALLBACK_MODEL_ID;

const DEFAULT_PROVIDER_SMOKE_MAX_AGE_DAYS = 14;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const CEREBRAS_SOURCE_URLS = [
  'https://inference-docs.cerebras.ai/models/overview',
  'https://inference-docs.cerebras.ai/support/rate-limits',
  'https://inference-docs.cerebras.ai/capabilities/tool-use',
  'https://inference-docs.cerebras.ai/capabilities/reasoning',
];

const EMPTY_QUOTA: ProviderModelQuota = {
  requestsPerMinute: 0,
  tokensPerMinute: 0,
  requestsPerDay: 0,
  tokensPerDay: 0,
};

const NO_PROVIDER_NATIVE_REASONING: ProviderReasoningCapability = {
  kind: 'none',
  defaultEnabled: false,
  requiresOptIn: false,
  smokeSource: 'mock-contract',
  optionShape: 'unknown',
  publicSummary:
    'Provider-native reasoning is not enabled for this OpenManager runtime policy.',
};

const CEREBRAS_GPT_OSS_PROVIDER_REASONING: ProviderReasoningCapability = {
  kind: 'provider-native',
  defaultEnabled: false,
  requiresOptIn: true,
  smokeSource: 'provider-doc',
  optionShape: 'reasoning_effort',
  publicSummary:
    'Official Cerebras docs describe GPT-OSS reasoning controls, but this model is not enabled for the current OpenManager runtime policy.',
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
      '2026-05-13 account smoke returned 429 queue/quota',
      'official Cerebras docs list this as a Preview model, not Production',
    ],
    reasoningCapability: NO_PROVIDER_NATIVE_REASONING,
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
    blockAfterDeprecation: true,
    smokeStatus: 'green',
    smokeEvidence: [
      '2026-05-13 current account chat completion HTTP 200',
      '2026-05-13 retained as short-context runtime only; not evidence for Metrics Query 16K primary promotion',
      'tool calling and structured output smoke previously passed',
    ],
    reasoningCapability: NO_PROVIDER_NATIVE_REASONING,
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
      '2026-05-13 current account chat completions smoke returned 404',
      'not shown in account free-tier Limits list',
    ],
    reasoningCapability: CEREBRAS_GPT_OSS_PROVIDER_REASONING,
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
      reasoningCapability: NO_PROVIDER_NATIVE_REASONING,
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

export function getProviderReasoningCapabilityStatus(
  policy: ProviderModelPolicy,
  options: ProviderReasoningCapabilityStatusOptions = {}
): ProviderReasoningCapabilityStatus {
  const capability = policy.reasoningCapability;
  const asOf = options.asOf ?? new Date();
  const expired = isReasoningCapabilityExpired(capability, asOf);
  const reasonCode: ProviderReasoningCapabilityReasonCode =
    capability.kind === 'none'
      ? 'not-supported'
      : !policy.enabled
        ? 'policy-disabled'
        : expired
          ? 'expired'
          : capability.requiresOptIn && !options.optIn
            ? 'opt-in-required'
            : 'enabled';
  const enabled = reasonCode === 'enabled';

  return {
    provider: policy.provider,
    modelId: policy.modelId,
    kind: capability.kind,
    enabled,
    reasonCode,
    publicSummary: capability.publicSummary,
    publicMetadata: {
      provider: policy.provider,
      modelId: policy.modelId,
      kind: capability.kind,
      enabled,
      defaultEnabled: capability.defaultEnabled,
      requiresOptIn: capability.requiresOptIn,
      lastVerified: capability.lastVerified,
      expiresAt: capability.expiresAt,
      smokeSource: capability.smokeSource,
      optionShape: capability.optionShape,
      publicSummary: capability.publicSummary,
    },
  };
}

export function getProviderReasoningCapabilityFindings(
  policies: readonly ProviderModelPolicy[] = getCerebrasRuntimeModelPolicies(),
  options: ProviderReasoningCapabilityStatusOptions = {}
): ProviderReasoningCapabilityFinding[] {
  return policies.flatMap((policy) => {
    const status = getProviderReasoningCapabilityStatus(policy, options);
    if (status.reasonCode !== 'expired') return [];

    return [
      {
        provider: policy.provider,
        modelId: policy.modelId,
        severity: 'P2' as const,
        reason: policy.reasoningCapability.expiresAt
          ? `provider-native reasoning capability expired on ${policy.reasoningCapability.expiresAt}; disabled until re-verified`
          : 'provider-native reasoning capability has no expiry; disabled until re-verified',
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

function isReasoningCapabilityExpired(
  capability: ProviderReasoningCapability,
  asOf: Date
): boolean {
  if (capability.kind !== 'provider-native') {
    return false;
  }

  if (!capability.expiresAt) return true;

  const expiryStart = Date.parse(`${capability.expiresAt}T00:00:00Z`);
  if (!Number.isFinite(expiryStart)) return true;

  const startOfNextDayUtc = new Date(expiryStart);
  startOfNextDayUtc.setUTCDate(startOfNextDayUtc.getUTCDate() + 1);
  return asOf >= startOfNextDayUtc;
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value ?? 1));
}
