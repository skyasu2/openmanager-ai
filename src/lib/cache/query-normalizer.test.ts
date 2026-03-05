import { describe, expect, it } from 'vitest';
import { normalizeSemanticCacheQuery } from '@/lib/cache/query-normalizer';

describe('normalizeSemanticCacheQuery', () => {
  // 1. Empty string
  it('returns empty string for empty input', () => {
    expect(normalizeSemanticCacheQuery('')).toBe('');
  });

  // 2. Whitespace-only
  it('returns empty string for whitespace-only input', () => {
    expect(normalizeSemanticCacheQuery('   ')).toBe('');
    expect(normalizeSemanticCacheQuery('\t\n')).toBe('');
  });

  // 3. Simple query normalizes and sorts
  it('normalizes Korean query "서버 상태" to sorted canonical tokens', () => {
    expect(normalizeSemanticCacheQuery('서버 상태')).toBe('server status');
  });

  // 4. Korean synonyms canonicalize
  it('canonicalizes Korean synonyms: "메모리 사용률" → "memory utilization"', () => {
    expect(normalizeSemanticCacheQuery('메모리 사용률')).toBe(
      'memory utilization'
    );
  });

  // 5. English synonyms canonicalize
  it('canonicalizes English synonyms: "RAM usage" → "memory utilization"', () => {
    expect(normalizeSemanticCacheQuery('RAM usage')).toBe('memory utilization');
  });

  // 6. Mixed Korean/English
  it('handles mixed Korean/English: "CPU 서버 상태"', () => {
    expect(normalizeSemanticCacheQuery('CPU 서버 상태')).toBe(
      'cpu server status'
    );
  });

  // 7. Stopwords removed
  it('removes stopwords: "좀 서버 상태 알려줘"', () => {
    expect(normalizeSemanticCacheQuery('좀 서버 상태 알려줘')).toBe(
      'server status'
    );
  });

  // 8. Special characters removed
  it('removes special characters: "서버!!! @상태#"', () => {
    expect(normalizeSemanticCacheQuery('서버!!! @상태#')).toBe('server status');
  });

  // 9. Duplicate tokens deduplicated
  it('deduplicates tokens: "cpu cpu cpu" → "cpu"', () => {
    expect(normalizeSemanticCacheQuery('cpu cpu cpu')).toBe('cpu');
  });

  // 10. All-stopwords query returns normalized original
  it('returns normalized original when all tokens are stopwords', () => {
    expect(normalizeSemanticCacheQuery('좀 부탁 please')).toBe(
      '좀 부탁 please'
    );
  });

  // 11. '씨피유' canonicalizes to 'cpu'
  it('canonicalizes "씨피유" to "cpu"', () => {
    expect(normalizeSemanticCacheQuery('씨피유')).toBe('cpu');
  });

  // 12. '디스크', 'storage', '스토리지' all canonicalize to 'disk'
  it('canonicalizes disk synonyms to "disk"', () => {
    expect(normalizeSemanticCacheQuery('디스크')).toBe('disk');
    expect(normalizeSemanticCacheQuery('storage')).toBe('disk');
    expect(normalizeSemanticCacheQuery('스토리지')).toBe('disk');
  });

  // 13. '네트워크', 'bandwidth', '트래픽' all canonicalize to 'network'
  it('canonicalizes network synonyms to "network"', () => {
    expect(normalizeSemanticCacheQuery('네트워크')).toBe('network');
    expect(normalizeSemanticCacheQuery('bandwidth')).toBe('network');
    expect(normalizeSemanticCacheQuery('트래픽')).toBe('network');
  });
});
