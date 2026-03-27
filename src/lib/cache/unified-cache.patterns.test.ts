import { describe, expect, it } from 'vitest';
import {
  getTopQueryPatterns,
  learnQueryPattern,
  normalizePatternKey,
} from './unified-cache.patterns';
import type { QueryPattern } from './unified-cache.types';

describe('normalizePatternKey', () => {
  it('lowercases text', () => {
    expect(normalizePatternKey('Hello World')).toBe('hello world');
  });

  it('collapses multiple whitespace into single space', () => {
    expect(normalizePatternKey('foo   bar\t\nbaz')).toBe('foo bar baz');
  });

  it('strips non-word characters except spaces', () => {
    // '>' and '%' are stripped, leaving 'cpu  90'; whitespace collapse runs before strip
    expect(normalizePatternKey('cpu > 90%')).toBe('cpu  90');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizePatternKey('  hello  ')).toBe('hello');
  });
});

describe('learnQueryPattern', () => {
  it('creates a new pattern with correct defaults', () => {
    const patterns = new Map<string, QueryPattern>();
    learnQueryPattern(patterns, 'server status', undefined, 100);

    const key = normalizePatternKey('server status');
    const entry = patterns.get(key);
    expect(entry).toBeDefined();
    expect(entry!.id).toBe(key);
    expect(entry!.regex).toBe('server status');
    expect(entry!.frequency).toBe(1);
    expect(entry!.avgResponseTime).toBe(0);
    expect(entry!.hits).toBe(0);
  });

  it('increments frequency on duplicate pattern', () => {
    const patterns = new Map<string, QueryPattern>();
    learnQueryPattern(patterns, 'cpu usage', undefined, 100);
    learnQueryPattern(patterns, 'cpu usage', undefined, 100);

    const key = normalizePatternKey('cpu usage');
    expect(patterns.get(key)!.frequency).toBe(2);
  });

  it('updates avgResponseTime with running average', () => {
    const patterns = new Map<string, QueryPattern>();
    learnQueryPattern(patterns, 'query', { responseTime: 100 }, 100);
    learnQueryPattern(patterns, 'query', { responseTime: 200 }, 100);

    const key = normalizePatternKey('query');
    const entry = patterns.get(key)!;
    expect(entry.hits).toBe(2);
    expect(entry.avgResponseTime).toBe(150);
  });

  it('does not increment hits when no responseTime in metadata', () => {
    const patterns = new Map<string, QueryPattern>();
    learnQueryPattern(patterns, 'test', { responseTime: 50 }, 100);
    learnQueryPattern(patterns, 'test', {}, 100);
    learnQueryPattern(patterns, 'test', undefined, 100);

    const key = normalizePatternKey('test');
    const entry = patterns.get(key)!;
    expect(entry.hits).toBe(1);
    expect(entry.frequency).toBe(3);
    expect(entry.avgResponseTime).toBe(50);
  });

  it('evicts oldest pattern when at max capacity', () => {
    const patterns = new Map<string, QueryPattern>();

    // Fill to capacity of 2
    learnQueryPattern(patterns, 'old', undefined, 2);
    // Backdate the first entry
    const oldKey = normalizePatternKey('old');
    patterns.get(oldKey)!.lastUsed = new Date('2020-01-01');

    learnQueryPattern(patterns, 'newer', undefined, 2);

    // This should evict "old"
    learnQueryPattern(patterns, 'newest', undefined, 2);

    expect(patterns.has(oldKey)).toBe(false);
    expect(patterns.has(normalizePatternKey('newer'))).toBe(true);
    expect(patterns.has(normalizePatternKey('newest'))).toBe(true);
    expect(patterns.size).toBe(2);
  });
});

describe('getTopQueryPatterns', () => {
  it('returns empty array for empty map', () => {
    const patterns = new Map<string, QueryPattern>();
    expect(getTopQueryPatterns(patterns, 5)).toEqual([]);
  });

  it('sorts by frequency descending', () => {
    const patterns = new Map<string, QueryPattern>();
    learnQueryPattern(patterns, 'low', undefined, 100);
    learnQueryPattern(patterns, 'high', undefined, 100);
    learnQueryPattern(patterns, 'high', undefined, 100);
    learnQueryPattern(patterns, 'high', undefined, 100);
    learnQueryPattern(patterns, 'mid', undefined, 100);
    learnQueryPattern(patterns, 'mid', undefined, 100);

    const result = getTopQueryPatterns(patterns, 10);
    expect(result[0].frequency).toBe(3);
    expect(result[1].frequency).toBe(2);
    expect(result[2].frequency).toBe(1);
  });

  it('respects the limit parameter', () => {
    const patterns = new Map<string, QueryPattern>();
    learnQueryPattern(patterns, 'a', undefined, 100);
    learnQueryPattern(patterns, 'b', undefined, 100);
    learnQueryPattern(patterns, 'c', undefined, 100);

    const result = getTopQueryPatterns(patterns, 2);
    expect(result).toHaveLength(2);
  });
});
