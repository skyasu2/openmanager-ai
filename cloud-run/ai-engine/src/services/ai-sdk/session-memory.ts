import { RedisClient } from '../../lib/redis-client';
import { logger } from '../../lib/logger';
import type { ModelMessage } from 'ai';

/**
 * Session Memory Service
 * 
 * Manages chat history and context in Redis for separate backends.
 * Solves the state-less limitation of Edge runtimes.
 */
export class SessionMemoryService {
  private static TTL = 3600; // 1 Hour

  static async getHistory(sessionId: string): Promise<ModelMessage[]> {
    if (!sessionId) return [];
    const history = await RedisClient.get<ModelMessage[]>(`chat:history:${sessionId}`);
    if (history) {
      logger.debug(`[SessionMemory] Retrieved ${history.length} messages for ${sessionId}`);
      return history;
    }
    return [];
  }

  static async saveHistory(sessionId: string, messages: ModelMessage[]): Promise<void> {
    if (!sessionId || !messages.length) return;
    
    // Keep only last 20 messages to prevent token bloat
    const limitedMessages = messages.slice(-20);
    await RedisClient.set(`chat:history:${sessionId}`, limitedMessages, this.TTL);
    logger.debug(`[SessionMemory] Saved ${limitedMessages.length} messages for ${sessionId}`);
  }

  /**
   * Cache expensive tool results (e.g., metrics or analysis)
   */
  static async getToolCache<T>(toolName: string, queryKey: string): Promise<T | null> {
    const cacheKey = `tool:cache:${toolName}:${queryKey}`;
    return await RedisClient.get<T>(cacheKey);
  }

  static async setToolCache(toolName: string, queryKey: string, result: any, ttl = 60): Promise<void> {
    const cacheKey = `tool:cache:${toolName}:${queryKey}`;
    await RedisClient.set(cacheKey, result, ttl);
  }
}
