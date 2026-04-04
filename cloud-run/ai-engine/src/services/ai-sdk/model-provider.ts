/**
 * AI SDK Model Provider
 *
 * Vercel AI SDK 6 based model provider with quad-provider architecture:
 * - Primary: Groq (llama-4-scout-17b, 500K TPD, 512K ctx, tool calling ✅)
 * - Secondary: Cerebras (qwen-3-235b, Preview, 1M TPD, 1,400 tok/s, structured-output ✅ / tool loop opt-in)
 * - Last Resort: Mistral (mistral-large-latest, Frontier, ~2 RPM free tier)
 * - Vision: Gemini 2.5 Flash-Lite (1M context, 1K RPD, no thinking tokens)
 *
 * @version 4.1.1
 * @updated 2026-04-04 - Cerebras tool-calling default를 opt-in으로 전환
 *                       Vision default를 Gemini 2.5 Flash-Lite로 고정
 */

import type { LanguageModel } from 'ai';
import { logger } from '../../lib/logger';

// Use centralized config getters (supports AI_PROVIDERS_CONFIG JSON format)
import {
  getCerebrasModelId,
  getGroqModelId,
  getOpenRouterVisionModelId,
} from '../../lib/config-parser';
import {
  type LLMProviderName as QuotaProviderName,
  getQuotaSummary,
  recordProviderUsage,
  selectAvailableProvider,
} from '../resilience/quota-tracker';
import { selectTextModel } from './agents/config/agent-model-selectors';
import {
  getCerebrasModel,
  getGeminiFlashLiteModel,
  getGroqModel,
  getMistralModel,
  getOpenRouterVisionModel,
} from './model-provider-core';
import {
  checkProviderStatus,
  getProviderToggleState,
  invalidateProviderStatusCache,
  toggleProvider,
} from './model-provider-status';
import type {
  ProviderHealth,
  ProviderName,
  ProviderStatus,
} from './model-provider.types';

export type { ProviderHealth, ProviderName, ProviderStatus } from './model-provider.types';
export {
  getCerebrasModel,
  getGeminiFlashLiteModel,
  getGroqModel,
  getMistralModel,
  getOpenRouterVisionModel,
} from './model-provider-core';
export {
  checkProviderStatus,
  getProviderToggleState,
  invalidateProviderStatusCache,
  toggleProvider,
} from './model-provider-status';

// ============================================================================
// 2. Runtime Provider Toggle (for testing)
// ============================================================================

// ============================================================================
// 3. Supervisor Model with Fallback Chain
// ============================================================================

/**
 * Get primary model for Supervisor (Single-Agent Mode)
 * Fallback chain: Cerebras → Groq → Mistral (3-way) with CB check
 *
 * @param excludeProviders - Providers to skip (e.g., recently failed providers on retry)
 */
export function getSupervisorModel(excludeProviders: ProviderName[] = []): {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
} {
  const result = selectTextModel('Supervisor', ['groq', 'cerebras', 'mistral'], {
    throwOnEmpty: true,
    excludeProviders,
    cbPrefix: 'supervisor',
    requiredCapabilities: { requireToolCalling: true },
  });
  // throwOnEmpty guarantees non-null
  return result as { model: LanguageModel; provider: ProviderName; modelId: string };
}

/**
 * Get verifier model with 3-way fallback + CB check
 * Groq(llama-4-scout) → Cerebras(qwen-3, Preview) → Mistral
 */
export function getVerifierModel(): {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
} {
  const result = selectTextModel('Verifier', ['groq', 'cerebras', 'mistral'], {
    throwOnEmpty: true,
    requiredCapabilities: { requireToolCalling: true },
  });
  return result as { model: LanguageModel; provider: ProviderName; modelId: string };
}

// Advisor model: re-exported from agent-model-selectors (SSOT)
export { getAdvisorModel } from './agents/config/agent-model-selectors';

/**
 * Get Vision Agent model (Gemini Flash-Lite with OpenRouter fallback)
 *
 * @note Actual agent execution uses agent-configs.ts getVisionModel().
 *       This function is a low-level utility for direct model access.
 *
 * Primary: Gemini 2.5 Flash-Lite (1M context, 1K RPD, no thinking tokens)
 * Fallback: OpenRouter (nvidia/nemotron-nano-12b-v2-vl:free)
 *
 * @returns Model info or null (graceful degradation)
 * @updated 2026-02-15 - Added OpenRouter request best-practice defaults
 */
export function getVisionAgentModel(): {
  model: LanguageModel;
  provider: 'gemini' | 'openrouter';
  modelId: string;
} | null {
  const status = checkProviderStatus();

  // 1. Try Gemini (Primary)
  if (status.gemini) {
    try {
      const geminiModelId = process.env.GEMINI_VISION_MODEL_ID || 'gemini-2.5-flash-lite';
      return {
        model: getGeminiFlashLiteModel(geminiModelId),
        provider: 'gemini',
        modelId: geminiModelId,
      };
    } catch (error) {
      logger.warn('⚠️ [Vision Agent] Gemini initialization failed, trying OpenRouter:', error);
    }
  }

  // 2. Try OpenRouter (Fallback)
  if (status.openrouter) {
    try {
      const modelId = getOpenRouterVisionModelId();
      logger.info(`[Vision Agent] Using OpenRouter fallback: ${modelId}`);
      return {
        model: getOpenRouterVisionModel(modelId),
        provider: 'openrouter',
        modelId: modelId,
      };
    } catch (error) {
      logger.error('❌ [Vision Agent] OpenRouter initialization failed:', error);
    }
  }

  logger.warn('⚠️ [Vision Agent] No vision provider available - Vision features disabled');
  return null;
}

/**
 * Check if Vision Agent is available
 * @returns true if Gemini or OpenRouter provider is configured and enabled
 */
export function isVisionAgentAvailable(): boolean {
  const status = checkProviderStatus();
  return status.gemini || status.openrouter;
}

// ============================================================================
// 6. Health Check
// ============================================================================

/**
 * Test provider connectivity (lightweight check)
 */
export async function testProviderHealth(
  provider: ProviderName
): Promise<ProviderHealth> {
  const startTime = Date.now();

  try {
    switch (provider) {
      case 'cerebras':
        getCerebrasModel(); // Just check if provider can be created
        break;
      case 'groq':
        getGroqModel();
        break;
      case 'mistral':
        getMistralModel();
        break;
      case 'gemini':
        getGeminiFlashLiteModel();
        break;
      case 'openrouter':
        getOpenRouterVisionModel();
        break;
    }

    return {
      provider,
      status: 'ok',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      provider,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check all providers health
 */
export async function checkAllProvidersHealth(): Promise<ProviderHealth[]> {
  const status = checkProviderStatus();
  const results: ProviderHealth[] = [];

  if (status.cerebras) {
    results.push(await testProviderHealth('cerebras'));
  }
  if (status.groq) {
    results.push(await testProviderHealth('groq'));
  }
  if (status.mistral) {
    results.push(await testProviderHealth('mistral'));
  }
  if (status.gemini) {
    results.push(await testProviderHealth('gemini'));
  }
  if (status.openrouter) {
    results.push(await testProviderHealth('openrouter'));
  }

  return results;
}

/**
 * Log provider status
 */
export function logProviderStatus(): void {
  const status = checkProviderStatus();
  logger.info({
    Cerebras: status.cerebras ? 'ok' : 'off',
    Groq: status.groq ? 'ok' : 'off',
    Mistral: status.mistral ? 'ok' : 'off',
    Gemini: status.gemini ? 'ok (Vision)' : 'off',
    OpenRouter: status.openrouter ? 'ok (Vision Fallback)' : 'off',
  }, '[Provider Status]');
}

// ============================================================================
// 7. Pre-emptive Fallback with Quota Tracking
// ============================================================================

/**
 * Get Supervisor model with Pre-emptive Fallback (Quota-aware)
 *
 * 80% 임계값 도달 시 사전 전환하여 Rate Limit 에러 방지
 *
 * @param excludeProviders - 제외할 Provider 목록
 * @returns 모델 정보 + Pre-emptive Fallback 여부
 */
export async function getSupervisorModelWithQuota(
  excludeProviders: ProviderName[] = []
): Promise<{
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
  isPreemptiveFallback: boolean;
}> {
  const status = checkProviderStatus();
  const excluded = new Set(excludeProviders);

  // Provider 우선순위 (Groq llama-4-scout primary > Cerebras qwen-3 Preview > Mistral)
  const preferredOrder: QuotaProviderName[] = ['groq', 'cerebras', 'mistral'];
  const availableOrder = preferredOrder.filter(
    (p) => status[p] && !excluded.has(p)
  );

  // Quota-aware Provider 선택
  const selection = await selectAvailableProvider(availableOrder);

  if (selection) {
    const { provider, isPreemptiveFallback } = selection;

    if (isPreemptiveFallback) {
      logger.info(`[Supervisor] Pre-emptive fallback to ${provider}`);
    }

    // Provider별 모델 반환
    switch (provider) {
      case 'cerebras': {
        const cerebrasModelId = getCerebrasModelId();
        return {
          model: getCerebrasModel(cerebrasModelId),
          provider: 'cerebras',
          modelId: cerebrasModelId,
          isPreemptiveFallback,
        };
      }
      case 'groq': {
        const groqModelId = getGroqModelId();
        return {
          model: getGroqModel(groqModelId),
          provider: 'groq',
          modelId: groqModelId,
          isPreemptiveFallback,
        };
      }
      case 'mistral':
        return {
          model: getMistralModel('mistral-large-latest'),
          provider: 'mistral',
          modelId: 'mistral-large-latest',
          isPreemptiveFallback,
        };
    }
  }

  // Quota 초과 시 기존 로직으로 폴백
  logger.warn('⚠️ [Supervisor] All providers at quota limit, using fallback logic');
  const fallback = getSupervisorModel(excludeProviders);
  return { ...fallback, isPreemptiveFallback: false };
}

/**
 * Record token usage after API call
 *
 * 🎯 AI SDK v6 Best Practice: Track all provider usage for pre-emptive fallback
 * All providers including Groq are tracked for accurate quota management
 *
 * @param provider - Provider name
 * @param tokensUsed - Number of tokens consumed
 * @param context - Optional context for logging (e.g., 'nlq', 'fallback', 'supervisor')
 */
export async function recordModelUsage(
  provider: ProviderName,
  tokensUsed: number,
  context: string = 'general'
): Promise<void> {
  // Track all providers for quota management
  // Groq has lower request quota than Cerebras (1K RPD vs 14.4K RPD), so tracking is still important.
  await recordProviderUsage(provider as QuotaProviderName, tokensUsed);

  // Enhanced logging with context
  if (provider === 'groq') {
    logger.info(`[QuotaTracker] Groq (${context}): ${tokensUsed} tokens - low quota provider, monitor closely`);
  }
}

/**
 * Get quota summary for all providers
 */
export { getQuotaSummary };
