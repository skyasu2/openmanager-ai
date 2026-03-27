import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  embedText,
  embedTexts,
  getEmbeddingStats,
  clearEmbeddingCache,
} from './embedding';

// Mock mistral-provider to return null (forces local fallback)
vi.mock('./mistral-provider', () => ({
  getMistralProvider: () => null,
}));

// Suppress logger output in tests
vi.mock('./logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('Embedding cache behavior', () => {
  afterEach(() => {
    clearEmbeddingCache();
  });

  it('returns 1024-dimension vector via local fallback', async () => {
    const embedding = await embedText('hello world');
    expect(embedding).toHaveLength(1024);
    expect(typeof embedding[0]).toBe('number');
  });

  it('caches embeddings and tracks cache hits', async () => {
    // First call — cache miss
    await embedText('test cache');
    const stats1 = getEmbeddingStats();
    const hitsBefore = stats1.cacheHits;

    // Second call — cache hit
    await embedText('test cache');
    const stats2 = getEmbeddingStats();
    expect(stats2.cacheHits).toBe(hitsBefore + 1);
  });

  it('returns same embedding for same text (cache consistency)', async () => {
    const first = await embedText('consistent text');
    const second = await embedText('consistent text');
    expect(first).toEqual(second);
  });

  it('returns different embeddings for different texts', async () => {
    const a = await embedText('text alpha');
    const b = await embedText('text beta');
    expect(a).not.toEqual(b);
  });

  it('batch embedTexts uses cache for repeated texts', async () => {
    // Prime cache
    await embedText('batch item 1');

    const statsBefore = getEmbeddingStats();
    const hitsBefore = statsBefore.cacheHits;

    // Batch with one cached and one new
    const results = await embedTexts(['batch item 1', 'batch item 2']);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(1024);
    expect(results[1]).toHaveLength(1024);

    const statsAfter = getEmbeddingStats();
    // "batch item 1" should be a cache hit
    expect(statsAfter.cacheHits).toBeGreaterThan(hitsBefore);
  });

  it('getEmbeddingStats includes estimatedMemoryMB', async () => {
    await embedText('memory test');
    const stats = getEmbeddingStats();
    expect(stats).toHaveProperty('estimatedMemoryMB');
    expect(typeof stats.estimatedMemoryMB).toBe('number');
    expect(stats.estimatedMemoryMB).toBeGreaterThanOrEqual(0);
    expect(stats.cacheSize).toBe(1);
  });

  it('clearEmbeddingCache resets cache size to 0', async () => {
    await embedText('to be cleared');
    expect(getEmbeddingStats().cacheSize).toBe(1);
    clearEmbeddingCache();
    expect(getEmbeddingStats().cacheSize).toBe(0);
  });
});
