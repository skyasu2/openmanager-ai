import { getUpstashConfig } from './config-parser';
import { logger } from './logger';

/**
 * Standardized Redis Client for Upstash REST API
 * @version 1.0.0
 */
export class RedisClient {
  private static config = getUpstashConfig();

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
}
