/**
 * Metrics-correlated log generation in syslog format.
 *
 * Generates realistic logs based on actual server metrics and server role
 * (inferred from serverId). No scenario labels — just like real monitoring
 * systems (Datadog, Grafana, New Relic) where engineers diagnose issues
 * from metrics + logs, not pre-attached descriptions.
 *
 * Consistency rules:
 * - cpu > 90%  → kernel throttle, GC overhead (MUST appear)
 * - memory > 85% → OOM kill, Redis eviction (MUST appear)
 * - disk > 80%  → "No space left", InnoDB write fail (MUST appear)
 * - network > 70% → conntrack full, SYN flood (MUST appear)
 * - All metrics healthy → only normal cron, health check logs
 *
 * @see server-data-loader.ts - Main orchestration facade
 */

import type { ServerLogEntry } from '@/services/server-data/server-data-types';

/** Server type determines which log sources are realistic */
type ServerType = 'web' | 'database' | 'cache' | 'application' | 'loadbalancer';

/** Sources that belong to the application layer and legitimately produce OTel traces.
 *  Kernel/system-level sources (kernel, systemd, cron, sshd, rsync) do NOT generate
 *  traceId/spanId in real environments. */
const APP_LAYER_SOURCES = new Set([
  'java',
  'nginx',
  'haproxy',
  'redis',
  'mysql',
  'postgres',
  'docker',
  'node',
]);

/** Log source availability per server type */
const SERVER_TYPE_SOURCES: Record<ServerType, Set<string>> = {
  web: new Set([
    'nginx',
    'haproxy',
    'systemd',
    'kernel',
    'docker',
    'cron',
    'sshd',
  ]),
  database: new Set([
    'mysql',
    'postgres',
    'kernel',
    'systemd',
    'docker',
    'cron',
    'sshd',
    'rsync',
  ]),
  cache: new Set(['redis', 'kernel', 'systemd', 'docker', 'cron', 'sshd']),
  application: new Set([
    'java',
    'docker',
    'systemd',
    'kernel',
    'cron',
    'sshd',
    'nginx',
  ]),
  loadbalancer: new Set([
    'haproxy',
    'nginx',
    'kernel',
    'systemd',
    'cron',
    'sshd',
  ]),
};

type LogGeneratorOptions = {
  stripHostname?: boolean;
  serverType?: string;
  peerStatus?: {
    upstreamHealthy: boolean;
    downstreamHealthy: boolean;
  };
};

/**
 * Generate realistic syslog-format logs based on server metrics.
 *
 * 1st pass: Metric thresholds (unconditional — these MUST appear)
 * 2nd pass: Metric + server role (contextual detail, inferred from serverId)
 * 3rd pass: Healthy state (only normal operational logs)
 *
 * @param serverMetrics - Server metrics (primary driver)
 * @param serverId - Server ID (used as hostname and role inference)
 * @param options - Optional: stripHostname, serverType, peerStatus
 * @returns Sorted log entries (newest first)
 */
export function generateServerLogs(
  serverMetrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  },
  serverId: string,
  options?: LogGeneratorOptions
): ServerLogEntry[] {
  const logs: ServerLogEntry[] = [];

  const now = new Date();
  const { cpu, memory, disk, network } = serverMetrics;
  const rawHostname = serverId.split('.')[0] || serverId;
  const hostPrefix = options?.stripHostname ? '' : `${rawHostname} `;
  const serverRole = serverId.toLowerCase();

  // Infer server type from serverId if not provided
  const serverType = inferServerType(options?.serverType || '', serverId);
  const allowedSources = SERVER_TYPE_SOURCES[serverType];

  // Helper: only push log if source is valid for this server type.
  // Strip traceId/spanId from non-app-layer sources (kernel, systemd, cron, etc.)
  // since those components don't produce OTel traces in real systems.
  const push = (entry: ServerLogEntry) => {
    if (allowedSources.has(entry.source)) {
      if (!APP_LAYER_SOURCES.has(entry.source)) {
        delete entry.traceId;
        delete entry.spanId;
      }
      logs.push(entry);
    }
  };

  const pid = (base: number) => base + Math.floor(Math.random() * 1000);
  // Add ±5s jitter to mimic real syslog/rsyslog timestamp variance
  const jitter = () => Math.floor((Math.random() - 0.5) * 10000);
  const ago = (ms: number) =>
    new Date(now.getTime() - ms + jitter()).toISOString();

  // OTel Trace ID/Span ID helpers (Hex strings)
  const genTraceId = () =>
    Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  const genSpanId = () =>
    Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

  // ─── 1st Pass: Metric-driven mandatory logs ─────────────────────

  // CPU critical (> 90%)
  if (cpu > 90) {
    const traceId = genTraceId(); // Correlation: Kernel throttle -> GC overhead
    push({
      timestamp: ago(15000),
      level: 'error',
      message: `${hostPrefix}kernel: [${pid(50000)}.${pid(100)}] CPU${Math.floor(Math.random() * 8)}: Package temperature above threshold, cpu clock throttled`,
      source: 'kernel',
      traceId,
      spanId: genSpanId(),
      structuredData: { temperature: 95, threshold: 90, cpu_id: 2 },
    });
    push({
      timestamp: ago(30000),
      level: 'warn',
      message: `${hostPrefix}java[${pid(5000)}]: GC overhead limit exceeded - heap usage at ${cpu.toFixed(0)}%`,
      source: 'java',
      traceId,
      spanId: genSpanId(),
      structuredData: { heap_usage: cpu, gc_duration_ms: 2500 },
    });
  }

  // CPU warning (> 80%)
  if (cpu > 80 && cpu <= 90) {
    const traceId = genTraceId();
    push({
      timestamp: ago(20000),
      level: 'warn',
      message: `${hostPrefix}systemd[1]: node-exporter.service: Watchdog timeout (limit 30s)!`,
      source: 'systemd',
      traceId,
      spanId: genSpanId(),
    });
  }

  // Memory critical (> 85%)
  if (memory > 85) {
    const traceId = genTraceId(); // Correlation: OOM Kill -> Redis Warning -> Docker Kill
    push({
      timestamp: ago(10000),
      level: 'error',
      message: `${hostPrefix}kernel: Out of memory: Killed process ${pid(10000)} (java) total-vm:${Math.floor(memory * 100)}kB, anon-rss:${Math.floor(memory * 80)}kB`,
      source: 'kernel',
      traceId,
      spanId: genSpanId(),
      structuredData: {
        process: 'java',
        memory_kb: Math.floor(memory * 100),
        reason: 'OOM',
      },
    });
    push({
      timestamp: ago(25000),
      level: 'error',
      message: `${hostPrefix}redis-server[${pid(3000)}]: # WARNING: Memory usage ${memory.toFixed(0)}% of max. Consider increasing maxmemory.`,
      source: 'redis',
      traceId,
      spanId: genSpanId(),
    });
    push({
      timestamp: ago(40000),
      level: 'warn',
      message: `${hostPrefix}dockerd[${pid(800)}]: container ${serverId.substring(0, 12)} OOMKilled=true (memory limit: 2GiB)`,
      source: 'docker',
      traceId,
      spanId: genSpanId(),
      structuredData: {
        container_id: serverId.substring(0, 12),
        event: 'OOMKilled',
      },
    });
  }

  // Memory warning (> 70%)
  if (memory > 70 && memory <= 85) {
    push({
      timestamp: ago(35000),
      level: 'warn',
      message: `${hostPrefix}java[${pid(5000)}]: [GC (Allocation Failure) ${Math.floor(memory * 50)}K->${Math.floor(memory * 30)}K(${Math.floor(memory * 100)}K), 0.${pid(100)} secs]`,
      source: 'java',
    });
  }

  // Disk critical (> 80%)
  if (disk > 80) {
    const traceId = genTraceId(); // Correlation: FS Warning -> MySQL Fail -> Rsync Fail
    push({
      timestamp: ago(20000),
      level: 'error',
      message: `${hostPrefix}kernel: [${pid(80000)}.${pid(100)}] EXT4-fs warning (device sda1): ext4_dx_add_entry:2461: Directory (ino: ${pid(100000)}) index full, reach max htree level :2`,
      source: 'kernel',
      traceId,
      spanId: genSpanId(),
    });
    push({
      timestamp: ago(35000),
      level: 'error',
      message: `${hostPrefix}mysqld[${pid(4000)}]: [ERROR] InnoDB: Write to file ./ib_logfile0 failed at offset ${pid(1000000)}. ${disk.toFixed(0)}% disk used.`,
      source: 'mysql',
      traceId,
      spanId: genSpanId(),
      structuredData: { error_code: 'INNODB_WRITE_FAIL', disk_usage: disk },
    });
    push({
      timestamp: ago(50000),
      level: 'warn',
      message: `${hostPrefix}rsync[${pid(15000)}]: rsync: write failed on "/backup/db-${rawHostname}.sql": No space left on device (28)`,
      source: 'rsync',
      traceId,
      spanId: genSpanId(),
    });
  }

  // Network critical (> 70%)
  if (network > 70) {
    const traceId = genTraceId(); // Correlation: Conntrack full -> HAProxy timeout -> SYN flood
    push({
      timestamp: ago(12000),
      level: 'error',
      message: `${hostPrefix}kernel: [${pid(90000)}.${pid(100)}] nf_conntrack: nf_conntrack: table full, dropping packet`,
      source: 'kernel',
      traceId,
      spanId: genSpanId(),
      structuredData: { event: 'conntrack_full', action: 'drop_packet' },
    });
    push({
      timestamp: ago(42000),
      level: 'warn',
      message: `${hostPrefix}haproxy[${pid(2000)}]: Server api_backend/server1 is DOWN, reason: Layer4 timeout, check duration: 5001ms`,
      source: 'haproxy',
      traceId,
      spanId: genSpanId(),
    });
    push({
      timestamp: ago(65000),
      level: 'warn',
      message: `${hostPrefix}kernel: [${pid(90000)}.${pid(100)}] TCP: request_sock_TCP: Possible SYN flooding on port 80. Sending cookies.`,
      source: 'kernel',
      traceId,
      spanId: genSpanId(),
      structuredData: { event: 'syn_flood', port: 80 },
    });
  }

  // ─── 2nd Pass: Metric + server role (contextual detail) ─────────

  // CPU high + API/web role → upstream timeout
  if (cpu > 80 && matchRole(serverRole, ['api', 'was', 'web', 'nginx'])) {
    const traceId = genTraceId();
    push({
      timestamp: ago(28000),
      level: 'error',
      message: `${hostPrefix}nginx[${pid(1000)}]: upstream timed out (110: Connection timed out) while reading response header from upstream`,
      source: 'nginx',
      traceId,
      spanId: genSpanId(),
      structuredData: { error_code: 110, upstream: 'unknown' },
    });
    push({
      timestamp: ago(45000),
      level: 'warn',
      message: `${hostPrefix}haproxy[${pid(2000)}]: backend api_servers has no server available! (qcur=${Math.floor(cpu * 2)})`,
      source: 'haproxy',
      traceId,
      spanId: genSpanId(),
    });
  }

  // Memory high + cache/redis role → eviction details
  if (memory > 70 && matchRole(serverRole, ['cache', 'redis', 'memcache'])) {
    const traceId = genTraceId();
    push({
      timestamp: ago(55000),
      level: 'warn',
      message: `${hostPrefix}java[${pid(5000)}]: java.lang.OutOfMemoryError: GC overhead limit exceeded`,
      source: 'java',
      traceId,
      spanId: genSpanId(),
    });
  }

  // Disk high + storage/db role → backup failure
  if (
    disk > 70 &&
    matchRole(serverRole, ['storage', 'nfs', 'db', 'mysql', 'postgres'])
  ) {
    const traceId = genTraceId();
    push({
      timestamp: ago(70000),
      level: 'info',
      message: `${hostPrefix}systemd[1]: Starting Daily Backup Service...`,
      source: 'systemd',
      traceId,
      spanId: genSpanId(),
    });
    if (matchRole(serverRole, ['mysql'])) {
      push({
        timestamp: ago(120000),
        level: 'info',
        message: `${hostPrefix}mysqldump[${pid(18000)}]: -- Dumping data for table \`logs\` (${Math.floor(disk * 10)}MB)`,
        source: 'mysql',
        traceId,
        spanId: genSpanId(),
      });
    } else {
      push({
        timestamp: ago(120000),
        level: 'info',
        message: `${hostPrefix}pg_dump[${pid(18000)}]: pg_dump: archiving data for table "public.logs" (${Math.floor(disk * 10)}MB)`,
        source: 'postgres',
        traceId,
        spanId: genSpanId(),
      });
    }
  }

  // Network high + LB role → connection errors
  if (
    network > 60 &&
    matchRole(serverRole, ['lb', 'haproxy', 'loadbalancer'])
  ) {
    const traceId = genTraceId();
    push({
      timestamp: ago(28000),
      level: 'error',
      message: `${hostPrefix}nginx[${pid(1000)}]: connect() failed (111: Connection refused) while connecting to upstream`,
      source: 'nginx',
      traceId,
      spanId: genSpanId(),
    });
    push({
      timestamp: ago(95000),
      level: 'info',
      message: `${hostPrefix}sshd[${pid(22000)}]: Received disconnect from 10.0.0.${Math.floor(network / 10)} port ${pid(40000)}: 11: disconnected by user`,
      source: 'sshd',
      traceId,
      spanId: genSpanId(),
    });
  }

  // ─── 3rd Pass: Peer status (inter-service correlation) ──────────

  if (options?.peerStatus) {
    const { upstreamHealthy, downstreamHealthy } = options.peerStatus;

    // My upstream is unhealthy → I see timeouts/errors
    if (!upstreamHealthy) {
      const traceId = genTraceId();
      push({
        timestamp: ago(18000),
        level: 'error',
        message: `${hostPrefix}nginx[${pid(1000)}]: upstream timed out (110: Connection timed out) while reading response header from upstream, client: 10.0.0.${Math.floor(Math.random() * 254) + 1}`,
        source: 'nginx',
        traceId,
        spanId: genSpanId(),
      });
    }

    // My downstream is unhealthy → I get connection refused
    if (!downstreamHealthy) {
      const traceId = genTraceId();
      push({
        timestamp: ago(22000),
        level: 'error',
        message: `${hostPrefix}haproxy[${pid(2000)}]: backend app_pool/server${Math.floor(Math.random() * 4) + 1} is DOWN, reason: Layer4 connection problem, info: "Connection refused"`,
        source: 'haproxy',
        traceId,
        spanId: genSpanId(),
      });
    }
  }

  // ─── 4th Pass: Healthy state (all metrics normal) ──────────────

  const isHealthy = cpu < 60 && memory < 60 && disk < 60 && network < 50;

  if (isHealthy || logs.length === 0) {
    const traceId = genTraceId();
    push({
      timestamp: ago(30000),
      level: 'info',
      message: `${hostPrefix}systemd[1]: Started Daily apt download activities.`,
      source: 'systemd',
      traceId,
      spanId: genSpanId(),
    });
    push({
      timestamp: ago(45000),
      level: 'info',
      message: `${hostPrefix}CRON[${pid(20000)}]: (root) CMD (/usr/lib/apt/apt.systemd.daily install)`,
      source: 'cron',
      traceId, // Same activity group
      spanId: genSpanId(),
    });
    push({
      timestamp: ago(60000),
      level: 'info',
      message: `${hostPrefix}nginx[${pid(1000)}]: 10.0.0.1 - - "GET /health HTTP/1.1" 200 15 "-" "kube-probe/1.28"`,
      source: 'nginx',
      traceId: genTraceId(), // Independent request
      spanId: genSpanId(),
      structuredData: {
        method: 'GET',
        path: '/health',
        status: 200,
        user_agent: 'kube-probe/1.28',
      },
    });
    push({
      timestamp: ago(90000),
      level: 'info',
      message: `${hostPrefix}dockerd[${pid(800)}]: time="2026-01-03T10:00:00.000000000Z" level=info msg="Container health status: healthy"`,
      source: 'docker',
      traceId: genTraceId(),
      spanId: genSpanId(),
      structuredData: { container_status: 'healthy' },
    });
  }

  // Sort newest first
  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Check if serverId contains any of the role keywords */
function matchRole(serverId: string, keywords: string[]): boolean {
  return keywords.some((kw) => serverId.includes(kw));
}

/** Infer ServerType from explicit type or serverId naming convention */
function inferServerType(explicitType: string, serverId: string): ServerType {
  const t = explicitType.toLowerCase();
  if (
    t === 'web' ||
    t === 'database' ||
    t === 'cache' ||
    t === 'application' ||
    t === 'loadbalancer'
  ) {
    return t;
  }

  const id = serverId.toLowerCase();
  if (id.includes('db') || id.includes('mysql') || id.includes('postgres'))
    return 'database';
  if (id.includes('redis') || id.includes('cache') || id.includes('memcache'))
    return 'cache';
  if (
    id.includes('lb') ||
    id.includes('haproxy') ||
    id.includes('loadbalancer')
  )
    return 'loadbalancer';
  if (id.includes('api') || id.includes('app') || id.includes('worker'))
    return 'application';

  return 'web'; // default
}
