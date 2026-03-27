import { getUpstashConfig } from './config-parser';
import { logger } from './logger';

/**
 * Standardized Redis Client for Upstash REST API
 * @version 1.0.0
 */
export class RedisClient {
  private static config = getUpstashConfig();

  static resetConfig(): void {
    this.config = getUpstashConfig();
  }

  private static async fetchRedis<T = unknown>(
    command: string[],
    options?: RedisCommandOptions
  ): Promise<T | null> {
    if (!this.config) {
      logger.warn('[Redis] Config not found, skipping operation');
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
        return null;
      }

      const data = (await response.json()) as { result: T | null };
      return data.result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn(
          `[Redis] Timeout executing ${command[0]} after ${options?.timeoutMs}ms`
        );
        return null;
      }
      logger.error(`[Redis] Network error executing ${command[0]}:`, err);
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
  ): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const command = ttlSeconds 
      ? ['SET', key, stringValue, 'EX', ttlSeconds.toString()] 
      : ['SET', key, stringValue];
    await this.fetchRedis(command, options);
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
  ) => Promise<void>;
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
  };
}

export function isRedisAvailable(): boolean {
  return getUpstashConfig() !== null;
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
  await RedisClient.set(key, value, ttlSeconds, options);
  return true;
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
