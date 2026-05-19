import type { LanguageModel } from 'ai';
import {
  getCerebrasFallbackModelIds,
  getCerebrasModelId,
  getGroqModelId,
  getMistralModelId,
  getOpenRouterVisionModelId,
  getZaiModelId,
  getZaiVisionModelId,
  isOpenRouterVisionFallbackEnabled,
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
  getZaiModel,
  getZaiVisionModel,
} from '../../model-provider-core';
import { checkProviderStatus } from '../../model-provider-status';
import type { ModelCapabilities, ProviderName } from '../../model-provider.types';
import { selectRoundRobinProviderOrder } from './round-robin-provider-selector';

export interface ModelResult {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
  capabilities: ModelCapabilities;
  rotationSlot?: number;  // Round-robin slot for UI attribution
}

// ============================================================================
// Text Provider → Model SSOT
// ============================================================================

export type TextProvider = 'cerebras' | 'groq' | 'mistral' | 'zai';

const TEXT_PROVIDER_MODELS: Record<TextProvider, {
  factory: (id: string) => LanguageModel;
  modelIds: () => string[];
  capabilities: ModelCapabilities | ((modelId?: string) => ModelCapabilities);
}> = {
  // Cerebras runtime candidates are config-driven. The default list is
  // llama3.1-8b only; long-context callers skip it by capability.
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
  // Mistral Small - free-tier friendly last-resort fallback. Limits are workspace-tier dependent.
  mistral: {
    factory: getMistralModel,
    modelIds: () => [getMistralModelId()],
    capabilities: (modelId) => getTextProviderCapabilities('mistral', modelId)
  },
  // Z.AI GLM Flash - free text fallback. Request body disables thinking in provider core.
  zai: {
    factory: getZaiModel,
    modelIds: () => [getZaiModelId()],
    capabilities: (modelId) => getTextProviderCapabilities('zai', modelId)
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
  /** Round-robin slot for attribution (optional, from round-robin selector) */
  rotationSlot?: number;
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
    rotationSlot,
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
          ...(typeof rotationSlot === 'number' && { rotationSlot }),
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
// Per-Agent Model Selectors (Round-Robin Delegation)
// ============================================================================

/**
 * Metrics Query model: Round-robin with 16K context guard
 */
export function getNlqModel(): ModelResult | null {
  const { providerOrder, rotationSlot } = selectRoundRobinProviderOrder(16_000);
  return selectTextModel('Metrics Query Agent', providerOrder, {
    requiredCapabilities: {
      requireToolCalling: true,
      minContextTokens: 16_000,
    },
    rotationSlot,
  });
}

/**
 * Analyst model: Round-robin with 32K context guard
 */
export function getAnalystModel(): ModelResult | null {
  const { providerOrder, rotationSlot } = selectRoundRobinProviderOrder(32_000);
  return selectTextModel('Analyst Agent', providerOrder, {
    requiredCapabilities: { requireToolCalling: true, minContextTokens: 32_000 },
    rotationSlot,
  });
}

/**
 * Reporter model: Round-robin with 32K context guard
 */
export function getReporterModel(): ModelResult | null {
  const { providerOrder, rotationSlot } = selectRoundRobinProviderOrder(32_000);
  return selectTextModel('Reporter Agent', providerOrder, {
    requiredCapabilities: { requireToolCalling: true, minContextTokens: 32_000 },
    rotationSlot,
  });
}

/**
 * Advisor model: Round-robin with 32K context guard
 */
export function getAdvisorModel(): ModelResult | null {
  const { providerOrder, rotationSlot } = selectRoundRobinProviderOrder(32_000);
  return selectTextModel('Advisor Agent', providerOrder, {
    requiredCapabilities: { requireToolCalling: true, minContextTokens: 32_000 },
    rotationSlot,
  });
}

/**
 * Supervisor model: Round-robin with 8K context guard (default)
 */
export function getSupervisorModel(): ModelResult | null {
  const { providerOrder, rotationSlot } = selectRoundRobinProviderOrder(8_000);
  return selectTextModel('Supervisor', providerOrder, {
    rotationSlot,
  });
}

// ============================================================================
// Vision Model (different provider type — not unified)
// ============================================================================

/**
 * Get Vision model: Gemini 2.5 Flash-Lite → Z.AI GLM-4.6V-Flash.
 * OpenRouter is opt-in only after live validation.
 */
export function getVisionModel(): ModelResult | null {
  const status = checkProviderStatus();
  const openRouterFallbackEnabled = isOpenRouterVisionFallbackEnabled();

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
      logger.warn('[Vision Agent] Gemini initialization failed, trying Z.AI Vision:', error);
    }
  }

  if (status.zai) {
    try {
      const modelId = getZaiVisionModelId();
      logger.info(`[Vision Agent] Using Z.AI Vision fallback: ${modelId}`);
      return {
        model: getZaiVisionModel(modelId),
        provider: 'zai',
        modelId,
        capabilities: getProviderCapabilities('zai', modelId),
      };
    } catch (error) {
      logger.error('[Vision Agent] Z.AI Vision initialization failed:', error);
    }
  }

  if (status.openrouter && openRouterFallbackEnabled) {
    try {
      const modelId = getOpenRouterVisionModelId();
      logger.info(`[Vision Agent] Using opt-in OpenRouter fallback: ${modelId}`);
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
