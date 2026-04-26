import {
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  CEREBRAS_GPT_OSS_MODEL_ID,
  CEREBRAS_QWEN_DEPRECATION_DATE,
  CEREBRAS_QWEN_MODEL_ID,
  DEFAULT_CEREBRAS_MODEL,
  getCerebrasModelId,
  getGroqModelId,
  getOpenRouterVisionModelId,
} from '../../lib/config-parser';
import type { ProviderName } from './model-provider.types';

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

const CEREBRAS_SOURCE_URLS = [
  'https://inference-docs.cerebras.ai/models/overview',
  'https://inference-docs.cerebras.ai/support/rate-limits',
  'https://inference-docs.cerebras.ai/capabilities/tool-use',
];

function isPastDeprecationDate(
  deprecationDate: string | undefined,
  asOf: Date
): boolean {
  if (!deprecationDate) return false;
  const startOfNextDayUtc = new Date(`${deprecationDate}T00:00:00Z`);
  startOfNextDayUtc.setUTCDate(startOfNextDayUtc.getUTCDate() + 1);
  return asOf >= startOfNextDayUtc;
}

export function getCerebrasModelMetadata(
  modelId = getCerebrasModelId()
): ProviderModelMetadata {
  if (modelId === CEREBRAS_QWEN_MODEL_ID) {
    return {
      provider: 'cerebras',
      role: 'primary structured routing + text fallback',
      modelId,
      lifecycle: 'preview',
      productionModel: false,
      preview: true,
      deprecated: false,
      deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
      recommendedReplacement: CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
      contextWindowTokens: 65_536,
      freeTierLimitSummary:
        'Account limit: 5 RPM / 30K TPM / 14.4K RPD / 1M TPD; primary until 2026-05-27 deprecation',
      sourceUrls: CEREBRAS_SOURCE_URLS,
    };
  }

  if (modelId === CEREBRAS_LLAMA_FALLBACK_MODEL_ID) {
    return {
      provider: 'cerebras',
      role: 'intra-Cerebras fallback',
      modelId,
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
      recommendedReplacement: undefined,
      contextWindowTokens: 8_192,
      freeTierLimitSummary:
        'Free: 30 RPM / 900 RPH / 14.4K RPD / 1M TPD; intra-Cerebras fallback only',
      sourceUrls: CEREBRAS_SOURCE_URLS,
    };
  }

  if (modelId === CEREBRAS_GPT_OSS_MODEL_ID) {
    return {
      provider: 'cerebras',
      role: 'excluded free-tier unavailable model',
      modelId,
      lifecycle: 'custom',
      productionModel: false,
      preview: false,
      deprecated: false,
      freeTierLimitSummary:
        'not in free-tier runtime candidates; current key chat smoke returned 404',
      sourceUrls: CEREBRAS_SOURCE_URLS,
    };
  }

  return {
    provider: 'cerebras',
    role: 'structured routing + opt-in text fallback',
    modelId,
    lifecycle: 'custom',
    productionModel: false,
    preview: false,
    deprecated: false,
    recommendedReplacement: DEFAULT_CEREBRAS_MODEL,
    freeTierLimitSummary: 'custom override; verify account entitlement before production use',
    sourceUrls: CEREBRAS_SOURCE_URLS,
  };
}

export function getRuntimeProviderModelMetadata(): ProviderModelMetadata[] {
  const geminiVisionModelId = process.env.GEMINI_VISION_MODEL_ID || 'gemini-2.5-flash-lite';

  return [
    {
      provider: 'groq',
      role: 'primary tool-calling text path',
      modelId: getGroqModelId(),
      lifecycle: 'preview',
      productionModel: false,
      preview: true,
      deprecated: false,
      contextWindowTokens: 131072,
      freeTierLimitSummary: '30 RPM / 30K TPM / 1K RPD / 500K TPD',
      sourceUrls: [
        'https://console.groq.com/docs/models',
        'https://console.groq.com/docs/rate-limits',
      ],
    },
    getCerebrasModelMetadata(),
    {
      provider: 'mistral',
      role: 'last-resort text fallback + embedding',
      modelId: 'mistral-large-latest / mistral-embed',
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      freeTierLimitSummary: 'workspace-tier dependent; keep as fallback/embedding path',
      sourceUrls: [
        'https://docs.mistral.ai/admin/user-management-finops/tier',
        'https://docs.mistral.ai/models/model-cards/mistral-large-3-25-12',
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
      freeTierLimitSummary: '50 requests/day by default; fallback only',
      sourceUrls: [
        'https://openrouter.ai/docs/api/reference/limits',
        'https://openrouter.ai/pricing',
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
