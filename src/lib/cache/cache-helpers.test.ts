import { describe, expect, it, vi } from 'vitest';

vi.mock('./unified-cache', () => ({
  CacheNamespace: {
    GENERAL: 'general',
    AI_QUERY: 'ai_query',
    AI_RESPONSE: 'ai_response',
    API: 'api',
    SERVER_METRICS: 'server_metrics',
    USER_SESSION: 'user_session',
  },
  CacheTTL: { SHORT: 30, MEDIUM: 300, LONG: 1800, STATIC: 3600 },
  SWRPreset: {
    REALTIME: { maxAge: 0, sMaxAge: 30, staleWhileRevalidate: 60 },
    DASHBOARD: { maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 },
    CONFIG: { maxAge: 300, sMaxAge: 1800, staleWhileRevalidate: 3600 },
    STATIC: { maxAge: 1800, sMaxAge: 3600, staleWhileRevalidate: 7200 },
  },
  UnifiedCacheService: { getInstance: vi.fn() },
}));

import {
  createCacheHeaders,
  createCacheHeadersFromPreset,
  hashString,
} from './cache-helpers';

describe('hashString', () => {
  it('returns a string', () => {
    expect(typeof hashString('hello')).toBe('string');
  });

  it('same input produces same output (deterministic)', () => {
    expect(hashString('test-input')).toBe(hashString('test-input'));
  });

  it('different inputs produce different outputs', () => {
    expect(hashString('input-a')).not.toBe(hashString('input-b'));
  });

  it('empty string returns a valid hash', () => {
    const result = hashString('');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles long strings', () => {
    const longStr = 'a'.repeat(10_000);
    const result = hashString(longStr);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('output is base-36 encoded', () => {
    const result = hashString('base36-check');
    // base-36 uses only digits 0-9 and lowercase letters a-z
    expect(result).toMatch(/^[0-9a-z]+$/);
  });
});

describe('createCacheHeaders', () => {
  it('returns all 3 header keys', () => {
    const headers = createCacheHeaders();
    expect(headers).toHaveProperty('Cache-Control');
    expect(headers).toHaveProperty('CDN-Cache-Control');
    expect(headers).toHaveProperty('Vercel-CDN-Cache-Control');
  });

  it('uses correct default values', () => {
    const headers = createCacheHeaders();
    expect(headers['Cache-Control']).toBe(
      'public, max-age=0, s-maxage=30, stale-while-revalidate=60'
    );
    expect(headers['CDN-Cache-Control']).toBe('public, s-maxage=30');
    expect(headers['Vercel-CDN-Cache-Control']).toBe('public, s-maxage=30');
  });

  it('applies custom maxAge, sMaxAge, staleWhileRevalidate values', () => {
    const headers = createCacheHeaders({
      maxAge: 120,
      sMaxAge: 600,
      staleWhileRevalidate: 1200,
    });
    expect(headers['Cache-Control']).toBe(
      'public, max-age=120, s-maxage=600, stale-while-revalidate=1200'
    );
    expect(headers['CDN-Cache-Control']).toBe('public, s-maxage=600');
    expect(headers['Vercel-CDN-Cache-Control']).toBe('public, s-maxage=600');
  });

  it('isPrivate=true sets private in Cache-Control', () => {
    const headers = createCacheHeaders({ isPrivate: true });
    expect(headers['Cache-Control']).toContain('private');
    expect(headers['Cache-Control']).not.toContain('public');
  });

  it('CDN headers always use public regardless of isPrivate', () => {
    const headers = createCacheHeaders({ isPrivate: true });
    expect(headers['CDN-Cache-Control']).toContain('public');
    expect(headers['Vercel-CDN-Cache-Control']).toContain('public');
  });
});

describe('createCacheHeadersFromPreset', () => {
  it('REALTIME preset has correct values', () => {
    const headers = createCacheHeadersFromPreset('REALTIME');
    expect(headers['Cache-Control']).toBe(
      'public, max-age=0, s-maxage=30, stale-while-revalidate=60'
    );
  });

  it('STATIC preset has correct values', () => {
    const headers = createCacheHeadersFromPreset('STATIC');
    expect(headers['Cache-Control']).toBe(
      'public, max-age=1800, s-maxage=3600, stale-while-revalidate=7200'
    );
  });

  it('isPrivate flag works with presets', () => {
    const headers = createCacheHeadersFromPreset('REALTIME', true);
    expect(headers['Cache-Control']).toContain('private');
    expect(headers['CDN-Cache-Control']).toContain('public');
  });
});
