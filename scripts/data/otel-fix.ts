/**
 * OTel Data Quality Fix Script
 *
 * 24개 hourly JSON + timeseries.json 일괄 변환.
 * C2, C4, W1-W3, W8, I1-I3 수정사항을 일괄 적용.
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
// C2: network.io unit/value 통일 (By/s → "1", values / 100)
// ============================================================================

function fixNetworkRatio(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    for (const metric of slot.metrics) {
      if (metric.name === 'system.network.utilization') {
        metric.unit = '1';
        for (const dp of metric.dataPoints) {
          // 현재 35-65 범위 → 0.35-0.65 ratio로 변환
          dp.asDouble = Math.round((dp.asDouble / 100) * 100) / 100;
        }
      }
    }
  }
  return data;
}

function fixNetworkTimeseries(data: TimeSeries): TimeSeries {
  const networkKey = 'system.network.utilization';
  if (data.metrics[networkKey]) {
    data.metrics[networkKey] = data.metrics[networkKey].map((serverSeries) =>
      serverSeries.map((val) => Math.round((val / 100) * 100) / 100)
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
      if (metric.name !== 'system.network.utilization') continue;

      for (const dp of metric.dataPoints) {
        const hostname = dp.attributes['host.name'] ?? '';
        const serverId = hostname.split('.')[0];

        // C2 변환 후 값은 이미 0-1 ratio
        if (serverId.startsWith('storage-')) {
          // Storage: 0.15-0.35 범위
          if (dp.asDouble < 0.15 || dp.asDouble > 0.35) {
            dp.asDouble = Math.round((0.15 + Math.random() * 0.20) * 100) / 100;
          }
        } else if (serverId.startsWith('cache-')) {
          // Cache: 0.30-0.50 범위
          if (dp.asDouble < 0.30 || dp.asDouble > 0.50) {
            dp.asDouble = Math.round((0.30 + Math.random() * 0.20) * 100) / 100;
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
// L2: 심각도 분포 재조정 (INFO→WARN/ERROR 승격 + 새 로그 삽입)
// ============================================================================

const WARN_TEMPLATES: Record<string, string[]> = {
  'web': [
    'nginx[{pid}]: upstream timed out (110: Connection timed out) while connecting to upstream',
    'nginx[{pid}]: client request body is buffered to a temporary file, client: 10.0.{a}.{b}',
  ],
  'api': [
    'java[{pid}]: [WARN] HikariPool - Connection pool is running low (available: 2/20)',
    'java[{pid}]: [WARN] Slow transaction detected: /api/servers took {ms}ms (threshold: 500ms)',
  ],
  'db': [
    'mysqld[{pid}]: [Warning] Aborted connection {n} to db: openmanager (Got timeout reading communication packets)',
    'mysqld[{pid}]: [Warning] InnoDB: Long semaphore wait (>2sec), holder thread {tid}',
  ],
  'cache': [
    'redis-server[{pid}]: WARNING: Memory usage {pct}% of maxmemory, consider increasing maxmemory',
    'redis-server[{pid}]: Client id={n} addr=10.0.{a}.{b}:{port} paused for {ms}ms during BGSAVE',
  ],
  'lb': [
    'haproxy[{pid}]: backend web_servers has no server available! Retrying in 1s.',
    'haproxy[{pid}]: Server web_servers/web-nginx-dc1-03 is DOWN, reason: Layer7 timeout',
  ],
};

const ERROR_TEMPLATES: Record<string, string[]> = {
  'web': [
    'nginx[{pid}]: connect() failed (111: Connection refused) while connecting to upstream 10.0.1.{b}:8080',
  ],
  'api': [
    'java[{pid}]: [ERROR] Failed to execute query: Connection reset by peer (db-mysql-dc1-primary:3306)',
  ],
  'db': [
    'mysqld[{pid}]: [ERROR] InnoDB: Cannot allocate {n}MB for the buffer pool, current limit {m}MB',
  ],
  'cache': [
    'redis-server[{pid}]: ERROR: MISCONF Redis is configured to save RDB snapshots, but is currently unable to persist',
  ],
  'lb': [
    'haproxy[{pid}]: Connect() to backend failed: Connection refused (errno 111)',
  ],
};

function getServerCategory(resource: string): string {
  if (resource.startsWith('web-')) return 'web';
  if (resource.startsWith('api-')) return 'api';
  if (resource.startsWith('db-')) return 'db';
  if (resource.startsWith('cache-')) return 'cache';
  if (resource.startsWith('lb-')) return 'lb';
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

function rebalanceSeverity(data: HourlyFile): HourlyFile {
  for (const slot of data.slots) {
    const infoLogs = slot.logs.filter(l => l.severityText === 'INFO');
    const totalLogs = slot.logs.length;
    if (totalLogs < 5) continue;

    // 목표: INFO 78%, WARN 14%, ERROR 8%
    const targetWarn = Math.max(1, Math.round(totalLogs * 0.14));
    const targetError = Math.max(1, Math.round(totalLogs * 0.08));
    const currentWarn = slot.logs.filter(l => l.severityText === 'WARN').length;
    const currentError = slot.logs.filter(l => l.severityText === 'ERROR').length;
    const needWarn = Math.max(0, targetWarn - currentWarn);
    const needError = Math.max(0, targetError - currentError);

    // 서버별로 균등 배분
    const serverIds = [...new Set(slot.logs.map(l => l.resource))];
    let warnAdded = 0;
    let errorAdded = 0;

    for (const sid of serverIds) {
      const cat = getServerCategory(sid);
      const warnTpls = WARN_TEMPLATES[cat] ?? WARN_TEMPLATES['web'];
      const errTpls = ERROR_TEMPLATES[cat] ?? ERROR_TEMPLATES['web'];

      // WARN 삽입
      if (warnAdded < needWarn) {
        const tpl = warnTpls[Math.floor(Math.random() * warnTpls.length)];
        const jitter = Math.floor(Math.random() * (slot.endTimeUnixNano - slot.startTimeUnixNano));
        slot.logs.push({
          timeUnixNano: slot.startTimeUnixNano + jitter,
          severityNumber: 13,
          severityText: 'WARN',
          body: fillTemplate(tpl),
          attributes: { 'log.source': cat === 'db' ? 'mysqld' : cat === 'cache' ? 'redis' : 'syslog' },
          resource: sid,
        });
        warnAdded++;
      }

      // ERROR 삽입 (주간 시간대에 집중: slot 시간 기반)
      if (errorAdded < needError) {
        const tpl = errTpls[Math.floor(Math.random() * errTpls.length)];
        const jitter = Math.floor(Math.random() * (slot.endTimeUnixNano - slot.startTimeUnixNano));
        slot.logs.push({
          timeUnixNano: slot.startTimeUnixNano + jitter,
          severityNumber: 17,
          severityText: 'ERROR',
          body: fillTemplate(tpl),
          attributes: { 'log.source': cat === 'db' ? 'mysqld' : cat === 'cache' ? 'redis' : 'syslog' },
          resource: sid,
        });
        errorAdded++;
      }
    }

    // 타임스탬프 순 정렬
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
// Main
// ============================================================================

function main(): void {
  console.log('=== OTel Data Quality Fix ===\n');

  // Phase 1: Hourly data fixes (순서 중요: C2 먼저, I3는 C2 이후)
  console.log('[Phase 1] Hourly JSON fixes...');

  processAllHourlyFiles((data, hour) => {
    // C2: Network ratio
    data = fixNetworkRatio(data);
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
    // I3: Storage/Cache network (after C2)
    data = fixStorageCacheNetwork(data);
    // L1: Redis OOM sequence (kill → restart)
    data = fixRedisOOMSequence(data);
    // L2: Severity rebalance (INFO 97%→78%)
    data = rebalanceSeverity(data);
    // L3: Watchdog dedup + S3GW cron cleanup
    data = limitWatchdogDuplicates(data);
    return data;
  });

  console.log('  ✓ 24 hourly files processed');

  // Phase 2: Timeseries fixes
  console.log('\n[Phase 2] Timeseries fixes...');

  // C2: Network ratio in timeseries
  processTimeseries((data) => fixNetworkTimeseries(data));
  console.log('  C2: Network values /100 in timeseries');

  // C4: Add missing metrics
  addMissingTimeseriesMetrics();

  // I3: Storage/Cache network in timeseries
  processTimeseries((data) => {
    const networkKey = 'system.network.utilization';
    if (!data.metrics[networkKey]) return data;

    for (let sIdx = 0; sIdx < data.serverIds.length; sIdx++) {
      const sid = data.serverIds[sIdx];
      const series = data.metrics[networkKey][sIdx];
      if (!series) continue;

      if (sid.startsWith('storage-')) {
        for (let i = 0; i < series.length; i++) {
          if (series[i] < 0.15 || series[i] > 0.35) {
            series[i] = Math.round((0.15 + Math.random() * 0.20) * 100) / 100;
          }
        }
      } else if (sid.startsWith('cache-')) {
        for (let i = 0; i < series.length; i++) {
          if (series[i] < 0.30 || series[i] > 0.50) {
            series[i] = Math.round((0.30 + Math.random() * 0.20) * 100) / 100;
          }
        }
      }
    }
    return data;
  });
  console.log('  I3: Storage/Cache network values adjusted in timeseries');

  console.log('\n=== Done ===');
}

main();
