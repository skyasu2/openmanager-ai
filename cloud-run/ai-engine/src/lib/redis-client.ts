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

  private static async fetchRedis(command: string[]): Promise<any> {
    if (!this.config) {
      logger.warn('[Redis] Config not found, skipping operation');
      return null;
    }

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error(`[Redis] Error executing ${command[0]}:`, error);
        return null;
      }

      const data = await response.json();
      return data.result;
    } catch (err) {
      logger.error(`[Redis] Network error executing ${command[0]}:`, err);
      return null;
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    const value = await this.fetchRedis(['GET', key]);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  static async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const command = ttlSeconds 
      ? ['SET', key, stringValue, 'EX', ttlSeconds.toString()] 
      : ['SET', key, stringValue];
    await this.fetchRedis(command);
  }

  static async del(key: string): Promise<void> {
    await this.fetchRedis(['DEL', key]);
  }

  static async incr(key: string): Promise<number> {
    const result = await this.fetchRedis(['INCR', key]);
    return typeof result === 'number' ? result : Number(result ?? 0);
  }

  static async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.fetchRedis(['EXPIRE', key, ttlSeconds.toString()]);
  }

  static async pexpire(key: string, ttlMs: number): Promise<void> {
    await this.fetchRedis(['PEXPIRE', key, ttlMs.toString()]);
  }

  static async pttl(key: string): Promise<number> {
    const result = await this.fetchRedis(['PTTL', key]);
    return typeof result === 'number' ? result : Number(result ?? -1);
  }
}

export interface RedisLikeClient {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, ttlSeconds: number) => Promise<void>;
  pexpire: (key: string, ttlMs: number) => Promise<void>;
  pttl: (key: string) => Promise<number>;
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

export async function redisGet<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) return null;
  return RedisClient.get<T>(key);
}

export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  await RedisClient.set(key, value, ttlSeconds);
  return true;
}

export async function redisDel(key: string): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  await RedisClient.del(key);
  return true;
}

/**
 * Upstash REST client does not provide key scan in this wrapper.
 * Keep signature for compatibility with legacy callers/tests.
 */
export async function redisDelByPattern(_pattern: string): Promise<number> {
  return 0;
}

export function resetRedisClient(): void {
  RedisClient.resetConfig();
}
