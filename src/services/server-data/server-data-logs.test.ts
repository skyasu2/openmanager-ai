/**
 * server-data-logs unit tests
 *
 * Tests generateServerLogs (metric-driven, server-role-context, peer status,
 * healthy state), inferServerType, and source filtering.
 *
 * Pure functions — no mocks needed.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { generateServerLogs } from './server-data-logs';

// ── Helpers ──────────────────────────────────────────────────────────────

const NORMAL_METRICS = { cpu: 30, memory: 40, disk: 30, network: 20 };
const HIGH_CPU = { cpu: 92, memory: 40, disk: 30, network: 20 };
const HIGH_MEMORY = { cpu: 30, memory: 88, disk: 30, network: 20 };
const HIGH_DISK = { cpu: 30, memory: 40, disk: 85, network: 20 };
const HIGH_NETWORK = { cpu: 30, memory: 40, disk: 30, network: 75 };
const ALL_HEALTHY = { cpu: 30, memory: 30, disk: 30, network: 20 };

function hasLogMatching(
  logs: ReturnType<typeof generateServerLogs>,
  pattern: RegExp
): boolean {
  return logs.some((l) => pattern.test(l.message));
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('generateServerLogs', () => {
  // ── 1st pass: metric-driven mandatory ──────────────────────

  describe('1st pass: metric-driven mandatory logs', () => {
    it('cpu > 90% includes kernel throttle log', () => {
      const logs = generateServerLogs(HIGH_CPU, 'app-01', {
        serverType: 'application',
      });

      expect(hasLogMatching(logs, /cpu clock throttled/i)).toBe(true);
    });

    it('cpu > 90% includes GC overhead log', () => {
      const logs = generateServerLogs(HIGH_CPU, 'app-01', {
        serverType: 'application',
      });

      expect(hasLogMatching(logs, /GC overhead/i)).toBe(true);
    });

    it('memory > 85% includes OOM kill log', () => {
      const logs = generateServerLogs(HIGH_MEMORY, 'app-01', {
        serverType: 'application',
      });

      expect(hasLogMatching(logs, /Out of memory/i)).toBe(true);
    });

    it('disk > 80% includes EXT4 warning log', () => {
      const logs = generateServerLogs(HIGH_DISK, 'db-01', {
        serverType: 'database',
      });

      expect(hasLogMatching(logs, /EXT4/i)).toBe(true);
    });

    it('network > 70% includes conntrack full log', () => {
      const logs = generateServerLogs(HIGH_NETWORK, 'web-01', {
        serverType: 'web',
      });

      expect(hasLogMatching(logs, /nf_conntrack.*table full/i)).toBe(true);
    });

    it('all metrics normal produces no error or warn logs', () => {
      const logs = generateServerLogs(NORMAL_METRICS, 'web-01', {
        serverType: 'web',
      });

      const errorOrWarn = logs.filter(
        (l) => l.level === 'error' || l.level === 'warn'
      );
      expect(errorOrWarn).toHaveLength(0);
    });
  });

  // ── 2nd pass: server-role-context ─────────────────────────

  describe('2nd pass: server-role-context logs', () => {
    it('cpu>80 + api role produces nginx upstream timeout', () => {
      const metrics = { cpu: 85, memory: 40, disk: 30, network: 20 };
      const logs = generateServerLogs(metrics, 'api-was-icn-01', {
        serverType: 'web',
      });

      expect(hasLogMatching(logs, /upstream timed out/i)).toBe(true);
    });

    it('disk>70 + mysql role produces mysqldump log (not pg_dump)', () => {
      const metrics = { cpu: 30, memory: 40, disk: 75, network: 20 };
      const logs = generateServerLogs(metrics, 'db-mysql-icn-01', {
        serverType: 'database',
      });

      expect(hasLogMatching(logs, /mysqldump/i)).toBe(true);
      expect(hasLogMatching(logs, /pg_dump/i)).toBe(false);
    });

    it('disk>70 + postgres role produces pg_dump log (not mysqldump)', () => {
      const metrics = { cpu: 30, memory: 40, disk: 75, network: 20 };
      const logs = generateServerLogs(metrics, 'db-postgres-icn-01', {
        serverType: 'database',
      });

      expect(hasLogMatching(logs, /pg_dump/i)).toBe(true);
      expect(hasLogMatching(logs, /mysqldump/i)).toBe(false);
    });

    it('cpu>80 + cache role does NOT produce nginx upstream timeout', () => {
      const metrics = { cpu: 85, memory: 40, disk: 30, network: 20 };
      const logs = generateServerLogs(metrics, 'cache-redis-icn-01', {
        serverType: 'cache',
      });

      expect(hasLogMatching(logs, /upstream timed out/i)).toBe(false);
    });

    it('cpu>80 + api role produces both 1st-pass and 2nd-pass logs', () => {
      const metrics = { cpu: 92, memory: 40, disk: 30, network: 20 };
      const logs = generateServerLogs(metrics, 'api-was-icn-01', {
        serverType: 'application',
      });

      // 1st pass: cpu > 90% mandatory log
      expect(hasLogMatching(logs, /cpu clock throttled/i)).toBe(true);
      // 2nd pass: api role context log
      expect(hasLogMatching(logs, /upstream timed out/i)).toBe(true);
    });
  });

  // ── 3rd pass: peer status ──────────────────────────────

  describe('3rd pass: peer status', () => {
    it('upstream unhealthy produces timeout log', () => {
      const logs = generateServerLogs(NORMAL_METRICS, 'web-01', {
        serverType: 'web',
        peerStatus: { upstreamHealthy: false, downstreamHealthy: true },
      });

      expect(hasLogMatching(logs, /upstream timed out/i)).toBe(true);
    });

    it('downstream unhealthy produces connection refused log', () => {
      const logs = generateServerLogs(NORMAL_METRICS, 'lb-01', {
        serverType: 'loadbalancer',
        peerStatus: { upstreamHealthy: true, downstreamHealthy: false },
      });

      expect(hasLogMatching(logs, /Connection refused/i)).toBe(true);
    });
  });

  // ── healthy state ──────────────────────────────────────

  describe('healthy state', () => {
    it('all healthy produces only systemd/cron/nginx info logs', () => {
      const logs = generateServerLogs(ALL_HEALTHY, 'web-01', {
        serverType: 'web',
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((l) => l.level === 'info')).toBe(true);
    });

    it('logs are sorted newest first', () => {
      const logs = generateServerLogs(ALL_HEALTHY, 'web-01', {
        serverType: 'web',
      });

      for (let i = 0; i < logs.length - 1; i++) {
        const current = new Date(logs[i]!.timestamp).getTime();
        const next = new Date(logs[i + 1]!.timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  // ── inferServerType ────────────────────────────────────

  describe('inferServerType (via serverId)', () => {
    it('db in serverId infers database', () => {
      const logs = generateServerLogs(HIGH_DISK, 'mysql-db-01');
      // database type → mysql source allowed
      expect(hasLogMatching(logs, /mysqld|InnoDB/i)).toBe(true);
    });

    it('redis in serverId infers cache', () => {
      const logs = generateServerLogs(HIGH_MEMORY, 'redis-cache-01');
      // cache type → redis source allowed
      expect(hasLogMatching(logs, /redis/i)).toBe(true);
    });

    it('lb in serverId infers loadbalancer', () => {
      const logs = generateServerLogs(HIGH_NETWORK, 'lb-01');
      // loadbalancer type → haproxy source allowed
      expect(hasLogMatching(logs, /haproxy/i)).toBe(true);
    });

    it('api in serverId infers application', () => {
      const logs = generateServerLogs(HIGH_CPU, 'api-server-01');
      // application type → java source allowed (GC overhead)
      expect(hasLogMatching(logs, /GC overhead/i)).toBe(true);
    });

    it('generic serverId defaults to web', () => {
      const logs = generateServerLogs(ALL_HEALTHY, 'frontend-01');
      // web type → nginx source allowed
      expect(hasLogMatching(logs, /nginx/i)).toBe(true);
    });
  });

  // ── source filtering ───────────────────────────────────

  describe('source filtering', () => {
    it('web server does not include mysql logs', () => {
      const logs = generateServerLogs(HIGH_DISK, 'web-01', {
        serverType: 'web',
      });

      const mysqlLogs = logs.filter((l) => l.source === 'mysql');
      expect(mysqlLogs).toHaveLength(0);
    });

    it('database server does not include haproxy logs', () => {
      const logs = generateServerLogs(HIGH_NETWORK, 'db-01', {
        serverType: 'database',
      });

      const haproxyLogs = logs.filter((l) => l.source === 'haproxy');
      expect(haproxyLogs).toHaveLength(0);
    });

    it('cache server does not include nginx logs', () => {
      const logs = generateServerLogs(HIGH_CPU, 'redis-01', {
        serverType: 'cache',
      });

      const nginxLogs = logs.filter((l) => l.source === 'nginx');
      expect(nginxLogs).toHaveLength(0);
    });
  });
});
