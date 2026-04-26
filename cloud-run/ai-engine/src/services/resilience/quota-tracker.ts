/**
 * AI Provider Quota Tracker (Cloud Run)
 *
 * 각 Provider의 사용량을 추적하고 Rate Limit 예측 전환 지원
 * - 실시간 사용량 추적 (토큰, 요청 수)
 * - 80% 임계값 도달 시 사전 전환 (Pre-emptive Fallback)
 * - Redis 기반 분산 상태 관리
 *
 * @version 1.2.0
 * @created 2026-01-04
 * @updated 2026-03-06 - Groq/Gemini/Cerebras 수치 공식 문서 기준 교정
 */

import { getRedisClient } from '../../lib/redis-client';
import { logger } from '../../lib/logger';
import {
  getCerebrasFallbackModelIds,
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  CEREBRAS_QWEN_MODEL_ID,
  getCerebrasModelId,
} from '../../lib/config-parser';

// ============================================================================
// Types
// ============================================================================

/** LLM Provider 이름 (모델 선택용) */
export type LLMProviderName = 'cerebras' | 'groq' | 'mistral' | 'gemini';

/** 전체 Provider 이름 (LLM + 외부 API) */
export type ProviderName = LLMProviderName | 'tavily';

export interface ProviderQuota {
  dailyTokenLimit: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
}

export type CerebrasQuotaModelId =
  | typeof CEREBRAS_QWEN_MODEL_ID
  | typeof CEREBRAS_LLAMA_FALLBACK_MODEL_ID;

export interface ProviderUsage {
  dailyTokens: number;
  minuteRequests: number;
  minuteTokens: number;
  lastUpdated: number;
  lastMinuteReset: number;
  date: string;
}

export interface QuotaStatus {
  provider: ProviderName;
  usage: ProviderUsage;
  quota: ProviderQuota;
  dailyTokenUsageRate: number;
  minuteRequestUsageRate: number;
  minuteTokenUsageRate: number;
  shouldPreemptiveFallback: boolean;
  recommendedWaitMs?: number;
}

// ============================================================================
// Provider Quota 설정 (Free-tier production guard 기준)
// ============================================================================

export const CEREBRAS_MODEL_QUOTAS: Record<CerebrasQuotaModelId, ProviderQuota> = {
  /**
   * Account Limits screen 기준. 공식 Free tier 표보다 계정별 제한을 우선한다.
   */
  [CEREBRAS_QWEN_MODEL_ID]: {
    dailyTokenLimit: 1_000_000,
    requestsPerMinute: 5,
    tokensPerMinute: 30_000,
    requestsPerDay: 14_400,
  },
  [CEREBRAS_LLAMA_FALLBACK_MODEL_ID]: {
    dailyTokenLimit: 1_000_000,
    requestsPerMinute: 30,
    tokensPerMinute: 60_000,
    requestsPerDay: 14_400,
  },
};

export const PROVIDER_QUOTAS: Record<ProviderName, ProviderQuota> = {
  /**
   * Cerebras primary model quota. Use getQuotaForProvider(provider, modelId)
   * for model-aware fallback checks.
   * @see https://inference-docs.cerebras.ai/support/rate-limits
   * @updated 2026-04-26
   *
   * - Qwen account limit: 1M TPD, 30K TPM, 5 RPM, 14.4K RPD
   * - Context/capability lives in provider-model-metadata; this tracker only enforces usage quotas.
   */
  cerebras: CEREBRAS_MODEL_QUOTAS[CEREBRAS_QWEN_MODEL_ID],
  /**
   * Groq Free Tier (meta-llama/llama-4-scout-17b-16e-instruct)
   * @see https://console.groq.com/docs/rate-limits
   * @updated 2026-04-25 - Scout limit metadata refreshed against Groq docs
   *
   * - 500K TPD, 30K TPM, 30 RPM, 1K RPD
   * - Context: 131K tokens
   */
  groq: {
    dailyTokenLimit: 500_000,
    requestsPerMinute: 30,
    tokensPerMinute: 30_000,
    requestsPerDay: 1_000,
  },
  mistral: {
    dailyTokenLimit: 1_000_000,
    requestsPerMinute: 2, // Free Tier: ~1-2 RPM (모델별 상이)
    tokensPerMinute: 30_000,
    requestsPerDay: 500,
  },
  /**
   * Gemini 2.5 Flash-Lite (Vision Agent, default as of 2026-04-04)
   * @see https://ai.google.dev/gemini-api/docs/models/gemini
   * @updated 2026-04-04 - Flash → Flash-Lite 전환
   *   이유: flash는 thinking 토큰을 기본 소비(~24+/req) → max_tokens 낮으면 content 공백
   *         flash-lite는 thinking 없음, RPD 2배(1,000), RPM 1.5배(15)로 더 유리
   *
   * Free Tier Limits (gemini-2.5-flash-lite):
   * - 1,000 RPD, 15 RPM
   * - 250,000 TPM
   * Override: GEMINI_VISION_MODEL_ID=gemini-2.5-flash 로 flash 복귀 가능
   */
  gemini: {
    dailyTokenLimit: 250_000 * 60 * 24,
    requestsPerMinute: 15,
    tokensPerMinute: 250_000,
    requestsPerDay: 1_000,
  },
  /**
   * Tavily Web Search API
   * @see https://tavily.com/#pricing
   * @added 2026-02-01
   *
   * Free Tier Limits:
   * - 1,000 requests/month
   * - No RPM limit (but Circuit Breaker로 보호)
   * - Token 개념 없음 (request 단위 과금)
   */
  tavily: {
    dailyTokenLimit: Number.MAX_SAFE_INTEGER, // 토큰 기반 아님
    requestsPerMinute: 30, // soft limit (Circuit Breaker로 보호)
    tokensPerMinute: Number.MAX_SAFE_INTEGER,
    requestsPerDay: 33, // 1,000/month ≈ 33/day
  },
};

export function getQuotaForProvider(
  provider: ProviderName,
  modelId?: string
): ProviderQuota {
  if (provider !== 'cerebras') {
    return PROVIDER_QUOTAS[provider];
  }

  const effectiveModelId = modelId || getCerebrasModelId();
  if (
    effectiveModelId === CEREBRAS_QWEN_MODEL_ID ||
    effectiveModelId === CEREBRAS_LLAMA_FALLBACK_MODEL_ID
  ) {
    return CEREBRAS_MODEL_QUOTAS[effectiveModelId];
  }

  return CEREBRAS_MODEL_QUOTAS[CEREBRAS_QWEN_MODEL_ID];
}

function getQuotaModelCandidates(provider: LLMProviderName): (string | undefined)[] {
  if (provider !== 'cerebras') return [undefined];

  return [
    getCerebrasModelId(),
    ...getCerebrasFallbackModelIds(),
  ].filter((modelId, index, list) => modelId && list.indexOf(modelId) === index);
}

// ============================================================================
// Pre-emptive Fallback 임계값
// ============================================================================

export const PREEMPTIVE_THRESHOLDS = {
  dailyTokenThreshold: 0.8,
  minuteRequestThreshold: 0.85,
  minuteTokenThreshold: 0.85,
  safetyMarginMs: 2000,
} as const;

// ============================================================================
// In-Memory Storage (단일 인스턴스용)
// ============================================================================

const inMemoryUsage = new Map<string, ProviderUsage>();

function getDefaultUsage(): ProviderUsage {
  const now = Date.now();
  return {
    dailyTokens: 0,
    minuteRequests: 0,
    minuteTokens: 0,
    lastUpdated: now,
    lastMinuteReset: now,
    date: new Date().toISOString().split('T')[0],
  };
}

// ============================================================================
// Redis Keys
// ============================================================================

function getUsageScope(provider: ProviderName, modelId?: string): string {
  if (provider !== 'cerebras') return provider;

  const effectiveModelId = modelId || getCerebrasModelId();
  return `cerebras:${effectiveModelId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

function getRedisKey(provider: ProviderName, modelId?: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `ai:quota:${getUsageScope(provider, modelId)}:${today}`;
}

const REDIS_TIMEOUT_MS = 1_000;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Provider 사용량 조회
 */
export async function getProviderUsage(
  provider: ProviderName,
  modelId?: string
): Promise<ProviderUsage> {
  const redis = getRedisClient();
  const today = new Date().toISOString().split('T')[0];
  const usageScope = getUsageScope(provider, modelId);

  if (redis) {
    try {
      const key = getRedisKey(provider, modelId);
      const data = await redis.get(key, { timeoutMs: REDIS_TIMEOUT_MS });

      if (data) {
        const usage = typeof data === 'string' ? JSON.parse(data) : data;

        if (usage.date !== today) {
          const reset = getDefaultUsage();
          await redis.set(key, JSON.stringify(reset), undefined, {
            timeoutMs: REDIS_TIMEOUT_MS,
          });
          await redis.expire(key, 86400, { timeoutMs: REDIS_TIMEOUT_MS });
          return reset;
        }

        const now = Date.now();
        if (now - usage.lastMinuteReset > 60_000) {
          usage.minuteRequests = 0;
          usage.minuteTokens = 0;
          usage.lastMinuteReset = now;
          await redis.set(key, JSON.stringify(usage), undefined, {
            timeoutMs: REDIS_TIMEOUT_MS,
          });
        }

        return usage;
      }

      const usage = getDefaultUsage();
      await redis.set(key, JSON.stringify(usage), undefined, {
        timeoutMs: REDIS_TIMEOUT_MS,
      });
      await redis.expire(key, 86400, { timeoutMs: REDIS_TIMEOUT_MS });
      return usage;
    } catch (error) {
      logger.warn(`[QuotaTracker] Redis error for ${provider}:`, error);
    }
  }

  // In-Memory Fallback
  let usage = inMemoryUsage.get(usageScope);
  if (!usage || usage.date !== today) {
    usage = getDefaultUsage();
    inMemoryUsage.set(usageScope, usage);
  }

  const now = Date.now();
  if (now - usage.lastMinuteReset > 60_000) {
    usage.minuteRequests = 0;
    usage.minuteTokens = 0;
    usage.lastMinuteReset = now;
  }

  return usage;
}

/**
 * Provider 사용량 기록
 */
export async function recordProviderUsage(
  provider: ProviderName,
  tokensUsed: number,
  modelId?: string
): Promise<void> {
  const redis = getRedisClient();
  const usage = await getProviderUsage(provider, modelId);
  const usageScope = getUsageScope(provider, modelId);

  usage.dailyTokens += tokensUsed;
  usage.minuteRequests += 1;
  usage.minuteTokens += tokensUsed;
  usage.lastUpdated = Date.now();

  if (redis) {
    try {
      const key = getRedisKey(provider, modelId);
      await redis.set(key, JSON.stringify(usage), undefined, {
        timeoutMs: REDIS_TIMEOUT_MS,
      });
      await redis.expire(key, 86400, { timeoutMs: REDIS_TIMEOUT_MS });
    } catch (error) {
      logger.warn(`[QuotaTracker] Redis save error for ${provider}:`, error);
    }
  }

  inMemoryUsage.set(usageScope, usage);

  // 로깅
  const quota = getQuotaForProvider(provider, modelId);
  const dailyRate = (usage.dailyTokens / quota.dailyTokenLimit) * 100;
  logger.info(
    `[QuotaTracker] ${usageScope}: +${tokensUsed} tokens (daily: ${dailyRate.toFixed(1)}%)`
  );
}

/**
 * Provider Quota 상태 조회
 */
export async function getQuotaStatus(
  provider: ProviderName,
  modelId?: string
): Promise<QuotaStatus> {
  const usage = await getProviderUsage(provider, modelId);
  const quota = getQuotaForProvider(provider, modelId);

  const dailyTokenUsageRate = usage.dailyTokens / quota.dailyTokenLimit;
  const minuteRequestUsageRate = usage.minuteRequests / quota.requestsPerMinute;
  const minuteTokenUsageRate = usage.minuteTokens / quota.tokensPerMinute;

  const shouldPreemptiveFallback =
    dailyTokenUsageRate >= PREEMPTIVE_THRESHOLDS.dailyTokenThreshold ||
    minuteRequestUsageRate >= PREEMPTIVE_THRESHOLDS.minuteRequestThreshold ||
    minuteTokenUsageRate >= PREEMPTIVE_THRESHOLDS.minuteTokenThreshold;

  let recommendedWaitMs: number | undefined;
  if (
    minuteRequestUsageRate >= PREEMPTIVE_THRESHOLDS.minuteRequestThreshold ||
    minuteTokenUsageRate >= PREEMPTIVE_THRESHOLDS.minuteTokenThreshold
  ) {
    const msUntilMinuteReset = 60_000 - (Date.now() - usage.lastMinuteReset);
    recommendedWaitMs =
      Math.max(0, msUntilMinuteReset) + PREEMPTIVE_THRESHOLDS.safetyMarginMs;
  }

  return {
    provider,
    usage,
    quota,
    dailyTokenUsageRate,
    minuteRequestUsageRate,
    minuteTokenUsageRate,
    shouldPreemptiveFallback,
    recommendedWaitMs,
  };
}

/**
 * 사용 가능한 최적 Provider 선택 (Pre-emptive Fallback)
 */
export async function selectAvailableProvider(
  preferredOrder: LLMProviderName[] = ['groq', 'cerebras', 'mistral']
): Promise<{
  provider: LLMProviderName;
  modelId?: string;
  status: QuotaStatus;
  isPreemptiveFallback: boolean;
} | null> {
  let skippedByQuota = false;

  for (const provider of preferredOrder) {
    for (const modelId of getQuotaModelCandidates(provider)) {
      const status = await getQuotaStatus(provider, modelId);

      if (!status.shouldPreemptiveFallback) {
        return {
          provider,
          ...(modelId && { modelId }),
          status,
          isPreemptiveFallback: skippedByQuota,
        };
      }

      skippedByQuota = true;

      if (status.dailyTokenUsageRate >= 0.95) {
        logger.info(
          `[QuotaTracker] ${provider}${modelId ? `/${modelId}` : ''}: Daily limit 95% exceeded, switching`
        );
        continue;
      }

      if (status.recommendedWaitMs && status.recommendedWaitMs < 30_000) {
        logger.info(
          `[QuotaTracker] ${provider}${modelId ? `/${modelId}` : ''}: Rate limit approaching, wait ${status.recommendedWaitMs}ms`
        );
        continue;
      }
    }
  }

  logger.warn('[QuotaTracker] All providers at capacity');
  return null;
}

/**
 * 모든 Provider Quota 요약
 */
export async function getQuotaSummary(): Promise<{
  providers: QuotaStatus[];
  onlineCount: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
}> {
  const providers: ProviderName[] = [
    'cerebras',
    'groq',
    'mistral',
    'gemini',
    'tavily',
  ];
  const statuses = await Promise.all(
    providers.map((provider) => getQuotaStatus(provider))
  );

  let onlineCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  for (const status of statuses) {
    if (status.dailyTokenUsageRate >= 0.95) {
      criticalCount++;
    } else if (status.shouldPreemptiveFallback) {
      warningCount++;
    } else {
      onlineCount++;
    }
  }

  return {
    providers: statuses,
    onlineCount,
    healthyCount: onlineCount,
    warningCount,
    criticalCount,
  };
}
