/**
 * Request-Level Retry with Fallback
 *
 * Handles 429 Rate Limit errors by automatically switching to fallback providers.
 * Implements exponential backoff for transient errors.
 *
 * @version 1.0.0
 * @created 2026-01-12
 */

import { generateText } from 'ai';
import type { ProviderName } from '../ai-sdk/model-provider';
import { logger } from '../../lib/logger';
import {
  getCapabilityMismatchReasons,
  getTextProviderCapabilities,
  type ModelCapabilityRequirements,
} from '../ai-sdk/provider-capabilities';
import {
  CEREBRAS_LLAMA_DEPRECATION_DATE,
  getCerebrasModelPolicy,
  isCerebrasModelExpiredByDate,
} from '../ai-sdk/provider-model-policy';
import {
  __resetProviderRetryBudgetForTests,
  consumeProviderRetryBudget,
  DEFAULT_PROVIDER_FALLBACK_CONTROL,
  getProviderFallbackDelay,
} from './provider-fallback-control';
import {
  markProviderQuotaCooldown,
  reconcileProviderQuotaReservation,
  reserveProviderQuota,
  type ProviderQuotaReservation,
} from './quota-tracker';
import { getAvailableProviders } from './retry-provider-chain';
import {
  createAttemptAbortController,
  estimateContextTokens,
  FALLBACK_ERROR_CODES,
  getBackoffDelay,
  isProviderRateLimitError,
  RETRY_ERROR_CODES,
  SHORT_CONTEXT_LIMIT_TOKENS,
  shouldFallback,
  shouldRetry,
  sleep,
} from './retry-with-fallback-utils';

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
  /** Base delay before switching providers */
  fallbackDelayMs: number;
  /** Additional jitter (0..N ms) before switching providers */
  fallbackJitterMs: number;
  /** Process-wide retry/fallback budget per minute (anti-amplification guard) */
  retryBudgetPerMinute: number;
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
  toolChoice?: Parameters<typeof generateText>[0]['toolChoice'];
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  stopWhen?: Parameters<typeof generateText>[0]['stopWhen'];
  abortSignal?: AbortSignal;
  requiredCapabilities?: ModelCapabilityRequirements;
  providerModelIds?: Partial<Record<ProviderName, string[]>>;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  ...DEFAULT_PROVIDER_FALLBACK_CONTROL,
  timeoutMs: 60000,
};

export const CEREBRAS_GPT_OSS_MIN_OUTPUT_TOKENS = 128;

export function resolveProviderMaxOutputTokens(
  provider: ProviderName,
  modelId: string,
  requestedTokens: number
): number {
  if (
    provider === 'cerebras' &&
    modelId.toLowerCase().includes('gpt-oss') &&
    requestedTokens < CEREBRAS_GPT_OSS_MIN_OUTPUT_TOKENS
  ) {
    return CEREBRAS_GPT_OSS_MIN_OUTPUT_TOKENS;
  }

  return requestedTokens;
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
  preferredOrder: ProviderName[] = ['groq', 'zai', 'mistral', 'cerebras'],
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<Awaited<ReturnType<typeof generateText>>>> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  const attempts: ProviderAttempt[] = [];
  const excludedProviders: ProviderName[] = [];
  const estimatedContextTokens = estimateContextTokens(options);
  const minContextTokens =
    estimatedContextTokens > SHORT_CONTEXT_LIMIT_TOKENS
      ? estimatedContextTokens
      : undefined;

  let currentProviderIndex = 0;
  const MAX_ITERATIONS = preferredOrder.length * (fullConfig.maxRetries + 1) + 1;
  let iterations = 0;

  while (iterations++ < MAX_ITERATIONS) {
    const availableProviders = getAvailableProviders(preferredOrder, excludedProviders);

    if (availableProviders.length === 0) {
      // All providers exhausted
      logger.error('[RetryWithFallback] All providers exhausted');
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
    const { name: provider, getModel } = providerConfig;
    const configuredModelIds =
      options.providerModelIds?.[provider]?.filter(Boolean) ??
      providerConfig.modelIds();

    const modelIds =
      provider === 'cerebras'
        ? configuredModelIds.filter((modelId) => {
            if (!isCerebrasModelExpiredByDate(modelId)) {
              return true;
            }

            const policy = getCerebrasModelPolicy(modelId);
            attempts.push({
              provider,
              modelId,
              attempt: 1,
              error: `CEREBRAS_DEPRECATED:${policy.deprecationDate ?? CEREBRAS_LLAMA_DEPRECATION_DATE}`,
              durationMs: 0,
            });
            logger.warn(
              `[RetryWithFallback] Skipping cerebras/${modelId}: past deprecation date ${policy.deprecationDate}`
            );
            return false;
          })
        : configuredModelIds;

    if (provider === 'cerebras' && modelIds.length === 0) {
      logger.warn(
        '[RetryWithFallback] Skipping cerebras: all configured models are past deprecation date'
      );
      excludedProviders.push(provider);
      continue;
    }

    for (let modelIndex = 0; modelIndex < modelIds.length; modelIndex++) {
      const modelId = modelIds[modelIndex];
      const hasNextModel = modelIndex < modelIds.length - 1;
      let retryCount = 0;

      while (retryCount <= fullConfig.maxRetries) {
        const attemptStart = Date.now();
        let quotaReservation: ProviderQuotaReservation | null = null;

        const requiredMinContextTokens = Math.max(
          options.requiredCapabilities?.minContextTokens ?? 0,
          minContextTokens ?? 0
        );
        const capabilityRequirements: ModelCapabilityRequirements = {
          ...options.requiredCapabilities,
          ...(options.tools ? { requireToolCalling: true } : {}),
          ...(requiredMinContextTokens > 0
            ? { minContextTokens: requiredMinContextTokens }
            : {}),
        };
        const capabilityMismatches = getCapabilityMismatchReasons(
          getTextProviderCapabilities(provider, modelId),
          capabilityRequirements
        );

        if (capabilityMismatches.length > 0) {
          attempts.push({
            provider,
            modelId,
            attempt: retryCount + 1,
            error: `Missing required capabilities: ${capabilityMismatches.join(', ')}`,
            durationMs: Date.now() - attemptStart,
          });
          logger.warn(
            `[RetryWithFallback] Skipping ${provider}/${modelId}: missing ${capabilityMismatches.join(', ')}`
          );
          excludedProviders.push(provider);
          break;
        }

        try {
          quotaReservation = await reserveProviderQuota(
            provider,
            estimatedContextTokens,
            modelId
          );

          if (!quotaReservation.reserved) {
            attempts.push({
              provider,
              modelId,
              attempt: retryCount + 1,
              error: `QUOTA_ADMISSION:${quotaReservation.reason ?? 'unknown'}`,
              durationMs: Date.now() - attemptStart,
            });
            logger.info(
              `[RetryWithFallback] Skipping ${provider}/${modelId}: quota admission ${quotaReservation.reason ?? 'blocked'}`
            );
            if (!hasNextModel) {
              excludedProviders.push(provider);
            }
            break;
          }

          logger.info(
            `[RetryWithFallback] Trying ${provider}/${modelId} (attempt ${retryCount + 1}/${fullConfig.maxRetries + 1})`
          );

          const model = getModel(modelId);
          const maxOutputTokens = resolveProviderMaxOutputTokens(
            provider,
            modelId,
            options.maxOutputTokens ?? 2048
          );

          const attemptAbort = createAttemptAbortController(
            fullConfig.timeoutMs,
            options.abortSignal
          );

          // Execute with timeout. Provider-level retry/fallback is managed here so
          // upstream 429/queue pressure does not get amplified by nested SDK retries.
          // 🎯 P2-2: Native timeout as primary + Promise.race as backup for full control
          let result: Awaited<ReturnType<typeof generateText>>;
          try {
            result = await Promise.race([
              generateText({
                model,
                messages: options.messages,
                tools: options.tools,
                ...(options.toolChoice && { toolChoice: options.toolChoice }),
                temperature: options.temperature ?? 0.2,
                ...(options.topP !== undefined && { topP: options.topP }),
                maxOutputTokens,
                maxRetries: 0, // Provider fallback is handled here; avoid retry amplification on 429/queue_exceeded.
                abortSignal: attemptAbort.signal,
                timeout: { totalMs: fullConfig.timeoutMs }, // 🎯 P2-2: Native timeout
                ...(options.stopWhen && { stopWhen: options.stopWhen }),
              }),
              attemptAbort.timeoutPromise,
              ...(attemptAbort.externalAbortPromise
                ? [attemptAbort.externalAbortPromise]
                : []),
            ]);
          } finally {
            attemptAbort.cleanup();
          }

          const durationMs = Date.now() - attemptStart;

          attempts.push({
            provider,
            modelId,
            attempt: retryCount + 1,
            durationMs,
          });

          logger.info(
            `[RetryWithFallback] ${provider} succeeded in ${durationMs}ms`
          );
          await reconcileProviderQuotaReservation(
            quotaReservation,
            result.usage?.totalTokens ?? estimatedContextTokens
          );

          return {
            success: true,
            result,
            provider,
            modelId,
            attempts,
            totalDurationMs: Date.now() - startTime,
            usedFallback: excludedProviders.length > 0 || attempts.length > 1,
          };
        } catch (error) {
          const durationMs = Date.now() - attemptStart;
          const errorMessage = error instanceof Error ? error.message : String(error);
          await reconcileProviderQuotaReservation(quotaReservation, 0);

          attempts.push({
            provider,
            modelId,
            attempt: retryCount + 1,
            error: errorMessage,
            durationMs,
          });

          logger.warn(
            `[RetryWithFallback] ${provider}/${modelId} failed (attempt ${retryCount + 1}): ${errorMessage}`
          );

          // Check if should fallback to next model/provider
          if (shouldFallback(error)) {
            if (isProviderRateLimitError(error)) {
              await markProviderQuotaCooldown(provider, modelId, errorMessage);
            }
            const skipRemainingProviderModels = isProviderRateLimitError(error);
            if (
              !consumeProviderRetryBudget(
                fullConfig,
                `fallback:${provider}`,
                'RetryWithFallback'
              )
            ) {
              return {
                success: false,
                provider,
                modelId,
                attempts,
                totalDurationMs: Date.now() - startTime,
                usedFallback: excludedProviders.length > 0 || attempts.length > 1,
              };
            }
            const delay = getProviderFallbackDelay(fullConfig);
            logger.info(
              `[RetryWithFallback] Rate limit/unavailable, switching ${
                hasNextModel && !skipRemainingProviderModels ? 'model' : 'provider'
              } after ${delay}ms...`
            );
            await sleep(delay);
            if (!hasNextModel || skipRemainingProviderModels) {
              excludedProviders.push(provider);
            }
            break; // Exit retry loop, try next model/provider
          }

          // Check if should retry same provider/model
          if (shouldRetry(error) && retryCount < fullConfig.maxRetries) {
            if (
              !consumeProviderRetryBudget(
                fullConfig,
                `retry:${provider}`,
                'RetryWithFallback'
              )
            ) {
              return {
                success: false,
                provider,
                modelId,
                attempts,
                totalDurationMs: Date.now() - startTime,
                usedFallback: excludedProviders.length > 0 || attempts.length > 1,
              };
            }
            const delay = getBackoffDelay(retryCount, fullConfig);
            logger.info(`[RetryWithFallback] Retrying ${provider}/${modelId} in ${delay}ms...`);
            await sleep(delay);
            retryCount++;
            continue;
          }

          // Non-retryable error - try next model/provider
          if (
            !consumeProviderRetryBudget(
              fullConfig,
              `next-provider:${provider}`,
              'RetryWithFallback'
            )
          ) {
            return {
              success: false,
              provider,
              modelId,
              attempts,
              totalDurationMs: Date.now() - startTime,
              usedFallback: excludedProviders.length > 0 || attempts.length > 1,
            };
          }
          const delay = getProviderFallbackDelay(fullConfig);
          logger.info(
            `[RetryWithFallback] Non-retryable error, trying next ${hasNextModel ? 'model' : 'provider'} after ${delay}ms...`
          );
          await sleep(delay);
          if (!hasNextModel) {
            excludedProviders.push(provider);
          }
          break;
        }
      }

      if (excludedProviders.includes(provider)) break;
    }

    // If we've exhausted retries for this provider, it's already excluded
    currentProviderIndex++;
  }

  // Defensive return for theoretical loop-cap exhaustion.
  logger.error('[RetryWithFallback] Aborted due to max iteration guard');
  return {
    success: false,
    provider: preferredOrder[0] ?? 'cerebras',
    modelId: '',
    attempts,
    totalDurationMs: Date.now() - startTime,
    usedFallback: excludedProviders.length > 0,
  };
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

// test-only helper
export function __resetRetryBudgetForTests(): void {
  __resetProviderRetryBudgetForTests();
}
