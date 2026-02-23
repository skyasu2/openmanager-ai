/**
 * Request-Level Retry with Fallback
 *
 * Handles 429 Rate Limit errors by automatically switching to fallback providers.
 * Implements exponential backoff for transient errors.
 *
 * @version 1.0.0
 * @created 2026-01-12
 */

import { generateText, type LanguageModel } from 'ai';
import type { ProviderName } from '../ai-sdk/model-provider';
import { logger } from '../../lib/logger';
import {
  getCerebrasModel,
  getGroqModel,
  getMistralModel,
  checkProviderStatus,
} from '../ai-sdk/model-provider';
import { getCircuitBreaker } from './circuit-breaker';

// ============================================================================
// Types
// ============================================================================

export interface RetryConfig {
  /** Maximum retry attempts per provider */
  maxRetries: number;
  /** Initial delay in ms (doubles each retry) */
  initialDelayMs: number;
  /** Maximum delay between retries */
  maxDelayMs: number;
  /** Timeout for each attempt in ms */
  timeoutMs: number;
}

export interface ProviderAttempt {
  provider: ProviderName;
  modelId: string;
  attempt: number;
  error?: string;
  durationMs: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  provider: ProviderName;
  modelId: string;
  attempts: ProviderAttempt[];
  totalDurationMs: number;
  usedFallback: boolean;
}

export interface GenerateTextOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  tools?: Parameters<typeof generateText>[0]['tools'];
  temperature?: number;
  maxOutputTokens?: number;
  stopWhen?: Parameters<typeof generateText>[0]['stopWhen'];
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  timeoutMs: 60000,
};

/**
 * Error codes that trigger fallback to next provider
 */
const FALLBACK_ERROR_CODES = [
  429,  // Rate limit
  503,  // Service unavailable
  502,  // Bad gateway
  504,  // Gateway timeout
];

/**
 * Error codes that should retry same provider
 */
const RETRY_ERROR_CODES = [
  408,  // Request timeout
  500,  // Internal server error (transient)
];

// ============================================================================
// Provider Chain
// ============================================================================

interface ProviderConfig {
  name: ProviderName;
  getModel: (modelId?: string) => LanguageModel;
  defaultModelId: string;
}

const PROVIDER_CHAIN: ProviderConfig[] = [
  {
    name: 'cerebras',
    getModel: getCerebrasModel,
    defaultModelId: 'gpt-oss-120b',
  },
  {
    name: 'groq',
    getModel: getGroqModel,
    defaultModelId: 'llama-3.3-70b-versatile',
  },
  {
    name: 'mistral',
    getModel: getMistralModel,
    defaultModelId: 'mistral-large-latest',
  },
];

/**
 * Get available providers based on current status
 */
function getAvailableProviders(
  preferredOrder: ProviderName[] = ['cerebras', 'groq', 'mistral'],
  excludeProviders: ProviderName[] = []
): ProviderConfig[] {
  const status = checkProviderStatus();
  const excluded = new Set(excludeProviders);

  return preferredOrder
    .filter((name) => {
      if (excluded.has(name)) return false;
      if (!status[name]) return false;
      // Check circuit breaker state — skip providers in OPEN state
      const cb = getCircuitBreaker(name);
      if (!cb.isAllowed()) {
        logger.warn(`⚠️ [RetryWithFallback] Skipping ${name}: circuit breaker OPEN`);
        return false;
      }
      return true;
    })
    .map((name) => PROVIDER_CHAIN.find((p) => p.name === name)!)
    .filter(Boolean);
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Check if error should trigger fallback to next provider
 */
function shouldFallback(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for rate limit keywords
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    // Check for service unavailable
    if (message.includes('503') || message.includes('unavailable')) {
      return true;
    }

    // Check status code in error object
    const anyError = error as { status?: number; statusCode?: number };
    if (anyError.status && FALLBACK_ERROR_CODES.includes(anyError.status)) {
      return true;
    }
    if (anyError.statusCode && FALLBACK_ERROR_CODES.includes(anyError.statusCode)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if error should trigger retry on same provider
 */
function shouldRetry(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Transient errors
    if (message.includes('timeout') || message.includes('econnreset')) {
      return true;
    }

    // Check status code
    const anyError = error as { status?: number; statusCode?: number };
    if (anyError.status && RETRY_ERROR_CODES.includes(anyError.status)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Execute generateText with automatic retry and fallback
 *
 * @param options - generateText options (messages, tools, etc.)
 * @param preferredOrder - Provider preference order
 * @param config - Retry configuration
 * @returns Result with provider info and attempt history
 *
 * @example
 * ```typescript
 * const result = await generateTextWithRetry({
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' },
 *   ],
 *   tools: myTools,
 * });
 *
 * if (result.success) {
 *   console.log(result.result.text);
 *   console.log(`Used ${result.provider} (fallback: ${result.usedFallback})`);
 * }
 * ```
 */
export async function generateTextWithRetry(
  options: GenerateTextOptions,
  preferredOrder: ProviderName[] = ['cerebras', 'groq', 'mistral'],
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<Awaited<ReturnType<typeof generateText>>>> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  const attempts: ProviderAttempt[] = [];
  const excludedProviders: ProviderName[] = [];

  let currentProviderIndex = 0;

  while (true) {
    const availableProviders = getAvailableProviders(preferredOrder, excludedProviders);

    if (availableProviders.length === 0) {
      // All providers exhausted
      logger.error('❌ [RetryWithFallback] All providers exhausted');
      return {
        success: false,
        provider: preferredOrder[0],
        modelId: '',
        attempts,
        totalDurationMs: Date.now() - startTime,
        usedFallback: excludedProviders.length > 0,
      };
    }

    const providerConfig = availableProviders[0];
    const { name: provider, getModel, defaultModelId } = providerConfig;

    let retryCount = 0;

    while (retryCount <= fullConfig.maxRetries) {
      const attemptStart = Date.now();

      try {
        console.log(
          `🔄 [RetryWithFallback] Trying ${provider}/${defaultModelId} (attempt ${retryCount + 1}/${fullConfig.maxRetries + 1})`
        );

        const model = getModel(defaultModelId);

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), fullConfig.timeoutMs);
        });

        // Execute with timeout
        // 🎯 P3-1: AI SDK v6.0.50 Best Practice - delegate network-level retries to SDK
        // maxRetries: 1 handles transient network errors automatically
        // Provider-level fallback is still managed by our custom logic
        // 🎯 P2-2: Native timeout as primary + Promise.race as backup for full control
        const result = await Promise.race([
          generateText({
            model,
            messages: options.messages,
            tools: options.tools,
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxOutputTokens ?? 2048,
            maxRetries: 1, // 🎯 P3-1: Delegate network retry to AI SDK
            timeout: { totalMs: fullConfig.timeoutMs }, // 🎯 P2-2: Native timeout
            ...(options.stopWhen && { stopWhen: options.stopWhen }),
          }),
          timeoutPromise, // Backup timeout via Promise.race
        ]);

        const durationMs = Date.now() - attemptStart;

        attempts.push({
          provider,
          modelId: defaultModelId,
          attempt: retryCount + 1,
          durationMs,
        });

        console.log(
          `✅ [RetryWithFallback] ${provider} succeeded in ${durationMs}ms`
        );

        return {
          success: true,
          result,
          provider,
          modelId: defaultModelId,
          attempts,
          totalDurationMs: Date.now() - startTime,
          usedFallback: excludedProviders.length > 0,
        };
      } catch (error) {
        const durationMs = Date.now() - attemptStart;
        const errorMessage = error instanceof Error ? error.message : String(error);

        attempts.push({
          provider,
          modelId: defaultModelId,
          attempt: retryCount + 1,
          error: errorMessage,
          durationMs,
        });

        logger.warn(
          `⚠️ [RetryWithFallback] ${provider} failed (attempt ${retryCount + 1}): ${errorMessage}`
        );

        // Check if should fallback to next provider
        if (shouldFallback(error)) {
          console.log(`🔀 [RetryWithFallback] Rate limit/unavailable, switching provider...`);
          excludedProviders.push(provider);
          break; // Exit retry loop, try next provider
        }

        // Check if should retry same provider
        if (shouldRetry(error) && retryCount < fullConfig.maxRetries) {
          const delay = getBackoffDelay(retryCount, fullConfig);
          console.log(`⏳ [RetryWithFallback] Retrying ${provider} in ${delay}ms...`);
          await sleep(delay);
          retryCount++;
          continue;
        }

        // Non-retryable error - try next provider
        console.log(`❌ [RetryWithFallback] Non-retryable error, trying next provider...`);
        excludedProviders.push(provider);
        break;
      }
    }

    // If we've exhausted retries for this provider, it's already excluded
    currentProviderIndex++;
  }
}

/**
 * Simple wrapper that throws on failure (for compatibility)
 */
export async function generateTextWithFallback(
  options: GenerateTextOptions,
  preferredOrder?: ProviderName[]
): Promise<{
  result: Awaited<ReturnType<typeof generateText>>;
  provider: ProviderName;
  modelId: string;
  usedFallback: boolean;
}> {
  const retryResult = await generateTextWithRetry(options, preferredOrder);

  if (!retryResult.success || !retryResult.result) {
    const lastError = retryResult.attempts[retryResult.attempts.length - 1]?.error;
    throw new Error(`All providers failed. Last error: ${lastError || 'Unknown'}`);
  }

  return {
    result: retryResult.result,
    provider: retryResult.provider,
    modelId: retryResult.modelId,
    usedFallback: retryResult.usedFallback,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_RETRY_CONFIG, FALLBACK_ERROR_CODES, RETRY_ERROR_CODES };
