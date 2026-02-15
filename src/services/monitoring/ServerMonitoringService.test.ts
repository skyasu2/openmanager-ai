/**
 * ServerMonitoringService unit tests
 *
 * Tests processMetric (SOURCE/DERIVED/CONFIG fields),
 * and projections: toServer, toEnhancedMetrics, toPaginatedServer.
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiServerMetrics } from '@/services/metrics/types';
import { estimateLoad15 } from '@/services/server-data/server-data-transformer';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/services/metrics/MetricsProvider', () => ({
  metricsProvider: {
    getServerMetrics: vi.fn(),
    getAllServerMetrics: vi.fn(() => []),
    getSystemSummary: vi.fn(() => ({
      timestamp: '2026-02-01T10:00:00Z',
      minuteOfDay: 600,
      totalServers: 0,
      statusCounts: { online: 0, warning: 0, critical: 0, offline: 0 },
      avgCpu: 0,
      avgMemory: 0,
      avgDisk: 0,
      avgNetwork: 0,
    })),
  },
}));

vi.mock('@/config/server-registry', () => ({
  getServerIP: vi.fn((id: string) => `10.0.0.${id.length}`),
}));

vi.mock('@/config/server-services-map', () => ({
  getServicesForServer: vi.fn(() => [
    { name: 'nginx', status: 'running', port: 80 },
  ]),
}));

// Import after mocks
import { metricsProvider } from '@/services/metrics/MetricsProvider';
import { ServerMonitoringService } from './ServerMonitoringService';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW_SECONDS = Math.floor(Date.now() / 1000);

function makeApiMetric(
  overrides?: Partial<ApiServerMetrics>
): ApiServerMetrics {
  return {
    serverId: 'web-01',
    serverType: 'web',
    location: 'icn-01',
    timestamp: '2026-02-01T10:00:00Z',
    minuteOfDay: 600,
    cpu: 55,
    memory: 60,
    disk: 40,
    network: 30,
    logs: [],
    status: 'online',
    hostname: 'web-01.openmanager.local',
    environment: 'production',
    os: 'ubuntu',
    osVersion: '22.04',
    loadAvg1: 1.2,
    loadAvg5: 0.8,
    bootTimeSeconds: NOW_SECONDS - 86400, // 1 day ago
    procsRunning: 120,
    responseTimeMs: 150,
    nodeInfo: {
      cpuCores: 8,
      memoryTotalBytes: 16 * 1024 ** 3,
      diskTotalBytes: 500 * 1024 ** 3,
    },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ServerMonitoringService', () => {
  let service: ServerMonitoringService;

  beforeEach(() => {
    ServerMonitoringService.resetForTesting();
    vi.stubEnv('NODE_ENV', 'test');
    service = ServerMonitoringService.getInstance();
  });

  // ── Singleton ────────────────────────────────────────────────────

  describe('singleton', () => {
    it('getInstance() returns the same instance', () => {
      const a = ServerMonitoringService.getInstance();
      const b = ServerMonitoringService.getInstance();
      expect(a).toBe(b);
    });

    it('resetForTesting() creates a new instance', () => {
      const first = ServerMonitoringService.getInstance();
      ServerMonitoringService.resetForTesting();
      const second = ServerMonitoringService.getInstance();
      expect(first).not.toBe(second);
    });
  });

  // ── processMetric (via getProcessedServer) ───────────────────────

  describe('processMetric via getProcessedServer', () => {
    it('passes SOURCE fields through: cpu, memory, disk, network', () => {
      const metric = makeApiMetric({
        cpu: 72,
        memory: 65,
        disk: 48,
        network: 35,
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01');
      expect(result).not.toBeNull();
      expect(result!.cpu).toBe(72);
      expect(result!.memory).toBe(65);
      expect(result!.disk).toBe(48);
      expect(result!.network).toBe(35);
    });

    it('derives networkIn/networkOut from server type ratio', () => {
      const metric = makeApiMetric({ network: 100, serverType: 'web' });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      // web ratio: rx=0.7, tx=0.3
      expect(result.networkIn).toBe(70);
      expect(result.networkOut).toBe(30);
    });

    it('derives networkIn/networkOut for database type', () => {
      const metric = makeApiMetric({ network: 100, serverType: 'database' });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('db-01')!;
      // database ratio: rx=0.4, tx=0.6
      expect(result.networkIn).toBe(40);
      expect(result.networkOut).toBe(60);
    });

    it('derives loadAvg15 from estimateLoad15(load1, load5)', () => {
      const metric = makeApiMetric({ loadAvg1: 2.0, loadAvg5: 1.5 });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      const expectedLoad15 = estimateLoad15(2.0, 1.5);
      expect(result.loadAvg15).toBeCloseTo(expectedLoad15, 2);
    });

    it('derives uptimeSeconds from bootTimeSeconds', () => {
      const bootTime = NOW_SECONDS - 7200; // 2 hours ago
      const metric = makeApiMetric({ bootTimeSeconds: bootTime });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      // Allow 2s tolerance for test execution time
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(7198);
      expect(result.uptimeSeconds).toBeLessThanOrEqual(7202);
    });

    it('returns uptimeSeconds=0 when bootTimeSeconds absent', () => {
      const metric = makeApiMetric({ bootTimeSeconds: undefined });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.uptimeSeconds).toBe(0);
    });

    it('sets ip from getServerIP (CONFIG)', () => {
      const metric = makeApiMetric();
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.ip).toBe('10.0.0.6'); // "web-01".length = 6
    });

    it('sets services from getServicesForServer (CONFIG)', () => {
      const metric = makeApiMetric();
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.services).toEqual([
        { name: 'nginx', status: 'running', port: 80 },
      ]);
    });

    it('returns specs when nodeInfo is present', () => {
      const metric = makeApiMetric({
        nodeInfo: {
          cpuCores: 16,
          memoryTotalBytes: 32 * 1024 ** 3,
          diskTotalBytes: 1000 * 1024 ** 3,
        },
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.specs).toEqual({
        cpu_cores: 16,
        memory_gb: 32,
        disk_gb: 1000,
      });
    });

    it('returns specs undefined when nodeInfo absent', () => {
      const metric = makeApiMetric({ nodeInfo: undefined });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.specs).toBeUndefined();
    });

    it('builds alerts from [WARN] log entries as warning severity', () => {
      const metric = makeApiMetric({
        logs: ['[WARN] CPU usage above threshold'],
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]!.severity).toBe('warning');
      expect(result.alerts[0]!.type).toBe('cpu');
    });

    it('builds alerts from [CRITICAL] log entries as critical severity', () => {
      const metric = makeApiMetric({
        logs: ['[CRITICAL] memory exceeded limit'],
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]!.severity).toBe('critical');
      expect(result.alerts[0]!.type).toBe('memory');
    });

    it('returns null when server not found', () => {
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(undefined);

      const result = service.getProcessedServer('nonexistent');
      expect(result).toBeNull();
    });

    it('builds osLabel from os + osVersion', () => {
      const metric = makeApiMetric({ os: 'centos', osVersion: '7.9' });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.osLabel).toBe('Centos 7.9');
    });

    it('defaults osLabel when os/osVersion missing', () => {
      const metric = makeApiMetric({ os: undefined, osVersion: undefined });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const result = service.getProcessedServer('web-01')!;
      expect(result.osLabel).toBe('Ubuntu 22.04 LTS');
    });
  });

  // ── toServer projection ──────────────────────────────────────────

  describe('toServer projection', () => {
    it('maps [CRITICAL] log to ERROR level', () => {
      const metric = makeApiMetric({
        logs: ['[CRITICAL] disk failure imminent'],
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const server = service.toServer(processed);

      expect(server.logs[0]!.level).toBe('ERROR');
    });

    it('maps [WARN] log to WARN level', () => {
      const metric = makeApiMetric({
        logs: ['[WARN] Network latency increasing'],
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const server = service.toServer(processed);

      expect(server.logs[0]!.level).toBe('WARN');
    });

    it('maps normal log to INFO level', () => {
      const metric = makeApiMetric({
        logs: ['systemd[1]: Started Daily apt download activities.'],
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const server = service.toServer(processed);

      expect(server.logs[0]!.level).toBe('INFO');
    });

    it('formats systemInfo.loadAverage as comma-separated string', () => {
      const metric = makeApiMetric({ loadAvg1: 1.2, loadAvg5: 0.8 });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const server = service.toServer(processed);

      expect(server.systemInfo.loadAverage).toMatch(
        /^\d+\.\d+, \d+\.\d+, \d+\.\d+$/
      );
    });
  });

  // ── toEnhancedMetrics projection ─────────────────────────────────

  describe('toEnhancedMetrics projection', () => {
    it('includes cpu_usage alias equal to cpu', () => {
      const metric = makeApiMetric({ cpu: 77 });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const enhanced = service.toEnhancedMetrics(processed);

      expect(enhanced.cpu_usage).toBe(77);
      expect(enhanced.cpu).toBe(77);
    });

    it('includes network_in and network_out', () => {
      const metric = makeApiMetric({ network: 80, serverType: 'web' });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const enhanced = service.toEnhancedMetrics(processed);

      expect(enhanced.network_in).toBe(56); // 80 * 0.7
      expect(enhanced.network_out).toBe(24); // 80 * 0.3
    });

    it('sets networkInfo status to offline when server offline', () => {
      const metric = makeApiMetric({ status: 'offline' });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const enhanced = service.toEnhancedMetrics(processed);

      expect(enhanced.networkInfo.status).toBe('offline');
    });
  });

  // ── toPaginatedServer projection ─────────────────────────────────

  describe('toPaginatedServer projection', () => {
    it('returns loadAverage as [l1, l5, l15] tuple', () => {
      const metric = makeApiMetric({ loadAvg1: 2.0, loadAvg5: 1.5 });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const paginated = service.toPaginatedServer(processed);

      expect(paginated.metrics.loadAverage).toHaveLength(3);
      expect(paginated.metrics.loadAverage[0]).toBe(2.0);
      expect(paginated.metrics.loadAverage[1]).toBe(1.5);
      const expectedLoad15 = estimateLoad15(2.0, 1.5);
      expect(paginated.metrics.loadAverage[2]).toBeCloseTo(expectedLoad15, 2);
    });

    it('uses hostname as name', () => {
      const metric = makeApiMetric({
        hostname: 'web-01.openmanager.local',
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const paginated = service.toPaginatedServer(processed);

      expect(paginated.name).toBe('web-01.openmanager.local');
    });

    it('rounds cpu/memory/disk metrics', () => {
      const metric = makeApiMetric({
        cpu: 55.7,
        memory: 62.3,
        disk: 41.9,
      });
      vi.mocked(metricsProvider.getServerMetrics).mockReturnValue(metric);

      const processed = service.getProcessedServer('web-01')!;
      const paginated = service.toPaginatedServer(processed);

      expect(paginated.metrics.cpu).toBe(56);
      expect(paginated.metrics.memory).toBe(62);
      expect(paginated.metrics.disk).toBe(42);
    });
  });
});
