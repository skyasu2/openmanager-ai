/**
 * Upstash Redis Client Singleton
 *
 * 무료 티어 보호 & Graceful Degradation 지원
 * - 월 500K 명령어 한도 내 운영
 * - 장애 시 서비스 가용성 우선
 *
 * @module redis/client
 */

import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logging';

// Redis 클라이언트 인스턴스 (싱글톤)
let redisInstance: Redis | null = null;
let isRedisAvailable = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60_000; // 1분

// 자동 복구 관련
let recoveryScheduled = false;
const RECOVERY_DELAY_MS = 60_000; // 1분 후 복구 시도

/**
 * Redis 연결 상태
 */
interface RedisStatus {
  available: boolean;
  lastCheck: number;
  error?: string;
}

/**
 * Redis 클라이언트 싱글톤 반환
 *
 * @returns Redis 인스턴스 또는 null (환경 변수 미설정 시)
 */
export function getRedisClient(): Redis | null {
  // 이미 인스턴스가 있으면 반환
  if (redisInstance) {
    return redisInstance;
  }

  // 환경 변수 확인 (Vercel KV 또는 Upstash 직접 설정 모두 지원)
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // 환경 변수가 없으면 null 반환 (Graceful degradation)
  if (!url || !token) {
    logger.warn(
      '[Redis] Missing environment variables: KV_REST_API_URL/UPSTASH_REDIS_REST_URL'
    );
    isRedisAvailable = false;
    return null;
  }

  try {
    redisInstance = new Redis({
      url,
      token,
      // 자동 파이프라이닝으로 명령어 배칭 (무료 티어 절약)
      enableAutoPipelining: true,
    });

    isRedisAvailable = true;
    logger.info('[Redis] Client initialized successfully');

    return redisInstance;
  } catch (error) {
    logger.error('[Redis] Failed to initialize client:', error);
    isRedisAvailable = false;
    return null;
  }
}

/**
 * Redis 가용성 확인
 *
 * @returns Redis 사용 가능 여부
 */
export function isRedisEnabled(): boolean {
  return isRedisAvailable && redisInstance !== null;
}

/**
 * Redis 헬스 체크 (캐시됨)
 *
 * @param forceCheck 강제 체크 여부
 * @returns Redis 상태 정보
 */
export async function checkRedisHealth(
  forceCheck = false
): Promise<RedisStatus> {
  const now = Date.now();

  // 캐시된 결과 반환 (1분 이내)
  if (!forceCheck && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return {
      available: isRedisAvailable,
      lastCheck: lastHealthCheck,
    };
  }

  const client = getRedisClient();

  if (!client) {
    return {
      available: false,
      lastCheck: now,
      error: 'Redis client not initialized',
    };
  }

  try {
    // PING 명령어로 연결 확인
    const pong = await client.ping();
    isRedisAvailable = pong === 'PONG';
    lastHealthCheck = now;

    return {
      available: isRedisAvailable,
      lastCheck: now,
    };
  } catch (error) {
    isRedisAvailable = false;
    lastHealthCheck = now;

    return {
      available: false,
      lastCheck: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 안전한 Redis 연산 래퍼
 * 실패 시 undefined 반환 (서비스 중단 방지)
 *
 * @param operation Redis 연산 함수
 * @param fallback 폴백 값
 * @returns 연산 결과 또는 폴백 값
 */
export async function safeRedisOp<T>(
  operation: (client: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  const client = getRedisClient();

  if (!client || !isRedisAvailable) {
    return fallback;
  }

  try {
    return await operation(client);
  } catch (error) {
    logger.error('[Redis] Operation failed:', error);
    // 연속 실패 시 Redis 비활성화 (Circuit Breaker 역할)
    isRedisAvailable = false;
    scheduleRecovery();
    return fallback;
  }
}

/**
 * Redis 자동 복구 스케줄러
 * safeRedisOp 실패 시 호출, 중복 스케줄 방지
 */
function scheduleRecovery(): void {
  if (recoveryScheduled) return;
  recoveryScheduled = true;
  setTimeout(async () => {
    recoveryScheduled = false;
    const status = await checkRedisHealth(true);
    if (status.available) {
      logger.info('[Redis] Auto-recovery succeeded');
    } else {
      logger.warn(
        '[Redis] Auto-recovery failed, will retry on next operation failure'
      );
    }
  }, RECOVERY_DELAY_MS);
}

/**
 * Redis 연결 재시도
 * 장애 복구 시 호출
 */
export async function reconnectRedis(): Promise<boolean> {
  // 기존 인스턴스 초기화
  redisInstance = null;
  isRedisAvailable = true;

  // 새 인스턴스 생성 시도
  const client = getRedisClient();

  if (!client) {
    return false;
  }

  // 헬스 체크
  const status = await checkRedisHealth(true);
  return status.available;
}

/**
 * Redis 비활성화 (환경 변수로 제어)
 */
export function isRedisDisabled(): boolean {
  return process.env.REDIS_ENABLED === 'false';
}

// ============================================================================
// Convenience Methods (for Job Queue compatibility)
// ============================================================================

/**
 * Safe Redis GET with automatic JSON parsing
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return null;

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
 * @param ttlSeconds - TTL in seconds
 */
export async function redisSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !isRedisAvailable) return false;

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
  if (!client || !isRedisAvailable) return false;

  try {
    await client.del(key);
    return true;
  } catch (e) {
    logger.warn(`[Redis] DEL failed for ${key}:`, e);
    return false;
  }
}

/**
 * Safe Redis MGET for batch retrieval (N+1 query prevention)
 * @param keys - Array of keys to fetch
 * @returns Array of values (null for missing keys)
 */
export async function redisMGet<T>(keys: string[]): Promise<(T | null)[]> {
  const client = getRedisClient();
  if (!client || !isRedisAvailable || keys.length === 0) {
    return keys.map(() => null);
  }

  try {
    const values = await client.mget<(T | null)[]>(...keys);
    return values;
  } catch (e) {
    logger.warn(`[Redis] MGET failed for ${keys.length} keys:`, e);
    return keys.map(() => null);
  }
}
