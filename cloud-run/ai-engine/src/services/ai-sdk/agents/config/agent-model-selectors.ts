import type { LanguageModel } from 'ai';
import {
  getCerebrasFallbackModelIds,
  getCerebrasModelId,
  getGroqModelId,
  getMistralModelId,
  getOpenRouterVisionModelId,
} from '../../../../lib/config-parser';
import { logger } from '../../../../lib/logger';
import { getCircuitBreaker } from '../../../resilience/circuit-breaker';
import {
  getProviderCapabilities,
  getCapabilityMismatchReasons,
  getTextProviderCapabilities,
  type ModelCapabilityRequirements,
} from '../../provider-capabilities';
import {
  getCerebrasModel,
  getGeminiFlashLiteModel,
  getGroqModel,
  getMistralModel,
  getOpenRouterVisionModel,
} from '../../model-provider-core';
import { checkProviderStatus } from '../../model-provider-status';
import type { ModelCapabilities, ProviderName } from '../../model-provider.types';
import { getAgentProviderOrder } from './agent-runtime-policy';

export interface ModelResult {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
  capabilities: ModelCapabilities;
}

// ============================================================================
// Text Provider → Model SSOT
// ============================================================================

export type TextProvider = 'cerebras' | 'groq' | 'mistral';

const TEXT_PROVIDER_MODELS: Record<TextProvider, {
  factory: (id: string) => LanguageModel;
  modelIds: () => string[];
  capabilities: ModelCapabilities | ((modelId?: string) => ModelCapabilities);
}> = {
  // Cerebras primary/fallback pair. Qwen is primary until 2026-05-27 deprecation;
  // llama3.1-8b stays intra-provider fallback only.
  cerebras: {
    factory: getCerebrasModel,
    modelIds: () => [
      getCerebrasModelId(),
      ...getCerebrasFallbackModelIds(),
    ].filter((modelId, index, list) => modelId && list.indexOf(modelId) === index),
    capabilities: (modelId) => getTextProviderCapabilities('cerebras', modelId)
  },
  // Groq Llama 4 Scout (17B Preview) - 1K RPD / 500K TPD, 131K ctx, tool calling ✅.
  groq: {
    factory: getGroqModel,
    modelIds: () => [getGroqModelId()],
    capabilities: (modelId) => getTextProviderCapabilities('groq', modelId)
  },
  // Mistral Large - Frontier급 성능, free tier ~2 RPM / 500 RPD. Last resort.
  mistral: {
    factory: getMistralModel,
    modelIds: () => [getMistralModelId()],
    capabilities: (modelId) => getTextProviderCapabilities('mistral', modelId)
  },
};

// ============================================================================
// selectTextModel — Common Helper
// ============================================================================

interface SelectTextModelOptions {
  /** If true, throw when no provider is available (default: false → return null) */
  throwOnEmpty?: boolean;
  /** Providers to exclude (e.g., recently failed) */
  excludeProviders?: ProviderName[];
  /** CB key prefix override (default: agentLabel lowercase) */
  cbPrefix?: string;
  /** Minimum capabilities required by the caller */
  requiredCapabilities?: ModelCapabilityRequirements;
}

/**
 * Unified text model selector with CB check + provider status + fallback chain.
 *
 * Replaces per-agent model selection functions with a single SSOT.
 * Every provider is checked against its Circuit Breaker before attempting init.
 */
export function selectTextModel(
  agentLabel: string,
  providerOrder: readonly TextProvider[],
  options: SelectTextModelOptions = {},
): ModelResult | null {
  const {
    throwOnEmpty = false,
    excludeProviders = [],
    cbPrefix,
    requiredCapabilities = {},
  } = options;
  const status = checkProviderStatus();
  const excluded = new Set<string>(excludeProviders);
  const prefix = cbPrefix ?? agentLabel.toLowerCase().replace(/\s+/g, '-');

  // CB pre-check: auto-exclude OPEN providers
  for (const provider of providerOrder) {
    if (!excluded.has(provider)) {
      const cb = getCircuitBreaker(`${prefix}-${provider}`);
      if (!cb.isAllowed()) {
        excluded.add(provider);
        logger.info(`[${agentLabel}] CB OPEN: auto-excluding ${provider}`);
      }
    }
  }

  for (const provider of providerOrder) {
    if (!status[provider] || excluded.has(provider)) continue;

    const config = TEXT_PROVIDER_MODELS[provider];
    const modelIds = config.modelIds();
    for (const modelId of modelIds) {
      const capabilities = typeof config.capabilities === 'function'
        ? config.capabilities(modelId)
        : config.capabilities;
      const mismatchReasons = getCapabilityMismatchReasons(
        capabilities,
        requiredCapabilities
      );
      if (mismatchReasons.length > 0) {
        logger.info(
          `[${agentLabel}] Skipping ${provider}/${modelId}: missing ${mismatchReasons.join(', ')}`
        );
        continue;
      }

      try {
        return {
          model: config.factory(modelId),
          provider,
          modelId,
          capabilities,
        };
      } catch {
        const nextModel = modelIds[modelIds.indexOf(modelId) + 1];
        const nextProviderIdx = providerOrder.indexOf(provider) + 1;
        const nextProvider = nextProviderIdx < providerOrder.length
          ? providerOrder[nextProviderIdx]
          : null;
        logger.warn(
          `[${agentLabel}] ${provider}/${modelId} unavailable${
            nextModel ? `, trying ${provider}/${nextModel}` : nextProvider ? `, trying ${nextProvider}` : ''
          }`
        );
      }
    }
  }

  if (throwOnEmpty) {
    throw new Error(
      `No provider available for ${agentLabel} (providers unavailable or missing required capabilities).`
    );
  }

  logger.warn(
    `[${agentLabel}] No model available (providers unavailable or missing required capabilities)`
  );
  return null;
}

// ============================================================================
// Per-Agent Model Selectors (1-line delegation)
// ============================================================================

/**
 * NLQ model: Groq(llama-4-scout) → Cerebras(Qwen, 16K+ ctx) → Mistral
 */
export function getNlqModel(): ModelResult | null {
  return selectTextModel('NLQ Agent', getAgentProviderOrder('NLQ Agent'), {
    requiredCapabilities: { requireToolCalling: true, minContextTokens: 16_000 },
  });
}

/**
 * Analyst model: Cerebras(Qwen, 32K+ ctx) → Groq(llama-4-scout) → Mistral
 */
export function getAnalystModel(): ModelResult | null {
  return selectTextModel('Analyst Agent', getAgentProviderOrder('Analyst Agent'), {
    requiredCapabilities: { requireToolCalling: true, minContextTokens: 32_000 },
  });
}

/**
 * Reporter model: Cerebras(Qwen, 32K+ ctx) → Groq(llama-4-scout) → Mistral
 */
export function getReporterModel(): ModelResult | null {
  return selectTextModel('Reporter Agent', getAgentProviderOrder('Reporter Agent'), {
    requiredCapabilities: { requireToolCalling: true, minContextTokens: 32_000 },
  });
}

/**
 * Advisor model: Cerebras(Qwen, 32K+ ctx) → Groq(llama-4-scout) → Mistral
 */
export function getAdvisorModel(): ModelResult | null {
  return selectTextModel('Advisor Agent', getAgentProviderOrder('Advisor Agent'), {
    requiredCapabilities: { requireToolCalling: true, minContextTokens: 32_000 },
  });
}

// ============================================================================
// Vision Model (different provider type — not unified)
// ============================================================================

/**
 * Get Vision model: Gemini 2.5 Flash-Lite → OpenRouter Gemma-3-27b (Fallback)
 */
export function getVisionModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.gemini) {
    try {
      const geminiModelId = process.env.GEMINI_VISION_MODEL_ID || 'gemini-2.5-flash-lite';
      return {
        model: getGeminiFlashLiteModel(geminiModelId),
        provider: 'gemini',
        modelId: geminiModelId,
        capabilities: getProviderCapabilities('gemini'),
      };
    } catch (error) {
      logger.warn('[Vision Agent] Gemini initialization failed, trying OpenRouter:', error);
    }
  }

  if (status.openrouter) {
    try {
      const modelId = getOpenRouterVisionModelId();
      logger.info(`[Vision Agent] Using OpenRouter fallback: ${modelId}`);
      return {
        model: getOpenRouterVisionModel(modelId),
        provider: 'openrouter',
        modelId,
        capabilities: getProviderCapabilities('openrouter'),
      };
    } catch (error) {
      logger.error('[Vision Agent] OpenRouter initialization failed:', error);
    }
  }

  logger.warn('[Vision Agent] No vision provider available - Vision features disabled');
  return null;
}
