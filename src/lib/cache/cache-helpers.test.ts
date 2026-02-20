/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  createCachedResponse,
  createCacheHeaders,
  createCacheHeadersFromPreset,
  normalizeQueryForCache,
} from './cache-helpers';
import { CacheNamespace, UnifiedCacheService } from './unified-cache';

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

describe('invalidateSessionCache SCAN 패턴 경계', () => {
  /**
   * Redis glob(match) 규칙의 부분 집합(*, ?)을 사용해 SCAN 패턴 경계를 검증.
   * 현재 invalidateSessionCache 패턴은 *만 사용한다.
   */
  function redisGlobToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
  }

  it('세그먼트 패턴이 동일 세션 키만 매칭한다 (endpoint 있음/없음)', async () => {
    const { generateQueryHash, getSessionScanPatterns } = await import(
      '@/lib/redis/ai-cache'
    );

    const sessionId = 'session-abc';
    const [withEndpointScanPattern, withoutEndpointScanPattern] =
      getSessionScanPatterns(sessionId);
    const withEndpointPattern = redisGlobToRegex(withEndpointScanPattern);
    const withoutEndpointPattern = redisGlobToRegex(withoutEndpointScanPattern);
    const prefix = 'v2:ai:response';

    // 동일 세션 키 (endpoint 있음)
    const keyWithEp = `${prefix}:${generateQueryHash(sessionId, 'test query', 'supervisor')}`;
    // 동일 세션 키 (endpoint 없음)
    const keyNoEp = `${prefix}:${generateQueryHash(sessionId, 'test query')}`;

    expect(withEndpointPattern.test(keyWithEp)).toBe(true);
    expect(withoutEndpointPattern.test(keyNoEp)).toBe(true);
    expect(withEndpointPattern.test(keyNoEp)).toBe(false);
    expect(withoutEndpointPattern.test(keyWithEp)).toBe(false);
  });

  it('타 세션 키는 매칭하지 않는다', async () => {
    const { getSessionScanPatterns } = await import('@/lib/redis/ai-cache');
    const { hashString } = await import('@/lib/cache/cache-helpers');

    const [withEndpointScanPattern, withoutEndpointScanPattern] =
      getSessionScanPatterns('session-abc');
    const otherSessionHash = hashString('session-xyz');
    const prefix = 'v2:ai:response';

    const withEndpointPattern = redisGlobToRegex(withEndpointScanPattern);
    const withoutEndpointPattern = redisGlobToRegex(withoutEndpointScanPattern);

    // 타 세션의 키
    const otherKey1 = `${prefix}:supervisor:${otherSessionHash}:qhash1`;
    const otherKey2 = `${prefix}:${otherSessionHash}:qhash2`;

    expect(withEndpointPattern.test(otherKey1)).toBe(false);
    expect(withoutEndpointPattern.test(otherKey2)).toBe(false);
  });

  it('queryHash 내부에 sessionHash가 우연히 포함돼도 오매칭하지 않는다', async () => {
    const { getSessionScanPatterns } = await import('@/lib/redis/ai-cache');
    const { hashString } = await import('@/lib/cache/cache-helpers');

    const [withEndpointScanPattern, withoutEndpointScanPattern] =
      getSessionScanPatterns('session-abc');
    const sessionHash = hashString('session-abc');
    const prefix = 'v2:ai:response';

    const withEndpointPattern = redisGlobToRegex(withEndpointScanPattern);
    const withoutEndpointPattern = redisGlobToRegex(withoutEndpointScanPattern);

    // queryHash 자체가 sessionHash와 동일한 문자열인 타 세션 키
    // (세그먼트 분리 덕분에 구분 가능)
    const otherSessionHash = hashString('session-other');
    const trickyKey = `${prefix}:${otherSessionHash}:${sessionHash}`;

    // endpoint 패턴: 4세그먼트 구조 `prefix:ep:session:query` 기대
    // trickyKey는 3세그먼트(`prefix:otherSession:sessionHash`)이므로 불일치
    expect(withEndpointPattern.test(trickyKey)).toBe(false);
    // without 패턴: `prefix:session:*` 기대
    // trickyKey의 2번째 세그먼트가 otherSessionHash이므로 불일치
    expect(withoutEndpointPattern.test(trickyKey)).toBe(false);
  });
});

describe('교차 endpoint 캐시 키 격리', () => {
  // generateQueryHash와 generateCacheKey를 직접 import하여 테스트
  // ai-cache.ts와 ai-response-cache.ts의 키 생성 로직이 endpoint를 올바르게 포함하는지 검증

  it('동일 session + 동치 질의 + 다른 endpoint → 다른 Redis 키', async () => {
    const { generateQueryHash } = await import('@/lib/redis/ai-cache');
    const session = 'test-session-001';
    const query = 'CPU 사용률 알려줘';

    const supervisorKey = generateQueryHash(session, query, 'supervisor');
    const incidentKey = generateQueryHash(session, query, 'incident-report');
    const noEndpointKey = generateQueryHash(session, query);

    // endpoint가 다르면 키가 달라야 함
    expect(supervisorKey).not.toBe(incidentKey);
    // endpoint가 없는 키는 있는 키와 달라야 함
    expect(noEndpointKey).not.toBe(supervisorKey);
  });

  it('동일 session + 동치 질의 + 다른 endpoint → 다른 Memory 키', async () => {
    const { generateCacheKey } = await import(
      '@/lib/ai/cache/ai-response-cache'
    );
    const session = 'test-session-002';
    const query = '서버 상태 확인해줘';

    const supervisorKey = generateCacheKey(session, query, 'supervisor');
    const monitoringKey = generateCacheKey(
      session,
      query,
      'intelligent-monitoring'
    );

    expect(supervisorKey).not.toBe(monitoringKey);
  });

  it('동일 endpoint + 동치 질의 → 동일 키 (어순 무관)', async () => {
    const { generateQueryHash } = await import('@/lib/redis/ai-cache');
    const session = 'test-session-003';

    const keyA = generateQueryHash(session, 'CPU usage 메모리', 'supervisor');
    const keyB = generateQueryHash(session, '메모리 cpu 사용률', 'supervisor');

    expect(keyA).toBe(keyB);
  });
});

describe('UnifiedCacheService LRU overwrite', () => {
  afterEach(() => {
    UnifiedCacheService.resetForTesting();
  });

  it('overwrite 시 eviction이 발생하지 않는다 (기존 키 유지)', async () => {
    const cache = UnifiedCacheService.getInstance();

    // maxSize(5000)보다 작은 3개 항목 세팅
    await cache.set('a', 1, { namespace: CacheNamespace.GENERAL });
    await cache.set('b', 2, { namespace: CacheNamespace.GENERAL });
    await cache.set('c', 3, { namespace: CacheNamespace.GENERAL });

    // 'a' 키를 overwrite — eviction 없이 갱신돼야 함
    await cache.set('a', 10, { namespace: CacheNamespace.GENERAL });

    // 모든 키가 존재해야 함
    expect(await cache.get('a', CacheNamespace.GENERAL)).toBe(10);
    expect(await cache.get('b', CacheNamespace.GENERAL)).toBe(2);
    expect(await cache.get('c', CacheNamespace.GENERAL)).toBe(3);
    expect(cache.getStats().size).toBe(3);
  });

  it('overwrite 시 recency가 갱신되어 LRU 대상에서 벗어난다', async () => {
    const cache = UnifiedCacheService.getInstance();
    // @ts-expect-error -- 테스트용 maxSize 축소
    cache.maxSize = 3;

    await cache.set('a', 1, { namespace: CacheNamespace.GENERAL });
    await cache.set('b', 2, { namespace: CacheNamespace.GENERAL });
    await cache.set('c', 3, { namespace: CacheNamespace.GENERAL });

    // 'a'를 overwrite하면 recency가 갱신되므로 LRU 대상은 'b'
    await cache.set('a', 10, { namespace: CacheNamespace.GENERAL });

    // 신규 키 'd' 추가 → LRU eviction 시 'b'가 제거돼야 함
    await cache.set('d', 4, { namespace: CacheNamespace.GENERAL });

    expect(await cache.get('b', CacheNamespace.GENERAL)).toBeNull();
    expect(await cache.get('a', CacheNamespace.GENERAL)).toBe(10);
    expect(await cache.get('c', CacheNamespace.GENERAL)).toBe(3);
    expect(await cache.get('d', CacheNamespace.GENERAL)).toBe(4);
  });
});
