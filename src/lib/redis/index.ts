/**
 * Redis Module Exports
 *
 * Upstash Redis 통합을 위한 모듈
 *
 * @module redis
 */

// AI Cache
export {
  type CachedAIResponse,
  type CacheResult,
  type CacheStats,
  generateQueryHash,
  getAIResponseCache,
  getCacheStats,
  invalidateSessionCache,
  setAIResponseCache,
} from './ai-cache';
// Circuit Breaker: Moved to @/lib/ai/circuit-breaker
// Use: import { executeWithCircuitBreaker } from '@/lib/ai/circuit-breaker'
// Client
export {
  checkRedisHealth,
  getRedisClient,
  getSystemRunningFlag,
  isRedisDisabled,
  isRedisEnabled,
  parseSystemRunningFlag,
  redisDel,
  redisGet,
  redisMGet,
  redisSet,
  setSystemRunningFlag,
} from './client';
// Rate Limiter
export {
  checkAISupervisorLimit,
  checkDefaultLimit,
  checkRedisRateLimit,
  RATE_LIMIT_CONFIGS,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter';
