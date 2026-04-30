/**
 * AI Provider Quota Tracker (Cloud Run)
 *
 * 각 Provider의 사용량을 추적하고 Rate Limit 예측 전환 지원
 * - 실시간 사용량 추적 (토큰, 요청 수)
 * - 80% 임계값 도달 시 사전 전환 (Pre-emptive Fallback)
 * - Redis 기반 분산 상태 관리
 *
 * @version 1.3.0
 * @created 2026-01-04
 * @updated 2026-05-01 - quota types, memory store, Redis store 분리
 */

import { isRedisDegraded } from '../../lib/redis-client';
import { logger } from '../../lib/logger';
import {
  PREEMPTIVE_THRESHOLDS,
  PROVIDER_COOLDOWN_MS,
  getQuotaForProvider,
  getQuotaModelCandidates,
  getQuotaUsageScope,
  type LLMProviderName,
  type ProviderName,
  type ProviderQuota,
  type ProviderQuotaReservation,
  type ProviderUsage,
  type QuotaAdmissionReason,
  type QuotaStatus,
} from './quota-types';
import {
  getDefaultUsage,
  getMemoryCooldown,
  getMemoryUsage,
  normalizeUsage,
  setMemoryCooldown,
  setMemoryUsage,
  withUsageLock,
} from './quota-store-memory';
import {
  getProviderCooldownFromRedis,
  readProviderUsageFromRedis,
  reconcileProviderQuotaInRedis,
  reserveProviderQuotaInRedis,
  saveProviderUsageToRedis,
  setProviderCooldownInRedis,
} from './quota-store-redis';

export {
  CEREBRAS_MODEL_QUOTAS,
  PREEMPTIVE_THRESHOLDS,
  PROVIDER_QUOTAS,
  getQuotaForProvider,
} from './quota-types';
export type {
  CerebrasQuotaModelId,
  LLMProviderName,
  ProviderName,
  ProviderQuota,
  ProviderQuotaReservation,
  ProviderUsage,
  QuotaAdmissionReason,
  QuotaStatus,
} from './quota-types';

function buildQuotaStatus(
  provider: ProviderName,
  usage: ProviderUsage,
  quota: ProviderQuota
): QuotaStatus {
  const dailyTokenUsageRate = usage.dailyTokens / quota.dailyTokenLimit;
  const dailyRequestUsageRate = quota.requestsPerDay
    ? usage.dailyRequests / quota.requestsPerDay
    : 0;
  const minuteRequestUsageRate = usage.minuteRequests / quota.requestsPerMinute;
  const minuteTokenUsageRate = usage.minuteTokens / quota.tokensPerMinute;

  const shouldPreemptiveFallback =
    dailyTokenUsageRate >= PREEMPTIVE_THRESHOLDS.dailyTokenThreshold ||
    dailyRequestUsageRate >= PREEMPTIVE_THRESHOLDS.dailyRequestThreshold ||
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
    dailyRequestUsageRate,
    minuteRequestUsageRate,
    minuteTokenUsageRate,
    shouldPreemptiveFallback,
    recommendedWaitMs,
  };
}

async function saveProviderUsage(
  provider: ProviderName,
  usage: ProviderUsage,
  modelId?: string
): Promise<void> {
  await saveProviderUsageToRedis(provider, usage, modelId);
  setMemoryUsage(provider, usage, modelId);
}

async function getProviderCooldown(
  provider: ProviderName,
  modelId?: string
): Promise<{ until: number; reason: string } | null> {
  const inMemory = getMemoryCooldown(provider, modelId);
  if (inMemory) return inMemory;

  const redisCooldown = await getProviderCooldownFromRedis(provider, modelId);
  if (redisCooldown) {
    setMemoryCooldown(provider, redisCooldown, modelId);
  }

  return redisCooldown;
}

function getProjectedAdmissionReason(
  usage: ProviderUsage,
  quota: ProviderQuota,
  estimatedTokens: number
): QuotaAdmissionReason | null {
  const projectedDailyTokens = usage.dailyTokens + estimatedTokens;
  const projectedDailyRequests = usage.dailyRequests + 1;
  const projectedMinuteRequests = usage.minuteRequests + 1;
  const projectedMinuteTokens = usage.minuteTokens + estimatedTokens;

  if (projectedDailyTokens > quota.dailyTokenLimit) {
    return 'daily_token_limit';
  }
  if (quota.requestsPerDay && projectedDailyRequests > quota.requestsPerDay) {
    return 'daily_request_limit';
  }
  if (projectedMinuteRequests > quota.requestsPerMinute) {
    return 'minute_request_limit';
  }
  if (projectedMinuteTokens > quota.tokensPerMinute) {
    return 'minute_token_limit';
  }

  if (
    projectedDailyTokens / quota.dailyTokenLimit >=
    PREEMPTIVE_THRESHOLDS.dailyTokenThreshold
  ) {
    return 'daily_token_threshold';
  }
  if (
    quota.requestsPerDay &&
    projectedDailyRequests / quota.requestsPerDay >=
      PREEMPTIVE_THRESHOLDS.dailyRequestThreshold
  ) {
    return 'daily_request_threshold';
  }
  if (
    projectedMinuteRequests / quota.requestsPerMinute >=
    PREEMPTIVE_THRESHOLDS.minuteRequestThreshold
  ) {
    return 'minute_request_threshold';
  }
  if (
    projectedMinuteTokens / quota.tokensPerMinute >=
    PREEMPTIVE_THRESHOLDS.minuteTokenThreshold
  ) {
    return 'minute_token_threshold';
  }

  return null;
}

/**
 * Provider 사용량 조회
 */
export async function getProviderUsage(
  provider: ProviderName,
  modelId?: string
): Promise<ProviderUsage> {
  const today = new Date().toISOString().split('T')[0];
  const redisUsage = await readProviderUsageFromRedis(provider, modelId);

  if (redisUsage) {
    if (redisUsage.date !== today) {
      const reset = getDefaultUsage();
      await saveProviderUsage(provider, reset, modelId);
      return reset;
    }

    const now = Date.now();
    if (now - redisUsage.lastMinuteReset > 60_000) {
      redisUsage.minuteRequests = 0;
      redisUsage.minuteTokens = 0;
      redisUsage.lastMinuteReset = now;
      await saveProviderUsage(provider, redisUsage, modelId);
    } else {
      setMemoryUsage(provider, redisUsage, modelId);
    }

    return redisUsage;
  }

  let usage = normalizeUsage(getMemoryUsage(provider, modelId));
  if (usage.date !== today) {
    usage = getDefaultUsage();
    setMemoryUsage(provider, usage, modelId);
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
  const usage = await getProviderUsage(provider, modelId);
  const usageScope = getQuotaUsageScope(provider, modelId);

  usage.dailyTokens += tokensUsed;
  usage.dailyRequests += 1;
  usage.minuteRequests += 1;
  usage.minuteTokens += tokensUsed;
  usage.lastUpdated = Date.now();

  await saveProviderUsage(provider, usage, modelId);

  const quota = getQuotaForProvider(provider, modelId);
  const dailyRate = (usage.dailyTokens / quota.dailyTokenLimit) * 100;
  logger.info(
    `[QuotaTracker] ${usageScope}: +${tokensUsed} tokens (daily: ${dailyRate.toFixed(1)}%)`
  );
}

/**
 * Provider 호출 전 quota budget을 예약한다.
 *
 * 성공 시 minute/daily request 1회와 예상 token을 먼저 반영한다. 실제 사용량이
 * 확인되면 reconcileProviderQuotaReservation()으로 token delta만 보정한다.
 */
export async function reserveProviderQuota(
  provider: ProviderName,
  estimatedTokens: number,
  modelId?: string
): Promise<ProviderQuotaReservation> {
  const normalizedEstimate = Math.max(1, Math.ceil(estimatedTokens));
  const redisReservation = await reserveProviderQuotaInRedis(
    provider,
    normalizedEstimate,
    modelId
  );

  if (redisReservation) {
    if (redisReservation.status.usage) {
      setMemoryUsage(provider, redisReservation.status.usage, modelId);
    }
    return redisReservation;
  }

  if (isRedisDegraded()) {
    logger.warn(
      `[QuotaTracker] Redis degraded — using in-memory quota for ${getQuotaUsageScope(provider, modelId)}`
    );
  }

  return withUsageLock(provider, modelId, async () => {
    const cooldown = await getProviderCooldown(provider, modelId);
    const usage = await getProviderUsage(provider, modelId);
    const quota = getQuotaForProvider(provider, modelId);
    const status = buildQuotaStatus(provider, usage, quota);

    if (cooldown) {
      return {
        reserved: false,
        provider,
        ...(modelId && { modelId }),
        estimatedTokens: normalizedEstimate,
        status,
        reason: 'cooldown',
        cooldownUntil: cooldown.until,
        recommendedWaitMs: Math.max(0, cooldown.until - Date.now()),
      };
    }

    const reason = getProjectedAdmissionReason(
      usage,
      quota,
      normalizedEstimate
    );
    if (reason) {
      const recommendedWaitMs = reason.startsWith('minute_')
        ? Math.max(0, 60_000 - (Date.now() - usage.lastMinuteReset)) +
          PREEMPTIVE_THRESHOLDS.safetyMarginMs
        : status.recommendedWaitMs;
      logger.info(
        `[QuotaTracker] Admission skip ${getQuotaUsageScope(provider, modelId)} reason=${reason}`
      );
      return {
        reserved: false,
        provider,
        ...(modelId && { modelId }),
        estimatedTokens: normalizedEstimate,
        status,
        reason,
        recommendedWaitMs,
      };
    }

    usage.dailyTokens += normalizedEstimate;
    usage.dailyRequests += 1;
    usage.minuteRequests += 1;
    usage.minuteTokens += normalizedEstimate;
    usage.lastUpdated = Date.now();
    await saveProviderUsage(provider, usage, modelId);

    const reservedStatus = buildQuotaStatus(provider, usage, quota);
    return {
      reserved: true,
      provider,
      ...(modelId && { modelId }),
      estimatedTokens: normalizedEstimate,
      status: reservedStatus,
    };
  });
}

/**
 * 예약 token과 실제 token 사용량의 차이를 보정한다.
 * request count는 provider 호출 시도 자체를 보호하기 위해 유지한다.
 */
export async function reconcileProviderQuotaReservation(
  reservation: ProviderQuotaReservation | null | undefined,
  actualTokensUsed: number
): Promise<void> {
  if (!reservation?.reserved) return;

  const actualTokens = Math.max(0, Math.ceil(actualTokensUsed));
  const tokenDelta = actualTokens - reservation.estimatedTokens;
  if (tokenDelta === 0) return;

  const redisUsage = await reconcileProviderQuotaInRedis(
    reservation.provider,
    tokenDelta,
    reservation.modelId
  );
  if (redisUsage) {
    setMemoryUsage(reservation.provider, redisUsage, reservation.modelId);
    return;
  }

  await withUsageLock(reservation.provider, reservation.modelId, async () => {
    const usage = await getProviderUsage(reservation.provider, reservation.modelId);
    usage.dailyTokens = Math.max(0, usage.dailyTokens + tokenDelta);
    usage.minuteTokens = Math.max(0, usage.minuteTokens + tokenDelta);
    usage.lastUpdated = Date.now();
    await saveProviderUsage(reservation.provider, usage, reservation.modelId);
  });
}

export async function markProviderQuotaCooldown(
  provider: ProviderName,
  modelId: string | undefined,
  reason: string,
  durationMs = PROVIDER_COOLDOWN_MS
): Promise<void> {
  const until = Date.now() + Math.max(1_000, durationMs);
  const payload = { until, reason };
  setMemoryCooldown(provider, payload, modelId);
  await setProviderCooldownInRedis(provider, payload, durationMs, modelId);
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
  return buildQuotaStatus(provider, usage, quota);
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
      const cooldown = await getProviderCooldown(provider, modelId);
      if (cooldown) {
        skippedByQuota = true;
        logger.info(
          `[QuotaTracker] ${provider}${modelId ? `/${modelId}` : ''}: cooldown active, switching`
        );
        continue;
      }

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
    if (
      status.dailyTokenUsageRate >= 0.95 ||
      status.dailyRequestUsageRate >= 0.95
    ) {
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
