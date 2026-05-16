import {
  DEFAULT_CEREBRAS_MODEL,
  getCerebrasModelId,
  getGroqModelId,
  getMistralModelId,
  getOpenRouterVisionModelId,
  getZaiModelId,
  getZaiVisionModelId,
} from '../../lib/config-parser';
import type { ProviderName } from './model-provider.types';
import {
  getCerebrasModelPolicy,
  getCerebrasRuntimeModelPolicies,
  type ProviderModelPolicy,
  type ProviderModelQuota,
  type ProviderModelSmokeStatus,
} from './provider-model-policy';

export type ProviderModelLifecycle = 'production' | 'preview' | 'custom';

export interface ProviderModelMetadata {
  provider: ProviderName;
  role: string;
  modelId: string;
  lifecycle: ProviderModelLifecycle;
  productionModel: boolean;
  preview: boolean;
  deprecated: boolean;
  deprecationDate?: string;
  recommendedReplacement?: string;
  contextWindowTokens?: number;
  enabled: boolean;
  toolCallingEnabled: boolean;
  structuredOutputEnabled: boolean;
  blockAfterDeprecation: boolean;
  smokeStatus: ProviderModelSmokeStatus;
  smokeEvidence: string[];
  quota: ProviderModelQuota;
  freeTierLimitSummary: string;
  sourceUrls: string[];
}

export interface DeprecatedProviderModelFinding {
  provider: ProviderName;
  modelId: string;
  severity: 'P1' | 'P2';
  reason: string;
  replacement: string;
}

function isPastDeprecationDate(
  deprecationDate: string | undefined,
  asOf: Date
): boolean {
  if (!deprecationDate) return false;
  const startOfNextDayUtc = new Date(`${deprecationDate}T00:00:00Z`);
  startOfNextDayUtc.setUTCDate(startOfNextDayUtc.getUTCDate() + 1);
  return asOf >= startOfNextDayUtc;
}

function describeCerebrasRole(policy: ProviderModelPolicy): string {
  switch (policy.role) {
    case 'primary':
      return 'primary Cerebras model';
    case 'fallback':
      return 'short-context Cerebras fallback model';
    case 'excluded':
      return 'excluded free-tier unavailable model';
    case 'vision':
      return 'vision';
  }
}

function toCerebrasMetadata(policy: ProviderModelPolicy): ProviderModelMetadata {
  return {
    provider: policy.provider,
    role: describeCerebrasRole(policy),
    modelId: policy.modelId,
    lifecycle: policy.lifecycle,
    productionModel: policy.lifecycle === 'production' && policy.enabled,
    preview: policy.lifecycle === 'preview',
    deprecated: false,
    deprecationDate: policy.deprecationDate,
    recommendedReplacement: policy.recommendedReplacement,
    contextWindowTokens: policy.contextWindowTokens,
    enabled: policy.enabled,
    toolCallingEnabled: policy.toolCallingEnabled,
    structuredOutputEnabled: policy.structuredOutputEnabled,
    blockAfterDeprecation: policy.blockAfterDeprecation,
    smokeStatus: policy.smokeStatus,
    smokeEvidence: policy.smokeEvidence,
    quota: policy.quota,
    freeTierLimitSummary: policy.freeTierLimitSummary,
    sourceUrls: policy.sourceUrls,
  };
}

export function getCerebrasModelMetadata(
  modelId = getCerebrasModelId()
): ProviderModelMetadata {
  return toCerebrasMetadata(getCerebrasModelPolicy(modelId));
}

export function getRuntimeProviderModelMetadata(): ProviderModelMetadata[] {
  const geminiVisionModelId = process.env.GEMINI_VISION_MODEL_ID || 'gemini-2.5-flash-lite';
  const cerebrasMetadata = [
    getCerebrasModelPolicy(getCerebrasModelId()),
    ...getCerebrasRuntimeModelPolicies(),
  ]
    .filter(
      (policy, index, policies) =>
        policies.findIndex((candidate) => candidate.modelId === policy.modelId) === index
    )
    .map(toCerebrasMetadata);

  return [
    {
      provider: 'groq',
      role: 'Supervisor/Metrics Query primary + long-context fallback',
      modelId: getGroqModelId(),
      lifecycle: 'preview',
      productionModel: false,
      preview: true,
      deprecated: false,
      contextWindowTokens: 131072,
      enabled: true,
      toolCallingEnabled: true,
      structuredOutputEnabled: true,
      blockAfterDeprecation: false,
      smokeStatus: 'green',
      smokeEvidence: ['provider model drift guard current'],
      quota: {
        requestsPerMinute: 30,
        tokensPerMinute: 30_000,
        requestsPerDay: 1_000,
        tokensPerDay: 500_000,
      },
      freeTierLimitSummary: '30 RPM / 30K TPM / 1K RPD / 500K TPD',
      sourceUrls: [
        'https://console.groq.com/docs/models',
        'https://console.groq.com/docs/rate-limits',
      ],
    },
    ...cerebrasMetadata,
    {
      provider: 'mistral',
      role: 'Analyst/Advisor primary + distributed text fallback',
      modelId: getMistralModelId(),
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      enabled: true,
      toolCallingEnabled: true,
      structuredOutputEnabled: true,
      blockAfterDeprecation: false,
      smokeStatus: 'green',
      smokeEvidence: ['last-resort fallback path configured'],
      quota: {
        requestsPerMinute: 50,
        tokensPerMinute: 50_000,
        requestsPerDay: 500,
        tokensPerDay: 1_000_000,
      },
      freeTierLimitSummary:
        'workspace-tier dependent; current account smoke observed 50 RPM / 50K TPM',
      sourceUrls: [
        'https://docs.mistral.ai/admin/user-management-finops/tier',
        'https://docs.mistral.ai/models/model-cards/mistral-small-4-0-26-03',
      ],
    },
    {
      provider: 'zai',
      role: 'free GLM Flash text fallback',
      modelId: getZaiModelId(),
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      contextWindowTokens: 128000,
      enabled: true,
      toolCallingEnabled: true,
      structuredOutputEnabled: true,
      blockAfterDeprecation: false,
      smokeStatus: 'green',
      smokeEvidence: [
        '2026-05-16 glm-4.5-flash chat completion HTTP 200',
        '2026-05-16 glm-4.5-flash tool-call smoke passed with thinking disabled',
      ],
      quota: {
        requestsPerMinute: 5,
        tokensPerMinute: 30_000,
        requestsPerDay: 500,
        tokensPerDay: 1_000_000,
      },
      freeTierLimitSummary:
        'glm-4.5-flash is officially free; rate limits are account/concurrency based, so runtime guard is 5 RPM / 500 RPD',
      sourceUrls: [
        'https://docs.z.ai/guides/overview/pricing',
        'https://docs.z.ai/api-reference/llm/chat-completion',
        'https://docs.z.ai/guides/capabilities/struct-output',
      ],
    },
    {
      provider: 'gemini',
      role: 'vision primary',
      modelId: geminiVisionModelId,
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      contextWindowTokens: 1000000,
      enabled: true,
      toolCallingEnabled: true,
      structuredOutputEnabled: true,
      blockAfterDeprecation: false,
      smokeStatus: 'green',
      smokeEvidence: ['vision primary path configured'],
      quota: {
        requestsPerMinute: 15,
        tokensPerMinute: 250_000,
        requestsPerDay: 1_000,
        tokensPerDay: 250_000 * 60 * 24,
      },
      freeTierLimitSummary: '15 RPM / 1,000 RPD for Gemini 2.5 Flash-Lite free tier',
      sourceUrls: [
        'https://ai.google.dev/gemini-api/docs/pricing',
        'https://ai.google.dev/gemini-api/docs/rate-limits',
      ],
    },
    {
      provider: 'openrouter',
      role: 'vision fallback',
      modelId: getOpenRouterVisionModelId(),
      lifecycle: 'production',
      productionModel: false,
      preview: false,
      deprecated: false,
      enabled: true,
      toolCallingEnabled: false,
      structuredOutputEnabled: true,
      blockAfterDeprecation: false,
      smokeStatus: 'green',
      smokeEvidence: ['vision fallback path configured'],
      quota: {
        requestsPerMinute: 1,
        tokensPerMinute: 30_000,
        requestsPerDay: 50,
        tokensPerDay: 1_000_000,
      },
      freeTierLimitSummary: '50 requests/day by default; fallback only',
      sourceUrls: [
        'https://openrouter.ai/docs/api/reference/limits',
        'https://openrouter.ai/pricing',
      ],
    },
    {
      provider: 'zai',
      role: 'vision fallback',
      modelId: getZaiVisionModelId(),
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      contextWindowTokens: 128000,
      enabled: true,
      toolCallingEnabled: true,
      structuredOutputEnabled: true,
      blockAfterDeprecation: false,
      smokeStatus: 'green',
      smokeEvidence: ['2026-05-16 glm-4.6v-flash chat completion HTTP 200'],
      quota: {
        requestsPerMinute: 5,
        tokensPerMinute: 30_000,
        requestsPerDay: 500,
        tokensPerDay: 1_000_000,
      },
      freeTierLimitSummary:
        'glm-4.6v-flash is officially free; runtime guard mirrors Z.AI text fallback',
      sourceUrls: [
        'https://docs.z.ai/guides/overview/pricing',
        'https://docs.z.ai/guides/vlm/glm-4.6v',
      ],
    },
  ];
}

export function getDeprecatedRuntimeProviderModels(
  metadata = getRuntimeProviderModelMetadata(),
  asOf: Date = new Date()
): DeprecatedProviderModelFinding[] {
  return metadata
    .filter((entry) => entry.deprecated || isPastDeprecationDate(entry.deprecationDate, asOf))
    .map((entry) => ({
      provider: entry.provider,
      modelId: entry.modelId,
      severity: 'P1',
      reason: `${entry.modelId} is deprecated for ${entry.provider} after ${entry.deprecationDate}`,
      replacement: entry.recommendedReplacement || DEFAULT_CEREBRAS_MODEL,
    }));
}
