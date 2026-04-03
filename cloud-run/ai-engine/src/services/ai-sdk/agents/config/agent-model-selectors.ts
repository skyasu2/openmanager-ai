import type { LanguageModel } from 'ai';
import { getCerebrasModelId, getGroqModelId, getOpenRouterVisionModelId } from '../../../../lib/config-parser';
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
  provider: ProviderName;
  modelId: string;
}

// ============================================================================
// Text Provider → Model SSOT
// ============================================================================

export type TextProvider = 'cerebras' | 'groq' | 'mistral';

const TEXT_PROVIDER_MODELS: Record<TextProvider, { factory: (id: string) => LanguageModel; modelId: () => string }> = {
  cerebras: { factory: getCerebrasModel, modelId: () => getCerebrasModelId() },
  // llama-4-scout: 500K TPD / 30K TPM / 512K ctx / tool calling ✅ (2026-04-03 llama-3.3-70b 교체)
  groq:     { factory: getGroqModel,     modelId: () => getGroqModelId() },
  mistral:  { factory: getMistralModel,  modelId: () => 'mistral-large-latest' },
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
    const modelId = config.modelId();
    try {
      return {
        model: config.factory(modelId),
        provider,
        modelId,
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

/**
 * NLQ model: Groq(llama-4-scout) → Cerebras(qwen-3, Preview) → Mistral
 * Groq primary: Production stable, 500K TPD, tool calling ✅
 * Cerebras secondary: Preview 상태이나 1,400 tok/s 속도 이점 유지
 */
export function getNlqModel(): ModelResult | null {
  return selectTextModel('NLQ Agent', ['groq', 'cerebras', 'mistral']);
}

/**
 * Analyst model: Groq(llama-4-scout) → Cerebras(qwen-3, Preview) → Mistral
 * 512K context로 장기 시계열 분석에 유리
 */
export function getAnalystModel(): ModelResult | null {
  return selectTextModel('Analyst Agent', ['groq', 'cerebras', 'mistral']);
}

/**
 * Reporter model: Groq(llama-4-scout) → Cerebras(qwen-3, Preview) → Mistral
 */
export function getReporterModel(): ModelResult | null {
  return selectTextModel('Reporter Agent', ['groq', 'cerebras', 'mistral']);
}

/**
 * Advisor model: Mistral → Groq(llama-4-scout) → Cerebras(qwen-3, Preview)
 * Mistral primary: 복잡한 추론/권고에 최적, Groq으로 부하 분산
 */
export function getAdvisorModel(): ModelResult | null {
  return selectTextModel('Advisor Agent', ['mistral', 'groq', 'cerebras']);
}

// ============================================================================
// Vision Model (different provider type — not unified)
// ============================================================================

/**
 * Get Vision model: Gemini 2.5 Flash-Lite → OpenRouter Gemma-3-27b (Fallback)
 * Flash-Lite: thinking 없음, RPD 1,000, RPM 15 (Flash보다 2배 여유)
 * OpenRouter fallbacks: gemma-3-27b → gemma-3-12b → gemma-3-4b (모두 ✅ 실테스트 통과)
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
