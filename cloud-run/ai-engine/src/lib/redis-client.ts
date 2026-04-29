import { getUpstashConfig } from './config-parser';
import { logger } from './logger';

// Circuit Breaker: N번 연속 실패 시 30초 동안 Redis 시도 차단 → in-memory fallback 즉시 진입
const CB_FAILURE_THRESHOLD = 3;
const CB_OPEN_DURATION_MS = 30_000;

export type RedisCircuitStateName = 'closed' | 'open' | 'half_open';

export interface RedisCircuitStateSnapshot {
  state: RedisCircuitStateName;
  consecutiveFailures: number;
  retryAfterMs: number;
  halfOpenProbeInFlight: boolean;
}

/**
 * Standardized Redis Client for Upstash REST API
 * @version 1.1.0
 */
export class RedisClient {
  private static config = getUpstashConfig();

  // Circuit Breaker state (module-level singleton, Cloud Run MAX_INSTANCES=1이므로 안전)
  private static cbConsecutiveFailures = 0;
  private static cbOpenUntil = 0;
  private static cbHalfOpenProbeInFlight = false;

  static resetConfig(): void {
    this.config = getUpstashConfig();
  }

  /** Circuit Breaker 상태 초기화 (테스트 전용) */
  static resetCircuitBreaker(): void {
    this.cbConsecutiveFailures = 0;
    this.cbOpenUntil = 0;
    this.cbHalfOpenProbeInFlight = false;
  }

  /** Circuit 상태를 부작용 없이 조회한다. health endpoint에서 사용한다. */
  static getCircuitState(): RedisCircuitStateSnapshot {
    if (this.cbOpenUntil === 0) {
      return {
        state: 'closed',
        consecutiveFailures: this.cbConsecutiveFailures,
        retryAfterMs: 0,
        halfOpenProbeInFlight: false,
      };
    }

    const retryAfterMs = this.cbOpenUntil - Date.now();
    return {
      state: retryAfterMs > 0 ? 'open' : 'half_open',
      consecutiveFailures: this.cbConsecutiveFailures,
      retryAfterMs: Math.max(0, retryAfterMs),
      halfOpenProbeInFlight: this.cbHalfOpenProbeInFlight,
    };
  }

  /** Circuit가 fully closed가 아닌지 반환한다. */
  static isCircuitOpen(): boolean {
    return this.getCircuitState().state !== 'closed';
  }

  /**
   * Redis 호출 전 short-circuit 여부를 결정한다.
   * HALF_OPEN 상태에서는 probe 1개만 통과시키고 동시 probe는 차단한다.
   */
  private static shouldShortCircuit(): boolean {
    if (this.cbOpenUntil === 0) return false;
    if (Date.now() < this.cbOpenUntil) return true;
    if (this.cbHalfOpenProbeInFlight) return true;

    this.cbHalfOpenProbeInFlight = true;
    return false;
  }

  private static recordSuccess(): void {
    if (this.cbConsecutiveFailures > 0) {
      logger.info('[Redis] Circuit closed — connection recovered');
    }
    this.cbConsecutiveFailures = 0;
    this.cbOpenUntil = 0;
    this.cbHalfOpenProbeInFlight = false;
  }

  private static recordFailure(command: string): void {
    this.cbConsecutiveFailures++;
    this.cbHalfOpenProbeInFlight = false;
    if (this.cbConsecutiveFailures >= CB_FAILURE_THRESHOLD) {
      this.cbOpenUntil = Date.now() + CB_OPEN_DURATION_MS;
      logger.warn(
        `[Redis] Circuit opened after ${this.cbConsecutiveFailures} failures on ${command} — in-memory fallback active for ${CB_OPEN_DURATION_MS / 1000}s`
      );
    }
  }

  private static async fetchRedis<T = unknown>(
    command: string[],
    options?: RedisCommandOptions
  ): Promise<T | null> {
    if (!this.config) {
      logger.warn('[Redis] Config not found, skipping operation');
      return null;
    }

    // Circuit Breaker: open 상태면 즉시 null 반환 (timeout 대기 없음)
    if (this.shouldShortCircuit()) {
      return null;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const controller = options?.timeoutMs
      ? new AbortController()
      : undefined;
    if (controller && options?.timeoutMs) {
      timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    }

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: controller?.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error(`[Redis] Error executing ${command[0]}:`, error);
        this.recordFailure(command[0]);
        return null;
      }

      const data = (await response.json()) as { result: T | null };
      this.recordSuccess();
      return data.result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn(
          `[Redis] Timeout executing ${command[0]} after ${options?.timeoutMs}ms`
        );
        this.recordFailure(command[0]);
        return null;
      }
      logger.error(`[Redis] Network error executing ${command[0]}:`, err);
      this.recordFailure(command[0]);
      return null;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  static async get<T>(
    key: string,
    options?: RedisCommandOptions
  ): Promise<T | null> {
    const value = await this.fetchRedis<string>(['GET', key], options);
    if (value === null || value === undefined) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  static async set<T extends string | number | object>(
    key: string,
    value: T,
    ttlSeconds?: number,
    options?: RedisCommandOptions
  ): Promise<boolean> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const command = ttlSeconds 
      ? ['SET', key, stringValue, 'EX', ttlSeconds.toString()] 
      : ['SET', key, stringValue];
    return (await this.fetchRedis(command, options)) !== null;
  }

  static async del(
    key: string,
    options?: RedisCommandOptions
  ): Promise<boolean> {
    const result = await this.fetchRedis(['DEL', key], options);
    return typeof result === 'number' ? result > 0 : Number(result ?? 0) > 0;
  }

  static async incr(
    key: string,
    options?: RedisCommandOptions
  ): Promise<number> {
    const result = await this.fetchRedis(['INCR', key], options);
    return typeof result === 'number' ? result : Number(result ?? 0);
  }

  static async expire(
    key: string,
    ttlSeconds: number,
    options?: RedisCommandOptions
  ): Promise<void> {
    await this.fetchRedis(['EXPIRE', key, ttlSeconds.toString()], options);
  }

  static async pexpire(
    key: string,
    ttlMs: number,
    options?: RedisCommandOptions
  ): Promise<void> {
    await this.fetchRedis(['PEXPIRE', key, ttlMs.toString()], options);
  }

  static async pttl(
    key: string,
    options?: RedisCommandOptions
  ): Promise<number> {
    const result = await this.fetchRedis(['PTTL', key], options);
    return typeof result === 'number' ? result : Number(result ?? -1);
  }

  static async eval<T = unknown>(
    script: string,
    keys: string[],
    args: string[] = [],
    options?: RedisCommandOptions
  ): Promise<T | null> {
    const command = [
      'EVAL',
      script,
      keys.length.toString(),
      ...keys,
      ...args,
    ];
    return this.fetchRedis<T>(command, options);
  }
}

export interface RedisCommandOptions {
  timeoutMs?: number;
}

export interface RedisLikeClient {
  get: <T>(key: string, options?: RedisCommandOptions) => Promise<T | null>;
  set: <T extends string | number | object>(
    key: string,
    value: T,
    ttlSeconds?: number,
    options?: RedisCommandOptions
  ) => Promise<boolean>;
  del: (key: string, options?: RedisCommandOptions) => Promise<boolean>;
  incr: (key: string, options?: RedisCommandOptions) => Promise<number>;
  expire: (
    key: string,
    ttlSeconds: number,
    options?: RedisCommandOptions
  ) => Promise<void>;
  pexpire: (
    key: string,
    ttlMs: number,
    options?: RedisCommandOptions
  ) => Promise<void>;
  pttl: (key: string, options?: RedisCommandOptions) => Promise<number>;
  eval: <T = unknown>(
    script: string,
    keys: string[],
    args?: string[],
    options?: RedisCommandOptions
  ) => Promise<T | null>;
}

export function getRedisClient(): RedisLikeClient | null {
  const config = getUpstashConfig();
  if (!config) return null;
  return {
    get: RedisClient.get.bind(RedisClient),
    set: RedisClient.set.bind(RedisClient),
    del: RedisClient.del.bind(RedisClient),
    incr: RedisClient.incr.bind(RedisClient),
    expire: RedisClient.expire.bind(RedisClient),
    pexpire: RedisClient.pexpire.bind(RedisClient),
    pttl: RedisClient.pttl.bind(RedisClient),
    eval: RedisClient.eval.bind(RedisClient),
  };
}

export function isRedisAvailable(): boolean {
  return getUpstashConfig() !== null;
}

/** Redis Circuit Breaker가 open(장애) 상태인지 반환 */
export function isRedisDegraded(): boolean {
  return RedisClient.isCircuitOpen();
}

export function getRedisCircuitState(): RedisCircuitStateSnapshot {
  return RedisClient.getCircuitState();
}

export async function redisGet<T>(
  key: string,
  options?: RedisCommandOptions
): Promise<T | null> {
  if (!isRedisAvailable()) return null;
  return RedisClient.get<T>(key, options);
}

export async function redisSet<T extends string | number | object>(
  key: string,
  value: T,
  ttlSeconds?: number,
  options?: RedisCommandOptions
): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  return RedisClient.set(key, value, ttlSeconds, options);
}

export async function redisDel(
  key: string,
  options?: RedisCommandOptions
): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  return RedisClient.del(key, options);
}

export function resetRedisClient(): void {
  RedisClient.resetConfig();
}
