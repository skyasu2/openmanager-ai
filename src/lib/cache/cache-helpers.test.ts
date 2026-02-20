/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  createCachedResponse,
  createCacheHeaders,
  createCacheHeadersFromPreset,
  normalizeQueryForCache,
} from './cache-helpers';

describe('createCacheHeaders', () => {
  it('should return default cache headers', () => {
    const headers = createCacheHeaders();

    expect(headers['Cache-Control']).toContain('public');
    expect(headers['Cache-Control']).toContain('max-age=0');
    expect(headers['Cache-Control']).toContain('s-maxage=30');
    expect(headers['CDN-Cache-Control']).toBeDefined();
    expect(headers['Vercel-CDN-Cache-Control']).toBeDefined();
  });

  it('should apply custom maxAge and sMaxAge', () => {
    const headers = createCacheHeaders({ maxAge: 60, sMaxAge: 300 });

    expect(headers['Cache-Control']).toContain('max-age=60');
    expect(headers['Cache-Control']).toContain('s-maxage=300');
  });

  it('should set private cache-control', () => {
    const headers = createCacheHeaders({ isPrivate: true });

    expect(headers['Cache-Control']).toContain('private');
    expect(headers['Cache-Control']).not.toContain('public');
  });

  it('should include stale-while-revalidate', () => {
    const headers = createCacheHeaders({ staleWhileRevalidate: 120 });

    expect(headers['Cache-Control']).toContain('stale-while-revalidate=120');
  });
});

describe('createCacheHeadersFromPreset', () => {
  it('should create headers from REALTIME preset', () => {
    const headers = createCacheHeadersFromPreset('REALTIME');

    expect(headers['Cache-Control']).toContain('max-age=0');
    expect(headers['Cache-Control']).toContain('s-maxage=30');
  });

  it('should create headers from DASHBOARD preset', () => {
    const headers = createCacheHeadersFromPreset('DASHBOARD');

    expect(headers['Cache-Control']).toContain('max-age=60');
    expect(headers['Cache-Control']).toContain('s-maxage=300');
  });

  it('should support private flag', () => {
    const headers = createCacheHeadersFromPreset('REALTIME', true);

    expect(headers['Cache-Control']).toContain('private');
  });
});

describe('createCachedResponse', () => {
  it('should create response with default status 200', () => {
    const response = createCachedResponse({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBeDefined();
  });

  it('should create response with custom status', () => {
    const response = createCachedResponse(
      { error: 'not found' },
      { status: 404 }
    );

    expect(response.status).toBe(404);
  });

  it('should accept preset option', () => {
    const response = createCachedResponse(
      { items: [] },
      { preset: 'DASHBOARD' }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
  });

  it('should serialize body as JSON', async () => {
    const data = { count: 5, items: ['a', 'b'] };
    const response = createCachedResponse(data);
    const body = await response.json();

    expect(body).toEqual(data);
  });
});

describe('normalizeQueryForCache', () => {
  it('구두점/불용어 제거 후 의미 토큰으로 정규화한다', () => {
    const normalized = normalizeQueryForCache('  서버 상태! 알려줘?? ');
    expect(normalized).toBe('server status');
  });

  it('어순이 달라도 동일한 의미 질의는 같은 키를 생성한다', () => {
    const a = normalizeQueryForCache('CPU usage 메모리');
    const b = normalizeQueryForCache('메모리 cpu 사용률');
    expect(a).toBe('cpu memory utilization');
    expect(a).toBe(b);
  });

  it('숫자 조건은 유지해서 서로 다른 질의를 구분한다', () => {
    const top5 = normalizeQueryForCache('top 5 서버 상태');
    const top10 = normalizeQueryForCache('top 10 server status');
    expect(top5).toBe('5 server status top');
    expect(top10).toBe('10 server status top');
    expect(top5).not.toBe(top10);
  });

  it('모든 토큰이 불용어로 제거되면 기본 정규화 문자열을 사용한다', () => {
    expect(normalizeQueryForCache('Please show me')).toBe('please show me');
  });
});
