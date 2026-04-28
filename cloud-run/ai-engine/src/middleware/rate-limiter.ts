/**
 * Rate Limiter Middleware for Cloud Run AI Engine
 *
 * Sliding window rate limiting with Redis primary + in-memory fallback.
 * Designed for Cloud Run Free Tier (512Mi memory limit).
 *
 * @version 1.0.0
 * @see src/lib/security/rate-limiter.ts (Frontend reference)
 */

import { createHash } from 'node:crypto';
import type { Context, Next } from 'hono';
import { getRedisClient } from '../lib/redis-client';
import { logger } from '../lib/logger';

export const RATE_LIMIT_IDENTITY_HEADER = 'X-Rate-Limit-Identity';

// ============================================================================
// 1. Types
// ============================================================================

interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Optional daily request cap */
  dailyLimit?: number;
  /** Optional in-flight concurrency cap per endpoint group */
  maxInFlight?: number;
  /** Key prefix for Redis */
  keyPrefix: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  daily?: {
    remaining: number;
    resetTime: number;
  };
  limitScope?: 'minute' | 'daily' | 'concurrency';
}

// ============================================================================
// 2. In-Memory Fallback (when Redis unavailable)
// ============================================================================

/**
 * Simple in-memory sliding window counter
 * Cloud Run Free Tier: Map size capped at 1000 entries to stay within 512Mi
 */
const inMemoryStore = new Map<
  string,
  { count: number; resetAt: number; dailyCount: number; dailyResetAt: number }
>();
const MAX_STORE_SIZE = 1000;
const REDIS_TIMEOUT_MS = 500;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const OVERLOAD_RETRY_AFTER_SECONDS = 2;
const RETRY_AFTER_JITTER_MAX_SECONDS = 2;
const inFlightStore = new Map<string, number>();
const ATOMIC_RATE_LIMIT_SCRIPT = `
local minute_key = KEYS[1]
local daily_key = KEYS[2]

local minute_limit = tonumber(ARGV[1])
local minute_window_ms = tonumber(ARGV[2])
local daily_limit = tonumber(ARGV[3])
local daily_window_ms = tonumber(ARGV[4])

local minute_count = tonumber(redis.call('GET', minute_key) or '0')
local minute_ttl = tonumber(redis.call('PTTL', minute_key))
if minute_ttl == nil or minute_ttl < 0 then
  minute_ttl = minute_window_ms
end

local daily_count = 0
local daily_ttl = daily_window_ms

if daily_limit > 0 then
  daily_count = tonumber(redis.call('GET', daily_key) or '0')
  daily_ttl = tonumber(redis.call('PTTL', daily_key))
  if daily_ttl == nil or daily_ttl < 0 then
    daily_ttl = daily_window_ms
  end
end

if minute_count >= minute_limit then
  return {0, minute_count, minute_ttl, daily_count, daily_ttl, 1}
end

if daily_limit > 0 and daily_count >= daily_limit then
  return {0, minute_count, daily_ttl, daily_count, daily_ttl, 2}
end

local next_minute_count = tonumber(redis.call('INCR', minute_key))
if next_minute_count == 1 then
  redis.call('PEXPIRE', minute_key, minute_window_ms)
  minute_ttl = minute_window_ms
else
  minute_ttl = tonumber(redis.call('PTTL', minute_key))
  if minute_ttl == nil or minute_ttl < 0 then
    minute_ttl = minute_window_ms
  end
end

local next_daily_count = daily_count
if daily_limit > 0 then
  next_daily_count = tonumber(redis.call('INCR', daily_key))
  if next_daily_count == 1 then
    redis.call('PEXPIRE', daily_key, daily_window_ms)
    daily_ttl = daily_window_ms
  else
    daily_ttl = tonumber(redis.call('PTTL', daily_key))
    if daily_ttl == nil or daily_ttl < 0 then
      daily_ttl = daily_window_ms
    end
  end
end

return {1, next_minute_count, minute_ttl, next_daily_count, daily_ttl, 0}
`;

function cleanupInMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of inMemoryStore) {
    if (entry.resetAt <= now && entry.dailyResetAt <= now) {
      inMemoryStore.delete(key);
    }
  }
  // Hard cap: evict oldest entries if still over limit
  if (inMemoryStore.size > MAX_STORE_SIZE) {
    const keysToDelete = [...inMemoryStore.keys()].slice(
      0,
      inMemoryStore.size - MAX_STORE_SIZE
    );
    for (const key of keysToDelete) {
      inMemoryStore.delete(key);
    }
  }
}

function tryAcquireInFlight(bucket: string, maxInFlight: number): boolean {
  const current = inFlightStore.get(bucket) ?? 0;
  if (current >= maxInFlight) {
    return false;
  }
  inFlightStore.set(bucket, current + 1);
  return true;
}

function releaseInFlight(bucket: string): void {
  const current = inFlightStore.get(bucket);
  if (!current || current <= 1) {
    inFlightStore.delete(bucket);
    return;
  }
  inFlightStore.set(bucket, current - 1);
}

function withRetryAfterJitter(
  baseSeconds: number,
  scope: 'minute' | 'daily' | 'concurrency'
): number {
  const normalizedBase = Math.max(1, Math.ceil(baseSeconds));
  if (scope === 'daily') {
    return normalizedBase;
  }
  const jitter = Math.floor(
    Math.random() * (RETRY_AFTER_JITTER_MAX_SECONDS + 1)
  );
  return normalizedBase + jitter;
}

async function checkInMemoryLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  cleanupInMemoryStore();

  const entry = inMemoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    // New window
    const nextEntry = {
      count: 0,
      resetAt: now + config.windowMs,
      dailyCount: entry?.dailyCount ?? 0,
      dailyResetAt: entry?.dailyResetAt ?? now + DAILY_WINDOW_MS,
    };
    if (nextEntry.dailyResetAt <= now) {
      nextEntry.dailyCount = 0;
      nextEntry.dailyResetAt = now + DAILY_WINDOW_MS;
    }
    inMemoryStore.set(key, nextEntry);

    if (config.dailyLimit && nextEntry.dailyCount >= config.dailyLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: nextEntry.dailyResetAt,
        daily: {
          remaining: 0,
          resetTime: nextEntry.dailyResetAt,
        },
        limitScope: 'daily',
      };
    }

    nextEntry.count += 1;
    if (config.dailyLimit) {
      nextEntry.dailyCount += 1;
    }
    return {
      allowed: true,
      remaining: config.maxRequests - nextEntry.count,
      resetTime: nextEntry.resetAt,
      daily: config.dailyLimit
        ? {
            remaining: Math.max(0, config.dailyLimit - nextEntry.dailyCount),
            resetTime: nextEntry.dailyResetAt,
          }
        : undefined,
    };
  }

  if (entry.dailyResetAt <= now) {
    entry.dailyCount = 0;
    entry.dailyResetAt = now + DAILY_WINDOW_MS;
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetAt,
      daily: config.dailyLimit
        ? {
            remaining: Math.max(0, config.dailyLimit - entry.dailyCount),
            resetTime: entry.dailyResetAt,
          }
        : undefined,
      limitScope: 'minute',
    };
  }

  if (config.dailyLimit && entry.dailyCount >= config.dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.dailyResetAt,
      daily: {
        remaining: 0,
        resetTime: entry.dailyResetAt,
      },
      limitScope: 'daily',
    };
  }

  entry.count += 1;
  if (config.dailyLimit) {
    entry.dailyCount += 1;
  }
  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetAt,
    daily: config.dailyLimit
      ? {
          remaining: Math.max(0, config.dailyLimit - entry.dailyCount),
          resetTime: entry.dailyResetAt,
        }
      : undefined,
  };
}

// ============================================================================
// 3. Redis-based Rate Limiting
// ============================================================================

async function checkRedisLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const namespacedKey = `${config.keyPrefix}:${key}`;
  const redis = getRedisClient();
  if (!redis) {
    return checkInMemoryLimit(namespacedKey, config);
  }

  const now = Date.now();
  const minuteKey = `${config.keyPrefix}:${key}`;
  const dailyKey = `${config.keyPrefix}:daily:${key}`;

  try {
    const evalResult = await redis.eval<unknown[]>(
      ATOMIC_RATE_LIMIT_SCRIPT,
      [minuteKey, dailyKey],
      [
        String(config.maxRequests),
        String(config.windowMs),
        String(config.dailyLimit ?? 0),
        String(DAILY_WINDOW_MS),
      ],
      { timeoutMs: REDIS_TIMEOUT_MS }
    );

    if (!Array.isArray(evalResult) || evalResult.length < 6) {
      throw new Error('invalid eval result shape');
    }

    const allowed = Number(evalResult[0]) === 1;
    const minuteCount = Math.max(0, Number(evalResult[1] ?? 0));
    const minuteTtl = Math.max(0, Number(evalResult[2] ?? config.windowMs));
    const dailyCount = Math.max(0, Number(evalResult[3] ?? 0));
    const dailyTtl = Math.max(0, Number(evalResult[4] ?? DAILY_WINDOW_MS));
    const limitScopeCode = Number(evalResult[5] ?? 0);

    const daily = config.dailyLimit
      ? {
          remaining: Math.max(0, config.dailyLimit - dailyCount),
          resetTime: now + dailyTtl,
        }
      : undefined;

    if (!allowed) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + (limitScopeCode === 2 ? dailyTtl : minuteTtl),
        daily,
        limitScope: limitScopeCode === 2 ? 'daily' : 'minute',
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - minuteCount),
      resetTime: now + minuteTtl,
      daily,
    };
  } catch (error) {
    logger.warn(
      '[RateLimiter] Redis atomic check failed, falling back to in-memory:',
      error
    );
    return checkInMemoryLimit(namespacedKey, config);
  }
}

// ============================================================================
// 4. Endpoint-specific Configurations
// ============================================================================

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  supervisor: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1분에 10회
    dailyLimit: 100,
    maxInFlight: 4,
    keyPrefix: 'rl:supervisor',
  },
  supervisorHealth: {
    maxRequests: 120,
    windowMs: 60 * 1000, // 1분에 120회 (health/read)
    keyPrefix: 'rl:supervisor:health',
  },
  jobsWrite: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1분에 5회 (job creation / processing)
    dailyLimit: 100,
    maxInFlight: 2,
    keyPrefix: 'rl:jobs:write',
  },
  jobsRead: {
    maxRequests: 120,
    windowMs: 60 * 1000, // 1분에 120회 (polling / status reads)
    keyPrefix: 'rl:jobs:read',
  },
  default: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1분에 30회
    keyPrefix: 'rl:default',
  },
};

/**
 * Resolve rate limit config from request path + method.
 * Jobs processing is a strict write workload, while status/progress polling
 * should not consume the same 5/min bucket.
 */
function resolveConfig(path: string, method: string): RateLimitConfig {
  if (
    path.includes('/supervisor/health') &&
    method.toUpperCase() === 'GET'
  ) {
    return RATE_LIMIT_CONFIGS.supervisorHealth;
  }
  if (path.includes('/supervisor')) return RATE_LIMIT_CONFIGS.supervisor;
  if (path.includes('/jobs/process') && method.toUpperCase() === 'POST') {
    return RATE_LIMIT_CONFIGS.jobsWrite;
  }
  if (path.includes('/jobs')) return RATE_LIMIT_CONFIGS.jobsRead;
  return RATE_LIMIT_CONFIGS.default;
}

/**
 * Extract client identifier from request
 * Priority: forwarded end-user identity > X-API-Key > X-Forwarded-For
 */
export function extractClientKeyFromHeaders(
  getHeader: (name: string) => string | undefined
): string {
  const forwardedIdentity = getHeader(RATE_LIMIT_IDENTITY_HEADER);
  if (forwardedIdentity) {
    return `fwd:${forwardedIdentity}`;
  }

  const apiKey = getHeader('X-API-Key');
  if (apiKey) {
    const hash = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    return `key:${hash}`;
  }

  const forwarded = getHeader('X-Forwarded-For');
  if (forwarded) {
    const clientIp = forwarded.split(',')[0]?.trim();
    if (clientIp) return `ip:${clientIp}`;
  }

  return 'ip:unknown';
}

function extractClientKey(c: Context): string {
  return extractClientKeyFromHeaders((name) => c.req.header(name));
}

// ============================================================================
// 5. Hono Middleware
// ============================================================================

/**
 * Rate limiting middleware for Hono
 *
 * Usage in server.ts:
 * ```typescript
 * import { rateLimitMiddleware } from './middleware/rate-limiter';
 * app.use('/api/*', rateLimitMiddleware);
 * ```
 */
export async function rateLimitMiddleware(
  c: Context,
  next: Next
): Promise<Response | void> {
  const path = c.req.path;
  const config = resolveConfig(path, c.req.method);
  const clientKey = extractClientKey(c);
  const rateLimitKey = `${clientKey}:${path.split('/').slice(0, 4).join('/')}`;
  const inFlightBucket = config.keyPrefix;
  const maxInFlight = config.maxInFlight;
  let inFlightAcquired = false;

  if (maxInFlight && maxInFlight > 0) {
    if (!tryAcquireInFlight(inFlightBucket, maxInFlight)) {
      const retryAfter = withRetryAfterJitter(
        OVERLOAD_RETRY_AFTER_SECONDS,
        'concurrency'
      );
      c.header('Retry-After', String(retryAfter));
      c.header('X-RateLimit-Overload', 'true');
      c.header('X-RateLimit-InFlight-Limit', String(maxInFlight));

      logger.warn(
        `[RateLimiter] In-flight overload: ${path} bucket=${inFlightBucket} maxInFlight=${maxInFlight}`
      );

      return c.json(
        {
          error: 'Too Many Requests',
          message: '동시 처리 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
          retryAfter,
          source: 'cloud-run-ai',
          limitScope: 'concurrency',
          remaining: 0,
          resetAt: Date.now() + retryAfter * 1000,
          dailyLimitExceeded: false,
        },
        429
      );
    }

    inFlightAcquired = true;
  }

  try {
    const result = await checkRedisLimit(rateLimitKey, config);

    // Set rate limit headers on all responses
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', result.resetTime.toString());
    if (config.dailyLimit && result.daily) {
      c.header('X-RateLimit-Daily-Limit', config.dailyLimit.toString());
      c.header('X-RateLimit-Daily-Remaining', result.daily.remaining.toString());
      c.header('X-RateLimit-Daily-Reset', result.daily.resetTime.toString());
    }

    if (!result.allowed) {
      const isDailyLimitExceeded = result.limitScope === 'daily';
      const retryAfter = withRetryAfterJitter(
        (result.resetTime - Date.now()) / 1000,
        isDailyLimitExceeded ? 'daily' : 'minute'
      );
      c.header('Retry-After', retryAfter.toString());

      logger.warn(
        `[RateLimiter] Rate limit exceeded: ${clientKey} on ${path} (${config.maxRequests}/${config.windowMs}ms)`
      );

      return c.json(
        {
          error: 'Too Many Requests',
          message: isDailyLimitExceeded
            ? `일일 요청 제한(${config.dailyLimit ?? 100}회)을 초과했습니다. 내일 다시 시도해주세요.`
            : '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.',
          retryAfter,
          source: 'cloud-run-ai',
          limitScope: isDailyLimitExceeded ? 'daily' : 'minute',
          remaining: result.remaining,
          resetAt: result.resetTime,
          dailyLimitExceeded: isDailyLimitExceeded,
        },
        429
      );
    }

    await next();
  } finally {
    if (inFlightAcquired) {
      releaseInFlight(inFlightBucket);
    }
  }
}
