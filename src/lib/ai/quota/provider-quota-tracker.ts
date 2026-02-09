/**
 * AI Provider Quota Tracker (Vercel)
 *
 * 각 Provider의 사용량을 추적하고 Rate Limit 예측 전환 지원
 * - 실시간 사용량 추적 (토큰, 요청 수)
 * - 80% 임계값 도달 시 사전 전환 (Pre-emptive Fallback)
 * - Redis 기반 분산 상태 관리
 *
 * @see cloud-run/ai-engine/src/services/resilience/quota-tracker.ts (Cloud Run 버전)
 * @note 두 파일은 동일한 로직, 다른 Redis 클라이언트 사용 (@upstash/redis vs ioredis)
 *
 * @version 1.0.0
 * @created 2026-01-04
 */

import { logger } from '@/lib/logging';
import { getRedisClient, isRedisEnabled } from '@/lib/redis/client';

// ============================================================================
// Types
// ============================================================================

export type ProviderName = 'cerebras' | 'groq' | 'mistral' | 'openrouter';

export interface ProviderQuota {
  /** 일일 토큰 한도 */
  dailyTokenLimit: number;
  /** 분당 요청 한도 (RPM) */
  requestsPerMinute: number;
  /** 분당 토큰 한도 (TPM) */
  tokensPerMinute: number;
  /** 일일 요청 한도 (RPD) */
  requestsPerDay?: number;
}

export interface ProviderUsage {
  /** 오늘 사용한 토큰 */
  dailyTokens: number;
  /** 현재 분 요청 수 */
  minuteRequests: number;
  /** 현재 분 토큰 */
  minuteTokens: number;
  /** 마지막 업데이트 타임스탬프 */
  lastUpdated: number;
  /** 마지막 분 리셋 시각 */
  lastMinuteReset: number;
  /** 오늘 날짜 (YYYY-MM-DD) */
  date: string;
}

export interface QuotaStatus {
  provider: ProviderName;
  usage: ProviderUsage;
  quota: ProviderQuota;
  /** 일일 토큰 사용률 (0-1) */
  dailyTokenUsageRate: number;
  /** 분당 요청 사용률 (0-1) */
  minuteRequestUsageRate: number;
  /** 분당 토큰 사용률 (0-1) */
  minuteTokenUsageRate: number;
  /** 사전 전환 필요 여부 */
  shouldPreemptiveFallback: boolean;
  /** 권장 대기 시간 (ms) */
  recommendedWaitMs?: number;
}

// ============================================================================
// Provider Quota 설정 (2026-01-04 기준)
// ============================================================================

export const PROVIDER_QUOTAS: Record<ProviderName, ProviderQuota> = {
  cerebras: {
    dailyTokenLimit: 24_000_000, // 24M tokens/day
    requestsPerMinute: 60,
    tokensPerMinute: 60_000, // 60K TPM
    requestsPerDay: 1_000_000, // 실질적 무제한
  },
  groq: {
    dailyTokenLimit: 100_000, // ~100K tokens/day (free tier)
    requestsPerMinute: 30,
    tokensPerMinute: 12_000, // 12K TPM
    requestsPerDay: 1_000,
  },
  mistral: {
    dailyTokenLimit: 1_000_000, // Limited free tier
    requestsPerMinute: 30,
    tokensPerMinute: 30_000,
    requestsPerDay: 500,
  },
  openrouter: {
    dailyTokenLimit: 10_000_000, // Free tier models
    requestsPerMinute: 20,
    tokensPerMinute: 20_000,
    requestsPerDay: 50, // 일부 free 모델 제한
  },
};

// ============================================================================
// Pre-emptive Fallback 임계값
// ============================================================================

export const PREEMPTIVE_THRESHOLDS = {
  /** 일일 토큰 임계값 (80%) */
  dailyTokenThreshold: 0.8,
  /** 분당 요청 임계값 (85%) */
  minuteRequestThreshold: 0.85,
  /** 분당 토큰 임계값 (85%) */
  minuteTokenThreshold: 0.85,
  /** 안전 마진 (ms) - Rate Limit 직전 대기 */
  safetyMarginMs: 2000,
} as const;

// ============================================================================
// In-Memory Fallback (Redis 장애 시)
// ============================================================================

const inMemoryUsage = new Map<ProviderName, ProviderUsage>();

function getDefaultUsage(): ProviderUsage {
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0] ?? '';
  return {
    dailyTokens: 0,
    minuteRequests: 0,
    minuteTokens: 0,
    lastUpdated: now,
    lastMinuteReset: now,
    date: today,
  };
}

// ============================================================================
// Redis Keys
// ============================================================================

function getRedisKey(provider: ProviderName): string {
  const today = new Date().toISOString().split('T')[0] ?? '';
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
  const today = new Date().toISOString().split('T')[0] ?? '';

  // Redis 사용 가능 시
  if (redis && isRedisEnabled()) {
    try {
      const key = getRedisKey(provider);
      const data = await redis.get<ProviderUsage>(key);

      if (data) {
        // 날짜 변경 시 리셋
        if (data.date !== today) {
          const reset = getDefaultUsage();
          await redis.set(key, reset, { ex: 86400 }); // 24시간 TTL
          return reset;
        }

        // 분 변경 시 분당 카운터 리셋
        const now = Date.now();
        if (now - data.lastMinuteReset > 60_000) {
          data.minuteRequests = 0;
          data.minuteTokens = 0;
          data.lastMinuteReset = now;
          await redis.set(key, data, { ex: 86400 });
        }

        return data;
      }

      // 신규 생성
      const usage = getDefaultUsage();
      await redis.set(key, usage, { ex: 86400 });
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

  // 분 리셋
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

  // 사용량 업데이트
  usage.dailyTokens += tokensUsed;
  usage.minuteRequests += 1;
  usage.minuteTokens += tokensUsed;
  usage.lastUpdated = Date.now();

  // Redis 저장
  if (redis && isRedisEnabled()) {
    try {
      const key = getRedisKey(provider);
      await redis.set(key, usage, { ex: 86400 });
    } catch (error) {
      logger.warn(`[QuotaTracker] Redis save error for ${provider}:`, error);
    }
  }

  // In-Memory 업데이트 (항상)
  inMemoryUsage.set(provider, usage);

  // 로깅 (개발 환경)
  if (process.env.NODE_ENV === 'development') {
    const quota = PROVIDER_QUOTAS[provider];
    const dailyRate = (usage.dailyTokens / quota.dailyTokenLimit) * 100;
    logger.info(
      `[QuotaTracker] ${provider}: ${tokensUsed} tokens (daily: ${dailyRate.toFixed(1)}%)`
    );
  }
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

  // Pre-emptive Fallback 판단
  const shouldPreemptiveFallback =
    dailyTokenUsageRate >= PREEMPTIVE_THRESHOLDS.dailyTokenThreshold ||
    minuteRequestUsageRate >= PREEMPTIVE_THRESHOLDS.minuteRequestThreshold ||
    minuteTokenUsageRate >= PREEMPTIVE_THRESHOLDS.minuteTokenThreshold;

  // 권장 대기 시간 계산
  let recommendedWaitMs: number | undefined;
  if (
    minuteRequestUsageRate >= PREEMPTIVE_THRESHOLDS.minuteRequestThreshold ||
    minuteTokenUsageRate >= PREEMPTIVE_THRESHOLDS.minuteTokenThreshold
  ) {
    // 분 리셋까지 남은 시간
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
 * 모든 Provider Quota 상태 조회
 */
export async function getAllQuotaStatus(): Promise<QuotaStatus[]> {
  const providers = Object.keys(PROVIDER_QUOTAS) as ProviderName[];
  return Promise.all(providers.map(getQuotaStatus));
}

/**
 * 사용 가능한 최적 Provider 선택 (Pre-emptive Fallback 적용)
 *
 * @param preferredOrder 선호 순서 (기본: cerebras → mistral → openrouter)
 * @returns 사용 가능한 Provider 또는 null
 */
export async function selectAvailableProvider(
  preferredOrder: ProviderName[] = ['cerebras', 'mistral', 'openrouter']
): Promise<{
  provider: ProviderName;
  status: QuotaStatus;
  isPreemptiveFallback: boolean;
} | null> {
  for (const provider of preferredOrder) {
    const status = await getQuotaStatus(provider);

    // 사전 전환 불필요 → 즉시 사용
    if (!status.shouldPreemptiveFallback) {
      return {
        provider,
        status,
        isPreemptiveFallback: false,
      };
    }

    // 일일 한도 초과 → 다음 Provider로
    if (status.dailyTokenUsageRate >= 0.95) {
      logger.info(
        `[QuotaTracker] ${provider}: 일일 한도 95% 초과, 다음 Provider로 전환`
      );
      continue;
    }

    // 분당 한도 임박 → 대기 또는 전환
    if (status.recommendedWaitMs && status.recommendedWaitMs < 30_000) {
      logger.info(
        `[QuotaTracker] ${provider}: 분당 한도 임박, ${status.recommendedWaitMs}ms 대기 권장`
      );
      // 짧은 대기면 해당 Provider 사용 (호출자가 대기 처리)
      return {
        provider,
        status,
        isPreemptiveFallback: true,
      };
    }
  }

  // 모든 Provider 한도 초과
  logger.warn('[QuotaTracker] 모든 Provider 한도 초과');
  return null;
}

/**
 * Provider 사용량 리셋 (테스트/관리용)
 */
export async function resetProviderUsage(
  provider: ProviderName
): Promise<void> {
  const redis = getRedisClient();
  const usage = getDefaultUsage();

  if (redis && isRedisEnabled()) {
    try {
      const key = getRedisKey(provider);
      await redis.set(key, usage, { ex: 86400 });
    } catch (error) {
      logger.warn(`[QuotaTracker] Redis reset error for ${provider}:`, error);
    }
  }

  inMemoryUsage.set(provider, usage);
}

/**
 * Quota 상태 요약 (대시보드용)
 */
export async function getQuotaSummary(): Promise<{
  providers: QuotaStatus[];
  healthyProviders: ProviderName[];
  warningProviders: ProviderName[];
  criticalProviders: ProviderName[];
  recommendedProvider: ProviderName | null;
}> {
  const providers = await getAllQuotaStatus();

  const healthyProviders: ProviderName[] = [];
  const warningProviders: ProviderName[] = [];
  const criticalProviders: ProviderName[] = [];

  for (const status of providers) {
    if (status.dailyTokenUsageRate >= 0.95) {
      criticalProviders.push(status.provider);
    } else if (status.shouldPreemptiveFallback) {
      warningProviders.push(status.provider);
    } else {
      healthyProviders.push(status.provider);
    }
  }

  const selection = await selectAvailableProvider();

  return {
    providers,
    healthyProviders,
    warningProviders,
    criticalProviders,
    recommendedProvider: selection?.provider ?? null,
  };
}
