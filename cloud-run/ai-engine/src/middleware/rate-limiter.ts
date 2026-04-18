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
  limitScope?: 'minute' | 'daily';
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
    const currentMinuteCount = Number(
      (await redis.get(minuteKey, { timeoutMs: REDIS_TIMEOUT_MS })) ?? 0
    );
    const minuteTtl = await redis.pttl(minuteKey, { timeoutMs: REDIS_TIMEOUT_MS });

    let currentDailyCount = 0;
    let dailyTtl = -1;

    if (config.dailyLimit) {
      currentDailyCount = Number(
        (await redis.get(dailyKey, { timeoutMs: REDIS_TIMEOUT_MS })) ?? 0
      );
      dailyTtl = await redis.pttl(dailyKey, { timeoutMs: REDIS_TIMEOUT_MS });
    }

    if (currentMinuteCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: minuteTtl > 0 ? now + minuteTtl : now + config.windowMs,
        daily: config.dailyLimit
          ? {
              remaining: Math.max(0, config.dailyLimit - currentDailyCount),
              resetTime:
                dailyTtl > 0 ? now + dailyTtl : now + DAILY_WINDOW_MS,
            }
          : undefined,
        limitScope: 'minute',
      };
    }

    if (config.dailyLimit && currentDailyCount >= config.dailyLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: dailyTtl > 0 ? now + dailyTtl : now + DAILY_WINDOW_MS,
        daily: {
          remaining: 0,
          resetTime: dailyTtl > 0 ? now + dailyTtl : now + DAILY_WINDOW_MS,
        },
        limitScope: 'daily',
      };
    }

    const minuteCount = await redis.incr(minuteKey, { timeoutMs: REDIS_TIMEOUT_MS });
    if (minuteCount === 1) {
      await redis.pexpire(minuteKey, config.windowMs, {
        timeoutMs: REDIS_TIMEOUT_MS,
      });
    }
    const updatedMinuteTtl =
      minuteTtl > 0 ? minuteTtl : config.windowMs;
    const resetTime = now + updatedMinuteTtl;

    let daily:
      | {
          remaining: number;
          resetTime: number;
        }
      | undefined;

    if (config.dailyLimit) {
      const dailyCount = await redis.incr(dailyKey, { timeoutMs: REDIS_TIMEOUT_MS });
      if (dailyCount === 1) {
        await redis.pexpire(dailyKey, DAILY_WINDOW_MS, {
          timeoutMs: REDIS_TIMEOUT_MS,
        });
      }
      const updatedDailyTtl = dailyTtl > 0 ? dailyTtl : DAILY_WINDOW_MS;
      daily = {
        remaining: Math.max(0, config.dailyLimit - dailyCount),
        resetTime: now + updatedDailyTtl,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - minuteCount),
      resetTime,
      daily,
    };
  } catch (error) {
    logger.warn('[RateLimiter] Redis error, falling back to in-memory:', error);
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
    keyPrefix: 'rl:supervisor',
  },
  supervisorHealth: {
    maxRequests: 120,
    windowMs: 60 * 1000, // 1분에 120회 (health/read)
    keyPrefix: 'rl:supervisor:health',
  },
  embedding: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1분에 30회
    keyPrefix: 'rl:embedding',
  },
  jobsWrite: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1분에 5회 (job creation / processing)
    dailyLimit: 100,
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
  if (path.includes('/embedding')) return RATE_LIMIT_CONFIGS.embedding;
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
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    c.header('Retry-After', retryAfter.toString());
    const isDailyLimitExceeded = result.limitScope === 'daily';

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
}
