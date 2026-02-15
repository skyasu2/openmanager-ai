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

// ============================================================================
// 1. Types
// ============================================================================

interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Key prefix for Redis */
  keyPrefix: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

// ============================================================================
// 2. In-Memory Fallback (when Redis unavailable)
// ============================================================================

/**
 * Simple in-memory sliding window counter
 * Cloud Run Free Tier: Map size capped at 1000 entries to stay within 512Mi
 */
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();
const MAX_STORE_SIZE = 1000;

function cleanupInMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of inMemoryStore) {
    if (entry.resetAt <= now) {
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
    inMemoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  entry.count += 1;
  const allowed = entry.count <= config.maxRequests;
  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetAt,
  };
}

// ============================================================================
// 3. Redis-based Rate Limiting
// ============================================================================

async function checkRedisLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (!redis) {
    return checkInMemoryLimit(key, config);
  }

  const now = Date.now();
  const redisKey = `${config.keyPrefix}:${key}`;

  try {
    // Sliding window: increment counter with expiry
    const count = await redis.incr(redisKey);

    if (count === 1) {
      // First request in window: set expiry
      await redis.pexpire(redisKey, config.windowMs);
    }

    const ttl = await redis.pttl(redisKey);
    const resetTime = ttl > 0 ? now + ttl : now + config.windowMs;

    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetTime,
    };
  } catch (error) {
    logger.warn('[RateLimiter] Redis error, falling back to in-memory:', error);
    return checkInMemoryLimit(key, config);
  }
}

// ============================================================================
// 4. Endpoint-specific Configurations
// ============================================================================

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  supervisor: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1분에 10회
    keyPrefix: 'rl:supervisor',
  },
  embedding: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1분에 30회
    keyPrefix: 'rl:embedding',
  },
  jobs: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1분에 5회
    keyPrefix: 'rl:jobs',
  },
  default: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1분에 30회
    keyPrefix: 'rl:default',
  },
};

/**
 * Resolve rate limit config from request path
 */
function resolveConfig(path: string): RateLimitConfig {
  if (path.includes('/supervisor')) return RATE_LIMIT_CONFIGS.supervisor;
  if (path.includes('/embedding')) return RATE_LIMIT_CONFIGS.embedding;
  if (path.includes('/jobs')) return RATE_LIMIT_CONFIGS.jobs;
  return RATE_LIMIT_CONFIGS.default;
}

/**
 * Extract client identifier from request
 * Priority: X-API-Key > X-Forwarded-For > remote address
 */
function extractClientKey(c: Context): string {
  const apiKey = c.req.header('X-API-Key');
  if (apiKey) {
    const hash = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    return `key:${hash}`;
  }

  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    return `ip:${forwarded.split(',')[0].trim()}`;
  }

  return 'ip:unknown';
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
  const config = resolveConfig(path);
  const clientKey = extractClientKey(c);
  const rateLimitKey = `${clientKey}:${path.split('/').slice(0, 4).join('/')}`;

  const result = await checkRedisLimit(rateLimitKey, config);

  // Set rate limit headers on all responses
  c.header('X-RateLimit-Limit', config.maxRequests.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', result.resetTime.toString());

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    c.header('Retry-After', retryAfter.toString());

    logger.warn(
      `[RateLimiter] Rate limit exceeded: ${clientKey} on ${path} (${config.maxRequests}/${config.windowMs}ms)`
    );

    return c.json(
      {
        error: 'Too Many Requests',
        message: '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.',
        retryAfter,
      },
      429
    );
  }

  await next();
}
