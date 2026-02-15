/**
 * AI SDK Model Provider
 *
 * Vercel AI SDK 6 based model provider with quad-provider architecture:
 * - Primary: Cerebras (llama-3.3-70b, 24M tokens/day)
 * - Fallback: Groq (llama-3.3-70b-versatile, 100K tokens/day)
 * - Verifier: Mistral (mistral-small-2506, 24B params)
 * - Vision: Gemini Flash-Lite (1M context, Vision, Search Grounding)
 *
 * @version 3.0.0
 * @updated 2026-01-27 - Added Gemini Flash-Lite for Vision Agent
 * @updated 2026-02-14 - Added OpenRouter fallback for Vision Agent
 */

import { createCerebras } from '@ai-sdk/cerebras';
import { createMistral } from '@ai-sdk/mistral';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

// Use centralized config getters (supports AI_PROVIDERS_CONFIG JSON format)
import {
  getCerebrasApiKey,
  getMistralApiKey,
  getGroqApiKey,
  getGeminiApiKey,
  getOpenRouterApiKey,
  getOpenRouterVisionModelId,
  getOpenRouterVisionFallbackModelIds,
} from '../../lib/config-parser';

import { getCircuitBreaker } from '../resilience/circuit-breaker';

// ============================================================================
// 1. Types
// ============================================================================

export type ProviderName = 'cerebras' | 'groq' | 'mistral' | 'gemini' | 'openrouter';

export interface ProviderStatus {
  cerebras: boolean;
  groq: boolean;
  mistral: boolean;
  gemini: boolean;
  openrouter: boolean;
}

// ============================================================================
// 2. Runtime Provider Toggle (for testing)
// ============================================================================

/**
 * Runtime toggle state for providers (default: all enabled)
 * Use toggleProvider() to enable/disable at runtime for testing
 */
const providerToggleState: Record<ProviderName, boolean> = {
  cerebras: true,
  groq: true,
  mistral: true,
  gemini: true,
  openrouter: true,
};

/**
 * Cached provider status (invalidated when toggling providers)
 * @optimization Reduces redundant API key checks during agent initialization
 */
let cachedProviderStatus: ProviderStatus | null = null;

/**
 * Toggle a provider on/off at runtime
 * @note Invalidates provider status cache to reflect changes
 */
export function toggleProvider(provider: ProviderName, enabled: boolean): void {
  providerToggleState[provider] = enabled;
  // Invalidate cache when provider toggle changes
  cachedProviderStatus = null;
  console.log(`🔧 [Provider] ${provider} ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Get current toggle state for all providers
 */
export function getProviderToggleState(): Record<ProviderName, boolean> {
  return { ...providerToggleState };
}

/**
 * Check if provider is enabled (both has API key AND toggle is on)
 */
function isProviderEnabled(provider: ProviderName): boolean {
  return providerToggleState[provider];
}

/**
 * Check which providers are available (API key exists AND toggle enabled)
 * @optimization Caches result for startup performance (agent-configs.ts calls this 5+ times)
 */
export function checkProviderStatus(): ProviderStatus {
  if (cachedProviderStatus) {
    return cachedProviderStatus;
  }

  cachedProviderStatus = {
    cerebras: !!getCerebrasApiKey() && isProviderEnabled('cerebras'),
    groq: !!getGroqApiKey() && isProviderEnabled('groq'),
    mistral: !!getMistralApiKey() && isProviderEnabled('mistral'),
    gemini: !!getGeminiApiKey() && isProviderEnabled('gemini'),
    openrouter: !!getOpenRouterApiKey() && isProviderEnabled('openrouter'),
  };

  return cachedProviderStatus;
}

/**
 * Invalidate provider status cache (call when toggling providers)
 */
export function invalidateProviderStatusCache(): void {
  cachedProviderStatus = null;
}

export interface ProviderConfig {
  apiKey: string | undefined;
  baseURL?: string;
}

export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
}

// ============================================================================
// 3. Provider Factories
// ============================================================================

/**
 * Create Cerebras provider instance
 */
function createCerebrasProvider() {
  const apiKey = getCerebrasApiKey();
  if (!apiKey) {
    throw new Error('CEREBRAS_API_KEY not configured');
  }

  return createCerebras({
    apiKey,
  });
}

/**
 * Create Groq provider instance
 */
function createGroqProvider() {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  return createGroq({
    apiKey,
  });
}

/**
 * Create Mistral provider instance
 */
function createMistralProvider() {
  const apiKey = getMistralApiKey();
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY not configured');
  }

  return createMistral({
    apiKey,
  });
}

/**
 * Create Gemini provider instance
 * Uses Google Generative AI (Gemini 2.5 Flash-Lite)
 *
 * @added 2026-01-27 Vision Agent
 */
function createGeminiProvider() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  return createGoogleGenerativeAI({
    apiKey,
  });
}

/**
 * Create OpenRouter provider instance
 * Uses OpenAI-compatible API
 */
function patchOpenRouterRequestInit(init?: RequestInit): RequestInit | undefined {
  if (!init?.body || typeof init.body !== 'string') {
    return init;
  }

  try {
    const parsedBody = JSON.parse(init.body) as Record<string, unknown>;
    const provider =
      typeof parsedBody.provider === 'object' && parsedBody.provider !== null
        ? parsedBody.provider as Record<string, unknown>
        : {};

    const modelId = typeof parsedBody.model === 'string' ? parsedBody.model : null;
    const primaryVisionModel = getOpenRouterVisionModelId();

    if (!('allow_fallbacks' in provider)) {
      provider.allow_fallbacks = true;
    }

    if (!('require_parameters' in provider)) {
      provider.require_parameters = true;
    }

    // OpenRouter official fallback chain:
    // provide "models" list so router can fail over to next model on error/quota.
    if (modelId === primaryVisionModel && !Array.isArray(parsedBody.models)) {
      const fallbacks = getOpenRouterVisionFallbackModelIds();
      parsedBody.models = [...new Set([primaryVisionModel, ...fallbacks])];
    }

    return {
      ...init,
      body: JSON.stringify({
        ...parsedBody,
        provider,
      }),
    };
  } catch {
    return init;
  }
}

function createOpenRouterProvider() {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const referer = process.env.OPENROUTER_HTTP_REFERER;
  const title = process.env.OPENROUTER_X_TITLE || 'OpenManager AI';

  const headers: Record<string, string> = {};
  if (referer) {
    headers['HTTP-Referer'] = referer;
  }
  if (title) {
    headers['X-Title'] = title;
  }

  return createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    name: 'openrouter',
    headers,
    fetch: async (input, init) => fetch(input, patchOpenRouterRequestInit(init)),
  });
}

// ============================================================================
// 4. Model Factory Functions
// ============================================================================

/**
 * AI SDK 타입 호환성 헬퍼
 *
 * Provider SDK들이 LanguageModelV3를 반환하지만 generateText()는 LanguageModelV2를 기대함.
 * 런타임에서는 호환되므로 타입 캐스팅으로 해결.
 *
 * 🎯 P1 Fix: 런타임 검증 추가로 Provider SDK 변경 시 조기 에러 감지
 *
 * @see https://github.com/vercel/ai/issues - AI SDK 버전 호환성 이슈
 */
function asLanguageModel(model: unknown): LanguageModel {
  // 🎯 CODEX Review Fix: 함수형 모델도 허용 (callable + 속성 조합 가능)
  if (!model || (typeof model !== 'object' && typeof model !== 'function')) {
    throw new TypeError('[ModelProvider] Model must be an object or function');
  }

  // Check for essential LanguageModel interface methods
  const m = model as Record<string, unknown>;
  const hasDoGenerate = typeof m.doGenerate === 'function';
  const hasDoStream = typeof m.doStream === 'function';

  if (!hasDoGenerate && !hasDoStream) {
    throw new TypeError(
      '[ModelProvider] Model does not implement LanguageModel interface (missing doGenerate/doStream)'
    );
  }

  return model as LanguageModel;
}

/**
 * Get Cerebras model via OpenAI-compatible API
 * @param modelId - 'llama-3.3-70b' (default) or 'llama-3.1-8b'
 */
export function getCerebrasModel(
  modelId: string = 'llama-3.3-70b'
): LanguageModel {
  const cerebras = createCerebrasProvider();
  return asLanguageModel(cerebras(modelId));
}

/**
 * Get Groq model
 * @param modelId - 'llama-3.3-70b-versatile' (default) or 'llama-3.1-8b-instant'
 */
export function getGroqModel(
  modelId: string = 'llama-3.3-70b-versatile'
): LanguageModel {
  const groq = createGroqProvider();
  return asLanguageModel(groq(modelId));
}

/**
 * Get Mistral model
 * @param modelId - 'mistral-small-2506' (default)
 */
export function getMistralModel(
  modelId: string = 'mistral-small-2506'
): LanguageModel {
  const mistral = createMistralProvider();
  return asLanguageModel(mistral(modelId));
}

/**
 * Get Gemini Flash-Lite model (Vision Agent)
 *
 * Features:
 * - 1M token context window
 * - Vision (Image/PDF/Video/Audio)
 * - Google Search Grounding
 * - URL Context
 *
 * Free Tier (2026-01):
 * - 1,000 RPD, 15 RPM, 250K TPM
 *
 * @param modelId - 'gemini-2.5-flash' (default, stable) - Vision/PDF/Audio support
 * @added 2026-01-27
 * @updated 2026-01-28 - Changed to gemini-2.5-flash (lite has v1 spec issue, 2.0 deprecated Mar 2026)
 */
export function getGeminiFlashLiteModel(
  modelId: string = 'gemini-2.5-flash'
): LanguageModel {
  const gemini = createGeminiProvider();
  return asLanguageModel(gemini(modelId));
}

/**
 * Get OpenRouter Vision model (Fallback)
 * Default: nvidia/nemotron-nano-12b-v2-vl:free
 *
 * @param modelId - Model ID (optional, uses env default if not provided)
 */
export function getOpenRouterVisionModel(
  modelId?: string
): LanguageModel {
  const openrouter = createOpenRouterProvider();
  const model = modelId || getOpenRouterVisionModelId();
  return asLanguageModel(openrouter(model));
}

// ============================================================================
// 5. Supervisor Model with Fallback Chain
// ============================================================================

/**
 * Get primary model for Supervisor (Single-Agent Mode)
 * Fallback chain: Cerebras → Mistral → Groq
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
  const cbProviders: ProviderName[] = ['cerebras', 'mistral', 'groq'];
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

  // Try Cerebras first (24M tokens/day, fastest)
  if (status.cerebras && !excluded.has('cerebras')) {
    try {
      return {
        model: getCerebrasModel('llama-3.3-70b'),
        provider: 'cerebras',
        modelId: 'llama-3.3-70b',
      };
    } catch (error) {
      logger.warn('⚠️ [Supervisor] Cerebras initialization failed:', error);
    }
  }

  // Fallback 1: Mistral
  if (status.mistral && !excluded.has('mistral')) {
    return {
      model: getMistralModel('mistral-small-2506'),
      provider: 'mistral',
      modelId: 'mistral-small-2506',
    };
  }

  // Fallback 2: Groq
  if (status.groq && !excluded.has('groq')) {
    console.log('🔄 [Supervisor] Using Groq fallback');
    return {
      model: getGroqModel('llama-3.3-70b-versatile'),
      provider: 'groq',
      modelId: 'llama-3.3-70b-versatile',
    };
  }

  throw new Error('No LLM provider configured. Set CEREBRAS_API_KEY, MISTRAL_API_KEY, or GROQ_API_KEY.');
}

/**
 * Get verifier model with 3-way fallback
 * Mistral → Cerebras → Groq
 * Ensures operation even if 2 of 3 providers are down
 */
export function getVerifierModel(): {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
} {
  const status = checkProviderStatus();

  // Primary: Mistral (best for verification)
  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-small-2506'),
        provider: 'mistral',
        modelId: 'mistral-small-2506',
      };
    } catch (error) {
      logger.warn('⚠️ [Verifier] Mistral initialization failed, trying Cerebras:', error);
    }
  }

  // Fallback 1: Cerebras
  if (status.cerebras) {
    try {
      console.log('🔄 [Verifier] Using Cerebras fallback');
      return {
        model: getCerebrasModel('llama-3.3-70b'),
        provider: 'cerebras',
        modelId: 'llama-3.3-70b',
      };
    } catch (error) {
      logger.warn('⚠️ [Verifier] Cerebras initialization failed, trying Groq:', error);
    }
  }

  // Fallback 2: Groq (last resort)
  if (status.groq) {
    console.log('🔄 [Verifier] Using Groq fallback (last resort)');
    return {
      model: getGroqModel('llama-3.3-70b-versatile'),
      provider: 'groq',
      modelId: 'llama-3.3-70b-versatile',
    };
  }

  throw new Error('No provider available for verifier model (all 3 providers down).');
}

/**
 * Get advisor model with 3-way fallback
 * Mistral → Groq → Cerebras
 * Ensures operation even if 2 of 3 providers are down
 */
export function getAdvisorModel(): {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
} {
  const status = checkProviderStatus();

  // Primary: Mistral (best for RAG + reasoning)
  if (status.mistral) {
    try {
      return {
        model: getMistralModel('mistral-small-2506'),
        provider: 'mistral',
        modelId: 'mistral-small-2506',
      };
    } catch (error) {
      logger.warn('⚠️ [Advisor] Mistral initialization failed, trying Groq:', error);
    }
  }

  // Fallback 1: Groq
  if (status.groq) {
    try {
      console.log('🔄 [Advisor] Using Groq fallback');
      return {
        model: getGroqModel('llama-3.3-70b-versatile'),
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };
    } catch (error) {
      logger.warn('⚠️ [Advisor] Groq initialization failed, trying Cerebras:', error);
    }
  }

  // Fallback 2: Cerebras (last resort)
  if (status.cerebras) {
    console.log('🔄 [Advisor] Using Cerebras fallback (last resort)');
    return {
      model: getCerebrasModel('llama-3.3-70b'),
      provider: 'cerebras',
      modelId: 'llama-3.3-70b',
    };
  }

  throw new Error('No provider available for advisor model (all 3 providers down).');
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

export interface ProviderHealth {
  provider: ProviderName;
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

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

import { logger } from '../../lib/logger';
import {
  selectAvailableProvider,
  recordProviderUsage,
  getQuotaSummary,
  type LLMProviderName as QuotaProviderName,
} from '../resilience/quota-tracker';

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

  // Provider 우선순위
  const preferredOrder: QuotaProviderName[] = ['cerebras', 'mistral', 'groq'];
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
          model: getCerebrasModel('llama-3.3-70b'),
          provider: 'cerebras',
          modelId: 'llama-3.3-70b',
          isPreemptiveFallback,
        };
      case 'mistral':
        return {
          model: getMistralModel('mistral-small-2506'),
          provider: 'mistral',
          modelId: 'mistral-small-2506',
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
