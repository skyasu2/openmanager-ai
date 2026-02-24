/**
 * AI Provider Quota Tracker (Cloud Run)
 *
 * 각 Provider의 사용량을 추적하고 Rate Limit 예측 전환 지원
 * - 실시간 사용량 추적 (토큰, 요청 수)
 * - 80% 임계값 도달 시 사전 전환 (Pre-emptive Fallback)
 * - Redis 기반 분산 상태 관리
 *
 * @see src/lib/ai/quota/provider-quota-tracker.ts (Vercel 버전)
 * @note 두 파일은 동일한 로직, 다른 Redis 클라이언트 사용 (ioredis vs @upstash/redis)
 *
 * @version 1.1.0
 * @created 2026-01-04
 * @updated 2026-01-27 - Gemini Vision Agent 쿼터 추가
 */

import { getRedisClient } from '../../lib/redis-client';
import { logger } from '../../lib/logger';

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
// Provider Quota 설정 (2026-01-27 기준)
// ============================================================================

export const PROVIDER_QUOTAS: Record<ProviderName, ProviderQuota> = {
  cerebras: {
    dailyTokenLimit: 24_000_000,
    requestsPerMinute: 60,
    tokensPerMinute: 60_000,
    requestsPerDay: 1_000_000,
  },
  groq: {
    dailyTokenLimit: 100_000,
    requestsPerMinute: 30,
    tokensPerMinute: 12_000,
    requestsPerDay: 1_000,
  },
  mistral: {
    dailyTokenLimit: 1_000_000,
    requestsPerMinute: 30,
    tokensPerMinute: 30_000,
    requestsPerDay: 500,
  },
  /**
   * Gemini Flash-Lite (Vision Agent)
   * @see https://ai.google.dev/gemini-api/docs/models/gemini
   * @added 2026-01-27
   *
   * Free Tier Limits:
   * - 1,000 RPD (requests per day)
   * - 15 RPM (requests per minute)
   * - 250,000 TPM (tokens per minute)
   * - 1M context window
   */
  gemini: {
    dailyTokenLimit: 250_000 * 60 * 24, // TPM * 60min * 24h (theoretical max)
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

const inMemoryUsage = new Map<ProviderName, ProviderUsage>();

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

function getRedisKey(provider: ProviderName): string {
  const today = new Date().toISOString().split('T')[0];
  return `ai:quota:${provider}:${today}`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Provider 사용량 조회
 */
export async function getProviderUsage(
  provider: ProviderName
): Promise<ProviderUsage> {
  const redis = getRedisClient();
  const today = new Date().toISOString().split('T')[0];

  if (redis) {
    try {
      const key = getRedisKey(provider);
      const data = await redis.get(key);

      if (data) {
        const usage = typeof data === 'string' ? JSON.parse(data) : data;

        if (usage.date !== today) {
          const reset = getDefaultUsage();
          await redis.set(key, JSON.stringify(reset));
          await redis.expire(key, 86400);
          return reset;
        }

        const now = Date.now();
        if (now - usage.lastMinuteReset > 60_000) {
          usage.minuteRequests = 0;
          usage.minuteTokens = 0;
          usage.lastMinuteReset = now;
          await redis.set(key, JSON.stringify(usage));
        }

        return usage;
      }

      const usage = getDefaultUsage();
      await redis.set(key, JSON.stringify(usage));
      await redis.expire(key, 86400);
      return usage;
    } catch (error) {
      logger.warn(`[QuotaTracker] Redis error for ${provider}:`, error);
    }
  }

  // In-Memory Fallback
  let usage = inMemoryUsage.get(provider);
  if (!usage || usage.date !== today) {
    usage = getDefaultUsage();
    inMemoryUsage.set(provider, usage);
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
  tokensUsed: number
): Promise<void> {
  const redis = getRedisClient();
  const usage = await getProviderUsage(provider);

  usage.dailyTokens += tokensUsed;
  usage.minuteRequests += 1;
  usage.minuteTokens += tokensUsed;
  usage.lastUpdated = Date.now();

  if (redis) {
    try {
      const key = getRedisKey(provider);
      await redis.set(key, JSON.stringify(usage));
      await redis.expire(key, 86400);
    } catch (error) {
      logger.warn(`[QuotaTracker] Redis save error for ${provider}:`, error);
    }
  }

  inMemoryUsage.set(provider, usage);

  // 로깅
  const quota = PROVIDER_QUOTAS[provider];
  const dailyRate = (usage.dailyTokens / quota.dailyTokenLimit) * 100;
  logger.info(
    `[QuotaTracker] ${provider}: +${tokensUsed} tokens (daily: ${dailyRate.toFixed(1)}%)`
  );
}

/**
 * Provider Quota 상태 조회
 */
export async function getQuotaStatus(
  provider: ProviderName
): Promise<QuotaStatus> {
  const usage = await getProviderUsage(provider);
  const quota = PROVIDER_QUOTAS[provider];

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
  preferredOrder: LLMProviderName[] = ['cerebras', 'mistral', 'groq']
): Promise<{
  provider: LLMProviderName;
  status: QuotaStatus;
  isPreemptiveFallback: boolean;
} | null> {
  for (const provider of preferredOrder) {
    const status = await getQuotaStatus(provider);

    if (!status.shouldPreemptiveFallback) {
      return { provider, status, isPreemptiveFallback: false };
    }

    if (status.dailyTokenUsageRate >= 0.95) {
      logger.info(
        `[QuotaTracker] ${provider}: Daily limit 95% exceeded, switching`
      );
      continue;
    }

    if (status.recommendedWaitMs && status.recommendedWaitMs < 30_000) {
      logger.info(
        `[QuotaTracker] ${provider}: Rate limit approaching, wait ${status.recommendedWaitMs}ms`
      );
      return { provider, status, isPreemptiveFallback: true };
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
  const statuses = await Promise.all(providers.map(getQuotaStatus));

  let healthyCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  for (const status of statuses) {
    if (status.dailyTokenUsageRate >= 0.95) {
      criticalCount++;
    } else if (status.shouldPreemptiveFallback) {
      warningCount++;
    } else {
      healthyCount++;
    }
  }

  return {
    providers: statuses,
    healthyCount,
    warningCount,
    criticalCount,
  };
}
