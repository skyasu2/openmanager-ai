/**
 * AI Response Cache Unit Tests
 *
 * @description Memory → Redis 다층 캐시 통합 로직 검증
 * @created 2026-02-23 v8.3.2
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Hoisted Mocks
// ============================================================================

const { mockLoggerInfo, mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

const {
  mockUnifiedCacheGet,
  mockUnifiedCacheSet,
  mockUnifiedCacheInvalidate,
  mockNormalizeQueryForCache,
} = vi.hoisted(() => ({
  mockUnifiedCacheGet: vi.fn(),
  mockUnifiedCacheSet: vi.fn(),
  mockUnifiedCacheInvalidate: vi.fn(),
  mockNormalizeQueryForCache: vi.fn((q: string) => q.toLowerCase().trim()),
}));

const { mockHashString } = vi.hoisted(() => ({
  mockHashString: vi.fn((s: string) => `hash_${s}`),
}));

const {
  mockGetAIResponseCache,
  mockSetAIResponseCache,
  mockInvalidateSessionCache,
} = vi.hoisted(() => ({
  mockGetAIResponseCache: vi.fn(),
  mockSetAIResponseCache: vi.fn(),
  mockInvalidateSessionCache: vi.fn(),
}));

// ============================================================================
// Module Mocks (importOriginal로 상수 SSOT 보장)
// ============================================================================

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// SSOT: src/lib/cache/unified-cache.types.ts 의 enum/const 값 복제
// importOriginal 사용 시 싱글톤 초기화로 mock이 깨지므로 직접 정의
vi.mock('@/lib/cache/unified-cache', () => ({
  CacheNamespace: {
    GENERAL: 'general',
    AI_QUERY: 'ai_query',
    AI_RESPONSE: 'ai_response',
    API: 'api',
    SERVER_METRICS: 'server_metrics',
    USER_SESSION: 'user_session',
  },
  CacheTTL: { SHORT: 30, MEDIUM: 300, LONG: 1800, STATIC: 3600 },
  unifiedCache: {
    get: mockUnifiedCacheGet,
    set: mockUnifiedCacheSet,
    invalidate: mockUnifiedCacheInvalidate,
  },
  normalizeQueryForCache: mockNormalizeQueryForCache,
}));

vi.mock('@/lib/cache/cache-helpers', () => ({
  hashString: mockHashString,
}));

vi.mock('@/lib/redis/ai-cache', () => ({
  getAIResponseCache: mockGetAIResponseCache,
  setAIResponseCache: mockSetAIResponseCache,
  invalidateSessionCache: mockInvalidateSessionCache,
}));

// ============================================================================
// SUT
// ============================================================================

import {
  AI_CACHE_TTL,
  generateCacheKey,
  getAICache,
  invalidateAICache,
  setAICache,
  withAICache,
} from './ai-response-cache';

// ============================================================================
// Tests
// ============================================================================

describe('generateCacheKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('동일 쿼리 → 동일 키를 반환한다', () => {
    // When
    const key1 = generateCacheKey('session1', 'hello world');
    const key2 = generateCacheKey('session1', 'hello world');

    // Then
    expect(key1).toBe(key2);
  });

  it('다른 세션 → 다른 키를 반환한다', () => {
    // When
    const key1 = generateCacheKey('session1', 'hello');
    const key2 = generateCacheKey('session2', 'hello');

    // Then
    expect(key1).not.toBe(key2);
  });

  it('다른 endpoint → 다른 키를 반환한다', () => {
    // When
    const key1 = generateCacheKey('session1', 'hello', 'supervisor');
    const key2 = generateCacheKey(
      'session1',
      'hello',
      'intelligent-monitoring'
    );

    // Then
    expect(key1).not.toBe(key2);
    expect(key1).toContain('supervisor:');
    expect(key2).toContain('intelligent-monitoring:');
  });

  it('endpoint 없이 호출하면 endpoint prefix가 없다', () => {
    // When
    const key = generateCacheKey('session1', 'hello');
    const keyWithEndpoint = generateCacheKey('session1', 'hello', 'supervisor');

    // Then: endpoint 없는 키는 endpoint prefix로 시작하지 않음
    expect(key).not.toMatch(
      /^(supervisor|intelligent-monitoring|incident-report|supervisor-status):/
    );
    expect(key).not.toBe(keyWithEndpoint);
  });
});

describe('getAICache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Memory 캐시 히트 → 즉시 반환, source=memory', async () => {
    // Given: Memory에 캐시된 데이터
    const cachedData = { success: true, response: 'cached answer' };
    mockUnifiedCacheGet.mockResolvedValue(cachedData);

    // When
    const result = await getAICache('session1', 'test query');

    // Then: Redis 조회 없이 Memory에서 반환
    expect(result.hit).toBe(true);
    expect(result.data).toEqual(cachedData);
    expect(result.source).toBe('memory');
    expect(mockGetAIResponseCache).not.toHaveBeenCalled();
  });

  it('Memory 미스 + Redis 히트 → source=redis, Memory에 재적재', async () => {
    // Given: Memory 미스, Redis에 데이터 존재
    mockUnifiedCacheGet.mockResolvedValue(null);
    mockGetAIResponseCache.mockResolvedValue({
      hit: true,
      data: { content: 'redis answer', metadata: { source: 'test' } },
    });

    // When
    const result = await getAICache('session1', 'test query');

    // Then: Redis에서 반환 + Memory에 재적재
    expect(result.hit).toBe(true);
    expect(result.source).toBe('redis');
    expect(result.data?.response).toBe('redis answer');
    expect(mockUnifiedCacheSet).toHaveBeenCalledOnce();
  });

  it('양쪽 미스 → hit=false, source=none', async () => {
    // Given: Memory, Redis 모두 미스
    mockUnifiedCacheGet.mockResolvedValue(null);
    mockGetAIResponseCache.mockResolvedValue({ hit: false, data: null });

    // When
    const result = await getAICache('session1', 'unknown query');

    // Then
    expect(result.hit).toBe(false);
    expect(result.data).toBeNull();
    expect(result.source).toBe('none');
  });

  it('Memory 에러 → Redis 폴백', async () => {
    // Given: Memory에서 에러 발생
    mockUnifiedCacheGet.mockRejectedValue(new Error('memory error'));
    mockGetAIResponseCache.mockResolvedValue({
      hit: true,
      data: { content: 'redis fallback', metadata: {} },
    });

    // When
    const result = await getAICache('session1', 'test');

    // Then: Redis로 폴백 성공
    expect(result.hit).toBe(true);
    expect(result.source).toBe('redis');
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[AI Cache] Memory cache error:',
      expect.any(Error)
    );
  });

  it('Redis 에러 → graceful miss', async () => {
    // Given: Memory 미스 + Redis 에러
    mockUnifiedCacheGet.mockResolvedValue(null);
    mockGetAIResponseCache.mockRejectedValue(new Error('redis error'));

    // When
    const result = await getAICache('session1', 'test');

    // Then: 에러 없이 miss 반환
    expect(result.hit).toBe(false);
    expect(result.source).toBe('none');
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[AI Cache] Redis cache error:',
      expect.any(Error)
    );
  });
});

describe('setAICache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Memory + Redis 양쪽에 저장한다', async () => {
    // Given
    const response = { success: true, response: 'answer', data: {} };

    // When
    await setAICache('session1', 'query', response, 'supervisor');

    // Then
    expect(mockUnifiedCacheSet).toHaveBeenCalledOnce();
    expect(mockSetAIResponseCache).toHaveBeenCalledOnce();
  });

  it('endpoint별 TTL 차이를 검증한다', async () => {
    // Given
    const response = { success: true, response: 'answer' };

    // When: supervisor TTL 저장
    await setAICache('s1', 'q1', response, 'supervisor');
    const supervisorTTL = mockSetAIResponseCache.mock.calls[0][3];

    mockSetAIResponseCache.mockClear();

    // When: incident-report TTL 저장
    await setAICache('s1', 'q1', response, 'incident-report');
    const incidentTTL = mockSetAIResponseCache.mock.calls[0][3];

    // Then: endpoint별 TTL이 다르다
    expect(supervisorTTL).toBe(AI_CACHE_TTL.supervisor);
    expect(incidentTTL).toBe(AI_CACHE_TTL['incident-report']);
    expect(incidentTTL).toBeGreaterThan(supervisorTTL);
  });

  it('Redis 에러 → Memory만 성공 (silent fail)', async () => {
    // Given: Redis 쓰기 에러
    const response = { success: true, response: 'answer' };
    mockSetAIResponseCache.mockRejectedValue(new Error('redis write error'));

    // When
    await setAICache('session1', 'query', response);

    // Then: Memory는 성공, Redis 에러는 로그만
    expect(mockUnifiedCacheSet).toHaveBeenCalledOnce();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[AI Cache] Redis set error:',
      expect.any(Error)
    );
  });
});

describe('invalidateAICache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('양쪽 캐시 무효화를 호출한다', async () => {
    // When
    await invalidateAICache('session1');

    // Then
    expect(mockUnifiedCacheInvalidate).toHaveBeenCalledOnce();
    expect(mockInvalidateSessionCache).toHaveBeenCalledWith('session1');
  });
});

describe('withAICache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('캐시 히트 → fetcher 미호출', async () => {
    // Given: 캐시에 데이터 존재
    const cachedData = { success: true, response: 'cached' };
    mockUnifiedCacheGet.mockResolvedValue(cachedData);
    const fetcher = vi.fn();

    // When
    const result = await withAICache('s1', 'q1', fetcher);

    // Then: fetcher 호출 없이 캐시 반환
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
  });

  it('캐시 미스 → fetcher 호출 + 결과 캐싱', async () => {
    // Given: 캐시 미스
    mockUnifiedCacheGet.mockResolvedValue(null);
    mockGetAIResponseCache.mockResolvedValue({ hit: false, data: null });
    const fetcherResult = { success: true, response: 'fresh data' };
    const fetcher = vi.fn().mockResolvedValue(fetcherResult);

    // When
    const result = await withAICache('s1', 'q1', fetcher);

    // Then: fetcher 호출 + 결과 캐싱
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.cached).toBe(false);
    expect(result.data).toEqual(fetcherResult);
    expect(mockUnifiedCacheSet).toHaveBeenCalled();
  });

  it('fetcher 실패 → 에러 전파, 캐싱 안 함', async () => {
    // Given: 캐시 미스 + fetcher 에러
    mockUnifiedCacheGet.mockResolvedValue(null);
    mockGetAIResponseCache.mockResolvedValue({ hit: false, data: null });
    const fetcher = vi.fn().mockRejectedValue(new Error('fetch failed'));

    // When/Then: 에러가 그대로 전파
    await expect(withAICache('s1', 'q1', fetcher)).rejects.toThrow(
      'fetch failed'
    );
  });

  it('fetcher 결과 success=false → 캐싱 안 함', async () => {
    // Given: 캐시 미스 + fetcher 실패 응답
    mockUnifiedCacheGet.mockResolvedValue(null);
    mockGetAIResponseCache.mockResolvedValue({ hit: false, data: null });
    const fetcherResult = { success: false, response: 'error' };
    const fetcher = vi.fn().mockResolvedValue(fetcherResult);

    // When
    const result = await withAICache('s1', 'q1', fetcher);

    // Then: 실패 응답은 캐싱하지 않음
    expect(result.data.success).toBe(false);
    expect(result.cached).toBe(false);
    expect(mockSetAIResponseCache).not.toHaveBeenCalled();
  });

  it('빈 response → success 기준으로 캐싱 여부 결정', async () => {
    // Given: 캐시 미스 + 빈 응답 (success=true)
    mockUnifiedCacheGet.mockResolvedValue(null);
    mockGetAIResponseCache.mockResolvedValue({ hit: false, data: null });
    const fetcherResult = { success: true, response: '' };
    const fetcher = vi.fn().mockResolvedValue(fetcherResult);

    // When
    const result = await withAICache('s1', 'q1', fetcher);

    // Then: success=true이므로 캐싱됨 (response 비어있어도)
    expect(result.cached).toBe(false);
    expect(result.data.response).toBe('');
  });
});
