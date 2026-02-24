import type { LanguageModel } from 'ai';
import { getOpenRouterVisionModelId } from '../../../../lib/config-parser';
import { logger } from '../../../../lib/logger';
import { getCircuitBreaker } from '../../../resilience/circuit-breaker';
import {
  checkProviderStatus,
  getCerebrasModel,
  getGeminiFlashLiteModel,
  getGroqModel,
  getMistralModel,
  getOpenRouterVisionModel,
} from '../../model-provider';
import type { ProviderName } from '../../model-provider.types';

export interface ModelResult {
  model: LanguageModel;
  provider: string;
  modelId: string;
}

// ============================================================================
// Text Provider → Model SSOT
// ============================================================================

type TextProvider = 'cerebras' | 'groq' | 'mistral';

const TEXT_PROVIDER_MODELS: Record<TextProvider, { factory: (id: string) => LanguageModel; modelId: string }> = {
  cerebras: { factory: getCerebrasModel, modelId: 'gpt-oss-120b' },
  groq:     { factory: getGroqModel,     modelId: 'llama-3.3-70b-versatile' },
  mistral:  { factory: getMistralModel,  modelId: 'mistral-large-latest' },
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
  const { throwOnEmpty = false, excludeProviders = [], cbPrefix } = options;
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
    try {
      return {
        model: config.factory(config.modelId),
        provider,
        modelId: config.modelId,
      };
    } catch {
      const nextIdx = providerOrder.indexOf(provider) + 1;
      const next = nextIdx < providerOrder.length ? providerOrder[nextIdx] : null;
      logger.warn(`[${agentLabel}] ${provider} unavailable${next ? `, trying ${next}` : ''}`);
    }
  }

  if (throwOnEmpty) {
    throw new Error(`No provider available for ${agentLabel} (all providers down).`);
  }

  logger.warn(`[${agentLabel}] No model available (all providers down)`);
  return null;
}

// ============================================================================
// Per-Agent Model Selectors (1-line delegation)
// ============================================================================

/** NLQ model: Cerebras → Groq → Mistral */
export function getNlqModel(): ModelResult | null {
  return selectTextModel('NLQ Agent', ['cerebras', 'groq', 'mistral']);
}

/** Analyst model: Cerebras → Groq → Mistral */
export function getAnalystModel(): ModelResult | null {
  return selectTextModel('Analyst Agent', ['cerebras', 'groq', 'mistral']);
}

/** Reporter model: Groq → Cerebras → Mistral */
export function getReporterModel(): ModelResult | null {
  return selectTextModel('Reporter Agent', ['groq', 'cerebras', 'mistral']);
}

/** Advisor model: Mistral → Cerebras → Groq */
export function getAdvisorModel(): ModelResult | null {
  return selectTextModel('Advisor Agent', ['mistral', 'cerebras', 'groq']);
}

// ============================================================================
// Vision Model (different provider type — not unified)
// ============================================================================

/**
 * Get Vision model: Gemini Flash → OpenRouter (Fallback)
 */
export function getVisionModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.gemini) {
    try {
      return {
        model: getGeminiFlashLiteModel('gemini-2.5-flash'),
        provider: 'gemini',
        modelId: 'gemini-2.5-flash',
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
      };
    } catch (error) {
      logger.error('[Vision Agent] OpenRouter initialization failed:', error);
    }
  }

  logger.warn('[Vision Agent] No vision provider available - Vision features disabled');
  return null;
}
