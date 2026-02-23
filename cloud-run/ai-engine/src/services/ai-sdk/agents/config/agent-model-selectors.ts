import type { LanguageModel } from 'ai';
import { getOpenRouterVisionModelId } from '../../../../lib/config-parser';
import { logger } from '../../../../lib/logger';
import {
  checkProviderStatus,
  getCerebrasModel,
  getGeminiFlashLiteModel,
  getGroqModel,
  getMistralModel,
  getOpenRouterVisionModel,
} from '../../model-provider';

export interface ModelResult {
  model: LanguageModel;
  provider: string;
  modelId: string;
}

/**
 * Get NLQ model: Cerebras → Groq → Mistral (3-way fallback)
 * Primary: Cerebras gpt-oss-120b (120B MoE, 1M TPD, 3000 tok/s)
 */
export function getNlqModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('gpt-oss-120b'),
        provider: 'cerebras',
        modelId: 'gpt-oss-120b',
      };
    } catch {
      logger.warn('⚠️ [NLQ Agent] Cerebras unavailable, trying Groq');
    }
  }

  if (status.groq) {
    try {
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch {
      logger.warn('⚠️ [NLQ Agent] Groq unavailable, trying Mistral');
    }
  }

  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-large-latest'),
        provider: 'mistral',
        modelId: 'mistral-large-latest',
      };
    } catch {
      logger.warn('⚠️ [NLQ Agent] Mistral unavailable');
    }
  }

  logger.warn('⚠️ [NLQ Agent] No model available (all providers down)');
  return null;
}

/**
 * Get Analyst model: Cerebras → Groq → Mistral (3-way fallback)
 * Primary: Cerebras gpt-oss-120b (120B MoE)
 * Reason: Groq/llama-3.3-70b produces empty responses with Analyst's multi-tool workflow.
 *         Cerebras/gpt-oss-120b handles tool calling reliably and is faster.
 */
export function getAnalystModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('gpt-oss-120b'),
        provider: 'cerebras',
        modelId: 'gpt-oss-120b',
      };
    } catch {
      logger.warn('⚠️ [Analyst Agent] Cerebras unavailable, trying Groq');
    }
  }

  if (status.groq) {
    try {
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch {
      logger.warn('⚠️ [Analyst Agent] Groq unavailable, trying Mistral');
    }
  }

  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-large-latest'),
        provider: 'mistral',
        modelId: 'mistral-large-latest',
      };
    } catch {
      logger.warn('⚠️ [Analyst Agent] Mistral unavailable');
    }
  }

  logger.warn('⚠️ [Analyst Agent] No model available (all providers down)');
  return null;
}

/**
 * Get Reporter model: Groq → Cerebras → Mistral (3-way fallback)
 * Primary: Groq llama-3.3-70b-versatile (70B)
 */
export function getReporterModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.groq) {
    try {
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch {
      logger.warn('⚠️ [Reporter Agent] Groq unavailable, trying Cerebras');
    }
  }

  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('gpt-oss-120b'),
        provider: 'cerebras',
        modelId: 'gpt-oss-120b',
      };
    } catch {
      logger.warn('⚠️ [Reporter Agent] Cerebras unavailable, trying Mistral');
    }
  }

  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-large-latest'),
        provider: 'mistral',
        modelId: 'mistral-large-latest',
      };
    } catch {
      logger.warn('⚠️ [Reporter Agent] Mistral unavailable');
    }
  }

  logger.warn('⚠️ [Reporter Agent] No model available (all providers down)');
  return null;
}

/**
 * Get Advisor model: Mistral → Cerebras → Groq (3-way fallback)
 * Primary: Mistral mistral-large-latest (Frontier model)
 * Advisor는 Mistral이 메인 — 각 provider가 최소 1개 에이전트 Primary
 */
export function getAdvisorModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-large-latest'),
        provider: 'mistral',
        modelId: 'mistral-large-latest',
      };
    } catch {
      logger.warn('⚠️ [Advisor Agent] Mistral unavailable, trying Cerebras');
    }
  }

  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('gpt-oss-120b'),
        provider: 'cerebras',
        modelId: 'gpt-oss-120b',
      };
    } catch {
      logger.warn('⚠️ [Advisor Agent] Cerebras unavailable, trying Groq');
    }
  }

  if (status.groq) {
    try {
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch {
      logger.warn('⚠️ [Advisor Agent] Groq unavailable');
    }
  }

  logger.warn('⚠️ [Advisor Agent] No model available (all providers down)');
  return null;
}

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
      logger.warn('⚠️ [Vision Agent] Gemini initialization failed, trying OpenRouter:', error);
    }
  }

  if (status.openrouter) {
    try {
      const modelId = getOpenRouterVisionModelId();
      logger.info(`🔄 [Vision Agent] Using OpenRouter fallback: ${modelId}`);
      return {
        model: getOpenRouterVisionModel(modelId),
        provider: 'openrouter',
        modelId,
      };
    } catch (error) {
      logger.error('❌ [Vision Agent] OpenRouter initialization failed:', error);
    }
  }

  logger.warn('⚠️ [Vision Agent] No vision provider available - Vision features disabled');
  return null;
}
