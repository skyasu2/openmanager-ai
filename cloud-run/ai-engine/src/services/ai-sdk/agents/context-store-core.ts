import { getRedisClient } from '../../../lib/redis-client';
import { logger } from '../../../lib/logger';
import type { AgentContext } from './context-store-types';

/** Parse CONTEXT_TTL_SECONDS from environment, default 1800 (30 minutes) */
const parsedTtl = Number.parseInt(process.env.CONTEXT_TTL_SECONDS ?? '', 10);
const contextTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 1800;

export const CONTEXT_CONFIG = {
  keyPrefix: 'ai:context:',
  ttlSeconds: contextTtl,
  maxHandoffs: 20,
  maxAnomalies: 50,
  maxMetrics: 100,
} as const;

const inMemoryStore = new Map<string, { context: AgentContext; expiresAt: number }>();

function cleanExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of inMemoryStore) {
    if (value.expiresAt < now) {
      inMemoryStore.delete(key);
    }
  }
}

function getRedisKey(sessionId: string): string {
  return `${CONTEXT_CONFIG.keyPrefix}${sessionId}`;
}

function createDefaultContext(sessionId: string, query: string = ''): AgentContext {
  const now = new Date().toISOString();
  return {
    sessionId,
    findings: {
      anomalies: [],
      rootCause: null,
      affectedServers: [],
      metrics: [],
      knowledgeResults: [],
      recommendedCommands: [],
    },
    lastAgent: 'Orchestrator',
    handoffs: [],
    query,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSessionContext(sessionId: string): Promise<AgentContext | null> {
  const redis = getRedisClient();
  const key = getRedisKey(sessionId);

  if (redis) {
    try {
      const data = await redis.get(key);
      if (data) {
        const context = typeof data === 'string' ? JSON.parse(data) : data;
        return context as AgentContext;
      }
    } catch (error) {
      logger.warn(`[ContextStore] Redis get error for ${sessionId}:`, error);
    }
  }

  cleanExpiredEntries();
  const cached = inMemoryStore.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  return null;
}

export async function saveSessionContext(context: AgentContext): Promise<void> {
  const redis = getRedisClient();
  const key = getRedisKey(context.sessionId);

  context.updatedAt = new Date().toISOString();

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(context));
      await redis.expire(key, CONTEXT_CONFIG.ttlSeconds);
    } catch (error) {
      logger.warn(`[ContextStore] Redis save error for ${context.sessionId}:`, error);
    }
  }

  inMemoryStore.set(key, {
    context,
    expiresAt: Date.now() + CONTEXT_CONFIG.ttlSeconds * 1000,
  });
}

export async function getOrCreateSessionContext(
  sessionId: string,
  query: string = ''
): Promise<AgentContext> {
  const existing = await getSessionContext(sessionId);
  if (existing) {
    if (query && query !== existing.query) {
      existing.query = query;
      existing.updatedAt = new Date().toISOString();
      await saveSessionContext(existing);
    }
    return existing;
  }

  const newContext = createDefaultContext(sessionId, query);
  await saveSessionContext(newContext);
  return newContext;
}

export async function updateSessionContext(
  sessionId: string,
  update: Partial<Omit<AgentContext, 'sessionId' | 'createdAt'>>
): Promise<AgentContext> {
  const context = await getOrCreateSessionContext(sessionId);

  if (update.findings) {
    Object.assign(context.findings, update.findings);
  }
  if (update.lastAgent) {
    context.lastAgent = update.lastAgent;
  }
  if (update.handoffs) {
    context.handoffs = [...context.handoffs, ...update.handoffs].slice(-CONTEXT_CONFIG.maxHandoffs);
  }
  if (update.query) {
    context.query = update.query;
  }

  await saveSessionContext(context);
  return context;
}

export async function deleteSessionContext(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  const key = getRedisKey(sessionId);

  if (redis) {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn(`[ContextStore] Redis delete error for ${sessionId}:`, error);
    }
  }

  inMemoryStore.delete(key);
  logger.info(`[ContextStore] Deleted context for ${sessionId}`);
}

export function getContextStoreStats(): {
  inMemoryCount: number;
  oldestEntry: string | null;
} {
  cleanExpiredEntries();
  const entries = Array.from(inMemoryStore.entries());

  let oldestEntry: string | null = null;
  let oldestTime = Number.POSITIVE_INFINITY;

  for (const [key, value] of entries) {
    const context = value.context;
    const createdTime = new Date(context.createdAt).getTime();
    if (createdTime < oldestTime) {
      oldestTime = createdTime;
      oldestEntry = key;
    }
  }

  return {
    inMemoryCount: inMemoryStore.size,
    oldestEntry,
  };
}
