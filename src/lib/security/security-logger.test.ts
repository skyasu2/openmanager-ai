import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/logging', () => ({ logger: mockLogger }));
vi.mock('@/config/constants', () => ({
  SECURITY: {
    LOGGER: {
      SAMPLE_WINDOW_MS: 60000,
      MAX_LOG_SIZE: 1000,
      CLEANUP_INTERVAL_MS: 3600000,
    },
  },
}));

async function getFreshInstance() {
  vi.resetModules();
  const mod = await import('./security-logger');
  return mod.securityLogger;
}

describe('SecurityLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('logAuthFailure', () => {
    it('logs warning on first call', async () => {
      const sl = await getFreshInstance();
      vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

      sl.logAuthFailure('192.168.1.1', 'invalid_token');

      expect(mockLogger.warn).toHaveBeenCalledOnce();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Security] Authentication failure')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('IP: 192.168.1.1')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Reason: invalid_token')
      );
    });

    it('skips logging for same IP within sample window', async () => {
      const sl = await getFreshInstance();
      vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

      sl.logAuthFailure('192.168.1.1', 'reason1');
      expect(mockLogger.warn).toHaveBeenCalledOnce();

      // Advance 30 seconds (within the 60-second window)
      vi.advanceTimersByTime(30_000);
      sl.logAuthFailure('192.168.1.1', 'reason2');

      expect(mockLogger.warn).toHaveBeenCalledOnce(); // still only 1
    });

    it('logs again for same IP after sample window elapses', async () => {
      const sl = await getFreshInstance();
      vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

      sl.logAuthFailure('192.168.1.1', 'reason1');
      expect(mockLogger.warn).toHaveBeenCalledOnce();

      // Advance past the 60-second window
      vi.advanceTimersByTime(60_001);
      sl.logAuthFailure('192.168.1.1', 'reason2');

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('logs for different IPs within the same window', async () => {
      const sl = await getFreshInstance();
      vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

      sl.logAuthFailure('192.168.1.1', 'reason1');
      sl.logAuthFailure('192.168.1.2', 'reason2');

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('evicts oldest entry when exceeding maxLogSize', async () => {
      // Re-mock with a small maxLogSize for this test
      vi.doMock('@/config/constants', () => ({
        SECURITY: {
          LOGGER: {
            SAMPLE_WINDOW_MS: 60000,
            MAX_LOG_SIZE: 3,
            CLEANUP_INTERVAL_MS: 3600000,
          },
        },
      }));
      vi.resetModules();
      const mod = await import('./security-logger');
      const sl = mod.securityLogger;

      vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

      sl.logAuthFailure('10.0.0.1', 'r1');
      sl.logAuthFailure('10.0.0.2', 'r2');
      sl.logAuthFailure('10.0.0.3', 'r3');

      // Map has 3 entries — at the limit
      expect(sl.getStatistics().totalIPs).toBe(3);

      // Adding a 4th should evict the oldest (10.0.0.1)
      sl.logAuthFailure('10.0.0.4', 'r4');
      expect(sl.getStatistics().totalIPs).toBe(3);

      // The oldest IP should no longer be tracked; verify by allowing it to log again immediately
      mockLogger.warn.mockClear();
      sl.logAuthFailure('10.0.0.1', 'r-again');
      // If evicted, it would log (no previous entry to suppress it)
      expect(mockLogger.warn).toHaveBeenCalledOnce();
    });
  });

  describe('logSecurityEvent', () => {
    it('logs error with type, ip, and details', async () => {
      const sl = await getFreshInstance();

      sl.logSecurityEvent({
        type: 'invalid_key',
        ip: '10.0.0.5',
        details: 'bad API key format',
      });

      expect(mockLogger.error).toHaveBeenCalledOnce();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Type: invalid_key')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('IP: 10.0.0.5')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Details: bad API key format')
      );
    });

    it('logs N/A for missing ip and details', async () => {
      const sl = await getFreshInstance();

      sl.logSecurityEvent({ type: 'config_error' });

      expect(mockLogger.error).toHaveBeenCalledOnce();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('IP: N/A')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Details: N/A')
      );
    });
  });

  describe('getStatistics', () => {
    it('returns totalIPs=0 and oldestTimestamp=null when empty', async () => {
      const sl = await getFreshInstance();

      const stats = sl.getStatistics();

      expect(stats).toEqual({ totalIPs: 0, oldestTimestamp: null });
    });

    it('returns correct count and oldest timestamp after failures', async () => {
      const sl = await getFreshInstance();

      const t1 = new Date('2026-03-06T12:00:00Z').getTime();
      vi.setSystemTime(t1);
      sl.logAuthFailure('10.0.0.1', 'r1');

      const t2 = t1 + 70_000; // past sample window so different IP entries are distinct
      vi.setSystemTime(t2);
      sl.logAuthFailure('10.0.0.2', 'r2');

      const stats = sl.getStatistics();

      expect(stats.totalIPs).toBe(2);
      expect(stats.oldestTimestamp).toBe(t1);
    });
  });

  describe('cleanup', () => {
    it('removes entries older than 1 hour', async () => {
      const sl = await getFreshInstance();

      const baseTime = new Date('2026-03-06T12:00:00Z').getTime();
      vi.setSystemTime(baseTime);
      sl.logAuthFailure('10.0.0.1', 'old-entry');

      // Advance 1 hour + 1 ms so the entry is older than 1 hour
      vi.setSystemTime(baseTime + 3600_001);
      sl.cleanup();

      expect(sl.getStatistics().totalIPs).toBe(0);
    });

    it('keeps entries newer than 1 hour', async () => {
      const sl = await getFreshInstance();

      const baseTime = new Date('2026-03-06T12:00:00Z').getTime();
      vi.setSystemTime(baseTime);
      sl.logAuthFailure('10.0.0.1', 'recent-entry');

      // Advance 30 minutes (within the 1-hour window)
      vi.setSystemTime(baseTime + 1800_000);
      sl.cleanup();

      expect(sl.getStatistics().totalIPs).toBe(1);
    });

    it('handles empty map gracefully', async () => {
      const sl = await getFreshInstance();

      expect(() => sl.cleanup()).not.toThrow();
      expect(sl.getStatistics().totalIPs).toBe(0);
    });
  });
});
