import type { QueryPattern } from './unified-cache.types';

function getResponseTime(metadata?: Record<string, unknown>): number {
  const value = metadata?.responseTime;
  return typeof value === 'number' ? value : 0;
}

function evictOldestPattern(
  patterns: Map<string, QueryPattern>,
  maxPatternSize: number
): void {
  if (patterns.size < maxPatternSize) return;

  let oldestKey = '';
  let oldestTime = Infinity;

  for (const [key, pattern] of patterns) {
    const time = pattern.lastUsed.getTime();
    if (time < oldestTime) {
      oldestTime = time;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    patterns.delete(oldestKey);
  }
}

export function normalizePatternKey(pattern: string): string {
  return pattern
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function learnQueryPattern(
  patterns: Map<string, QueryPattern>,
  pattern: string,
  metadata: Record<string, unknown> | undefined,
  maxPatternSize: number
): void {
  const patternKey = normalizePatternKey(pattern);
  const existing = patterns.get(patternKey);

  if (existing) {
    existing.frequency++;
    existing.hits++;
    existing.lastUsed = new Date();

    const responseTime = getResponseTime(metadata);
    if (responseTime > 0) {
      existing.avgResponseTime =
        (existing.avgResponseTime * (existing.hits - 1) + responseTime) /
        existing.hits;
    }
    return;
  }

  evictOldestPattern(patterns, maxPatternSize);

  patterns.set(patternKey, {
    id: patternKey,
    regex: pattern,
    frequency: 1,
    avgResponseTime: getResponseTime(metadata),
    lastUsed: new Date(),
    hits: 1,
  });
}

export function getTopQueryPatterns(
  patterns: Map<string, QueryPattern>,
  limit: number
): QueryPattern[] {
  return Array.from(patterns.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
}
