/**
 * AI Redis Cache Tests
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRedisGet,
  mockRedisSet,
  mockRedisScan,
  mockRedisDel,
  mockLoggerInfo,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisScan: vi.fn(),
  mockRedisDel: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
}));

const mockRedisClient = {
  get: mockRedisGet,
  set: mockRedisSet,
  scan: mockRedisScan,
  del: mockRedisDel,
};

vi.mock('@/lib/redis/client', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
  isRedisDisabled: vi.fn(() => false),
  isRedisEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

import {
  buildSemanticQueryEmbedding,
  cosineSimilarity,
  generateQueryHash,
  getAIResponseCache,
  setAIResponseCache,
  tokenOverlapRatio,
} from './ai-cache';

describe('semantic embedding helpers', () => {
  it('normalizes semantically similar queries to high similarity', () => {
    const left = buildSemanticQueryEmbedding('현재 서버 health 알려줘');
    const right = buildSemanticQueryEmbedding('서버 상태 확인');
    const similarity = cosineSimilarity(left.vector, right.vector);

    expect(left.normalizedQuery).toBe('server status');
    expect(right.normalizedQuery).toBe('server status');
    expect(similarity).toBeGreaterThanOrEqual(0.99);
    expect(tokenOverlapRatio(left.normalizedQuery, right.normalizedQuery)).toBe(
      1
    );
  });

  it('keeps unrelated queries at lower similarity', () => {
    const left = buildSemanticQueryEmbedding('cache memory utilization');
    const right = buildSemanticQueryEmbedding('network bandwidth trend');
    const similarity = cosineSimilarity(left.vector, right.vector);

    expect(similarity).toBeLessThan(0.75);
    expect(tokenOverlapRatio(left.normalizedQuery, right.normalizedQuery)).toBe(
      0
    );
  });
});

describe('AI response Redis cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores semantic metadata with cache payload', async () => {
    mockRedisSet.mockResolvedValue('OK');

    const success = await setAIResponseCache('session-1', '서버 상태 알려줘', {
      content: 'cached-response',
      metadata: { source: 'test' },
    });

    expect(success).toBe(true);
    expect(mockRedisSet).toHaveBeenCalledOnce();

    const [, payload] = mockRedisSet.mock.calls[0]!;
    expect(payload.metadata.source).toBe('test');
    expect(payload.metadata.__semanticCache).toBeDefined();
    expect(payload.metadata.__semanticCache.algorithm).toBe('token-hash-v1');
    expect(Array.isArray(payload.metadata.__semanticCache.embedding)).toBe(
      true
    );
  });

  it('returns semantic hit when exact key misses', async () => {
    const sessionId = 'session-semantic';
    const endpoint = 'supervisor';
    const query = '현재 모든 서버 상태를 요약해줘';
    const exactHash = generateQueryHash(sessionId, query, endpoint);
    const exactKey = `v2:ai:response:${exactHash}`;
    const [, sessionHash] = exactHash.split(':');

    const candidateQuery = query;
    const candidateKey = `v2:ai:response:${endpoint}:${sessionHash}:candidate-1`;
    const candidateEmbedding = buildSemanticQueryEmbedding(candidateQuery);

    mockRedisScan.mockResolvedValue([0, [candidateKey]]);
    mockRedisGet.mockImplementation(async (key: string) => {
      if (key === exactKey) return null;
      if (key === candidateKey) {
        return {
          content: 'semantic-cached',
          metadata: {
            __semanticCache: {
              algorithm: 'token-hash-v1',
              normalizedQuery: candidateEmbedding.normalizedQuery,
              embedding: candidateEmbedding.vector,
              createdAt: Date.now(),
            },
          },
        };
      }
      return null;
    });

    const result = await getAIResponseCache(sessionId, query, endpoint);

    expect(result.hit).toBe(true);
    expect(result.data?.content).toBe('semantic-cached');
    expect(result.semanticScore).toBeDefined();
    expect(result.semanticScore).toBeGreaterThanOrEqual(0.82);
  });

  it('limits semantic scans once enough candidates are collected', async () => {
    const sessionId = 'session-scan-limit';
    const endpoint = 'supervisor';
    const query = '서버 상태 요약';
    const exactHash = generateQueryHash(sessionId, query, endpoint);
    const exactKey = `v2:ai:response:${exactHash}`;
    const [, sessionHash] = exactHash.split(':');

    const candidateKeys = [
      exactKey,
      ...Array.from(
        { length: 12 },
        (_, index) =>
          `v2:ai:response:${endpoint}:${sessionHash}:candidate-${index + 1}`
      ),
    ];
    const embedding = buildSemanticQueryEmbedding(query);

    mockRedisScan
      .mockResolvedValueOnce([1, candidateKeys])
      .mockRejectedValueOnce(new Error('unexpected extra scan'));
    mockRedisGet.mockImplementation(async (key: string) => {
      if (key === exactKey) {
        return null;
      }

      return {
        content: 'semantic-cached',
        metadata: {
          __semanticCache: {
            algorithm: 'token-hash-v1',
            normalizedQuery: embedding.normalizedQuery,
            embedding: embedding.vector,
            createdAt: Date.now(),
          },
        },
      };
    });

    const result = await getAIResponseCache(sessionId, query, endpoint);

    expect(result.hit).toBe(true);
    expect(mockRedisScan).toHaveBeenCalledOnce();
  });
});
