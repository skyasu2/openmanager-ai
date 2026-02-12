/**
 * AI Engine Log Generator (경량 버전)
 *
 * Vercel server-data-logs.ts의 4-pass 로직을 AI 컨텍스트용으로 축약.
 * UI 전용 필드(traceId, spanId, structuredData, timestamp) 제거.
 *
 * Consistency rules (system-rules.json 임계값과 일치):
 * - cpu > 90% (critical)  → kernel throttle, GC overhead [error]
 * - cpu > 80% (warning)   → watchdog timeout [warn]
 * - memory > 90% (critical) → OOM kill, Redis eviction [error]
 * - memory > 80% (warning)  → GC allocation failure [warn]
 * - disk > 90% (critical) → "No space left", InnoDB write fail [error]
 * - disk > 80% (warning)  → capacity warning [warn]
 * - network > 85% (critical) → conntrack full, SYN flood [error]
 * - network > 70% (warning)  → throughput high [warn]
 * - All metrics healthy → only cron/healthcheck
 *
 * @see src/services/server-data/server-data-logs.ts (Vercel full version)
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'info' | 'warn' | 'error';

export interface GeneratedLog {
  level: LogLevel;
  source: string;
  message: string;
}

// ============================================================================
// Server Type → Log Source Mapping
// ============================================================================

type ServerType = 'web' | 'database' | 'cache' | 'application' | 'loadbalancer';

const SERVER_TYPE_SOURCES: Record<ServerType, Set<string>> = {
  web: new Set(['nginx', 'haproxy', 'systemd', 'kernel', 'docker', 'cron', 'sshd']),
  database: new Set(['mysql', 'postgres', 'kernel', 'systemd', 'docker', 'cron', 'sshd', 'rsync']),
  cache: new Set(['redis', 'kernel', 'systemd', 'docker', 'cron', 'sshd']),
  application: new Set(['java', 'docker', 'systemd', 'kernel', 'cron', 'sshd', 'nginx']),
  loadbalancer: new Set(['haproxy', 'nginx', 'kernel', 'systemd', 'cron', 'sshd']),
};

// ============================================================================
// Main Generator
// ============================================================================

/**
 * 메트릭 기반 로그 생성 (AI 컨텍스트용)
 *
 * @param metrics - 서버 메트릭 (0-100 percent)
 * @param serverId - 서버 ID
 * @param serverType - 서버 타입 (raw string, inferServerType로 정규화)
 * @param scenario - 시나리오 힌트 (optional, 2nd pass용)
 */
export function generateLogs(
  metrics: { cpu: number; memory: number; disk: number; network: number },
  serverId: string,
  serverType: string,
  scenario: string = '',
): GeneratedLog[] {
  const logs: GeneratedLog[] = [];
  const { cpu, memory, disk, network } = metrics;
  const type = inferServerType(serverType, serverId);
  const allowed = SERVER_TYPE_SOURCES[type];
  const hint = scenario.toLowerCase();

  const push = (log: GeneratedLog) => {
    if (allowed.has(log.source)) {
      logs.push(log);
    }
  };

  // ─── 1st Pass: Metric-driven mandatory logs ─────────────────────

  // 임계값: system-rules.json과 일치 (cpu/mem/disk: warn=80, crit=90, net: warn=70, crit=85)
  if (cpu > 90) {
    push({ level: 'error', source: 'kernel', message: 'CPU Package temperature above threshold, cpu clock throttled' });
    push({ level: 'error', source: 'java', message: `GC overhead limit exceeded - heap usage at ${Math.round(cpu)}%` });
  } else if (cpu > 80) {
    push({ level: 'warn', source: 'systemd', message: 'node-exporter.service: Watchdog timeout (limit 30s)!' });
  }

  if (memory > 90) {
    push({ level: 'error', source: 'kernel', message: `Out of memory: Killed process (java) total-vm:${Math.floor(memory * 100)}kB` });
    push({ level: 'error', source: 'redis', message: `WARNING: Memory usage ${Math.round(memory)}% of max. Consider increasing maxmemory.` });
    push({ level: 'warn', source: 'docker', message: `container OOMKilled=true (memory limit: 2GiB)` });
  } else if (memory > 80) {
    push({ level: 'warn', source: 'java', message: `GC Allocation Failure ${Math.floor(memory * 50)}K->${Math.floor(memory * 30)}K` });
  }

  if (disk > 90) {
    push({ level: 'error', source: 'kernel', message: 'EXT4-fs warning: ext4_dx_add_entry: Directory index full' });
    push({ level: 'error', source: 'mysql', message: `InnoDB: Write to file ./ib_logfile0 failed. ${Math.round(disk)}% disk used.` });
    push({ level: 'error', source: 'rsync', message: 'rsync: write failed: No space left on device (28)' });
  } else if (disk > 80) {
    push({ level: 'warn', source: 'kernel', message: `Filesystem /dev/sda1 usage at ${Math.round(disk)}% - approaching capacity` });
    push({ level: 'warn', source: 'rsync', message: 'rsync: low disk space warning during backup' });
  }

  if (network > 85) {
    push({ level: 'error', source: 'kernel', message: 'nf_conntrack: table full, dropping packet' });
    push({ level: 'error', source: 'haproxy', message: 'Server api_backend/server1 is DOWN, reason: Layer4 timeout' });
    push({ level: 'warn', source: 'kernel', message: 'TCP: Possible SYN flooding on port 80. Sending cookies.' });
  } else if (network > 70) {
    push({ level: 'warn', source: 'kernel', message: `Network throughput high: ${Math.round(network)}% utilization` });
    push({ level: 'warn', source: 'haproxy', message: 'backend api_servers queue depth increasing' });
  }

  // ─── 2nd Pass: Metric + scenario hint ───────────────────────────

  if (cpu > 80 && hasHint(hint, ['api', '과부하', 'cpu'])) {
    push({ level: 'error', source: 'nginx', message: 'upstream timed out (110: Connection timed out) while reading response header' });
    push({ level: 'warn', source: 'haproxy', message: `backend api_servers has no server available! (qcur=${Math.floor(cpu * 2)})` });
  }

  if (memory > 80 && hasHint(hint, ['캐시', 'redis', 'memory', '메모리'])) {
    push({ level: 'warn', source: 'redis', message: `Redis eviction policy active - keys being removed (memory ${Math.round(memory)}%)` });
  }

  if (disk > 70 && hasHint(hint, ['백업', 'backup', '디스크', 'disk', 'i/o'])) {
    push({ level: 'info', source: 'systemd', message: 'Starting Daily Backup Service...' });
    push({ level: 'info', source: 'postgres', message: `pg_dump: archiving data for table "public.logs" (${Math.floor(disk * 10)}MB)` });
  }

  if (network > 70 && hasHint(hint, ['네트워크', 'network', '패킷', 'lb', '로드밸런서'])) {
    push({ level: 'warn', source: 'nginx', message: 'upstream connection timeout increasing - check backend health' });
  }

  // ─── 3rd Pass: Healthy state ────────────────────────────────────

  const isHealthy = cpu < 60 && memory < 60 && disk < 60 && network < 50;

  if (isHealthy || logs.length === 0) {
    push({ level: 'info', source: 'systemd', message: 'Started Daily apt download activities.' });
    push({ level: 'info', source: 'cron', message: '(root) CMD (/usr/lib/apt/apt.systemd.daily install)' });
    push({ level: 'info', source: 'nginx', message: 'GET /health HTTP/1.1 200 15 "kube-probe/1.28"' });
  }

  return logs;
}

// ============================================================================
// Helpers
// ============================================================================

function hasHint(hint: string, keywords: string[]): boolean {
  return keywords.some((kw) => hint.includes(kw));
}

function inferServerType(explicitType: string, serverId: string): ServerType {
  const t = explicitType.toLowerCase();
  if (t === 'web' || t === 'database' || t === 'cache' || t === 'application' || t === 'loadbalancer') {
    return t;
  }

  const id = serverId.toLowerCase();
  if (id.includes('db') || id.includes('mysql') || id.includes('postgres')) return 'database';
  if (id.includes('redis') || id.includes('cache') || id.includes('memcache')) return 'cache';
  if (id.includes('lb') || id.includes('haproxy') || id.includes('loadbalancer')) return 'loadbalancer';
  if (id.includes('api') || id.includes('app') || id.includes('worker')) return 'application';

  return 'web';
}
