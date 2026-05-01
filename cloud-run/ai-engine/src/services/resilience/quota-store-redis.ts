import { getRedisClient } from '../../lib/redis-client';
import { logger } from '../../lib/logger';
import {
  PREEMPTIVE_THRESHOLDS,
  getQuotaForProvider,
  getQuotaUsageScope,
  type ProviderName,
  type ProviderQuotaReservation,
  type ProviderUsage,
} from './quota-types';
import { normalizeUsage } from './quota-store-memory';

export const REDIS_TIMEOUT_MS = 1_000;
export const REDIS_QUOTA_TTL_SECONDS = 86_400;

export function getRedisKey(provider: ProviderName, modelId?: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `ai:quota:${getQuotaUsageScope(provider, modelId)}:${today}`;
}

export function getCooldownKey(
  provider: ProviderName,
  modelId?: string
): string {
  return `ai:quota:cooldown:${getQuotaUsageScope(provider, modelId)}`;
}

const ATOMIC_QUOTA_RESERVATION_SCRIPT = `
local usageKey = KEYS[1]
local cooldownKey = KEYS[2]

local today = ARGV[1]
local now = tonumber(ARGV[2])
local estimatedTokens = tonumber(ARGV[3])
local dailyTokenLimit = tonumber(ARGV[4])
local requestsPerDay = tonumber(ARGV[5])
local requestsPerMinute = tonumber(ARGV[6])
local tokensPerMinute = tonumber(ARGV[7])
local dailyTokenThreshold = tonumber(ARGV[8])
local dailyRequestThreshold = tonumber(ARGV[9])
local minuteRequestThreshold = tonumber(ARGV[10])
local minuteTokenThreshold = tonumber(ARGV[11])
local safetyMarginMs = tonumber(ARGV[12])
local ttlSeconds = tonumber(ARGV[13])
local provider = ARGV[14]
local modelId = ARGV[15]

local function defaultUsage()
  return {
    dailyTokens = 0,
    dailyRequests = 0,
    minuteRequests = 0,
    minuteTokens = 0,
    lastUpdated = now,
    lastMinuteReset = now,
    date = today,
  }
end

local function normalizeUsage(raw)
  if not raw then
    return defaultUsage()
  end

  local ok, decoded = pcall(cjson.decode, raw)
  if not ok or type(decoded) ~= 'table' then
    return defaultUsage()
  end

  if decoded.date ~= today then
    return defaultUsage()
  end

  decoded.dailyTokens = tonumber(decoded.dailyTokens) or 0
  decoded.dailyRequests = tonumber(decoded.dailyRequests) or 0
  decoded.minuteRequests = tonumber(decoded.minuteRequests) or 0
  decoded.minuteTokens = tonumber(decoded.minuteTokens) or 0
  decoded.lastUpdated = tonumber(decoded.lastUpdated) or now
  decoded.lastMinuteReset = tonumber(decoded.lastMinuteReset) or now
  decoded.date = decoded.date or today

  if now - decoded.lastMinuteReset > 60000 then
    decoded.minuteRequests = 0
    decoded.minuteTokens = 0
    decoded.lastMinuteReset = now
  end

  return decoded
end

local function buildStatus(usage)
  local dailyTokenUsageRate = usage.dailyTokens / dailyTokenLimit
  local dailyRequestUsageRate = 0
  if requestsPerDay > 0 then
    dailyRequestUsageRate = usage.dailyRequests / requestsPerDay
  end
  local minuteRequestUsageRate = usage.minuteRequests / requestsPerMinute
  local minuteTokenUsageRate = usage.minuteTokens / tokensPerMinute
  local shouldPreemptiveFallback =
    dailyTokenUsageRate >= dailyTokenThreshold or
    dailyRequestUsageRate >= dailyRequestThreshold or
    minuteRequestUsageRate >= minuteRequestThreshold or
    minuteTokenUsageRate >= minuteTokenThreshold
  local recommendedWaitMs = cjson.null
  if minuteRequestUsageRate >= minuteRequestThreshold or
     minuteTokenUsageRate >= minuteTokenThreshold then
    recommendedWaitMs = math.max(0, 60000 - (now - usage.lastMinuteReset)) + safetyMarginMs
  end

  return {
    provider = provider,
    usage = usage,
    quota = {
      dailyTokenLimit = dailyTokenLimit,
      requestsPerMinute = requestsPerMinute,
      tokensPerMinute = tokensPerMinute,
      requestsPerDay = requestsPerDay > 0 and requestsPerDay or cjson.null,
    },
    dailyTokenUsageRate = dailyTokenUsageRate,
    dailyRequestUsageRate = dailyRequestUsageRate,
    minuteRequestUsageRate = minuteRequestUsageRate,
    minuteTokenUsageRate = minuteTokenUsageRate,
    shouldPreemptiveFallback = shouldPreemptiveFallback,
    recommendedWaitMs = recommendedWaitMs,
  }
end

local cooldownRaw = redis.call('GET', cooldownKey)
if cooldownRaw then
  local ok, cooldown = pcall(cjson.decode, cooldownRaw)
  if ok and type(cooldown) == 'table' and tonumber(cooldown["until"]) and tonumber(cooldown["until"]) > now then
    local usage = normalizeUsage(redis.call('GET', usageKey))
    return cjson.encode({
      reserved = false,
      provider = provider,
      modelId = modelId ~= '' and modelId or cjson.null,
      estimatedTokens = estimatedTokens,
      status = buildStatus(usage),
      reason = 'cooldown',
      cooldownUntil = tonumber(cooldown["until"]),
      recommendedWaitMs = math.max(0, tonumber(cooldown["until"]) - now),
    })
  end
  redis.call('DEL', cooldownKey)
end

local usage = normalizeUsage(redis.call('GET', usageKey))
local projectedDailyTokens = usage.dailyTokens + estimatedTokens
local projectedDailyRequests = usage.dailyRequests + 1
local projectedMinuteRequests = usage.minuteRequests + 1
local projectedMinuteTokens = usage.minuteTokens + estimatedTokens
local reason = nil

if projectedDailyTokens > dailyTokenLimit then
  reason = 'daily_token_limit'
elseif requestsPerDay > 0 and projectedDailyRequests > requestsPerDay then
  reason = 'daily_request_limit'
elseif projectedMinuteRequests > requestsPerMinute then
  reason = 'minute_request_limit'
elseif projectedMinuteTokens > tokensPerMinute then
  reason = 'minute_token_limit'
elseif projectedDailyTokens / dailyTokenLimit >= dailyTokenThreshold then
  reason = 'daily_token_threshold'
elseif requestsPerDay > 0 and projectedDailyRequests / requestsPerDay >= dailyRequestThreshold then
  reason = 'daily_request_threshold'
elseif projectedMinuteRequests / requestsPerMinute >= minuteRequestThreshold then
  reason = 'minute_request_threshold'
elseif projectedMinuteTokens / tokensPerMinute >= minuteTokenThreshold then
  reason = 'minute_token_threshold'
end

if reason then
  local recommendedWaitMs = cjson.null
  if string.sub(reason, 1, 7) == 'minute_' then
    recommendedWaitMs = math.max(0, 60000 - (now - usage.lastMinuteReset)) + safetyMarginMs
  end
  redis.call('SET', usageKey, cjson.encode(usage), 'EX', ttlSeconds)
  return cjson.encode({
    reserved = false,
    provider = provider,
    modelId = modelId ~= '' and modelId or cjson.null,
    estimatedTokens = estimatedTokens,
    status = buildStatus(usage),
    reason = reason,
    recommendedWaitMs = recommendedWaitMs,
  })
end

usage.dailyTokens = projectedDailyTokens
usage.dailyRequests = projectedDailyRequests
usage.minuteRequests = projectedMinuteRequests
usage.minuteTokens = projectedMinuteTokens
usage.lastUpdated = now
redis.call('SET', usageKey, cjson.encode(usage), 'EX', ttlSeconds)

return cjson.encode({
  reserved = true,
  provider = provider,
  modelId = modelId ~= '' and modelId or cjson.null,
  estimatedTokens = estimatedTokens,
  status = buildStatus(usage),
})
`;

const ATOMIC_QUOTA_RECONCILE_SCRIPT = `
local usageKey = KEYS[1]

local today = ARGV[1]
local now = tonumber(ARGV[2])
local tokenDelta = tonumber(ARGV[3])
local ttlSeconds = tonumber(ARGV[4])

local function defaultUsage()
  return {
    dailyTokens = 0,
    dailyRequests = 0,
    minuteRequests = 0,
    minuteTokens = 0,
    lastUpdated = now,
    lastMinuteReset = now,
    date = today,
  }
end

local raw = redis.call('GET', usageKey)
local usage = defaultUsage()
if raw then
  local ok, decoded = pcall(cjson.decode, raw)
  if ok and type(decoded) == 'table' and decoded.date == today then
    usage = decoded
    usage.dailyTokens = tonumber(usage.dailyTokens) or 0
    usage.dailyRequests = tonumber(usage.dailyRequests) or 0
    usage.minuteRequests = tonumber(usage.minuteRequests) or 0
    usage.minuteTokens = tonumber(usage.minuteTokens) or 0
    usage.lastUpdated = tonumber(usage.lastUpdated) or now
    usage.lastMinuteReset = tonumber(usage.lastMinuteReset) or now
    usage.date = usage.date or today
  end
end

if now - usage.lastMinuteReset > 60000 then
  usage.minuteRequests = 0
  usage.minuteTokens = 0
  usage.lastMinuteReset = now
end

usage.dailyTokens = math.max(0, usage.dailyTokens + tokenDelta)
usage.minuteTokens = math.max(0, usage.minuteTokens + tokenDelta)
usage.lastUpdated = now

redis.call('SET', usageKey, cjson.encode(usage), 'EX', ttlSeconds)
return cjson.encode(usage)
`;

export function getAtomicQuotaReservationScriptForTests(): string {
  return ATOMIC_QUOTA_RESERVATION_SCRIPT;
}

function normalizeQuotaReservation(
  value: unknown,
  provider: ProviderName,
  modelId: string | undefined,
  estimatedTokens: number
): ProviderQuotaReservation | null {
  const source =
    typeof value === 'string'
      ? (JSON.parse(value) as Partial<ProviderQuotaReservation>)
      : (value as Partial<ProviderQuotaReservation>);

  if (!source || typeof source !== 'object') return null;
  if (typeof source.reserved !== 'boolean') return null;
  if (!source.status) return null;

  return {
    reserved: source.reserved,
    provider,
    ...(modelId && { modelId }),
    estimatedTokens,
    status: source.status,
    ...(source.reason && { reason: source.reason }),
    ...(typeof source.cooldownUntil === 'number'
      ? { cooldownUntil: source.cooldownUntil }
      : {}),
    ...(typeof source.recommendedWaitMs === 'number'
      ? { recommendedWaitMs: source.recommendedWaitMs }
      : {}),
  };
}

export async function readProviderUsageFromRedis(
  provider: ProviderName,
  modelId?: string
): Promise<ProviderUsage | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get(getRedisKey(provider, modelId), {
      timeoutMs: REDIS_TIMEOUT_MS,
    });
    if (!data) return null;
    return normalizeUsage(typeof data === 'string' ? JSON.parse(data) : data);
  } catch (error) {
    logger.warn(`[QuotaTracker] Redis error for ${provider}:`, error);
    return null;
  }
}

export async function saveProviderUsageToRedis(
  provider: ProviderName,
  usage: ProviderUsage,
  modelId?: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const key = getRedisKey(provider, modelId);
    await redis.set(key, JSON.stringify(usage), undefined, {
      timeoutMs: REDIS_TIMEOUT_MS,
    });
    await redis.expire(key, REDIS_QUOTA_TTL_SECONDS, {
      timeoutMs: REDIS_TIMEOUT_MS,
    });
  } catch (error) {
    logger.warn(`[QuotaTracker] Redis save error for ${provider}:`, error);
  }
}

export async function getProviderCooldownFromRedis(
  provider: ProviderName,
  modelId?: string
): Promise<{ until: number; reason: string } | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get<{ until: number; reason: string }>(
      getCooldownKey(provider, modelId),
      { timeoutMs: REDIS_TIMEOUT_MS }
    );
    if (!data) return null;
    if (data.until > Date.now()) return data;
  } catch (error) {
    logger.warn(
      `[QuotaTracker] Redis cooldown read error for ${provider}:`,
      error
    );
  }

  return null;
}

export async function setProviderCooldownInRedis(
  provider: ProviderName,
  cooldown: { until: number; reason: string },
  durationMs: number,
  modelId?: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(
      getCooldownKey(provider, modelId),
      cooldown,
      Math.ceil(durationMs / 1000),
      { timeoutMs: REDIS_TIMEOUT_MS }
    );
  } catch (error) {
    logger.warn(
      `[QuotaTracker] Redis cooldown save error for ${provider}:`,
      error
    );
  }
}

export async function reserveProviderQuotaInRedis(
  provider: ProviderName,
  estimatedTokens: number,
  modelId?: string
): Promise<ProviderQuotaReservation | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const quota = getQuotaForProvider(provider, modelId);
  const today = new Date().toISOString().split('T')[0];

  try {
    const result = await redis.eval<unknown>(
      ATOMIC_QUOTA_RESERVATION_SCRIPT,
      [getRedisKey(provider, modelId), getCooldownKey(provider, modelId)],
      [
        today,
        String(Date.now()),
        String(estimatedTokens),
        String(quota.dailyTokenLimit),
        String(quota.requestsPerDay ?? 0),
        String(quota.requestsPerMinute),
        String(quota.tokensPerMinute),
        String(PREEMPTIVE_THRESHOLDS.dailyTokenThreshold),
        String(PREEMPTIVE_THRESHOLDS.dailyRequestThreshold),
        String(PREEMPTIVE_THRESHOLDS.minuteRequestThreshold),
        String(PREEMPTIVE_THRESHOLDS.minuteTokenThreshold),
        String(PREEMPTIVE_THRESHOLDS.safetyMarginMs),
        String(REDIS_QUOTA_TTL_SECONDS),
        provider,
        modelId ?? '',
      ],
      { timeoutMs: REDIS_TIMEOUT_MS }
    );

    return normalizeQuotaReservation(
      result,
      provider,
      modelId,
      estimatedTokens
    );
  } catch (error) {
    logger.warn(
      `[QuotaTracker] Redis atomic reservation error for ${provider}:`,
      error
    );
    return null;
  }
}

export async function reconcileProviderQuotaInRedis(
  provider: ProviderName,
  tokenDelta: number,
  modelId?: string
): Promise<ProviderUsage | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const result = await redis.eval<unknown>(
      ATOMIC_QUOTA_RECONCILE_SCRIPT,
      [getRedisKey(provider, modelId)],
      [
        new Date().toISOString().split('T')[0],
        String(Date.now()),
        String(tokenDelta),
        String(REDIS_QUOTA_TTL_SECONDS),
      ],
      { timeoutMs: REDIS_TIMEOUT_MS }
    );
    return normalizeUsage(
      typeof result === 'string' ? JSON.parse(result) : result
    );
  } catch (error) {
    logger.warn(
      `[QuotaTracker] Redis atomic reconcile error for ${provider}:`,
      error
    );
    return null;
  }
}
