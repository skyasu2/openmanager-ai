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
  generateQueryHash,
  getAIResponseCache,
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
  checkRedisRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter';
