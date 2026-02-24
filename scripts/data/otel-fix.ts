/**
 * OTel Data Quality Fix Script
 *
 * 24개 hourly JSON + timeseries.json 일괄 변환.
 * P1/P2: 인과관계 기반 24시간 장애 시나리오 (5 stories, 메트릭-로그 일치)
 * C2, C4, W1-W3, W8, I1-I3: 기존 데이터 품질 수정
 *
 * Usage: npx tsx scripts/data/otel-fix.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Paths
// ============================================================================

const OTEL_DATA_DIR = path.resolve('public/data/otel-data');
const HOURLY_DIR = path.join(OTEL_DATA_DIR, 'hourly');
const TIMESERIES_PATH = path.join(OTEL_DATA_DIR, 'timeseries.json');

// ============================================================================
// Utility: Process all hourly files
// ============================================================================

type HourlyFile = {
  schemaVersion: string;
  hour: number;
  scope: { name: string; version: string };
  slots: Slot[];
};

type Slot = {
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  metrics: Metric[];
  logs: LogEntry[];
};

type Metric = {
  name: string;
  unit: string;
  type: string;
  dataPoints: DataPoint[];
};

type DataPoint = {
  asDouble: number;
  attributes: Record<string, string>;
};

type LogEntry = {
  timeUnixNano: number;
  severityNumber: number;
  severityText: string;
  body: string;
  attributes: Record<string, string>;
  resource: string;
};

type TimeSeries = {
  schemaVersion: string;
  generatedAt: string;
  serverIds: string[];
  timestamps: number[];
  metrics: Record<string, number[][]>;
};

function processAllHourlyFiles(transform: (data: HourlyFile, hour: number) => HourlyFile): void {
  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const filepath = path.join(HOURLY_DIR, filename);
    const raw = fs.readFileSync(filepath, 'utf-8');
    const data: HourlyFile = JSON.parse(raw);
    const transformed = transform(data, h);
    fs.writeFileSync(filepath, JSON.stringify(transformed, null, 2) + '\n');
  }
}

function processTimeseries(transform: (data: TimeSeries) => TimeSeries): void {
  const raw = fs.readFileSync(TIMESERIES_PATH, 'utf-8');
  const data: TimeSeries = JSON.parse(raw);
  const transformed = transform(data);
  fs.writeFileSync(TIMESERIES_PATH, JSON.stringify(transformed, null, 2) + '\n');
}

// ============================================================================
// Scenario System: 인과관계 기반 24시간 장애 시나리오
// ============================================================================

type ServerMetricOverride = {
  cpu?: number;     // 0-1 ratio
  memory?: number;  // 0-1 ratio
  disk?: number;    // 0-1 ratio
  network?: number; // 0-1 ratio (bytes 변환은 adjustMetricsForScenario에서)
};

// 5개 스토리의 시간별 메트릭 오버라이드
// S1: 야간 배치→DB 연쇄(00-05), S2: 출근 피크→API 과부하(07-12)
// S3: Redis 메모리 누수(13-18), S4: 네트워크/LB 포화(19-22), S5: 스토리지 백업(23)
const HOUR_SCENARIOS: Record<number, Record<string, ServerMetricOverride>> = {
  // === S1: 야간 배치 → 디스크 포화 → DB 연쇄 (00~05) ===
  0:  { 'db-mysql-dc1-primary': { cpu: 0.55, memory: 0.68, disk: 0.81 } },
  1:  { 'db-mysql-dc1-primary': { cpu: 0.62, memory: 0.72, disk: 0.82 } },
  2:  { 'db-mysql-dc1-primary': { cpu: 0.72, memory: 0.82, disk: 0.83 } },
  3:  {
    'db-mysql-dc1-primary': { cpu: 0.82, memory: 0.88, disk: 0.84 },
    'api-was-dc1-01': { cpu: 0.82, memory: 0.68 },
  },
  4:  {
    'db-mysql-dc1-primary': { cpu: 0.68, memory: 0.78, disk: 0.82 },
    'api-was-dc1-01': { cpu: 0.72 },
  },
  5:  { 'db-mysql-dc1-primary': { cpu: 0.55, memory: 0.68, disk: 0.81 } },
  // === S1→S2 전환 (잔여 disk warning + 트래픽 상승) ===
  6:  {
    'db-mysql-dc1-primary': { disk: 0.80 },
    'api-was-dc1-01': { cpu: 0.65 },
  },
  // === S2: 출근 트래픽 → API 과부하 → 전구간 연쇄 (07~12) ===
  7:  { 'api-was-dc1-01': { cpu: 0.81, memory: 0.65 } },
  8:  {
    'api-was-dc1-01': { cpu: 0.84, memory: 0.72 },
    'api-was-dc1-02': { cpu: 0.72 },
  },
  9:  {
    'api-was-dc1-01': { cpu: 0.91, memory: 0.78 },
    'api-was-dc1-02': { cpu: 0.84 },
    'lb-haproxy-dc1-01': { cpu: 0.72, network: 0.65 },
    'db-mysql-dc1-primary': { cpu: 0.68, memory: 0.72 },
  },
  10: {
    'api-was-dc1-01': { cpu: 0.93, memory: 0.86 },
    'api-was-dc1-02': { cpu: 0.87 },
    'db-mysql-dc1-primary': { cpu: 0.75, memory: 0.78 },
    'lb-haproxy-dc1-01': { cpu: 0.70 },
  },
  11: {
    'api-was-dc1-01': { cpu: 0.82, memory: 0.76 },
    'api-was-dc1-02': { cpu: 0.76 },
  },
  12: {
    'api-was-dc1-01': { cpu: 0.81 },
    'cache-redis-dc1-01': { memory: 0.68 },
  },
  // === S3: Redis 메모리 누수 → 캐시 장애 (13~18) ===
  13: { 'cache-redis-dc1-01': { memory: 0.81 } },
  14: { 'cache-redis-dc1-01': { memory: 0.82 } },
  15: {
    'cache-redis-dc1-01': { memory: 0.83 },
    'cache-redis-dc1-02': { memory: 0.72 },
  },
  16: {
    'cache-redis-dc1-01': { memory: 0.91, cpu: 0.75 },
    'api-was-dc1-01': { cpu: 0.78 },
    'api-was-dc1-02': { cpu: 0.72 },
    'db-mysql-dc1-primary': { cpu: 0.72, memory: 0.75 },
  },
  17: {
    'cache-redis-dc1-01': { memory: 0.85, cpu: 0.68 },
    'api-was-dc1-01': { cpu: 0.72 },
  },
  18: {
    'cache-redis-dc1-01': { memory: 0.81 },
    'lb-haproxy-dc1-01': { network: 0.62 },
  },
  // === S4: 네트워크 이상 → LB 포화 (19~22) ===
  19: { 'lb-haproxy-dc1-01': { network: 0.71, cpu: 0.62 } },
  20: { 'lb-haproxy-dc1-01': { network: 0.74, cpu: 0.72 } },
  21: {
    'lb-haproxy-dc1-01': { network: 0.88, cpu: 0.85 },
    'api-was-dc1-01': { cpu: 0.75 },
    'api-was-dc1-02': { cpu: 0.70 },
    'lb-haproxy-dc1-02': { network: 0.68, cpu: 0.65 },
  },
  22: {
    'lb-haproxy-dc1-01': { network: 0.72, cpu: 0.74 },
    'lb-haproxy-dc1-02': { network: 0.60 },
  },
  // === S5: 스토리지 백업 충돌 (23, S1과 시간적 연결) ===
  23: {
    'storage-nfs-dc1-01': { disk: 0.82, cpu: 0.65 },
    'storage-s3gw-dc1-01': { network: 0.68, disk: 0.72 },
    'db-mysql-dc1-backup': { disk: 0.75, cpu: 0.60 },
  },
};

// 장애 서버 → cascade WARN을 받을 서버 (호출자/의존 서버)
const CASCADE_MAP: Record<string, string[]> = {
  'db-mysql-dc1-primary': ['api-was-dc1-01', 'api-was-dc1-02', 'api-was-dc1-03'],
  'db-mysql-dc1-replica': ['api-was-dc1-01', 'api-was-dc1-02', 'api-was-dc1-03'],
  'cache-redis-dc1-01':   ['api-was-dc1-01', 'api-was-dc1-02', 'api-was-dc1-03'],
  'cache-redis-dc1-02':   ['api-was-dc1-01', 'api-was-dc1-02', 'api-was-dc1-03'],
  'api-was-dc1-01': ['web-nginx-dc1-01', 'web-nginx-dc1-02', 'web-nginx-dc1-03'],
  'api-was-dc1-02': ['web-nginx-dc1-01', 'web-nginx-dc1-02', 'web-nginx-dc1-03'],
  'api-was-dc1-03': ['web-nginx-dc1-01', 'web-nginx-dc1-02', 'web-nginx-dc1-03'],
  'lb-haproxy-dc1-01': ['web-nginx-dc1-01', 'web-nginx-dc1-02', 'web-nginx-dc1-03'],
  'lb-haproxy-dc1-02': ['web-nginx-dc1-01', 'web-nginx-dc1-02', 'web-nginx-dc1-03'],
  'storage-nfs-dc1-01': ['db-mysql-dc1-backup'],
};

// cascade 대상 서버 카테고리별 WARN 로그 템플릿
const CASCADE_WARN_TEMPLATES: Record<string, string[]> = {
  'api': [
    'java[{pid}]: [WARN] HikariPool - Connection to backend timed out after {ms}ms',
    'java[{pid}]: [WARN] Slow transaction: downstream dependency response {ms}ms (threshold: 500ms)',
  ],
  'web': [
    'nginx[{pid}]: upstream timed out (110: Connection timed out) while connecting to upstream',
    'nginx[{pid}]: *{n} upstream prematurely closed connection while reading response header',
  ],
  'db': [
    'mysqld[{pid}]: [Warning] InnoDB: Write to NFS mount stalled for {ms}ms',
  ],
};

// 메트릭별 WARN 로그 템플릿 (직접 장애 서버용)
const METRIC_WARN_TEMPLATES: Record<string, Record<string, string[]>> = {
  'db': {
    'cpu': [
      'mysqld[{pid}]: [Warning] InnoDB: Long semaphore wait (>2sec), holder thread {tid}',
      'mysqld[{pid}]: [Warning] Too many active connections ({n} of 200), queries delayed',
    ],
    'memory': [
      'mysqld[{pid}]: [Warning] InnoDB: Buffer pool usage {pct}% of allocated 64GB',
      'mysqld[{pid}]: [Warning] InnoDB: page_cleaner: 1000ms intended loop took {ms}ms',
    ],
    'disk': [
      'mysqld[{pid}]: [Warning] Disk I/O stalling: fsync took {ms}ms for file ./ibdata1',
      'mysqld[{pid}]: [Warning] Disk usage at {pct}%, approaching critical threshold',
    ],
  },
  'api': {
    'cpu': [
      'java[{pid}]: [WARN] Thread pool nearing exhaustion: active {n}/200, queue depth {m}',
      'java[{pid}]: [WARN] Slow transaction: /api/servers took {ms}ms (threshold: 500ms)',
    ],
    'memory': [
      'java[{pid}]: [WARN] GC overhead: ParNew pause {ms}ms, old gen usage {pct}%',
      'java[{pid}]: [WARN] Heap memory usage {pct}%, approaching GC pressure zone',
    ],
  },
  'cache': {
    'memory': [
      'redis-server[{pid}]: WARNING: Memory usage {pct}% of maxmemory limit',
      'redis-server[{pid}]: WARNING: Eviction rate increasing, {n} keys evicted in last 60s',
    ],
    'cpu': [
      'redis-server[{pid}]: WARNING: Slow command detected, took {ms}ms to process',
    ],
  },
  'lb': {
    'network': [
      'haproxy[{pid}]: WARNING: Connection table {pct}% full (conntrack saturation)',
      'haproxy[{pid}]: WARNING: SYN cookie activation detected, possible SYN flood',
    ],
    'cpu': [
      'haproxy[{pid}]: WARNING: CPU usage at {pct}%, request queuing increasing',
    ],
  },
  'storage': {
    'disk': [
      'nfsd[{pid}]: WARNING: Export /data I/O latency {ms}ms exceeds 100ms threshold',
    ],
    'cpu': [
      'nfsd[{pid}]: WARNING: High CPU from concurrent I/O, {n} pending operations',
    ],
    'network': [
      'minio[{pid}]: WARNING: S3 sync bandwidth at {pct}% capacity',
    ],
  },
};

// 메트릭별 ERROR 로그 템플릿 (critical 서버용)
const METRIC_ERROR_TEMPLATES: Record<string, Record<string, string[]>> = {
  'db': {
    'cpu': ['mysqld[{pid}]: [ERROR] Too many connections: max_connections (200) exceeded'],
    'memory': ['mysqld[{pid}]: [ERROR] InnoDB: Cannot allocate {n}MB for the buffer pool'],
    'disk': ['mysqld[{pid}]: [ERROR] InnoDB: Write to ./ibdata1 failed: No space left on device'],
  },
  'api': {
    'cpu': ['java[{pid}]: [ERROR] RejectedExecutionException: Thread pool exhausted, {n} tasks rejected'],
    'memory': ['java[{pid}]: [ERROR] java.lang.OutOfMemoryError: Java heap space (used {pct}%)'],
  },
  'cache': {
    'memory': ['redis-server[{pid}]: ERROR: MISCONF Redis unable to persist to disk (OOM during BGSAVE)'],
    'cpu': ['redis-server[{pid}]: ERROR: Command timeout after {ms}ms, client disconnected'],
  },
  'lb': {
    'network': ['haproxy[{pid}]: ERROR: Connection table full, dropping new connections (SYN flood active)'],
    'cpu': ['haproxy[{pid}]: ERROR: Backend queue overflow, {n} requests dropped'],
  },
  'storage': {
    'disk': ['nfsd[{pid}]: ERROR: Write to /data/backup failed: No space left on device'],
  },
};

function metricNameToKey(name: string): 'cpu' | 'memory' | 'disk' | 'network' | undefined {
  switch (name) {
    case 'system.cpu.utilization': return 'cpu';
    case 'system.memory.utilization': return 'memory';
    case 'system.filesystem.utilization': return 'disk';
    case 'system.network.io': return 'network';
    default: return undefined;
  }
}

function getLogSource(category: string): string {
  switch (category) {
    case 'db': return 'mysqld';
    case 'cache': return 'redis';
    case 'web': return 'nginx';
    case 'api': return 'java';
    case 'lb': return 'haproxy';
    case 'storage': return 'syslog';
    default: return 'syslog';
  }
}

// ============================================================================
// P1: 시나리오 기반 메트릭 조정 (C2/I3 이후 실행, 최종 메트릭 권한)
// ============================================================================

function adjustMetricsForScenario(data: HourlyFile, hour: number): HourlyFile {
  const scenario = HOUR_SCENARIOS[hour];

  for (let slotIdx = 0; slotIdx < data.slots.length; slotIdx++) {
    const slot = data.slots[slotIdx];
    const slotOffset = (slotIdx - 2.5) / 6 * 0.04; // -0.017 ~ +0.017 점진 변화

    for (const metric of slot.metrics) {
      const metricKey = metricNameToKey(metric.name);
      if (!metricKey) continue;

      for (const dp of metric.dataPoints) {
        const hostname = dp.attributes['host.name'] ?? '';
        const serverId = hostname.split('.')[0];

        if (scenario?.[serverId]?.[metricKey] !== undefined) {
          // 시나리오 서버: 목표값 + 슬롯 내 점진 변화 + jitter
          const target = scenario[serverId][metricKey] as number;
          const jitter = (Math.random() - 0.5) * 0.03;
          const value = Math.max(0.01, Math.min(0.99, target + slotOffset + jitter));

          if (metricKey === 'network') {
            dp.asDouble = Math.round(value * 125_000_000);
          } else {
            dp.asDouble = Math.round(value * 100) / 100;
          }
        } else {
          // 비시나리오 서버: 건강 범위 보장 (warning 미만)
          const maxHealthy = metricKey === 'network' ? 0.60 : 0.72;
          const currentRatio = metricKey === 'network'
            ? dp.asDouble / 125_000_000
            : dp.asDouble;

          if (currentRatio > maxHealthy) {
            const healthyValue = 0.35 + Math.random() * 0.25;
            if (metricKey === 'network') {
              dp.asDouble = Math.round(healthyValue * 125_000_000);
            } else {
              dp.asDouble = Math.round(healthyValue * 100) / 100;
            }
          }
        }
      }
    }
  }
  return data;
}

// ============================================================================
// C2: network.io unit/value 통일 (OTel 표준: system.network.io, unit By, bytes/sec)
// ============================================================================

function fixNetworkRatio(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    for (const metric of slot.metrics) {
      if (metric.name === 'system.network.io') {
        metric.unit = 'By';
        // 값이 0-1 ratio로 잘못 들어온 경우 → bytes/sec로 변환
        for (const dp of metric.dataPoints) {
          if (dp.asDouble >= 0 && dp.asDouble <= 1) {
            dp.asDouble = Math.round(dp.asDouble * 125_000_000);
          }
        }
      }
    }
  }
  return data;
}

function fixNetworkTimeseries(data: TimeSeries): TimeSeries {
  const networkKey = 'system.network.io';
  if (data.metrics[networkKey]) {
    data.metrics[networkKey] = data.metrics[networkKey].map((serverSeries) =>
      serverSeries.map((val) => (val >= 0 && val <= 1) ? Math.round(val * 125_000_000) : val)
    );
  }
  return data;
}

// ============================================================================
// C4: timeseries.json 누락 메트릭 추가 (uptime, process.count)
// ============================================================================

function addMissingTimeseriesMetrics(): void {
  const raw = fs.readFileSync(TIMESERIES_PATH, 'utf-8');
  const ts: TimeSeries = JSON.parse(raw);
  const serverIds = ts.serverIds;
  const numTimestamps = ts.timestamps.length; // 144

  // 24개 hourly에서 메트릭 값 추출
  const uptimeMap: Record<string, number[]> = {};
  const processMap: Record<string, number[]> = {};

  for (const sid of serverIds) {
    uptimeMap[sid] = [];
    processMap[sid] = [];
  }

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const filepath = path.join(HOURLY_DIR, filename);
    const data: HourlyFile = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

    for (const slot of data.slots) {
      // 각 슬롯에서 메트릭 추출
      const uptimeValues: Record<string, number> = {};
      const processValues: Record<string, number> = {};

      for (const metric of slot.metrics) {
        if (metric.name === 'system.uptime') {
          for (const dp of metric.dataPoints) {
            const hostname = dp.attributes['host.name'];
            if (hostname) {
              const sid = hostname.split('.')[0];
              uptimeValues[sid] = dp.asDouble;
            }
          }
        }
        if (metric.name === 'system.process.count') {
          for (const dp of metric.dataPoints) {
            const hostname = dp.attributes['host.name'];
            if (hostname) {
              const sid = hostname.split('.')[0];
              processValues[sid] = dp.asDouble;
            }
          }
        }
      }

      for (const sid of serverIds) {
        uptimeMap[sid].push(uptimeValues[sid] ?? 2592000);
        processMap[sid].push(processValues[sid] ?? 120);
      }
    }
  }

  // timeseries에 추가
  ts.metrics['system.uptime'] = serverIds.map((sid) => {
    const vals = uptimeMap[sid];
    // numTimestamps 포인트에 맞추기 (슬롯 6개 × 24시간 = 144)
    return vals.slice(0, numTimestamps);
  });

  ts.metrics['system.process.count'] = serverIds.map((sid) => {
    const vals = processMap[sid];
    return vals.slice(0, numTimestamps);
  });

  fs.writeFileSync(TIMESERIES_PATH, JSON.stringify(ts, null, 2) + '\n');
  console.log(`  C4: Added system.uptime and system.process.count to timeseries (${numTimestamps} points each)`);
}

// ============================================================================
// W1: 로그 timeUnixNano 시간 분산
// ============================================================================

function fixLogTimeDistribution(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    const start = slot.startTimeUnixNano;
    const end = slot.endTimeUnixNano;
    const range = end - start; // 10분 = 600_000_000_000 nano

    if (slot.logs.length === 0) continue;

    // 균일 분산 + jitter
    const step = range / slot.logs.length;
    for (let i = 0; i < slot.logs.length; i++) {
      const jitter = Math.floor((Math.random() - 0.5) * step * 0.3);
      const newTime = Math.floor(start + i * step + jitter);
      // clamp within slot range
      slot.logs[i].timeUnixNano = Math.max(start, Math.min(end - 1, newTime));
    }
  }
  return data;
}

// ============================================================================
// W2: S3 Gateway 로그 템플릿 교체 (NFS → S3/MinIO)
// ============================================================================

function fixS3GatewayLogs(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    for (const log of slot.logs) {
      if (log.resource !== 'storage-s3gw-dc1-01') continue;

      if (log.body.includes('Started NFS server')) {
        log.body = 'systemd[1]: Started MinIO S3 Gateway service.';
      } else if (log.body.includes('NFS export')) {
        const buckets = 5 + Math.floor(Math.random() * 20);
        log.body = `minio[${2000 + Math.floor(Math.random() * 5000)}]: S3 Gateway ready, ${buckets} buckets loaded`;
        log.attributes['log.source'] = 'minio';
      }
    }
  }
  return data;
}

// ============================================================================
// W3: Redis OOM 프로세스명 수정 (java → redis-server)
// ============================================================================

function fixRedisOOMProcess(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    for (const log of slot.logs) {
      if (!log.resource.startsWith('cache-')) continue;
      if (log.body.includes('Killed process') && log.body.includes('(java)')) {
        log.body = log.body.replace('(java)', '(redis-server)');
      }
    }
  }
  return data;
}

// ============================================================================
// W8: systemd 서비스 시작 메시지 중복 제거
// ============================================================================

function deduplicateSystemdStarted(data: HourlyFile): HourlyFile {
  // 시간대(hourly file) 내에서 "systemd[1]: Started ..." 패턴을
  // 첫 슬롯에만 유지, 나머지 슬롯에서 제거
  const seenStartedMessages = new Set<string>();

  for (let slotIdx = 0; slotIdx < data.slots.length; slotIdx++) {
    const slot = data.slots[slotIdx];
    const filtered: LogEntry[] = [];

    for (const log of slot.logs) {
      const isStartedMsg = /^systemd\[1\]: Started /.test(log.body);
      if (isStartedMsg) {
        // key = resource + message pattern
        const key = `${log.resource}::${log.body.replace(/\[\d+\]/, '[*]')}`;
        if (seenStartedMessages.has(key)) {
          continue; // skip duplicate
        }
        seenStartedMessages.add(key);
      }
      filtered.push(log);
    }

    slot.logs = filtered;
  }
  return data;
}

// ============================================================================
// I1: InnoDB Buffer pool 타임스탬프 동적화
// ============================================================================

function fixInnoDBTimestamp(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    const slotStartNano = slot.startTimeUnixNano;
    // nano → ms → ISO
    const slotDate = new Date(slotStartNano / 1_000_000);
    const isoStr = slotDate.toISOString().replace(/\.\d{3}Z$/, '');

    for (const log of slot.logs) {
      if (log.body.includes('InnoDB: Buffer pool') && log.body.includes('load completed at')) {
        log.body = log.body.replace(
          /load completed at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
          `load completed at ${isoStr}`
        );
      }
    }
  }
  return data;
}

// ============================================================================
// I2: GC 파라미터 변동 추가
// ============================================================================

function fixGCParameterVariation(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    for (const log of slot.logs) {
      // ParNew: 153344K->17024K(153344K) 패턴
      const match = log.body.match(/ParNew: (\d+)K->(\d+)K\((\d+)K\)/);
      if (match) {
        const base1 = parseInt(match[1]);
        const base2 = parseInt(match[2]);
        const base3 = parseInt(match[3]);

        // ±10~20% jitter
        const jitter = () => 1 + (Math.random() - 0.5) * 0.3;
        const v1 = Math.round(base1 * jitter());
        const v2 = Math.round(base2 * jitter());
        const v3 = Math.round(base3 * jitter());

        log.body = log.body.replace(
          /ParNew: \d+K->\d+K\(\d+K\)/,
          `ParNew: ${v1}K->${v2}K(${v3}K)`
        );
      }
    }
  }
  return data;
}

// ============================================================================
// I3: Storage/Cache 네트워크 값 보정 (C2 변환 후)
// ============================================================================

function fixStorageCacheNetwork(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    for (const metric of slot.metrics) {
      if (metric.name !== 'system.network.io') continue;

      for (const dp of metric.dataPoints) {
        const hostname = dp.attributes['host.name'] ?? '';
        const serverId = hostname.split('.')[0];

        // bytes/sec (1Gbps = 125,000,000 B/s)
        if (serverId.startsWith('storage-')) {
          // Storage: 15-35% of 1Gbps = 18.75M-43.75M
          if (dp.asDouble < 18_750_000 || dp.asDouble > 43_750_000) {
            dp.asDouble = Math.round((0.15 + Math.random() * 0.20) * 125_000_000);
          }
        } else if (serverId.startsWith('cache-')) {
          // Cache: 30-50% of 1Gbps = 37.5M-62.5M
          if (dp.asDouble < 37_500_000 || dp.asDouble > 62_500_000) {
            dp.asDouble = Math.round((0.30 + Math.random() * 0.20) * 125_000_000);
          }
        }
      }
    }
  }
  return data;
}

// ============================================================================
// L1: Redis OOM 시퀀스 수정 (kill → restart 시퀀스)
// ============================================================================

function fixRedisOOMSequence(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    const newLogs: LogEntry[] = [];
    for (let i = 0; i < slot.logs.length; i++) {
      const log = slot.logs[i];
      newLogs.push(log);

      // OOM kill 로그 직후에 systemd 재시작 시퀀스 삽입
      if (log.resource.startsWith('cache-') && log.body.includes('Killed process') && log.body.includes('(redis-server)')) {
        const pid = 3000 + Math.floor(Math.random() * 5000);
        const restartTime = log.timeUnixNano + 2_000_000_000; // 2초 후
        const readyTime = restartTime + 1_500_000_000; // 1.5초 후

        newLogs.push({
          timeUnixNano: Math.min(restartTime, slot.endTimeUnixNano - 1),
          severityNumber: 9,
          severityText: 'INFO',
          body: `systemd[1]: redis-server.service: Main process exited, code=killed, status=9/KILL`,
          attributes: { 'log.source': 'systemd' },
          resource: log.resource,
        });
        newLogs.push({
          timeUnixNano: Math.min(readyTime, slot.endTimeUnixNano - 1),
          severityNumber: 9,
          severityText: 'INFO',
          body: `systemd[1]: redis-server.service: Scheduled restart job, restart counter is at 1.`,
          attributes: { 'log.source': 'systemd' },
          resource: log.resource,
        });
        newLogs.push({
          timeUnixNano: Math.min(readyTime + 500_000_000, slot.endTimeUnixNano - 1),
          severityNumber: 9,
          severityText: 'INFO',
          body: `redis-server[${pid}]: Server initialized, ready to accept connections on port 6379`,
          attributes: { 'log.source': 'redis' },
          resource: log.resource,
        });

        // 뒤에 나올 "Cannot allocate memory for SET" 로그 제거 (kill 이후 불가)
        while (i + 1 < slot.logs.length) {
          const next = slot.logs[i + 1];
          if (next.resource === log.resource && next.body.includes('Cannot allocate memory')) {
            i++; // skip
          } else {
            break;
          }
        }
      }
    }
    slot.logs = newLogs;
  }
  return data;
}

// ============================================================================
// L2 (교체): 메트릭 기반 로그 재조정 — 인과관계 일치
// ============================================================================

function getServerCategory(resource: string): string {
  if (resource.startsWith('web-')) return 'web';
  if (resource.startsWith('api-')) return 'api';
  if (resource.startsWith('db-')) return 'db';
  if (resource.startsWith('cache-')) return 'cache';
  if (resource.startsWith('lb-')) return 'lb';
  if (resource.startsWith('storage-')) return 'storage';
  return 'web';
}

function fillTemplate(tpl: string): string {
  return tpl
    .replace(/\{pid\}/g, String(1000 + Math.floor(Math.random() * 9000)))
    .replace(/\{n\}/g, String(Math.floor(Math.random() * 10000)))
    .replace(/\{m\}/g, String(64 + Math.floor(Math.random() * 128)))
    .replace(/\{ms\}/g, String(200 + Math.floor(Math.random() * 3000)))
    .replace(/\{pct\}/g, String(75 + Math.floor(Math.random() * 20)))
    .replace(/\{tid\}/g, String(Math.floor(Math.random() * 999999)))
    .replace(/\{a\}/g, String(Math.floor(Math.random() * 10)))
    .replace(/\{b\}/g, String(1 + Math.floor(Math.random() * 254)))
    .replace(/\{port\}/g, String(10000 + Math.floor(Math.random() * 55000)));
}

type HealthStatus = 'healthy' | 'warning' | 'critical';

const THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  cpu: { warning: 0.80, critical: 0.90 },
  memory: { warning: 0.80, critical: 0.90 },
  disk: { warning: 0.80, critical: 0.90 },
  network: { warning: 0.70, critical: 0.85 },
};

function reconcileLogsWithMetrics(data: HourlyFile, _hour: number): HourlyFile {
  for (const slot of data.slots) {
    // 1. 슬롯별 서버 메트릭 추출
    const serverMetrics: Record<string, Record<string, number>> = {};
    for (const metric of slot.metrics) {
      const metricKey = metricNameToKey(metric.name);
      if (!metricKey) continue;
      for (const dp of metric.dataPoints) {
        const hostname = dp.attributes['host.name'] ?? '';
        const serverId = hostname.split('.')[0];
        if (!serverMetrics[serverId]) serverMetrics[serverId] = {};
        serverMetrics[serverId][metricKey] = metricKey === 'network'
          ? dp.asDouble / 125_000_000
          : dp.asDouble;
      }
    }

    // 2. 서버별 건강 상태 판정 (system-rules.json 임계값 기준)
    const serverHealth: Record<string, { status: HealthStatus; highMetrics: string[] }> = {};
    for (const [sid, metrics] of Object.entries(serverMetrics)) {
      let status: HealthStatus = 'healthy';
      const highMetrics: string[] = [];
      for (const [key, value] of Object.entries(metrics)) {
        const threshold = THRESHOLDS[key];
        if (!threshold) continue;
        if (value >= threshold.critical) {
          status = 'critical';
          highMetrics.push(key);
        } else if (value >= threshold.warning) {
          if (status !== 'critical') status = 'warning';
          highMetrics.push(key);
        }
      }
      serverHealth[sid] = { status, highMetrics };
    }

    // 3. 기존 WARN/ERROR 로그 제거 (INFO만 유지)
    slot.logs = slot.logs.filter(log =>
      log.severityText !== 'WARN' && log.severityText !== 'ERROR'
    );

    const newLogs: LogEntry[] = [];

    // 4. 메트릭 기반 WARN/ERROR 로그 생성
    for (const [sid, health] of Object.entries(serverHealth)) {
      if (health.status === 'healthy') continue;
      const cat = getServerCategory(sid);

      for (const metricKey of health.highMetrics) {
        // Critical → ERROR + WARN
        if (health.status === 'critical') {
          const errTpls = METRIC_ERROR_TEMPLATES[cat]?.[metricKey] ?? [];
          if (errTpls.length > 0) {
            const tpl = errTpls[Math.floor(Math.random() * errTpls.length)];
            const jitter = Math.floor(Math.random() * (slot.endTimeUnixNano - slot.startTimeUnixNano));
            newLogs.push({
              timeUnixNano: slot.startTimeUnixNano + jitter,
              severityNumber: 17,
              severityText: 'ERROR',
              body: fillTemplate(tpl),
              attributes: { 'log.source': getLogSource(cat) },
              resource: sid,
            });
          }
        }
        // Warning/Critical → WARN
        const warnTpls = METRIC_WARN_TEMPLATES[cat]?.[metricKey] ?? [];
        if (warnTpls.length > 0) {
          const tpl = warnTpls[Math.floor(Math.random() * warnTpls.length)];
          const jitter = Math.floor(Math.random() * (slot.endTimeUnixNano - slot.startTimeUnixNano));
          newLogs.push({
            timeUnixNano: slot.startTimeUnixNano + jitter,
            severityNumber: 13,
            severityText: 'WARN',
            body: fillTemplate(tpl),
            attributes: { 'log.source': getLogSource(cat) },
            resource: sid,
          });
        }
      }
    }

    // 5. 토폴로지 연쇄 로그 (장애 서버의 의존 서버에 cascade WARN)
    const cascadeTargets = new Set<string>();
    for (const [sid, health] of Object.entries(serverHealth)) {
      if (health.status === 'healthy') continue;
      const targets = CASCADE_MAP[sid];
      if (!targets) continue;
      for (const target of targets) {
        // cascade 대상이 자체적으로 비정상이 아닌 경우에만 추가
        const targetHealth = serverHealth[target]?.status ?? 'healthy';
        if (targetHealth === 'healthy') {
          cascadeTargets.add(target);
        }
      }
    }

    for (const target of cascadeTargets) {
      const cat = getServerCategory(target);
      const tpls = CASCADE_WARN_TEMPLATES[cat] ?? [];
      if (tpls.length === 0) continue;
      const tpl = tpls[Math.floor(Math.random() * tpls.length)];
      const jitter = Math.floor(Math.random() * (slot.endTimeUnixNano - slot.startTimeUnixNano));
      newLogs.push({
        timeUnixNano: slot.startTimeUnixNano + jitter,
        severityNumber: 13,
        severityText: 'WARN',
        body: fillTemplate(tpl),
        attributes: { 'log.source': getLogSource(cat) },
        resource: target,
      });
    }

    // 6. 새 로그 추가 + 시간순 정렬
    slot.logs.push(...newLogs);
    slot.logs.sort((a, b) => a.timeUnixNano - b.timeUnixNano);
  }
  return data;
}

// ============================================================================
// L3: Watchdog 중복 제한 (동일 메시지 최대 2회) + S3GW cron 정리
// ============================================================================

function limitWatchdogDuplicates(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    const watchdogCounts = new Map<string, number>();
    slot.logs = slot.logs.filter(log => {
      // Watchdog 중복 제한
      if (log.body.includes('Watchdog timestamp updated')) {
        const key = `${log.resource}::watchdog`;
        const count = watchdogCounts.get(key) ?? 0;
        if (count >= 2) return false;
        watchdogCounts.set(key, count + 1);
      }

      // S3GW cron 제거 → minio healthcheck으로 교체
      if (log.resource === 'storage-s3gw-dc1-01' && log.attributes['log.source'] === 'cron') {
        log.attributes['log.source'] = 'minio';
        log.body = `minio[${2000 + Math.floor(Math.random() * 5000)}]: Healthcheck passed, ${3 + Math.floor(Math.random() * 10)} active connections`;
        log.severityText = 'INFO';
        log.severityNumber = 9;
      }

      return true;
    });
  }
  return data;
}

// ============================================================================
// Timeseries: 시나리오 동기화
// ============================================================================

/**
 * Timeseries를 hourly 파일에서 직접 추출하여 완벽히 동기화.
 * 기존 방식(시나리오만 덮어쓰기)이 1.8% 불일치를 일으킨 것을 해결.
 *
 * 방식: 24개 hourly JSON을 읽고, 각 슬롯의 메트릭 값을 timeseries 144포인트에 1:1 매핑.
 * - cpu/memory/disk: hourly에 0-1 ratio 저장 → 그대로 복사
 * - network: hourly에 bytes 저장 → ratio로 역변환 (bytes / 125,000,000)
 */
function syncTimeseriesFromHourlyFiles(data: TimeSeries): TimeSeries {
  const NETWORK_MAX_BYTES = 125_000_000;
  const RATIO_METRICS = [
    'system.cpu.utilization',
    'system.memory.utilization',
    'system.filesystem.utilization',
  ];
  const NETWORK_METRIC = 'system.network.io';

  for (let hour = 0; hour < 24; hour++) {
    const filename = `hour-${String(hour).padStart(2, '0')}.json`;
    const filepath = path.join(HOURLY_DIR, filename);
    const raw = fs.readFileSync(filepath, 'utf-8');
    const hourly: HourlyFile = JSON.parse(raw);

    for (let slotIdx = 0; slotIdx < hourly.slots.length; slotIdx++) {
      const slot = hourly.slots[slotIdx];
      if (!slot) continue;
      const tsIdx = hour * 6 + slotIdx;

      for (const metric of slot.metrics) {
        const isRatio = RATIO_METRICS.includes(metric.name);
        const isNetwork = metric.name === NETWORK_METRIC;
        if (!isRatio && !isNetwork) continue;

        const tsSeries = data.metrics[metric.name];
        if (!tsSeries) continue;

        for (const dp of metric.dataPoints) {
          const hostname = dp.attributes['host.name'];
          const serverId = hostname?.split('.')[0];
          if (!serverId) continue;

          const serverIdx = data.serverIds.indexOf(serverId);
          if (serverIdx === -1) continue;

          const series = tsSeries[serverIdx];
          if (!series || tsIdx >= series.length) continue;

          if (isRatio) {
            // ratio 그대로 복사 (소수점 4자리)
            series[tsIdx] = Math.round(dp.asDouble * 10000) / 10000;
          } else {
            // bytes → ratio 역변환
            const ratio = dp.asDouble / NETWORK_MAX_BYTES;
            series[tsIdx] = Math.round(Math.min(ratio, 0.99) * 10000) / 10000;
          }
        }
      }
    }
  }

  return data;
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  console.log('=== OTel Data Quality Fix (Scenario-based) ===\n');

  // Phase 1: Hourly data fixes
  console.log('[Phase 1] Hourly JSON fixes...');

  processAllHourlyFiles((data, hour) => {
    // C2: Network ratio → bytes
    data = fixNetworkRatio(data);
    // I3: Storage/Cache network (after C2)
    data = fixStorageCacheNetwork(data);
    // ★ P1: 시나리오 메트릭 조정 (C2/I3 이후, 최종 메트릭 권한)
    data = adjustMetricsForScenario(data, hour);
    // W1: Log time distribution
    data = fixLogTimeDistribution(data);
    // W2: S3 Gateway logs
    data = fixS3GatewayLogs(data);
    // W3: Redis OOM process
    data = fixRedisOOMProcess(data);
    // W8: systemd started dedup
    data = deduplicateSystemdStarted(data);
    // I1: InnoDB timestamp
    data = fixInnoDBTimestamp(data);
    // I2: GC parameter variation
    data = fixGCParameterVariation(data);
    // L1: Redis OOM sequence (kill → restart)
    data = fixRedisOOMSequence(data);
    // ★ P2: 메트릭-로그 일치 (L2 교체, 최종 로그 권한)
    data = reconcileLogsWithMetrics(data, hour);
    // L3: Watchdog dedup + S3GW cron cleanup
    data = limitWatchdogDuplicates(data);
    return data;
  });

  console.log('  ✓ 24 hourly files processed (5 scenarios applied)');

  // Phase 2: Timeseries fixes
  console.log('\n[Phase 2] Timeseries fixes...');

  // C4: Add missing metrics (uptime, process.count)
  addMissingTimeseriesMetrics();

  // ★ Timeseries를 hourly 파일에서 직접 추출 (100% 정합성 보장)
  processTimeseries((data) => syncTimeseriesFromHourlyFiles(data));
  console.log('  ★ Timeseries synced from hourly files (direct extraction)');

  console.log('\n=== Done ===');
}

main();
