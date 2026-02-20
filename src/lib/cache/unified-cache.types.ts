export interface CacheItem<T = unknown> {
  value: T;
  expires: number;
  created: number;
  hits: number;
  namespace: string;
  pattern?: string;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  maxSize: number;
  hitRate: number;
  memoryUsage: string;
  namespaces: Record<string, number>;
}

export interface QueryPattern {
  id: string;
  regex: string;
  frequency: number;
  avgResponseTime: number;
  lastUsed: Date;
  hits: number;
}

export enum CacheNamespace {
  GENERAL = 'general',
  AI_QUERY = 'ai_query',
  AI_RESPONSE = 'ai_response',
  API = 'api',
  SERVER_METRICS = 'server_metrics',
  USER_SESSION = 'user_session',
}

export const CacheTTL = {
  SHORT: 30,
  MEDIUM: 300,
  LONG: 1800,
  STATIC: 3600,
} as const;

export const SWRPreset = {
  REALTIME: {
    maxAge: 0,
    sMaxAge: CacheTTL.SHORT,
    staleWhileRevalidate: CacheTTL.SHORT * 2,
  },
  DASHBOARD: {
    maxAge: 60,
    sMaxAge: CacheTTL.MEDIUM,
    staleWhileRevalidate: CacheTTL.MEDIUM * 2,
  },
  CONFIG: {
    maxAge: CacheTTL.MEDIUM,
    sMaxAge: CacheTTL.LONG,
    staleWhileRevalidate: CacheTTL.LONG * 2,
  },
  STATIC: {
    maxAge: CacheTTL.LONG,
    sMaxAge: CacheTTL.STATIC,
    staleWhileRevalidate: CacheTTL.STATIC * 2,
  },
} as const;

export type SWRPresetKey = keyof typeof SWRPreset;
