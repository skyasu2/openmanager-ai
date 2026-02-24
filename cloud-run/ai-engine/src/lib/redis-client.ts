/**
 * Upstash Redis Client
 *
 * Provides Redis connection for distributed caching.
 * Uses Upstash serverless Redis (HTTP-based, no connection pooling needed).
 *
 * ## Configuration (2025-12-26)
 * Uses config-parser for unified JSON secret support.
 * Upstash config is embedded in SUPABASE_CONFIG.upstash
 */

import { Redis } from '@upstash/redis';
import { getUpstashConfig, type UpstashConfig } from './config-parser';
import { logger } from './logger';

// Re-export for convenience
export type { UpstashConfig };

// ============================================================================
// 1. Types
// ============================================================================

interface RedisHealthStatus {
  connected: boolean;
  latencyMs: number | null;
  lastCheck: string;
  error?: string;
}

// ============================================================================
// 2. Redis Client Singleton
// ============================================================================

let redisInstance: Redis | null = null;
let connectionFailed = false;

/**
 * Get Redis client instance (lazy initialization)
 * Returns null if not configured or connection failed
 */
export function getRedisClient(): Redis | null {
  if (connectionFailed) {
    return null;
  }

  if (redisInstance) {
    return redisInstance;
  }

  const config = getUpstashConfig();
  if (!config) {
    logger.info('[Redis] Not configured, using in-memory cache only');
    return null;
  }

  try {
    redisInstance = new Redis({
      url: config.url,
      token: config.token,
    });
    logger.info('[Redis] Client initialized');
    return redisInstance;
  } catch (e) {
    logger.error('[Redis] Client initialization failed:', e);
    connectionFailed = true;
    return null;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return getRedisClient() !== null;
}

// ============================================================================
// 3. Redis Operations with Error Handling
// ============================================================================

/**
 * Safe Redis GET with automatic JSON parsing
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get<T>(key);
    return value;
  } catch (e) {
    logger.warn(`[Redis] GET failed for ${key}:`, e);
    return null;
  }
}

/**
 * Safe Redis SET with automatic JSON serialization
 * @param ttlSeconds - TTL in seconds (Upstash uses seconds)
 */
export async function redisSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (e) {
    logger.warn(`[Redis] SET failed for ${key}:`, e);
    return false;
  }
}

/**
 * Safe Redis DELETE
 */
export async function redisDel(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(key);
    return true;
  } catch (e) {
    logger.warn(`[Redis] DEL failed for ${key}:`, e);
    return false;
  }
}

/**
 * Safe Redis DELETE by pattern (using SCAN + DEL)
 */
export async function redisDelByPattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  try {
    let cursor = 0;
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, {
        match: pattern,
        count: 100,
      });
      cursor = Number(nextCursor);

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== 0);

    return deletedCount;
  } catch (e) {
    logger.warn(`[Redis] DEL pattern failed for ${pattern}:`, e);
    return 0;
  }
}

// ============================================================================
// 4. Health Check
// ============================================================================

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  const client = getRedisClient();
  const now = new Date().toISOString();

  if (!client) {
    return {
      connected: false,
      latencyMs: null,
      lastCheck: now,
      error: 'Redis not configured',
    };
  }

  try {
    const start = Date.now();
    await client.ping();
    const latencyMs = Date.now() - start;

    return {
      connected: true,
      latencyMs,
      lastCheck: now,
    };
  } catch (e) {
    return {
      connected: false,
      latencyMs: null,
      lastCheck: now,
      error: String(e),
    };
  }
}

// ============================================================================
// 5. Reset (for testing)
// ============================================================================

/**
 * Reset Redis client (for testing)
 */
export function resetRedisClient(): void {
  redisInstance = null;
  connectionFailed = false;
  logger.info('[Redis] Client reset');
}
