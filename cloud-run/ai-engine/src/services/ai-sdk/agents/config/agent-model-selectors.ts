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
 * Ensures operation even if 2 of 3 providers are down
 */
export function getNlqModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('llama-3.3-70b'),
        provider: 'cerebras',
        modelId: 'llama-3.3-70b',
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
        model: getMistralModel('mistral-small-2506'),
        provider: 'mistral',
        modelId: 'mistral-small-2506',
      };
    } catch {
      logger.warn('⚠️ [NLQ Agent] Mistral unavailable');
    }
  }

  logger.warn('⚠️ [NLQ Agent] No model available (all 3 providers down)');
  return null;
}

/**
 * Get Analyst model: Groq → Cerebras → Mistral (3-way fallback)
 * Ensures operation even if 2 of 3 providers are down
 */
export function getAnalystModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.groq) {
    try {
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch {
      logger.warn('⚠️ [Analyst Agent] Groq unavailable, trying Cerebras');
    }
  }

  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('llama-3.3-70b'),
        provider: 'cerebras',
        modelId: 'llama-3.3-70b',
      };
    } catch {
      logger.warn('⚠️ [Analyst Agent] Cerebras unavailable, trying Mistral');
    }
  }

  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-small-2506'),
        provider: 'mistral',
        modelId: 'mistral-small-2506',
      };
    } catch {
      logger.warn('⚠️ [Analyst Agent] Mistral unavailable');
    }
  }

  logger.warn('⚠️ [Analyst Agent] No model available (all 3 providers down)');
  return null;
}

/**
 * Get Reporter model: Groq → Cerebras → Mistral (3-way fallback)
 * Ensures operation even if 2 of 3 providers are down
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
        model: getCerebrasModel('llama-3.3-70b'),
        provider: 'cerebras',
        modelId: 'llama-3.3-70b',
      };
    } catch {
      logger.warn('⚠️ [Reporter Agent] Cerebras unavailable, trying Mistral');
    }
  }

  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-small-2506'),
        provider: 'mistral',
        modelId: 'mistral-small-2506',
      };
    } catch {
      logger.warn('⚠️ [Reporter Agent] Mistral unavailable');
    }
  }

  logger.warn('⚠️ [Reporter Agent] No model available (all 3 providers down)');
  return null;
}

/**
 * Get Advisor model: Mistral → Groq → Cerebras (3-way fallback)
 * Ensures operation even if 2 of 3 providers are down
 */
export function getAdvisorModel(): ModelResult | null {
  const status = checkProviderStatus();

  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-small-2506'),
        provider: 'mistral',
        modelId: 'mistral-small-2506',
      };
    } catch {
      logger.warn('⚠️ [Advisor Agent] Mistral unavailable, trying Groq');
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
      logger.warn('⚠️ [Advisor Agent] Groq unavailable, trying Cerebras');
    }
  }

  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('llama-3.3-70b'),
        provider: 'cerebras',
        modelId: 'llama-3.3-70b',
      };
    } catch {
      logger.warn('⚠️ [Advisor Agent] Cerebras unavailable');
    }
  }

  logger.warn('⚠️ [Advisor Agent] No model available (all 3 providers down)');
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
