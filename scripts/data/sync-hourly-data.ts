#!/usr/bin/env tsx
/**
 * 🔄 SSOT 데이터 동기화 스크립트 (Prometheus 포맷)
 *
 * 목적: Prometheus/node_exporter 스타일 JSON 생성
 * - Dashboard와 AI Engine이 동일한 데이터를 사용하도록 보장
 * - 서버 ID 명명규칙: 한국 DC (web-nginx-icn-01, cache-redis-icn-01 등)
 * - metric 이름: node_* prefix (node_exporter 표준)
 *
 * 사용법:
 *   npx tsx scripts/data/sync-hourly-data.ts
 *
 * 출력:
 *   - src/data/hourly-data/hour-XX.json (24개 파일, SSOT 번들)
 *   - cloud-run/ai-engine/data/hourly-data/hour-XX.json (24개 파일)
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Seeded Random (결정론적 랜덤 - 매번 동일한 결과)
// ============================================================================

/**
 * Mulberry32 PRNG - 시드 기반 결정론적 난수 생성기
 * 같은 시드로 실행하면 항상 동일한 난수 시퀀스 생성
 */
function createSeededRandom(seed: number) {
  let state = seed;
  return function (): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 전역 시드 기반 랜덤 함수 (시간/서버별로 재설정)
let seededRandom: () => number = Math.random;

// ============================================================================
// 서버 정의 (fixed-24h-metrics.ts와 동기화)
// ============================================================================

type ServerType =
  | 'web'
  | 'database'
  | 'application'
  | 'storage'
  | 'cache'
  | 'loadbalancer';

type ServerStatus = 'online' | 'warning' | 'critical' | 'offline';

interface ServerConfig {
  id: string;
  name: string;
  type: ServerType;
  location: string;
  hostname: string;
  ip: string;
  os: string;
  osVersion: string;
  specs: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
  };
  baseline: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

/**
 * 🇰🇷 한국 데이터센터 기반 15개 서버 정의 (SSOT)
 *
 * 서버 존:
 * - ICN: 인천/서울 (메인 데이터센터)
 * - PUS: 부산 (DR 데이터센터)
 */
const KOREAN_DC_SERVERS: ServerConfig[] = [
  // 웹서버 (Nginx): 3대
  {
    id: 'web-nginx-icn-01',
    name: 'Nginx Web Server 01',
    type: 'web',
    location: 'Seoul-ICN-AZ1',
    hostname: 'web-nginx-icn-01.openmanager.kr',
    ip: '10.10.1.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 100 },
    baseline: { cpu: 35, memory: 45, disk: 30, network: 60 },
  },
  {
    id: 'web-nginx-icn-02',
    name: 'Nginx Web Server 02',
    type: 'web',
    location: 'Seoul-ICN-AZ2',
    hostname: 'web-nginx-icn-02.openmanager.kr',
    ip: '10.10.1.12',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 100 },
    baseline: { cpu: 32, memory: 42, disk: 28, network: 55 },
  },
  {
    id: 'web-nginx-pus-01',
    name: 'Nginx Web Server DR',
    type: 'web',
    location: 'Busan-PUS-AZ1',
    hostname: 'web-nginx-pus-01.openmanager.kr',
    ip: '10.20.1.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 100 },
    baseline: { cpu: 20, memory: 35, disk: 25, network: 40 },
  },

  // API 서버 (WAS): 3대
  {
    id: 'api-was-icn-01',
    name: 'WAS API Server 01',
    type: 'application',
    location: 'Seoul-ICN-AZ1',
    hostname: 'api-was-icn-01.openmanager.kr',
    ip: '10.10.2.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 8, memory_gb: 16, disk_gb: 200 },
    baseline: { cpu: 45, memory: 55, disk: 35, network: 50 },
  },
  {
    id: 'api-was-icn-02',
    name: 'WAS API Server 02',
    type: 'application',
    location: 'Seoul-ICN-AZ2',
    hostname: 'api-was-icn-02.openmanager.kr',
    ip: '10.10.2.12',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 8, memory_gb: 16, disk_gb: 200 },
    baseline: { cpu: 42, memory: 52, disk: 33, network: 48 },
  },
  {
    id: 'api-was-pus-01',
    name: 'WAS API Server DR',
    type: 'application',
    location: 'Busan-PUS-AZ1',
    hostname: 'api-was-pus-01.openmanager.kr',
    ip: '10.20.2.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 8, memory_gb: 16, disk_gb: 200 },
    baseline: { cpu: 25, memory: 40, disk: 28, network: 35 },
  },

  // 데이터베이스 (MySQL): 3대
  {
    id: 'db-mysql-icn-primary',
    name: 'MySQL Primary',
    type: 'database',
    location: 'Seoul-ICN-AZ1',
    hostname: 'db-mysql-icn-primary.openmanager.kr',
    ip: '10.10.3.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 16, memory_gb: 64, disk_gb: 1000 },
    baseline: { cpu: 55, memory: 70, disk: 45, network: 40 },
  },
  {
    id: 'db-mysql-icn-replica',
    name: 'MySQL Replica',
    type: 'database',
    location: 'Seoul-ICN-AZ2',
    hostname: 'db-mysql-icn-replica.openmanager.kr',
    ip: '10.10.3.12',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 16, memory_gb: 64, disk_gb: 1000 },
    baseline: { cpu: 40, memory: 60, disk: 42, network: 35 },
  },
  {
    id: 'db-mysql-pus-dr',
    name: 'MySQL DR Replica',
    type: 'database',
    location: 'Busan-PUS-AZ1',
    hostname: 'db-mysql-pus-dr.openmanager.kr',
    ip: '10.20.3.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 16, memory_gb: 64, disk_gb: 1000 },
    baseline: { cpu: 20, memory: 45, disk: 40, network: 25 },
  },

  // 캐시 (Redis): 2대
  {
    id: 'cache-redis-icn-01',
    name: 'Redis Cache 01',
    type: 'cache',
    location: 'Seoul-ICN-AZ1',
    hostname: 'cache-redis-icn-01.openmanager.kr',
    ip: '10.10.4.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 4, memory_gb: 32, disk_gb: 50 },
    baseline: { cpu: 25, memory: 75, disk: 20, network: 45 },
  },
  {
    id: 'cache-redis-icn-02',
    name: 'Redis Cache 02',
    type: 'cache',
    location: 'Seoul-ICN-AZ2',
    hostname: 'cache-redis-icn-02.openmanager.kr',
    ip: '10.10.4.12',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 4, memory_gb: 32, disk_gb: 50 },
    baseline: { cpu: 22, memory: 72, disk: 18, network: 42 },
  },

  // 스토리지 (NFS/S3): 2대
  {
    id: 'storage-nfs-icn-01',
    name: 'NFS Storage 01',
    type: 'storage',
    location: 'Seoul-ICN-AZ1',
    hostname: 'storage-nfs-icn-01.openmanager.kr',
    ip: '10.10.5.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 4, memory_gb: 16, disk_gb: 5000 },
    baseline: { cpu: 30, memory: 40, disk: 65, network: 50 },
  },
  {
    id: 'storage-s3gw-pus-01',
    name: 'S3 Gateway DR',
    type: 'storage',
    location: 'Busan-PUS-DR',
    hostname: 'storage-s3gw-pus-01.openmanager.kr',
    ip: '10.20.5.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 2, memory_gb: 8, disk_gb: 200 },
    baseline: { cpu: 20, memory: 35, disk: 55, network: 60 },
  },

  // 로드밸런서 (HAProxy): 2대
  {
    id: 'lb-haproxy-icn-01',
    name: 'HAProxy LB 01',
    type: 'loadbalancer',
    location: 'Seoul-ICN-AZ1',
    hostname: 'lb-haproxy-icn-01.openmanager.kr',
    ip: '10.10.6.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 50 },
    baseline: { cpu: 40, memory: 35, disk: 15, network: 70 },
  },
  {
    id: 'lb-haproxy-pus-01',
    name: 'HAProxy LB DR',
    type: 'loadbalancer',
    location: 'Busan-PUS-DR',
    hostname: 'lb-haproxy-pus-01.openmanager.kr',
    ip: '10.20.6.11',
    os: 'ubuntu',
    osVersion: '22.04',
    specs: { cpu_cores: 4, memory_gb: 8, disk_gb: 50 },
    baseline: { cpu: 38, memory: 33, disk: 14, network: 68 },
  },
];

// ============================================================================
// 장애 시나리오 정의 (24시간 4분할)
// ============================================================================

interface FailureScenario {
  hour: number;
  incident: string;
  affectedServers: {
    id: string;
    status: ServerStatus;
    metricsOverride: Partial<{ cpu: number; memory: number; disk: number; network: number }>;
  }[];
}

/**
 * 장애 진행 단계 정의
 * - pre: 장애 1시간 전 (경고 징후)
 * - onset: 장애 시작 (00-20분)
 * - peak: 장애 피크 (30분)
 * - sustained: 장애 지속 (40-50분)
 * - recovery: 장애 후 회복 (다음 시간)
 */
type FailurePhase = 'normal' | 'pre' | 'onset' | 'peak' | 'sustained' | 'recovery';

/**
 * 단계별 메트릭 배수 (피크 대비)
 */
const PHASE_MULTIPLIERS: Record<FailurePhase, number> = {
  normal: 0,      // 정상
  pre: 0.4,       // 전조 징후 (40%)
  onset: 0.6,     // 시작 (60%)
  peak: 1.0,      // 피크 (100%)
  sustained: 0.85, // 지속 (85%)
  recovery: 0.3,  // 회복 중 (30%)
};

const FAILURE_SCENARIOS: FailureScenario[] = [
  // 🔴 0-5시: DB 백업 → 슬로우 쿼리 연쇄 장애
  {
    hour: 2,
    incident: 'DB 자동 백업 중 디스크 I/O 과부하',
    affectedServers: [
      { id: 'db-mysql-icn-primary', status: 'warning', metricsOverride: { cpu: 85, disk: 88, memory: 78 } },
      { id: 'db-mysql-icn-replica', status: 'warning', metricsOverride: { cpu: 70, disk: 82, memory: 72 } },
    ],
  },
  {
    hour: 3,
    incident: 'DB 슬로우 쿼리 누적 - 성능 저하',
    affectedServers: [
      { id: 'db-mysql-icn-primary', status: 'critical', metricsOverride: { cpu: 95, memory: 92, disk: 72 } },
      { id: 'api-was-icn-01', status: 'warning', metricsOverride: { cpu: 75, memory: 70 } },
    ],
  },

  // 🟡 6-11시: 네트워크/LB 장애
  {
    hour: 7,
    incident: '네트워크 패킷 손실 - LB 과부하',
    affectedServers: [
      { id: 'lb-haproxy-icn-01', status: 'critical', metricsOverride: { cpu: 92, network: 95 } },
      { id: 'web-nginx-icn-01', status: 'warning', metricsOverride: { cpu: 78, network: 88 } },
      { id: 'web-nginx-icn-02', status: 'warning', metricsOverride: { cpu: 75, network: 85 } },
    ],
  },

  // 🔵 12-17시: 메모리 누수 장애
  {
    hour: 12,
    incident: 'Redis 캐시 메모리 누수 - OOM 직전',
    affectedServers: [
      { id: 'cache-redis-icn-01', status: 'critical', metricsOverride: { memory: 95, cpu: 65 } },
      { id: 'cache-redis-icn-02', status: 'warning', metricsOverride: { memory: 89, cpu: 55 } },
      { id: 'api-was-icn-01', status: 'warning', metricsOverride: { memory: 78, cpu: 68 } },
    ],
  },

  // 🟠 18-23시: CPU 피크 장애
  {
    hour: 21,
    incident: 'API 요청 폭증 - CPU 과부하',
    affectedServers: [
      { id: 'api-was-icn-01', status: 'critical', metricsOverride: { cpu: 96, memory: 85 } },
      { id: 'api-was-icn-02', status: 'critical', metricsOverride: { cpu: 94, memory: 82 } },
      { id: 'lb-haproxy-icn-01', status: 'warning', metricsOverride: { cpu: 80, network: 88 } },
    ],
  },
];

// ============================================================================
// 로그 템플릿 (AI 분석용)
// ============================================================================

const LOG_TEMPLATES: Record<ServerType, Record<string, { critical: string[]; warning: string[] }>> = {
  database: {
    cpu: {
      critical: [
        '[ERROR] mysqld: CPU utilization exceeded 95% - query processing delayed',
        '[ERROR] InnoDB: Buffer pool contention detected - high CPU wait',
        '[WARN] Slow query: SELECT * FROM orders took 12.5s (rows_examined: 2.5M)',
      ],
      warning: [
        '[WARN] mysqld: CPU spike detected during query execution',
        '[INFO] Query optimizer: Full table scan on large_table',
      ],
    },
    memory: {
      critical: [
        '[ERROR] mysqld: Out of memory (Needed 2048 bytes)',
        '[ERROR] InnoDB: Cannot allocate buffer pool - insufficient memory',
        '[WARN] Connection pool exhausted: 500/500 connections used',
      ],
      warning: [
        '[WARN] InnoDB: Buffer pool usage above 85%',
        '[INFO] mysqld: Memory pressure detected, freeing cache',
      ],
    },
    disk: {
      critical: [
        '[ERROR] mysqld: Disk full /var/lib/mysql (errcode: 28)',
        '[ERROR] InnoDB: Unable to write to datafile /var/lib/mysql/ibdata1',
        '[ERROR] Binary log write failed: MYSQL_BIN_LOG::write_event() returned 1',
      ],
      warning: [
        '[WARN] InnoDB: Tablespace approaching 90% capacity',
        '[INFO] mysqld: Running disk cleanup on /var/lib/mysql',
      ],
    },
    network: {
      critical: [
        '[ERROR] mysqld: Connection refused - max_connections reached',
        '[ERROR] Replication lag: 3600 seconds behind master',
      ],
      warning: [
        '[WARN] mysqld: Network latency spike to replica',
        '[INFO] Connection timeout from application server',
      ],
    },
  },
  cache: {
    cpu: {
      critical: ['[ERROR] redis: CPU 100% - event loop blocked'],
      warning: ['[WARN] redis: High CPU during KEYS operation'],
    },
    memory: {
      critical: [
        '[ERROR] redis: OOM command not allowed - used_memory > maxmemory',
        '[ERROR] redis: Cannot allocate memory for SET operation',
        '[WARN] redis: Memory fragmentation ratio: 2.5',
      ],
      warning: [
        '[WARN] redis: Memory usage above 85% threshold',
        '[INFO] redis: Evicting keys using volatile-lru policy',
      ],
    },
    disk: {
      critical: ['[ERROR] redis: RDB save failed - disk full'],
      warning: ['[WARN] redis: AOF rewrite in progress - disk I/O high'],
    },
    network: {
      critical: ['[ERROR] redis: Connection refused - max clients reached'],
      warning: ['[WARN] redis: Latency spike detected: 250ms'],
    },
  },
  application: {
    cpu: {
      critical: [
        '[ERROR] JVM: GC overhead limit exceeded',
        '[ERROR] Thread pool exhausted: 500/500 threads busy',
        '[WARN] Request queue depth: 1000 (threshold: 100)',
      ],
      warning: [
        '[WARN] JVM: Minor GC frequency increased (>10/min)',
        '[INFO] CPU throttling detected - scaling recommended',
      ],
    },
    memory: {
      critical: [
        '[ERROR] JVM: OutOfMemoryError - Java heap space',
        '[ERROR] Memory leak detected in session management',
      ],
      warning: [
        '[WARN] JVM: Heap usage above 85%',
        '[INFO] GC pause time: 2.5s (threshold: 1s)',
      ],
    },
    disk: {
      critical: ['[ERROR] Log rotation failed - disk full'],
      warning: ['[WARN] Temp directory usage above 90%'],
    },
    network: {
      critical: [
        '[ERROR] Connection pool exhausted to database',
        '[ERROR] Circuit breaker OPEN for external-api',
      ],
      warning: [
        '[WARN] HTTP 503 rate increased: 5%',
        '[INFO] Request latency p99: 2500ms (threshold: 1000ms)',
      ],
    },
  },
  web: {
    cpu: {
      critical: ['[ERROR] nginx: Worker process CPU 100%'],
      warning: ['[WARN] nginx: High request processing time'],
    },
    memory: {
      critical: ['[ERROR] nginx: Cannot allocate memory for new connection'],
      warning: ['[WARN] nginx: Shared memory zone 85% used'],
    },
    disk: {
      critical: ['[ERROR] nginx: Access log write failed - disk full'],
      warning: ['[WARN] nginx: Cache directory 90% full'],
    },
    network: {
      critical: [
        '[ERROR] nginx: upstream timed out (110: Connection timed out)',
        '[ERROR] nginx: Too many open connections: 10000/10000',
      ],
      warning: [
        '[WARN] nginx: Connection queue overflow',
        '[INFO] nginx: Active connections: 8500 (limit: 10000)',
      ],
    },
  },
  loadbalancer: {
    cpu: {
      critical: ['[ERROR] haproxy: CPU usage critical - request dropping'],
      warning: ['[WARN] haproxy: High CPU during health checks'],
    },
    memory: {
      critical: ['[ERROR] haproxy: Out of memory for new session'],
      warning: ['[WARN] haproxy: Session memory usage high'],
    },
    disk: {
      critical: ['[ERROR] haproxy: Log write failed'],
      warning: ['[WARN] haproxy: Stats file rotation needed'],
    },
    network: {
      critical: [
        '[ERROR] haproxy: Backend api-servers DOWN - all checks failed',
        '[ERROR] haproxy: Connection limit reached: 50000/50000',
      ],
      warning: [
        '[WARN] haproxy: Backend response time degraded: 2s avg',
        '[INFO] haproxy: Health check timeout for web-01',
      ],
    },
  },
  storage: {
    cpu: {
      critical: ['[ERROR] nfsd: CPU bottleneck during I/O'],
      warning: ['[WARN] nfsd: High CPU during large file transfer'],
    },
    memory: {
      critical: ['[ERROR] nfsd: Cache memory exhausted'],
      warning: ['[WARN] nfsd: Buffer cache pressure'],
    },
    disk: {
      critical: [
        '[ERROR] nfsd: Filesystem full - write operations blocked',
        '[ERROR] nfsd: I/O error on /dev/sda1',
      ],
      warning: [
        '[WARN] nfsd: Disk usage above 85%',
        '[INFO] nfsd: RAID rebuild in progress - performance degraded',
      ],
    },
    network: {
      critical: ['[ERROR] nfsd: NFS export unavailable'],
      warning: ['[WARN] nfsd: Network throughput degraded'],
    },
  },
};

/**
 * 서버 메트릭에 부합하는 로그 생성 (syslog 형식)
 *
 * 모든 서버에 대해 로그 생성:
 * - 정상(online): 운영 info 로그 (cron, health check, docker 등)
 * - 경고(warning): info + warning 로그
 * - 장애(critical): info + warning + error 로그
 *
 * 기존 소비자 호환: [ERROR]/[WARN]/[INFO] 마커 포함 string[]
 */
function generateLogs(
  server: ServerConfig,
  status: ServerStatus,
  metrics: { cpu: number; memory: number; disk: number; network: number },
): string[] {
  const logs: string[] = [];
  const templates = LOG_TEMPLATES[server.type];
  if (!templates) return logs;

  const pid = () => 1000 + Math.floor(seededRandom() * 9000);

  // ── 1단계: 모든 서버 공통 운영 로그 (info) ──────────────────────
  const COMMON_INFO_LOGS: Record<ServerType, string[]> = {
    web: [
      `[INFO] nginx[${pid()}]: 10.0.0.1 - - "GET /health HTTP/1.1" 200 15 "-" "kube-probe/1.28"`,
      `[INFO] systemd[1]: Started Daily apt download activities.`,
      `[INFO] CRON[${pid()}]: (root) CMD (/usr/lib/apt/apt.systemd.daily install)`,
    ],
    database: [
      `[INFO] mysqld[${pid()}]: InnoDB: Buffer pool(s) load completed at ${new Date().toISOString().slice(0, 19)}`,
      `[INFO] systemd[1]: Started MySQL Community Server.`,
      `[INFO] CRON[${pid()}]: (mysql) CMD (/usr/bin/mysqladmin --defaults-file=/etc/mysql/debian.cnf ping)`,
    ],
    cache: [
      `[INFO] redis-server[${pid()}]: DB saved on disk (RDB snapshot)`,
      `[INFO] redis-server[${pid()}]: Background AOF rewrite finished successfully`,
      `[INFO] systemd[1]: redis-server.service: Watchdog timestamp updated.`,
    ],
    application: [
      `[INFO] java[${pid()}]: [GC (Allocation Failure) ParNew: 153344K->17024K(153344K), 0.0${Math.floor(seededRandom() * 90) + 10} secs]`,
      `[INFO] dockerd[${pid()}]: Container health status: healthy (exit code 0)`,
      `[INFO] systemd[1]: Started Application Service (api-was).`,
    ],
    loadbalancer: [
      `[INFO] haproxy[${pid()}]: Health check OK for backend api_servers/server1 (HTTP 200)`,
      `[INFO] haproxy[${pid()}]: Proxy api_frontend started (FD ${Math.floor(seededRandom() * 100) + 10})`,
      `[INFO] systemd[1]: haproxy.service: Watchdog timestamp updated.`,
    ],
    storage: [
      `[INFO] nfsd[${pid()}]: NFS export /data/shared ready, ${Math.floor(seededRandom() * 50) + 10} active clients`,
      `[INFO] systemd[1]: Started NFS server and services.`,
      `[INFO] CRON[${pid()}]: (root) CMD (/usr/local/bin/check-raid-status.sh)`,
    ],
  };

  // 서버 타입에 맞는 info 로그 1~2개 추가 (결정론적 선택)
  const infoLogs = COMMON_INFO_LOGS[server.type] || COMMON_INFO_LOGS.web;
  const infoCount = status === 'online' ? 2 : 1;
  for (let i = 0; i < infoCount && i < infoLogs.length; i++) {
    const idx = Math.floor(seededRandom() * infoLogs.length);
    const log = infoLogs[idx];
    if (log && !logs.includes(log)) {
      logs.push(log);
    }
  }

  // 정상 서버는 info 로그만
  if (status === 'online') {
    return logs;
  }

  // ── 2단계: 장애 서버 경고/에러 로그 ─────────────────────────────
  const severityLevel = status === 'critical' ? 'critical' : 'warning';

  // 메트릭별 심각도 확인 (높은 순 정렬)
  const metricSeverity: { metric: string; value: number }[] = [
    { metric: 'cpu', value: metrics.cpu },
    { metric: 'memory', value: metrics.memory },
    { metric: 'disk', value: metrics.disk },
    { metric: 'network', value: metrics.network },
  ].sort((a, b) => b.value - a.value);

  // 상위 2개 문제 메트릭에 대한 로그 추가
  for (const { metric, value } of metricSeverity.slice(0, 2)) {
    if (value > 70) {
      const metricTemplates = templates[metric];
      if (metricTemplates) {
        const templateList = metricTemplates[severityLevel] || metricTemplates.warning;
        if (templateList.length > 0) {
          const selectedLog = templateList[Math.floor(seededRandom() * templateList.length)];
          if (selectedLog) logs.push(selectedLog);
        }
      }
    }
  }

  // ── 3단계: critical 상태 시 커널/시스템 레벨 로그 추가 ──────────
  if (status === 'critical') {
    const topMetric = metricSeverity[0];
    if (topMetric && topMetric.value > 85) {
      const kernelLogs: Record<string, string> = {
        cpu: `[ERROR] kernel: [${pid()}.${Math.floor(seededRandom() * 999)}] CPU${Math.floor(seededRandom() * 8)}: Package temperature above threshold, cpu clock throttled`,
        memory: `[ERROR] kernel: Out of memory: Killed process ${pid()} (java) total-vm:${Math.floor(topMetric.value * 100)}kB, anon-rss:${Math.floor(topMetric.value * 80)}kB`,
        disk: `[ERROR] kernel: [${pid()}.${Math.floor(seededRandom() * 999)}] EXT4-fs warning (device sda1): directory index full, reach max htree level`,
        network: `[ERROR] kernel: [${pid()}.${Math.floor(seededRandom() * 999)}] nf_conntrack: table full, dropping packet`,
      };
      const kernelLog = kernelLogs[topMetric.metric];
      if (kernelLog) logs.push(kernelLog);
    }
  }

  return logs;
}

// ============================================================================
// 데이터 생성 로직
// ============================================================================

function getScenarioForHour(hour: number): FailureScenario | undefined {
  return FAILURE_SCENARIOS.find((s) => s.hour === hour);
}

/**
 * 현재 시간/분에 대한 장애 단계 결정
 */
function getFailurePhase(hour: number, minuteIndex: number): { phase: FailurePhase; scenario: FailureScenario | undefined } {
  // 현재 시간이 장애 시간인 경우
  const currentScenario = getScenarioForHour(hour);
  if (currentScenario) {
    if (minuteIndex <= 2) return { phase: 'onset', scenario: currentScenario };
    if (minuteIndex === 3) return { phase: 'peak', scenario: currentScenario };
    return { phase: 'sustained', scenario: currentScenario };
  }

  // 다음 시간이 장애 시간인 경우 (현재는 전조)
  const nextHour = (hour + 1) % 24;
  const nextScenario = getScenarioForHour(nextHour);
  if (nextScenario && minuteIndex >= 3) {
    return { phase: 'pre', scenario: nextScenario };
  }

  // 이전 시간이 장애 시간인 경우 (현재는 회복)
  const prevHour = (hour - 1 + 24) % 24;
  const prevScenario = getScenarioForHour(prevHour);
  if (prevScenario && minuteIndex <= 3) {
    return { phase: 'recovery', scenario: prevScenario };
  }

  return { phase: 'normal', scenario: undefined };
}

/**
 * 단계별 상태 결정
 */
function getStatusForPhase(phase: FailurePhase, peakStatus: ServerStatus): ServerStatus {
  switch (phase) {
    case 'peak':
    case 'sustained':
      return peakStatus;
    case 'onset':
      return peakStatus === 'critical' ? 'warning' : 'online';
    case 'pre':
    case 'recovery':
      return 'online';
    default:
      return 'online';
  }
}

/**
 * Prometheus 스타일 target 데이터 생성
 */
function generatePrometheusTarget(
  server: ServerConfig,
  serverIndex: number,
  hour: number,
  minuteIndex: number
): {
  instance: string;
  job: string;
  labels: {
    hostname: string;
    datacenter: string;
    environment: string;
    server_type: string;
    os: string;
    os_version: string;
  };
  metrics: {
    up: 0 | 1;
    node_cpu_usage_percent: number;
    node_memory_usage_percent: number;
    node_filesystem_usage_percent: number;
    node_network_transmit_bytes_rate: number;
    node_load1: number;
    node_load5: number;
    node_boot_time_seconds: number;
    node_procs_running: number;
    node_http_request_duration_milliseconds: number;
  };
  nodeInfo: {
    cpu_cores: number;
    memory_total_bytes: number;
    disk_total_bytes: number;
  };
  logs: string[];
} {
  // 결정론적 시드: hour * 10000 + serverIndex * 100 + minuteIndex
  const seed = hour * 10000 + serverIndex * 100 + minuteIndex;
  seededRandom = createSeededRandom(seed);

  // 장애 단계 결정
  const { phase, scenario } = getFailurePhase(hour, minuteIndex);
  const multiplier = PHASE_MULTIPLIERS[phase];

  // 기본 메트릭 (baseline + 결정론적 랜덤 변동)
  let metrics = {
    cpu: server.baseline.cpu + Math.floor((seededRandom() - 0.5) * 10),
    memory: server.baseline.memory + Math.floor((seededRandom() - 0.5) * 8),
    disk: server.baseline.disk + Math.floor((seededRandom() - 0.5) * 5),
    network: server.baseline.network + Math.floor((seededRandom() - 0.5) * 10),
  };

  let status: ServerStatus = 'online';

  // 시나리오 적용 (단계별 점진적 적용)
  if (scenario && phase !== 'normal') {
    const affected = scenario.affectedServers.find((s) => s.id === server.id);
    if (affected) {
      const peakMetrics = { ...metrics, ...affected.metricsOverride };

      metrics = {
        cpu: Math.round(metrics.cpu + (peakMetrics.cpu - metrics.cpu) * multiplier),
        memory: Math.round(metrics.memory + (peakMetrics.memory - metrics.memory) * multiplier),
        disk: Math.round(metrics.disk + (peakMetrics.disk - metrics.disk) * multiplier),
        network: Math.round(metrics.network + (peakMetrics.network - metrics.network) * multiplier),
      };

      status = getStatusForPhase(phase, affected.status);
    }
  }

  // 범위 보정 (0-100)
  metrics.cpu = Math.max(0, Math.min(100, metrics.cpu));
  metrics.memory = Math.max(0, Math.min(100, metrics.memory));
  metrics.disk = Math.max(0, Math.min(100, metrics.disk));
  metrics.network = Math.max(0, Math.min(100, metrics.network));

  // up 메트릭: online/warning/critical → 1, offline → 0
  const up: 0 | 1 = status === 'offline' ? 0 : 1;

  // node_load1, node_load5 파생 (CPU 기반)
  const cpuCores = server.specs.cpu_cores;
  const node_load1 = Math.round((metrics.cpu / 100) * cpuCores * (0.8 + seededRandom() * 0.4) * 100) / 100;
  const node_load5 = Math.round(node_load1 * (0.75 + seededRandom() * 0.2) * 100) / 100;

  // boot time: ~30일 전 고정
  const node_boot_time_seconds = 1735932708 + Math.floor(seededRandom() * 86400);

  // processes
  const node_procs_running = 100 + Math.floor(seededRandom() * 50);

  // 응답 시간 계산
  const baseResponseTime = server.type === 'cache' ? 20 : server.type === 'database' ? 50 : 150;
  const responseTimeMultiplier = status === 'critical' ? 20 : status === 'warning' ? 3 : (1 + multiplier * 2);
  const node_http_request_duration_milliseconds = Math.round(baseResponseTime * responseTimeMultiplier * (0.8 + seededRandom() * 0.4));

  // AI 분석용 로그 생성
  const logs = generateLogs(server, status, metrics);

  const instance = `${server.id}:9100`;

  return {
    instance,
    job: 'node-exporter',
    labels: {
      hostname: server.hostname,
      datacenter: server.location,
      environment: 'production',
      server_type: server.type,
      os: server.os,
      os_version: server.osVersion,
    },
    metrics: {
      up,
      node_cpu_usage_percent: metrics.cpu,
      node_memory_usage_percent: metrics.memory,
      node_filesystem_usage_percent: metrics.disk,
      node_network_transmit_bytes_rate: metrics.network,
      node_load1,
      node_load5,
      node_boot_time_seconds,
      node_procs_running,
      node_http_request_duration_milliseconds,
    },
    nodeInfo: {
      cpu_cores: server.specs.cpu_cores,
      memory_total_bytes: server.specs.memory_gb * 1024 * 1024 * 1024,
      disk_total_bytes: server.specs.disk_gb * 1024 * 1024 * 1024,
    },
    logs,
  };
}

/**
 * 시간대별 timestampMs 계산 (오늘 기준)
 */
function getTimestampMs(hour: number, minute: number): number {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);

  // 오늘 날짜 기준으로 특정 시:분의 Unix epoch ms
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth();
  const day = kstDate.getUTCDate();

  const targetUTC = Date.UTC(year, month, day, hour, minute, 0) - kstOffset;
  return targetUTC;
}

function generateHourlyData(hour: number) {
  const scenario = getScenarioForHour(hour);
  const prevScenario = getScenarioForHour((hour - 1 + 24) % 24);
  const nextScenario = getScenarioForHour((hour + 1) % 24);
  const dataPoints = [];

  // 10분 간격 6개 데이터 포인트 (00, 10, 20, 30, 40, 50분)
  for (let minuteIndex = 0; minuteIndex < 6; minuteIndex++) {
    const minute = minuteIndex * 10;
    const timestampMs = getTimestampMs(hour, minute);
    const targets: Record<string, ReturnType<typeof generatePrometheusTarget>> = {};

    KOREAN_DC_SERVERS.forEach((server, serverIndex) => {
      const instance = `${server.id}:9100`;
      targets[instance] = generatePrometheusTarget(server, serverIndex, hour, minuteIndex);
    });

    dataPoints.push({ timestampMs, targets });
  }

  return {
    hour,
    scrapeConfig: {
      scrapeInterval: '10m',
      evaluationInterval: '10m',
      source: 'node-exporter',
    },
    dataPoints,
    metadata: {
      version: '3.0.0',
      format: 'prometheus',
      totalDataPoints: 6,
      intervalMinutes: 10,
      serverCount: KOREAN_DC_SERVERS.length,
      affectedServers: scenario?.affectedServers.length || 0,
      hasPreFailureSymptoms: !!nextScenario,
      hasRecoveryPhase: !!prevScenario,
    },
  };
}

// ============================================================================
// 메인 실행
// ============================================================================

function main() {
  try {
    console.log('🔄 SSOT 데이터 동기화 시작 (Prometheus 포맷)...\n');
    console.log('📋 SSOT: Prometheus/node_exporter 스타일 (한국 DC 서버 15개)\n');

    // 출력 디렉토리들 (2곳 동기화)
    const outputDirs = [
      path.join(process.cwd(), 'src/data/hourly-data'),
      path.join(process.cwd(), 'cloud-run/ai-engine/data/hourly-data'),
    ];

    // 디렉토리 생성
    outputDirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    let totalSize = 0;

    // 24시간 데이터 생성
    for (let hour = 0; hour < 24; hour++) {
      const data = generateHourlyData(hour);
      const filename = `hour-${hour.toString().padStart(2, '0')}.json`;
      const jsonContent = JSON.stringify(data, null, 2);

      // 모든 출력 디렉토리에 저장
      outputDirs.forEach((dir) => {
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, jsonContent);
      });

      const fileSize = Buffer.byteLength(jsonContent, 'utf8');
      totalSize += fileSize;

      const scenario = getScenarioForHour(hour);
      const icon = scenario?.affectedServers.some((s) => s.status === 'critical')
        ? '🔴'
        : scenario?.affectedServers.some((s) => s.status === 'warning')
          ? '🟡'
          : '🟢';

      const label = scenario ? scenario.incident : `${hour}시 정상 운영`;
      console.log(`${icon} ${filename} - ${label} (${(fileSize / 1024).toFixed(1)}KB)`);
    }

    console.log(`\n📦 총 크기: ${(totalSize / 1024).toFixed(1)}KB (파일당 평균 ${(totalSize / 24 / 1024).toFixed(1)}KB)`);
    console.log('\n✅ 동기화 완료!\n');

    console.log('📁 출력 위치:');
    outputDirs.forEach((dir) => console.log(`   - ${dir}`));

    console.log('\n📊 통계:');
    console.log(`   - 시간별 파일: 24개`);
    console.log(`   - 서버 수: ${KOREAN_DC_SERVERS.length}개`);
    console.log(`   - 데이터 포인트/파일: 6개 (10분 간격)`);
    console.log(`   - 장애 시나리오: ${FAILURE_SCENARIOS.length}개`);
    console.log(`   - 포맷: Prometheus/node_exporter`);
  } catch (error) {
    console.error('❌ 동기화 실패:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
