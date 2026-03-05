import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { EdgeCache, EdgeLogger } from './edge-runtime-utils';

// ---------------------------------------------------------------------------
// EdgeLogger
// ---------------------------------------------------------------------------
describe('EdgeLogger', () => {
  let edgeLogger: EdgeLogger;

  beforeEach(() => {
    edgeLogger = new EdgeLogger();
  });

  it('info() stores log entry with level "info"', () => {
    edgeLogger.info('hello');
    const logs = edgeLogger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('info');
  });

  it('warn() stores log entry with level "warn"', () => {
    edgeLogger.warn('caution');
    expect(edgeLogger.getLogs()[0].level).toBe('warn');
  });

  it('error() stores log entry with level "error"', () => {
    edgeLogger.error('failure');
    expect(edgeLogger.getLogs()[0].level).toBe('error');
  });

  it('debug() stores log entry with level "debug"', () => {
    edgeLogger.debug('trace');
    expect(edgeLogger.getLogs()[0].level).toBe('debug');
  });

  it('log entry includes timestamp, level, and message', () => {
    edgeLogger.info('test message');
    const entry = edgeLogger.getLogs()[0];
    expect(entry).toHaveProperty('timestamp');
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('test message');
    // timestamp should be ISO format
    expect(() => new Date(entry.timestamp)).not.toThrow();
  });

  it('log entry includes meta when provided', () => {
    const meta = { userId: 42 };
    edgeLogger.info('with meta', meta);
    expect(edgeLogger.getLogs()[0].meta).toEqual(meta);
  });

  it('log entry meta is undefined when not provided', () => {
    edgeLogger.info('no meta');
    expect(edgeLogger.getLogs()[0].meta).toBeUndefined();
  });

  it('getLogs() returns a copy, not a reference', () => {
    edgeLogger.info('a');
    const logs1 = edgeLogger.getLogs();
    const logs2 = edgeLogger.getLogs();
    expect(logs1).not.toBe(logs2);
    expect(logs1).toEqual(logs2);
  });

  it('clearLogs() empties the log array', () => {
    edgeLogger.info('a');
    edgeLogger.warn('b');
    expect(edgeLogger.getLogs()).toHaveLength(2);
    edgeLogger.clearLogs();
    expect(edgeLogger.getLogs()).toHaveLength(0);
  });

  it('caps at 100 logs, removing the oldest entry', () => {
    for (let i = 0; i < 105; i++) {
      edgeLogger.info(`msg-${i}`);
    }
    const logs = edgeLogger.getLogs();
    expect(logs).toHaveLength(100);
    // oldest kept should be msg-5 (0..4 evicted)
    expect(logs[0].message).toBe('msg-5');
    expect(logs[99].message).toBe('msg-104');
  });

  it('getInstance() returns the same instance on repeated calls', async () => {
    // Reset modules to get a fresh singleton
    vi.resetModules();
    vi.mock('@/lib/logging', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    const { EdgeLogger: Fresh } = await import('./edge-runtime-utils');
    const a = Fresh.getInstance();
    const b = Fresh.getInstance();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// EdgeCache
// ---------------------------------------------------------------------------
describe('EdgeCache', () => {
  let cache: EdgeCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new EdgeCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('set/get stores and retrieves a value', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('get returns null for a missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('get returns null for an expired entry', () => {
    cache.set('temp', 'data', 1000); // 1 second TTL
    vi.advanceTimersByTime(1001);
    expect(cache.get('temp')).toBeNull();
  });

  it('has returns true for a valid (non-expired) entry', () => {
    cache.set('k', 'v', 5000);
    expect(cache.has('k')).toBe(true);
  });

  it('has returns false for an expired entry', () => {
    cache.set('k', 'v', 1000);
    vi.advanceTimersByTime(1001);
    expect(cache.has('k')).toBe(false);
  });

  it('has returns false for a missing key', () => {
    expect(cache.has('nope')).toBe(false);
  });

  it('delete removes an entry', () => {
    cache.set('k', 'v');
    cache.delete('k');
    expect(cache.get('k')).toBeNull();
  });

  it('clear removes all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('size() excludes expired entries', () => {
    cache.set('short', 'x', 1000);
    cache.set('long', 'y', 60000);
    vi.advanceTimersByTime(1001);
    expect(cache.size()).toBe(1);
  });

  it('set evicts the oldest entry when at maxSize (100)', () => {
    // Fill to capacity
    for (let i = 0; i < 100; i++) {
      cache.set(`key-${i}`, i);
    }
    expect(cache.size()).toBe(100);

    // Adding one more should evict the first
    cache.set('key-100', 100);
    expect(cache.size()).toBe(100);
    expect(cache.get('key-0')).toBeNull(); // evicted
    expect(cache.get('key-100')).toBe(100); // present
  });

  it('getStats() returns size, maxSize, and keys', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(100);
    expect(stats.keys).toEqual(expect.arrayContaining(['a', 'b']));
    expect(stats.keys).toHaveLength(2);
  });

  it('default TTL is 5 minutes (300000ms)', () => {
    cache.set('default-ttl', 'value');

    // Just before 5 minutes: still valid
    vi.advanceTimersByTime(299999);
    expect(cache.get('default-ttl')).toBe('value');

    // At 5 minutes + 1ms: expired
    vi.advanceTimersByTime(2);
    expect(cache.get('default-ttl')).toBeNull();
  });

  it('getInstance() returns the same instance on repeated calls', async () => {
    vi.useRealTimers();
    vi.resetModules();
    vi.mock('@/lib/logging', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    const { EdgeCache: Fresh } = await import('./edge-runtime-utils');
    const a = Fresh.getInstance();
    const b = Fresh.getInstance();
    expect(a).toBe(b);
  });
});
