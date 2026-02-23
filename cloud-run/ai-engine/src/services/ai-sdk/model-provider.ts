/**
 * AI SDK Model Provider
 *
 * Vercel AI SDK 6 based model provider with quad-provider architecture:
 * - Primary: Cerebras (gpt-oss-120b, 120B MoE, 1M tokens/day, 3000 tok/s)
 * - Fallback: Groq (llama-3.3-70b-versatile, 70B, 100K tokens/day)
 * - Last Resort: Mistral (mistral-large-3-25-12, Frontier, ~2 RPM free tier)
 * - Vision: Gemini Flash (1M context, Vision, Search Grounding)
 *
 * @version 4.0.0
 * @updated 2026-02-23 - Cerebras upgraded to gpt-oss-120b (120B MoE, tool calling)
 */

import type { LanguageModel } from 'ai';
import { logger } from '../../lib/logger';

// Use centralized config getters (supports AI_PROVIDERS_CONFIG JSON format)
import {
  getOpenRouterVisionModelId,
} from '../../lib/config-parser';
import { getCircuitBreaker } from '../resilience/circuit-breaker';
import {
  type LLMProviderName as QuotaProviderName,
  getQuotaSummary,
  recordProviderUsage,
  selectAvailableProvider,
} from '../resilience/quota-tracker';
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
 * Fallback chain: Cerebras → Groq (2-way, Mistral excluded — 2 RPM 임베딩 전용)
 * Primary: Cerebras gpt-oss-120b (120B MoE, 1M TPD, 3000 tok/s)
 *
 * @param excludeProviders - Providers to skip (e.g., recently failed providers on retry)
 */
export function getSupervisorModel(excludeProviders: ProviderName[] = []): {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
} {
  const status = checkProviderStatus();
  const excluded = new Set(excludeProviders);

  // CB 사전 체크: OPEN 상태인 provider를 자동으로 exclude
  const cbProviders: ProviderName[] = ['cerebras', 'groq'];
  for (const provider of cbProviders) {
    if (!excluded.has(provider)) {
      const cb = getCircuitBreaker(`supervisor-${provider}`);
      if (!cb.isAllowed()) {
        excluded.add(provider);
        console.log(`🔌 [Supervisor] CB OPEN: auto-excluding ${provider}`);
      }
    }
  }

  if (excluded.size > 0) {
    console.log(`🔄 [Supervisor] Excluding providers: [${[...excluded].join(', ')}]`);
  }

  // Primary: Cerebras (gpt-oss-120b, 120B MoE, 1M TPD)
  if (status.cerebras && !excluded.has('cerebras')) {
    try {
      return {
        model: getCerebrasModel('gpt-oss-120b'),
        provider: 'cerebras',
        modelId: 'gpt-oss-120b',
      };
    } catch (error) {
      logger.warn('⚠️ [Supervisor] Cerebras initialization failed:', error);
    }
  }

  // Fallback: Groq (llama-3.3-70b-versatile, 70B)
  if (status.groq && !excluded.has('groq')) {
    try {
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch (error) {
      logger.warn('⚠️ [Supervisor] Groq initialization failed:', error);
    }
  }

  throw new Error('No LLM provider configured. Set CEREBRAS_API_KEY or GROQ_API_KEY.');
}

/**
 * Get verifier model with 2-way fallback
 * Cerebras → Groq (Mistral excluded — 2 RPM 임베딩 전용)
 */
export function getVerifierModel(): {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
} {
  const status = checkProviderStatus();

  // Primary: Cerebras (gpt-oss-120b, 120B MoE, 1M TPD)
  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('gpt-oss-120b'),
        provider: 'cerebras',
        modelId: 'gpt-oss-120b',
      };
    } catch (error) {
      logger.warn('⚠️ [Verifier] Cerebras initialization failed, trying Groq:', error);
    }
  }

  // Fallback: Groq
  if (status.groq) {
    try {
      console.log('🔄 [Verifier] Using Groq fallback');
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch (error) {
      logger.warn('⚠️ [Verifier] Groq initialization failed:', error);
    }
  }

  throw new Error('No provider available for verifier model (Cerebras + Groq both down).');
}

/**
 * Get advisor model with 2-way fallback
 * Cerebras → Groq (Mistral excluded — 2 RPM 임베딩 전용)
 */
export function getAdvisorModel(): {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
} {
  const status = checkProviderStatus();

  // Primary: Cerebras (gpt-oss-120b, 120B MoE, 1M TPD)
  if (status.cerebras) {
    try {
      return {
        model: getCerebrasModel('gpt-oss-120b'),
        provider: 'cerebras',
        modelId: 'gpt-oss-120b',
      };
    } catch (error) {
      logger.warn('⚠️ [Advisor] Cerebras initialization failed, trying Groq:', error);
    }
  }

  // Fallback: Groq
  if (status.groq) {
    try {
      console.log('🔄 [Advisor] Using Groq fallback');
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch (error) {
      logger.warn('⚠️ [Advisor] Groq initialization failed:', error);
    }
  }

  throw new Error('No provider available for advisor model (Cerebras + Groq both down).');
}

/**
 * Get Vision Agent model (Gemini Flash with OpenRouter Fallback)
 *
 * @note Actual agent execution uses agent-configs.ts getVisionModel().
 *       This function is a low-level utility for direct model access.
 *
 * Primary: Gemini 2.5 Flash (1M context, 250 RPD Free Tier)
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
      return {
        model: getGeminiFlashLiteModel('gemini-2.5-flash'),
        provider: 'gemini',
        modelId: 'gemini-2.5-flash',
      };
    } catch (error) {
      logger.warn('⚠️ [Vision Agent] Gemini initialization failed, trying OpenRouter:', error);
    }
  }

  // 2. Try OpenRouter (Fallback)
  if (status.openrouter) {
    try {
      const modelId = getOpenRouterVisionModelId();
      console.log(`🔄 [Vision Agent] Using OpenRouter fallback: ${modelId}`);
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
  console.log('🔑 AI SDK Provider Status:', {
    Cerebras: status.cerebras ? '✅' : '❌',
    Groq: status.groq ? '✅' : '❌',
    Mistral: status.mistral ? '✅' : '❌',
    Gemini: status.gemini ? '✅ (Vision)' : '❌',
    OpenRouter: status.openrouter ? '✅ (Vision Fallback)' : '❌',
  });
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

  // Provider 우선순위 (Cerebras 120B MoE > Groq 70B) — Mistral excluded (2 RPM 임베딩 전용)
  const preferredOrder: QuotaProviderName[] = ['cerebras', 'groq'];
  const availableOrder = preferredOrder.filter(
    (p) => status[p] && !excluded.has(p)
  );

  // Quota-aware Provider 선택
  const selection = await selectAvailableProvider(availableOrder);

  if (selection) {
    const { provider, isPreemptiveFallback } = selection;

    if (isPreemptiveFallback) {
      console.log(`⚠️ [Supervisor] Pre-emptive fallback to ${provider}`);
    }

    // Provider별 모델 반환
    switch (provider) {
      case 'cerebras':
        return {
          model: getCerebrasModel('gpt-oss-120b'),
          provider: 'cerebras',
          modelId: 'gpt-oss-120b',
          isPreemptiveFallback,
        };
      case 'groq':
        return {
          model: getGroqModel('llama-3.3-70b-versatile'),
          provider: 'groq',
          modelId: 'llama-3.3-70b-versatile',
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
  // Groq has lower limits (100K/day) so tracking is especially important for fallback scenarios
  await recordProviderUsage(provider as QuotaProviderName, tokensUsed);

  // Enhanced logging with context
  if (provider === 'groq') {
    console.log(`[QuotaTracker] Groq (${context}): ${tokensUsed} tokens - low quota provider, monitor closely`);
  }
}

/**
 * Get quota summary for all providers
 */
export { getQuotaSummary };
