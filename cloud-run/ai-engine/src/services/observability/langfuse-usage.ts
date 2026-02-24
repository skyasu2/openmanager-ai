import { redisGet, redisSet } from '../../lib/redis-client';
import { logger } from '../../lib/logger';
import { isLangfuseTestModeEnabled } from './langfuse-flags';

const FREE_TIER_LIMIT = 50_000;
const SAFETY_THRESHOLD = 0.9;
const DEFAULT_SAMPLE_RATE = 1.0;

interface UsageState {
  eventCount: number;
  monthKey: string;
  isDisabled: boolean;
  lastWarning: string | null;
}

const REDIS_KEY_PREFIX = 'langfuse:usage:';
const REDIS_TTL_SECONDS = 35 * 24 * 3600;

let usageState: UsageState = {
  eventCount: 0,
  monthKey: getCurrentMonthKey(),
  isDisabled: false,
  lastWarning: null,
};

interface SamplingContext {
  sampled: boolean;
  createdAt: number;
}

const samplingContextMap = new Map<string, SamplingContext>();
const SAMPLING_CONTEXT_TTL_MS = 5 * 60 * 1000;

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getUsageRedisKey(): string {
  return `${REDIS_KEY_PREFIX}${getCurrentMonthKey()}`;
}

function checkAndResetMonth(): void {
  const currentMonth = getCurrentMonthKey();
  if (usageState.monthKey !== currentMonth) {
    logger.info(`[Langfuse] 월간 카운터 리셋: ${usageState.monthKey} -> ${currentMonth}`);
    usageState = {
      eventCount: 0,
      monthKey: currentMonth,
      isDisabled: false,
      lastWarning: null,
    };
  }
}

function incrementUsage(count: number = 1): boolean {
  checkAndResetMonth();

  if (usageState.isDisabled) {
    return false;
  }

  usageState.eventCount += count;

  if (usageState.eventCount >= FREE_TIER_LIMIT * SAFETY_THRESHOLD) {
    usageState.isDisabled = true;
    logger.error(
      `[Langfuse] 무료 티어 한도 90% 도달! 자동 비활성화됨 ` +
        `(${usageState.eventCount.toLocaleString()}/${FREE_TIER_LIMIT.toLocaleString()} events)`
    );
    redisSet(getUsageRedisKey(), usageState, REDIS_TTL_SECONDS).catch(() => {});
    return false;
  }

  const warningThresholds = [0.7, 0.8];
  for (const threshold of warningThresholds) {
    const thresholdKey = `${threshold * 100}%`;
    if (
      usageState.eventCount >= FREE_TIER_LIMIT * threshold &&
      usageState.lastWarning !== thresholdKey
    ) {
      usageState.lastWarning = thresholdKey;
      logger.warn(
        `[Langfuse] 무료 티어 ${thresholdKey} 사용 중 ` +
          `(${usageState.eventCount.toLocaleString()}/${FREE_TIER_LIMIT.toLocaleString()} events)`
      );
    }
  }

  redisSet(getUsageRedisKey(), usageState, REDIS_TTL_SECONDS).catch(() => {});
  return true;
}

function shouldSample(): boolean {
  if (isLangfuseTestModeEnabled()) {
    return true;
  }
  return Math.random() < DEFAULT_SAMPLE_RATE;
}

function cleanupStaleSamplingContexts(): void {
  const now = Date.now();
  for (const [sessionId, context] of samplingContextMap.entries()) {
    if (now - context.createdAt > SAMPLING_CONTEXT_TTL_MS) {
      samplingContextMap.delete(sessionId);
    }
  }
}

function shouldSampleWithContext(sessionId?: string): boolean {
  if (isLangfuseTestModeEnabled()) {
    return true;
  }

  if (!sessionId) {
    return shouldSample();
  }

  return getSamplingContext(sessionId);
}

export function initSamplingContext(sessionId: string): boolean {
  cleanupStaleSamplingContexts();

  const existing = samplingContextMap.get(sessionId);
  if (existing) {
    return existing.sampled;
  }

  const sampled = shouldSample();
  samplingContextMap.set(sessionId, {
    sampled,
    createdAt: Date.now(),
  });

  return sampled;
}

export function getSamplingContext(sessionId: string): boolean {
  const existing = samplingContextMap.get(sessionId);
  if (existing) {
    return existing.sampled;
  }

  return initSamplingContext(sessionId);
}

export function consumeLangfuseQuota(count: number = 1): boolean {
  return incrementUsage(count);
}

export function shouldTrackLangfuseEvent(sessionId?: string): boolean {
  if (!shouldSampleWithContext(sessionId)) {
    return false;
  }

  return consumeLangfuseQuota(1);
}

export async function restoreUsageFromRedis(): Promise<void> {
  try {
    const saved = await redisGet<UsageState>(getUsageRedisKey());
    if (saved && saved.monthKey === getCurrentMonthKey()) {
      usageState = saved;
      logger.info(
        `[Langfuse] Redis에서 사용량 복원: ${saved.eventCount.toLocaleString()} events (${saved.monthKey})`
      );
    }
  } catch {
    logger.warn('[Langfuse] Redis 복원 실패, 인메모리 카운터 사용');
  }
}

export function getLangfuseUsageStatus(): {
  eventCount: number;
  limit: number;
  usagePercent: number;
  isDisabled: boolean;
  monthKey: string;
  testMode: boolean;
  sampleRate: string;
} {
  checkAndResetMonth();
  return {
    eventCount: usageState.eventCount,
    limit: FREE_TIER_LIMIT,
    usagePercent: Math.round((usageState.eventCount / FREE_TIER_LIMIT) * 100),
    isDisabled: usageState.isDisabled,
    monthKey: usageState.monthKey,
    testMode: isLangfuseTestModeEnabled(),
    sampleRate: isLangfuseTestModeEnabled() ? '100%' : `${DEFAULT_SAMPLE_RATE * 100}%`,
  };
}
