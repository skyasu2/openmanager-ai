import {
  CEREBRAS_QWEN_DEPRECATION_DATE,
  DEFAULT_CEREBRAS_MODEL,
  DEPRECATED_CEREBRAS_QWEN_MODEL_ID,
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

export function getCerebrasModelMetadata(
  modelId = getCerebrasModelId()
): ProviderModelMetadata {
  if (modelId === DEPRECATED_CEREBRAS_QWEN_MODEL_ID) {
    return {
      provider: 'cerebras',
      role: 'structured routing + opt-in text fallback',
      modelId,
      lifecycle: 'preview',
      productionModel: false,
      preview: true,
      deprecated: true,
      deprecationDate: CEREBRAS_QWEN_DEPRECATION_DATE,
      recommendedReplacement: DEFAULT_CEREBRAS_MODEL,
      contextWindowTokens: 8192,
      freeTierLimitSummary: 'preview model; do not use as long-term runtime default',
      sourceUrls: CEREBRAS_SOURCE_URLS,
    };
  }

  if (modelId === DEFAULT_CEREBRAS_MODEL) {
    return {
      provider: 'cerebras',
      role: 'structured routing + opt-in text fallback',
      modelId,
      lifecycle: 'production',
      productionModel: true,
      preview: false,
      deprecated: false,
      contextWindowTokens: 131072,
      freeTierLimitSummary: 'free-tier constrained; keep usage behind routing and quota guards',
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
  metadata = getRuntimeProviderModelMetadata()
): DeprecatedProviderModelFinding[] {
  return metadata
    .filter((entry) => entry.deprecated)
    .map((entry) => ({
      provider: entry.provider,
      modelId: entry.modelId,
      severity: 'P1',
      reason: `${entry.modelId} is deprecated for ${entry.provider} after ${entry.deprecationDate}`,
      replacement: entry.recommendedReplacement || DEFAULT_CEREBRAS_MODEL,
    }));
}
