/**
 * Redis-based Distributed Circuit Breaker State Store
 *
 * @description
 * Upstash Redis를 사용한 분산 Circuit Breaker 상태 관리
 * 서버리스 환경(Vercel)에서 인스턴스 간 상태 공유 지원
 *
 * Best Practices Applied:
 * - Redis Hash로 상태 저장 (HSET/HGETALL)
 * - TTL 자동 만료로 자가 복구
 * - Pipeline으로 명령어 배칭 (무료 티어 절약)
 * - Graceful degradation (Redis 장애 시 InMemory 폴백)
 *
 * @see https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/circuit-breaker.html
 * @created 2026-01-25
 */

import type { Redis } from '@upstash/redis';
import type {
  CircuitState,
  IDistributedStateStore,
} from '@/lib/ai/circuit-breaker';
import { logger } from '@/lib/logging';
import {
  getRedisClient,
  isRedisEnabled,
  runRedisWithTimeout,
} from './client';

// ============================================================================
// Constants
// ============================================================================

const CIRCUIT_KEY_PREFIX = 'circuit:';
const CIRCUIT_TTL_SECONDS = 300; // 5분 (Circuit Breaker 리셋 시간)
const REDIS_TIMEOUT_MS = 1_000;
const DEFAULT_STATE: CircuitState = {
  state: 'CLOSED',
  failures: 0,
  lastFailTime: 0,
  threshold: 3,
  resetTimeout: 60000,
};

// ============================================================================
// Redis Circuit Breaker Store
// ============================================================================

/**
 * Redis 기반 분산 Circuit Breaker 상태 저장소
 *
 * @example
 * ```typescript
 * import { RedisCircuitBreakerStore } from '@/lib/redis/circuit-breaker-store';
 * import { setDistributedStateStore } from '@/lib/ai/circuit-breaker';
 *
 * // 앱 초기화 시 Redis 저장소 설정
 * setDistributedStateStore(new RedisCircuitBreakerStore());
 * ```
 */
export class RedisCircuitBreakerStore implements IDistributedStateStore {
  private readonly keyPrefix: string;
  private readonly ttlSeconds: number;

  constructor(options?: { keyPrefix?: string; ttlSeconds?: number }) {
    this.keyPrefix = options?.keyPrefix ?? CIRCUIT_KEY_PREFIX;
    this.ttlSeconds = options?.ttlSeconds ?? CIRCUIT_TTL_SECONDS;
  }

  /**
   * Circuit 상태 조회
   */
  async getState(serviceName: string): Promise<CircuitState | null> {
    const redis = this.getRedis();
    if (!redis) return null;

    try {
      const key = this.getKey(serviceName);
      const data = await runRedisWithTimeout(
        `HGETALL ${key}`,
        () => redis.hgetall<Record<string, string>>(key),
        { timeoutMs: REDIS_TIMEOUT_MS }
      );

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return this.parseState(data);
    } catch (error) {
      logger.warn(
        `[CircuitBreakerStore] getState failed for ${serviceName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Circuit 상태 저장
   */
  async setState(serviceName: string, state: CircuitState): Promise<void> {
    const redis = this.getRedis();
    if (!redis) return;

    try {
      const key = this.getKey(serviceName);
      const data = this.serializeState(state);

      // Pipeline으로 HSET + EXPIRE 원자적 실행
      const pipeline = redis.pipeline();
      pipeline.hset(key, data);
      pipeline.expire(key, this.ttlSeconds);
      await runRedisWithTimeout(
        `PIPELINE setState ${key}`,
        () => pipeline.exec(),
        { timeoutMs: REDIS_TIMEOUT_MS }
      );

      logger.debug(
        `[CircuitBreakerStore] setState: ${serviceName} → ${state.state}`
      );
    } catch (error) {
      logger.warn(
        `[CircuitBreakerStore] setState failed for ${serviceName}:`,
        error
      );
    }
  }

  /**
   * 실패 카운터 증가 (Atomic)
   */
  async incrementFailures(serviceName: string): Promise<number> {
    const redis = this.getRedis();
    if (!redis) return 0;

    try {
      const key = this.getKey(serviceName);
      const now = Date.now();

      // Pipeline으로 원자적 업데이트
      const pipeline = redis.pipeline();
      pipeline.hincrby(key, 'failures', 1);
      pipeline.hset(key, { lastFailTime: now.toString() });
      pipeline.expire(key, this.ttlSeconds);

      const results = await runRedisWithTimeout(
        `PIPELINE incrementFailures ${key}`,
        () => pipeline.exec<[number, number, number]>(),
        { timeoutMs: REDIS_TIMEOUT_MS }
      );
      const newFailures = results[0];

      logger.debug(
        `[CircuitBreakerStore] incrementFailures: ${serviceName} → ${newFailures}`
      );
      return newFailures;
    } catch (error) {
      logger.warn(
        `[CircuitBreakerStore] incrementFailures failed for ${serviceName}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Circuit 상태 리셋 (삭제)
   */
  async resetState(serviceName: string): Promise<void> {
    const redis = this.getRedis();
    if (!redis) return;

    try {
      const key = this.getKey(serviceName);
      await runRedisWithTimeout(`DEL ${key}`, () => redis.del(key), {
        timeoutMs: REDIS_TIMEOUT_MS,
      });
      logger.debug(`[CircuitBreakerStore] resetState: ${serviceName}`);
    } catch (error) {
      logger.warn(
        `[CircuitBreakerStore] resetState failed for ${serviceName}:`,
        error
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getRedis(): Redis | null {
    if (!isRedisEnabled()) {
      return null;
    }
    return getRedisClient();
  }

  private getKey(serviceName: string): string {
    return `${this.keyPrefix}${serviceName}`;
  }

  private serializeState(state: CircuitState): Record<string, string> {
    return {
      state: state.state,
      failures: state.failures.toString(),
      lastFailTime: state.lastFailTime.toString(),
      threshold: state.threshold.toString(),
      resetTimeout: state.resetTimeout.toString(),
    };
  }

  private parseState(data: Record<string, string>): CircuitState {
    return {
      state: (data.state as CircuitState['state']) || DEFAULT_STATE.state,
      failures: parseInt(data.failures || '0', 10),
      lastFailTime: parseInt(data.lastFailTime || '0', 10),
      threshold: parseInt(data.threshold || '3', 10),
      resetTimeout: parseInt(data.resetTimeout || '60000', 10),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let storeInstance: RedisCircuitBreakerStore | null = null;

/**
 * Redis Circuit Breaker Store 싱글톤 반환
 */
export function getRedisCircuitBreakerStore(): RedisCircuitBreakerStore {
  if (!storeInstance) {
    storeInstance = new RedisCircuitBreakerStore();
  }
  return storeInstance;
}

// ============================================================================
// Auto-initialization
// ============================================================================

/**
 * Circuit Breaker에 Redis Store 자동 연결
 *
 * @description
 * Redis가 활성화되어 있으면 자동으로 분산 상태 저장소로 설정
 * Redis가 비활성화되면 기본 InMemoryStateStore 사용 (폴백)
 *
 * @example
 * ```typescript
 * // 앱 초기화 시 호출
 * import { initializeRedisCircuitBreaker } from '@/lib/redis/circuit-breaker-store';
 * await initializeRedisCircuitBreaker();
 * ```
 */
export async function initializeRedisCircuitBreaker(): Promise<boolean> {
  // 동적 import로 순환 참조 방지
  const { setDistributedStateStore } = await import('@/lib/ai/circuit-breaker');

  if (!isRedisEnabled()) {
    logger.info(
      '[CircuitBreakerStore] Redis not available, using InMemory fallback'
    );
    return false;
  }

  const store = getRedisCircuitBreakerStore();
  setDistributedStateStore(store);

  logger.info('[CircuitBreakerStore] Redis distributed store initialized');
  return true;
}
