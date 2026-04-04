import type { LanguageModel } from 'ai';
import {
  getCerebrasModelId,
  getGroqModelId,
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
  checkProviderStatus,
  getCerebrasModel,
  getGeminiFlashLiteModel,
  getGroqModel,
  getMistralModel,
  getOpenRouterVisionModel,
} from '../../model-provider';
import type { ModelCapabilities, ProviderName } from '../../model-provider.types';

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
  modelId: () => string;
  capabilities: ModelCapabilities | (() => ModelCapabilities);
}> = {
  // Qwen 3 (235B Preview) - 1M TPD, 1,400 tok/s, tool calling ✅ (Cerebras 상시 적용)
  cerebras: { 
    factory: getCerebrasModel, 
    modelId: () => getCerebrasModelId(),
    capabilities: () => getTextProviderCapabilities('cerebras')
  },
  // Llama 4 Scout (17B) - 500K TPD, 30K TPM, 512K ctx, tool calling ✅ (2026-04-03 교체)
  groq: { 
    factory: getGroqModel, 
    modelId: () => getGroqModelId(),
    capabilities: () => getTextProviderCapabilities('groq')
  },
  // Mistral Large - Frontier급 성능, free tier quota 낮음 (~2 RPM)
  mistral: { 
    factory: getMistralModel, 
    modelId: () => 'mistral-large-latest',
    capabilities: () => getTextProviderCapabilities('mistral')
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
  providerOrder: TextProvider[],
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
    const modelId = config.modelId();
    const capabilities = typeof config.capabilities === 'function'
      ? config.capabilities()
      : config.capabilities;
    const mismatchReasons = getCapabilityMismatchReasons(capabilities, requiredCapabilities);
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
      const nextIdx = providerOrder.indexOf(provider) + 1;
      const next = nextIdx < providerOrder.length ? providerOrder[nextIdx] : null;
      logger.warn(`[${agentLabel}] ${provider} unavailable${next ? `, trying ${next}` : ''}`);
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
 * NLQ model: Groq(llama-4-scout) → Cerebras(qwen-3, Preview) → Mistral
 */
export function getNlqModel(): ModelResult | null {
  return selectTextModel('NLQ Agent', ['groq', 'cerebras', 'mistral'], {
    requiredCapabilities: { requireToolCalling: true },
  });
}

/**
 * Analyst model: Groq(llama-4-scout) → Cerebras(qwen-3, Preview) → Mistral
 */
export function getAnalystModel(): ModelResult | null {
  return selectTextModel('Analyst Agent', ['groq', 'cerebras', 'mistral'], {
    requiredCapabilities: { requireToolCalling: true },
  });
}

/**
 * Reporter model: Groq(llama-4-scout) → Cerebras(qwen-3, Preview) → Mistral
 */
export function getReporterModel(): ModelResult | null {
  return selectTextModel('Reporter Agent', ['groq', 'cerebras', 'mistral'], {
    requiredCapabilities: { requireToolCalling: true },
  });
}

/**
 * Advisor model: Mistral → Groq(llama-4-scout) → Cerebras(qwen-3, Preview)
 */
export function getAdvisorModel(): ModelResult | null {
  return selectTextModel('Advisor Agent', ['mistral', 'groq', 'cerebras'], {
    requiredCapabilities: { requireToolCalling: true },
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
