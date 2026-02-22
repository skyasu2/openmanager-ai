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
  getHealthCache,
  type HealthCheckResult,
  invalidateSessionCache,
  setAIResponseCache,
  setHealthCache,
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
  reconnectRedis,
  redisDel,
  redisGet,
  redisMGet,
  redisSet,
  safeRedisOp,
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
