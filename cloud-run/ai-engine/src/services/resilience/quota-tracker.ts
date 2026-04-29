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
  getCerebrasModelId,
} from '../../lib/config-parser';
import {
  CEREBRAS_LLAMA_FALLBACK_MODEL_ID,
  CEREBRAS_QWEN_MODEL_ID,
  getCerebrasModelPolicy,
  type CerebrasRuntimeModelId,
} from '../ai-sdk/provider-model-policy';

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

export type CerebrasQuotaModelId = CerebrasRuntimeModelId;

export interface ProviderUsage {
  dailyTokens: number;
  dailyRequests: number;
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
  dailyRequestUsageRate: number;
  minuteRequestUsageRate: number;
  minuteTokenUsageRate: number;
  shouldPreemptiveFallback: boolean;
  recommendedWaitMs?: number;
}

export type QuotaAdmissionReason =
  | 'cooldown'
  | 'daily_token_limit'
  | 'daily_request_limit'
  | 'minute_request_limit'
  | 'minute_token_limit'
  | 'daily_token_threshold'
  | 'daily_request_threshold'
  | 'minute_request_threshold'
  | 'minute_token_threshold';

export interface ProviderQuotaReservation {
  reserved: boolean;
  provider: ProviderName;
  modelId?: string;
  estimatedTokens: number;
  status: QuotaStatus;
  reason?: QuotaAdmissionReason;
  cooldownUntil?: number;
  recommendedWaitMs?: number;
}

// ============================================================================
// Provider Quota 설정 (Free-tier production guard 기준)
// ============================================================================

function quotaFromModelPolicy(modelId: CerebrasQuotaModelId): ProviderQuota {
  const quota = getCerebrasModelPolicy(modelId).quota;
  return {
    dailyTokenLimit: quota.tokensPerDay,
    requestsPerMinute: quota.requestsPerMinute,
    tokensPerMinute: quota.tokensPerMinute,
    requestsPerDay: quota.requestsPerDay,
  };
}

export const CEREBRAS_MODEL_QUOTAS: Record<CerebrasQuotaModelId, ProviderQuota> = {
  /**
   * Account Limits screen 기준. 공식 Free tier 표보다 계정별 제한을 우선한다.
   */
  [CEREBRAS_QWEN_MODEL_ID]: quotaFromModelPolicy(CEREBRAS_QWEN_MODEL_ID),
  [CEREBRAS_LLAMA_FALLBACK_MODEL_ID]: quotaFromModelPolicy(CEREBRAS_LLAMA_FALLBACK_MODEL_ID),
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
  dailyRequestThreshold: 0.85,
  minuteRequestThreshold: 0.85,
  minuteTokenThreshold: 0.85,
  safetyMarginMs: 2000,
} as const;

const PROVIDER_COOLDOWN_MS = 90_000;

// ============================================================================
// In-Memory Storage (단일 인스턴스용)
// ============================================================================

const inMemoryUsage = new Map<string, ProviderUsage>();
const inMemoryCooldowns = new Map<
  string,
  { until: number; reason: string }
>();
const usageLocks = new Map<string, Promise<void>>();

function getDefaultUsage(): ProviderUsage {
  const now = Date.now();
  return {
    dailyTokens: 0,
    dailyRequests: 0,
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

function getCooldownKey(provider: ProviderName, modelId?: string): string {
  return `ai:quota:cooldown:${getUsageScope(provider, modelId)}`;
}

const REDIS_TIMEOUT_MS = 1_000;
const REDIS_QUOTA_TTL_SECONDS = 86_400;

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
  if ok and type(cooldown) == 'table' and tonumber(cooldown.until) and tonumber(cooldown.until) > now then
    local usage = normalizeUsage(redis.call('GET', usageKey))
    return cjson.encode({
      reserved = false,
      provider = provider,
      modelId = modelId ~= '' and modelId or cjson.null,
      estimatedTokens = estimatedTokens,
      status = buildStatus(usage),
      reason = 'cooldown',
      cooldownUntil = tonumber(cooldown.until),
      recommendedWaitMs = math.max(0, tonumber(cooldown.until) - now),
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

// ============================================================================
// Core Functions
// ============================================================================

function normalizeUsage(value: unknown): ProviderUsage {
  const source = value && typeof value === 'object'
    ? value as Partial<ProviderUsage>
    : {};
  const fallback = getDefaultUsage();

  return {
    dailyTokens: Number(source.dailyTokens ?? 0),
    dailyRequests: Number(source.dailyRequests ?? 0),
    minuteRequests: Number(source.minuteRequests ?? 0),
    minuteTokens: Number(source.minuteTokens ?? 0),
    lastUpdated: Number(source.lastUpdated ?? fallback.lastUpdated),
    lastMinuteReset: Number(source.lastMinuteReset ?? fallback.lastMinuteReset),
    date: String(source.date ?? fallback.date),
  };
}

async function saveProviderUsage(
  provider: ProviderName,
  usage: ProviderUsage,
  modelId?: string
): Promise<void> {
  const redis = getRedisClient();
  const usageScope = getUsageScope(provider, modelId);

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
}

async function withUsageLock<T>(
  provider: ProviderName,
  modelId: string | undefined,
  operation: () => Promise<T>
): Promise<T> {
  const usageScope = getUsageScope(provider, modelId);
  const previous = usageLocks.get(usageScope) ?? Promise.resolve();
  let release!: () => void;
  const current = previous.then(
    () => new Promise<void>((resolve) => {
      release = resolve;
    })
  );

  usageLocks.set(usageScope, current);
  await previous;

  try {
    return await operation();
  } finally {
    release();
    if (usageLocks.get(usageScope) === current) {
      usageLocks.delete(usageScope);
    }
  }
}

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

async function getProviderCooldown(
  provider: ProviderName,
  modelId?: string
): Promise<{ until: number; reason: string } | null> {
  const now = Date.now();
  const key = getCooldownKey(provider, modelId);
  const inMemory = inMemoryCooldowns.get(key);
  if (inMemory) {
    if (inMemory.until > now) return inMemory;
    inMemoryCooldowns.delete(key);
  }

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get<{ until: number; reason: string }>(key, {
      timeoutMs: REDIS_TIMEOUT_MS,
    });
    if (!data) return null;
    if (data.until > now) return data;
  } catch (error) {
    logger.warn(`[QuotaTracker] Redis cooldown read error for ${provider}:`, error);
  }

  return null;
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

function normalizeQuotaReservation(
  value: unknown,
  provider: ProviderName,
  modelId: string | undefined,
  estimatedTokens: number
): ProviderQuotaReservation | null {
  const source = typeof value === 'string'
    ? JSON.parse(value) as Partial<ProviderQuotaReservation>
    : value as Partial<ProviderQuotaReservation>;

  if (!source || typeof source !== 'object') return null;
  if (typeof source.reserved !== 'boolean') return null;
  if (!source.status) return null;

  const reservation: ProviderQuotaReservation = {
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

  if (reservation.status.usage) {
    inMemoryUsage.set(getUsageScope(provider, modelId), reservation.status.usage);
  }

  return reservation;
}

async function reserveProviderQuotaInRedis(
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

    return normalizeQuotaReservation(result, provider, modelId, estimatedTokens);
  } catch (error) {
    logger.warn(`[QuotaTracker] Redis atomic reservation error for ${provider}:`, error);
    return null;
  }
}

async function reconcileProviderQuotaInRedis(
  provider: ProviderName,
  tokenDelta: number,
  modelId?: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

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
    const usage = normalizeUsage(
      typeof result === 'string' ? JSON.parse(result) : result
    );
    inMemoryUsage.set(getUsageScope(provider, modelId), usage);
    return true;
  } catch (error) {
    logger.warn(`[QuotaTracker] Redis atomic reconcile error for ${provider}:`, error);
    return false;
  }
}

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
        const usage = normalizeUsage(
          typeof data === 'string' ? JSON.parse(data) : data
        );

        if (usage.date !== today) {
          const reset = getDefaultUsage();
          await saveProviderUsage(provider, reset, modelId);
          return reset;
        }

        const now = Date.now();
        if (now - usage.lastMinuteReset > 60_000) {
          usage.minuteRequests = 0;
          usage.minuteTokens = 0;
          usage.lastMinuteReset = now;
          await saveProviderUsage(provider, usage, modelId);
        }

        return usage;
      }

      const usage = getDefaultUsage();
      await saveProviderUsage(provider, usage, modelId);
      return usage;
    } catch (error) {
      logger.warn(`[QuotaTracker] Redis error for ${provider}:`, error);
    }
  }

  // In-Memory Fallback
  let usage = normalizeUsage(inMemoryUsage.get(usageScope));
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
  const usage = await getProviderUsage(provider, modelId);
  const usageScope = getUsageScope(provider, modelId);

  usage.dailyTokens += tokensUsed;
  usage.dailyRequests += 1;
  usage.minuteRequests += 1;
  usage.minuteTokens += tokensUsed;
  usage.lastUpdated = Date.now();

  await saveProviderUsage(provider, usage, modelId);

  // 로깅
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
    return redisReservation;
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
        `[QuotaTracker] Admission skip ${getUsageScope(provider, modelId)} reason=${reason}`
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

  if (
    await reconcileProviderQuotaInRedis(
      reservation.provider,
      tokenDelta,
      reservation.modelId
    )
  ) {
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
  const key = getCooldownKey(provider, modelId);
  const payload = { until, reason };
  inMemoryCooldowns.set(key, payload);

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, payload, Math.ceil(durationMs / 1000), {
      timeoutMs: REDIS_TIMEOUT_MS,
    });
  } catch (error) {
    logger.warn(`[QuotaTracker] Redis cooldown save error for ${provider}:`, error);
  }
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
