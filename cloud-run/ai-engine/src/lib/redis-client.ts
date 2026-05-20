import { Redis } from '@upstash/redis';
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
  expire: (key: string, ttlSeconds: number, options?: RedisCommandOptions) => Promise<void>;
  pexpire: (key: string, ttlMs: number, options?: RedisCommandOptions) => Promise<void>;
  pttl: (key: string, options?: RedisCommandOptions) => Promise<number>;
  // Redis EVAL executes a Lua script atomically on the server (not JS eval)
  eval: <T = unknown>(
    script: string,
    keys: string[],
    args?: string[],
    options?: RedisCommandOptions
  ) => Promise<T | null>;
}

// ============================================================================
// SDK Singleton
// ============================================================================

let _sdk: Redis | null = null;

function getSdk(): Redis | null {
  if (_sdk) return _sdk;
  const config = getUpstashConfig();
  if (!config) return null;
  // enableAutoPipelining: false — Circuit Breaker가 개별 호출을 래핑하므로
  // 파이프라인 배치와 혼용하면 실패 계수가 꼬일 수 있음
  _sdk = new Redis({ url: config.url, token: config.token, enableAutoPipelining: false });
  return _sdk;
}

// ============================================================================
// Circuit Breaker (module-level state, Cloud Run MAX_INSTANCES=1이므로 안전)
// ============================================================================

let cbConsecutiveFailures = 0;
let cbOpenUntil = 0;
let cbHalfOpenProbeInFlight = false;

function getCircuitStateInternal(): RedisCircuitStateSnapshot {
  if (cbOpenUntil === 0) {
    return {
      state: 'closed',
      consecutiveFailures: cbConsecutiveFailures,
      retryAfterMs: 0,
      halfOpenProbeInFlight: false,
    };
  }
  const retryAfterMs = cbOpenUntil - Date.now();
  return {
    state: retryAfterMs > 0 ? 'open' : 'half_open',
    consecutiveFailures: cbConsecutiveFailures,
    retryAfterMs: Math.max(0, retryAfterMs),
    halfOpenProbeInFlight: cbHalfOpenProbeInFlight,
  };
}

function shouldShortCircuit(): boolean {
  if (cbOpenUntil === 0) return false;
  if (Date.now() < cbOpenUntil) return true;
  if (cbHalfOpenProbeInFlight) return true;
  cbHalfOpenProbeInFlight = true;
  return false;
}

function recordSuccess(): void {
  if (cbConsecutiveFailures > 0) {
    logger.info('[Redis] Circuit closed — connection recovered');
  }
  cbConsecutiveFailures = 0;
  cbOpenUntil = 0;
  cbHalfOpenProbeInFlight = false;
}

function recordFailure(command: string): void {
  cbConsecutiveFailures++;
  cbHalfOpenProbeInFlight = false;
  if (cbConsecutiveFailures >= CB_FAILURE_THRESHOLD) {
    cbOpenUntil = Date.now() + CB_OPEN_DURATION_MS;
    logger.warn(
      `[Redis] Circuit opened after ${cbConsecutiveFailures} failures on ${command} — in-memory fallback active for ${CB_OPEN_DURATION_MS / 1000}s`
    );
  }
}

// ============================================================================
// Core executor: Circuit Breaker + optional per-call timeout
// ============================================================================

async function withCB<T>(
  command: string,
  op: (sdk: Redis) => Promise<T>,
  options?: RedisCommandOptions
): Promise<T | null> {
  const sdk = getSdk();
  if (!sdk) {
    logger.warn('[Redis] Config not found, skipping operation');
    return null;
  }

  if (shouldShortCircuit()) return null;

  try {
    let promise = op(sdk);

    if (options?.timeoutMs) {
      const ms = options.timeoutMs;
      promise = Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`[Redis] ${command} timed out after ${ms}ms`)),
            ms
          )
        ),
      ]);
    }

    const result = await promise;
    recordSuccess();
    return result;
  } catch (err) {
    if (err instanceof Error && err.message.includes('timed out')) {
      logger.warn(`[Redis] Timeout on ${command} after ${options?.timeoutMs}ms`);
    } else {
      logger.error(`[Redis] Error on ${command}:`, err);
    }
    recordFailure(command);
    return null;
  }
}

// ============================================================================
// RedisClient — same public API as before, internals replaced with SDK
// ============================================================================

export class RedisClient {
  /** SDK 인스턴스 재초기화 (설정 변경 후 또는 테스트용) */
  static resetConfig(): void {
    _sdk = null;
  }

  /** Circuit Breaker 상태 초기화 (테스트 전용) */
  static resetCircuitBreaker(): void {
    cbConsecutiveFailures = 0;
    cbOpenUntil = 0;
    cbHalfOpenProbeInFlight = false;
  }

  static getCircuitState(): RedisCircuitStateSnapshot {
    return getCircuitStateInternal();
  }

  static isCircuitOpen(): boolean {
    return getCircuitStateInternal().state !== 'closed';
  }

  static async get<T>(key: string, options?: RedisCommandOptions): Promise<T | null> {
    return withCB('GET', (sdk) => sdk.get<T>(key), options);
  }

  static async set<T extends string | number | object>(
    key: string,
    value: T,
    ttlSeconds?: number,
    options?: RedisCommandOptions
  ): Promise<boolean> {
    const result = await withCB(
      'SET',
      (sdk) => (ttlSeconds ? sdk.set(key, value, { ex: ttlSeconds }) : sdk.set(key, value)),
      options
    );
    return result !== null;
  }

  static async del(key: string, options?: RedisCommandOptions): Promise<boolean> {
    const result = await withCB('DEL', (sdk) => sdk.del(key), options);
    return typeof result === 'number' ? result > 0 : Number(result ?? 0) > 0;
  }

  static async incr(key: string, options?: RedisCommandOptions): Promise<number> {
    const result = await withCB('INCR', (sdk) => sdk.incr(key), options);
    return typeof result === 'number' ? result : Number(result ?? 0);
  }

  static async expire(
    key: string,
    ttlSeconds: number,
    options?: RedisCommandOptions
  ): Promise<void> {
    await withCB('EXPIRE', (sdk) => sdk.expire(key, ttlSeconds), options);
  }

  static async pexpire(
    key: string,
    ttlMs: number,
    options?: RedisCommandOptions
  ): Promise<void> {
    await withCB('PEXPIRE', (sdk) => sdk.pexpire(key, ttlMs), options);
  }

  static async pttl(key: string, options?: RedisCommandOptions): Promise<number> {
    const result = await withCB('PTTL', (sdk) => sdk.pttl(key), options);
    return typeof result === 'number' ? result : Number(result ?? -1);
  }

  // Redis EVAL: Lua 스크립트를 서버에서 원자적으로 실행 (JS eval 아님)
  static async runLuaScript<T = unknown>(
    script: string,
    keys: string[],
    args: string[] = [],
    options?: RedisCommandOptions
  ): Promise<T | null> {
    return withCB(
      'EVAL',
      (sdk) => (sdk as unknown as { eval: (s: string, k: string[], a: string[]) => Promise<T | null> }).eval(script, keys, args),
      options
    );
  }
}

// ============================================================================
// Convenience functions (unchanged API)
// ============================================================================

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
    eval: RedisClient.runLuaScript.bind(RedisClient),
  };
}

export function isRedisAvailable(): boolean {
  return getUpstashConfig() !== null;
}

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
