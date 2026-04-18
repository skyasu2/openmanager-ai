/**
 * OTel Data Quality Verification Script
 *
 * otel-fix.ts 실행 후 데이터 무결성 검증.
 *
 * Usage: npx tsx scripts/data/otel-verify.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const OTEL_DATA_DIR = path.resolve('public/data/otel-data');
const HOURLY_DIR = path.join(OTEL_DATA_DIR, 'hourly');
const TIMESERIES_PATH = path.join(OTEL_DATA_DIR, 'timeseries.json');

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

type HourlyFile = {
  slots: {
    startTimeUnixNano: number;
    endTimeUnixNano: number;
    metrics: { name: string; unit: string; dataPoints: { asDouble: number; attributes: Record<string, string> }[] }[];
    logs: { timeUnixNano: number; body: string; resource: string; attributes: Record<string, string> }[];
  }[];
};

type TimeSeries = {
  serverIds: string[];
  timestamps: number[];
  metrics: Record<string, number[][]>;
};

type ResourceCatalog = {
  resources: Record<string, Record<string, string | number>>;
};

function main(): void {
  console.log('=== OTel Data Verification ===\n');

  // ── 1. Network values 0-1 range (24 hourly files) ──
  console.log('[1] Network values 0-1 range (hourly):');
  let networkOutOfRange = 0;
  let networkUnitWrong = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));

    for (const slot of data.slots) {
      for (const metric of slot.metrics) {
        if (metric.name === 'system.network.io') {
          if (metric.unit !== 'By') networkUnitWrong++;
          for (const dp of metric.dataPoints) {
            // bytes/sec: 0 ~ 125,000,000 (1Gbps)
            if (dp.asDouble < 0 || dp.asDouble > 125_000_000) networkOutOfRange++;
          }
        }
      }
    }
  }

  check('Network unit = "By"', networkUnitWrong === 0, `${networkUnitWrong} wrong units`);
  check('Network values in [0, 125M]', networkOutOfRange === 0, `${networkOutOfRange} out of range`);

  // ── 2. Timeseries has 9 metrics ──
  console.log('\n[2] Timeseries metrics count:');
  const ts: TimeSeries = JSON.parse(fs.readFileSync(TIMESERIES_PATH, 'utf-8'));
  const expectedMetrics = [
    'system.cpu.utilization',
    'system.memory.utilization',
    'system.filesystem.utilization',
    'system.network.io',
    'system.linux.cpu.load_1m',
    'system.linux.cpu.load_5m',
    'system.process.count',
    'system.uptime',
    'http.server.request.duration',
  ];
  const actualMetrics = Object.keys(ts.metrics);
  check(`${expectedMetrics.length} metrics in timeseries`, expectedMetrics.every((m) => actualMetrics.includes(m)),
    `missing: ${expectedMetrics.filter((m) => !actualMetrics.includes(m)).join(', ')}`);

  // ── 3. Timeseries network 0-1 range ──
  console.log('\n[3] Timeseries network range:');
  const networkTs = ts.metrics['system.network.io'] ?? [];
  let tsNetworkOutOfRange = 0;
  for (const series of networkTs) {
    for (const val of series) {
      if (val < 0 || val > 125_000_000) tsNetworkOutOfRange++;
    }
  }
  check('Timeseries network in [0, 125M]', tsNetworkOutOfRange === 0, `${tsNetworkOutOfRange} out of range`);

  // ── 3b. Backup node realism ──
  console.log('\n[3b] Backup node realism:');
  const catalog: ResourceCatalog = JSON.parse(
    fs.readFileSync(path.join(OTEL_DATA_DIR, 'resource-catalog.json'), 'utf-8')
  );
  const backup = catalog.resources['db-mysql-dc1-backup'] ?? {};
  check('Backup CPU cores = 8', backup['host.cpu.count'] === 8);
  check(
    'Backup memory = 32GB',
    backup['host.memory.size'] === 34_359_738_368
  );
  check(
    'Backup purpose = cold-standby',
    backup['server.purpose'] === 'cold-standby'
  );
  check(
    'Backup notes mention daily snapshot',
    String(backup['server.notes'] ?? '').includes('daily snapshot')
  );

  const hour23: HourlyFile = JSON.parse(
    fs.readFileSync(path.join(HOURLY_DIR, 'hour-23.json'), 'utf-8')
  );
  const getBackupSeries = (metricName: string): number[] =>
    hour23.slots
      .map((slot) => {
        const metric = slot.metrics.find((entry) => entry.name === metricName);
        const point = metric?.dataPoints.find((dp) =>
          String(dp.attributes['host.name'] ?? '').startsWith(
            'db-mysql-dc1-backup.'
          )
        );
        return point?.asDouble;
      })
      .filter((value): value is number => typeof value === 'number');

  const backupCpuSeries = getBackupSeries('system.cpu.utilization');
  const backupMemorySeries = getBackupSeries('system.memory.utilization');
  const backupDiskSeries = getBackupSeries('system.filesystem.utilization');

  check('Backup CPU hour-23 max <= 0.35', Math.max(...backupCpuSeries) <= 0.35);
  check(
    'Backup memory hour-23 max <= 0.45',
    Math.max(...backupMemorySeries) <= 0.45
  );
  check(
    'Backup disk hour-23 min >= 0.68',
    Math.min(...backupDiskSeries) >= 0.68
  );

  // ── 3c. Redis cross-AZ latency scenario ──
  console.log('\n[3c] Redis cross-AZ latency scenario:');
  const responseTargets = [13, 14, 15];
  let remoteAzLogCount = 0;
  let redisLatencyHoursPassing = 0;

  for (const hour of responseTargets) {
    const hourly: HourlyFile = JSON.parse(
      fs.readFileSync(
        path.join(HOURLY_DIR, `hour-${String(hour).padStart(2, '0')}.json`),
        'utf-8'
      )
    );

    const responseSeries = hourly.slots
      .map((slot) => {
        const metric = slot.metrics.find(
          (entry) => entry.name === 'http.server.request.duration'
        );
        const point = metric?.dataPoints.find((dp) =>
          String(dp.attributes['host.name'] ?? '').startsWith(
            'api-was-dc1-03.'
          )
        );
        return point?.asDouble;
      })
      .filter((value): value is number => typeof value === 'number');

    if (responseSeries.length === 6 && Math.max(...responseSeries) >= 0.35) {
      redisLatencyHoursPassing++;
    }

    for (const slot of hourly.slots) {
      for (const log of slot.logs) {
        if (
          (log.resource === 'api-was-dc1-03' ||
            log.resource === 'cache-redis-dc1-01') &&
          /remote az cache/i.test(log.body)
        ) {
          remoteAzLogCount++;
        }
      }
    }
  }

  const apiWasIndex = ts.serverIds.indexOf('api-was-dc1-03');
  const apiWasResponseSeries =
    ts.metrics['http.server.request.duration']?.[apiWasIndex] ?? [];
  const crossAzWindow = apiWasResponseSeries.slice(13 * 6, 16 * 6);

  check(
    'api-was-dc1-03 latency spikes across hours 13-15',
    redisLatencyHoursPassing === 3,
    `${redisLatencyHoursPassing}/3 hours`
  );
  check(
    'Remote AZ cache cause logs recorded',
    remoteAzLogCount >= 6,
    `${remoteAzLogCount} logs`
  );
  check(
    'Timeseries syncs cross-AZ latency spikes',
    Math.max(...crossAzWindow) >= 0.35,
    `${Math.max(...crossAzWindow).toFixed(3)} max`
  );

  // ── 3d. NFS SPOF scenario ──
  console.log('\n[3d] NFS SPOF scenario:');
  let nfsHoursPassing = 0;
  let nfsCauseLogCount = 0;

  for (const hour of [2, 3, 4]) {
    const hourly: HourlyFile = JSON.parse(
      fs.readFileSync(
        path.join(HOURLY_DIR, `hour-${String(hour).padStart(2, '0')}.json`),
        'utf-8'
      )
    );

    const diskSeries = hourly.slots
      .map((slot) => {
        const metric = slot.metrics.find(
          (entry) => entry.name === 'system.filesystem.utilization'
        );
        const point = metric?.dataPoints.find((dp) =>
          String(dp.attributes['host.name'] ?? '').startsWith(
            'storage-nfs-dc1-01.'
          )
        );
        return point?.asDouble;
      })
      .filter((value): value is number => typeof value === 'number');

    const cpuSeries = hourly.slots
      .map((slot) => {
        const metric = slot.metrics.find(
          (entry) => entry.name === 'system.cpu.utilization'
        );
        const point = metric?.dataPoints.find((dp) =>
          String(dp.attributes['host.name'] ?? '').startsWith(
            'storage-nfs-dc1-01.'
          )
        );
        return point?.asDouble;
      })
      .filter((value): value is number => typeof value === 'number');

    if (
      diskSeries.length === 6 &&
      cpuSeries.length === 6 &&
      Math.max(...diskSeries) >= 0.82 &&
      Math.max(...cpuSeries) >= 0.45
    ) {
      nfsHoursPassing++;
    }

    for (const slot of hourly.slots) {
      for (const log of slot.logs) {
        if (
          (log.resource === 'storage-nfs-dc1-01' ||
            log.resource.startsWith('api-was-dc1-')) &&
          /nfs/i.test(log.body)
        ) {
          nfsCauseLogCount++;
        }
      }
    }
  }

  const nfsResponseWindow = ['api-was-dc1-01', 'api-was-dc1-02', 'api-was-dc1-03']
    .flatMap((serverId) => {
      const idx = ts.serverIds.indexOf(serverId);
      return ts.metrics['http.server.request.duration']?.[idx]?.slice(
        2 * 6,
        5 * 6
      ) ?? [];
    });

  check(
    'storage-nfs-dc1-01 saturation across hours 02-04',
    nfsHoursPassing === 3,
    `${nfsHoursPassing}/3 hours`
  );
  check(
    'NFS SPOF cause logs recorded',
    nfsCauseLogCount >= 9,
    `${nfsCauseLogCount} logs`
  );
  check(
    'Timeseries syncs NFS latency cascade',
    Math.max(...nfsResponseWindow) >= 0.5,
    `${Math.max(...nfsResponseWindow).toFixed(3)} max`
  );

  // ── 3e. Phase 3-A AZ2 LB inventory ──
  console.log('\n[3e] Phase 3-A AZ2 load balancer inventory:');
  const az2Lb = catalog.resources['lb-haproxy-dc1-03'] ?? {};
  check(
    'AZ2 LB catalog entry exists',
    az2Lb['host.name'] === 'lb-haproxy-dc1-03.openmanager.kr'
  );
  check('AZ2 LB zone = DC1-AZ2', az2Lb['cloud.availability_zone'] === 'DC1-AZ2');

  let az2LbMissingHours = 0;
  for (let hour = 0; hour < 24; hour++) {
    const hourly: HourlyFile = JSON.parse(
      fs.readFileSync(
        path.join(HOURLY_DIR, `hour-${String(hour).padStart(2, '0')}.json`),
        'utf-8'
      )
    );
    const cpuMetric = hourly.slots[0]?.metrics.find(
      (entry) => entry.name === 'system.cpu.utilization'
    );
    const hasAz2Lb = cpuMetric?.dataPoints.some(
      (dp) => dp.attributes['host.name'] === 'lb-haproxy-dc1-03.openmanager.kr'
    );
    if (!hasAz2Lb) {
      az2LbMissingHours++;
    }
  }

  check(
    'AZ2 LB present in all hourly files',
    az2LbMissingHours === 0,
    `${az2LbMissingHours} missing hours`
  );

  const az2LbIndex = ts.serverIds.indexOf('lb-haproxy-dc1-03');
  check('AZ2 LB present in timeseries serverIds', az2LbIndex >= 0);
  check(
    'AZ2 LB timeseries length matches timestamps',
    az2LbIndex >= 0 &&
      (ts.metrics['system.cpu.utilization']?.[az2LbIndex]?.length ?? 0) ===
        ts.timestamps.length
  );

  // ── 4. Cache OOM logs have redis-server (not java) ──
  console.log('\n[4] Cache OOM process name:');
  let javaOOMInCache = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));

    for (const slot of data.slots) {
      for (const log of slot.logs) {
        if (log.resource.startsWith('cache-') && log.body.includes('Killed process') && log.body.includes('(java)')) {
          javaOOMInCache++;
        }
      }
    }
  }
  check('No (java) in cache OOM logs', javaOOMInCache === 0, `${javaOOMInCache} found`);

  // ── 5. S3 Gateway has no NFS logs ──
  console.log('\n[5] S3 Gateway log content:');
  let nfsInS3 = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));

    for (const slot of data.slots) {
      for (const log of slot.logs) {
        if (log.resource === 'storage-s3gw-dc1-01' && (log.body.includes('NFS') || log.body.includes('nfsd'))) {
          nfsInS3++;
        }
      }
    }
  }
  check('No NFS logs in S3 Gateway', nfsInS3 === 0, `${nfsInS3} found`);

  // ── 6. systemd Started deduplication ──
  console.log('\n[6] systemd Started dedup:');
  let startedInLaterSlots = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));

    const seenKeys = new Set<string>();

    for (let sIdx = 0; sIdx < data.slots.length; sIdx++) {
      const slot = data.slots[sIdx];
      for (const log of slot.logs) {
        if (/^systemd\[1\]: Started /.test(log.body)) {
          const key = `${log.resource}::${log.body.replace(/\[\d+\]/, '[*]')}`;
          if (seenKeys.has(key)) {
            startedInLaterSlots++;
          }
          seenKeys.add(key);
        }
      }
    }
  }
  check('systemd Started only in first slot per hour', startedInLaterSlots === 0, `${startedInLaterSlots} duplicates`);

  // ── 7. Log timeUnixNano within slot range ──
  console.log('\n[7] Log timestamp distribution:');
  let logsOutOfSlot = 0;
  let totalLogs = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));

    for (const slot of data.slots) {
      for (const log of slot.logs) {
        totalLogs++;
        if (log.timeUnixNano < slot.startTimeUnixNano || log.timeUnixNano >= slot.endTimeUnixNano) {
          logsOutOfSlot++;
        }
      }
    }
  }
  check(`Log timestamps in slot range (${totalLogs} total)`, logsOutOfSlot === 0, `${logsOutOfSlot} out of range`);

  // ── 8. otel-processed directory absent ──
  console.log('\n[8] otel-processed cleanup:');
  const otelProcessedExists = fs.existsSync(path.resolve('src/data/otel-processed'));
  check('otel-processed/ directory deleted', !otelProcessedExists);

  // ── 9. Storage/Cache network ranges ──
  console.log('\n[9] Storage/Cache network ranges:');
  let storageOutOfRange = 0;
  let cacheOutOfRange = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));

    for (const slot of data.slots) {
      for (const metric of slot.metrics) {
        if (metric.name !== 'system.network.io') continue;
        for (const dp of metric.dataPoints) {
          const sid = (dp.attributes['host.name'] ?? '').split('.')[0];
          // bytes/sec: storage 15-35% of 1Gbps = 18.75M-43.75M
          if (sid.startsWith('storage-') && (dp.asDouble < 17_500_000 || dp.asDouble > 45_000_000)) {
            storageOutOfRange++;
          }
          // bytes/sec: cache 29-51% of 1Gbps = 36.25M-63.75M
          if (sid.startsWith('cache-') && (dp.asDouble < 36_000_000 || dp.asDouble > 64_000_000)) {
            cacheOutOfRange++;
          }
        }
      }
    }
  }
  check('Storage network in [0.14, 0.36] (±0.01 margin)', storageOutOfRange === 0, `${storageOutOfRange} out of range`);
  check('Cache network in [0.29, 0.51] (±0.01 margin)', cacheOutOfRange === 0, `${cacheOutOfRange} out of range`);

  // ── 10. Severity distribution ──
  console.log('\n[10] Severity distribution:');
  let totalInfo = 0;
  let totalWarn = 0;
  let totalError = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));
    for (const slot of data.slots) {
      for (const log of slot.logs) {
        if (log.severityText === 'INFO') totalInfo++;
        else if (log.severityText === 'WARN') totalWarn++;
        else if (log.severityText === 'ERROR') totalError++;
      }
    }
  }

  const totalSev = totalInfo + totalWarn + totalError;
  const infoPct = totalSev > 0 ? (totalInfo / totalSev) * 100 : 0;
  const warnPct = totalSev > 0 ? (totalWarn / totalSev) * 100 : 0;
  const errorPct = totalSev > 0 ? (totalError / totalSev) * 100 : 0;
  console.log(`  INFO: ${totalInfo} (${infoPct.toFixed(1)}%), WARN: ${totalWarn} (${warnPct.toFixed(1)}%), ERROR: ${totalError} (${errorPct.toFixed(1)}%)`);
  check('INFO < 85%', infoPct < 85, `INFO is ${infoPct.toFixed(1)}%`);
  check('WARN > 5%', warnPct > 5, `WARN is ${warnPct.toFixed(1)}%`);
  check('ERROR > 3%', errorPct > 3, `ERROR is ${errorPct.toFixed(1)}%`);

  // ── 11. Redis OOM has restart sequence ──
  console.log('\n[11] Redis OOM restart sequence:');
  let oomWithoutRestart = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));
    for (const slot of data.slots) {
      for (let i = 0; i < slot.logs.length; i++) {
        const log = slot.logs[i];
        if (log.resource.startsWith('cache-') && log.body.includes('Killed process')) {
          // 다음 3개 로그 내에 재시작 시퀀스가 있어야 함
          const nextLogs = slot.logs.slice(i + 1, i + 5).map(l => l.body);
          const hasRestart = nextLogs.some(b => b.includes('Main process exited') || b.includes('Scheduled restart'));
          if (!hasRestart) oomWithoutRestart++;
        }
      }
    }
  }
  check('Redis OOM has restart sequence', oomWithoutRestart === 0, `${oomWithoutRestart} missing`);

  // ── 12. Watchdog duplicates limited ──
  console.log('\n[12] Watchdog duplication limit:');
  let excessiveWatchdog = 0;

  for (let h = 0; h < 24; h++) {
    const filename = `hour-${String(h).padStart(2, '0')}.json`;
    const data: HourlyFile = JSON.parse(fs.readFileSync(path.join(HOURLY_DIR, filename), 'utf-8'));
    for (const slot of data.slots) {
      const watchdogCounts = new Map<string, number>();
      for (const log of slot.logs) {
        if (log.body.includes('Watchdog timestamp updated')) {
          const key = `${log.resource}::watchdog`;
          watchdogCounts.set(key, (watchdogCounts.get(key) ?? 0) + 1);
        }
      }
      for (const [, count] of watchdogCounts) {
        if (count > 2) excessiveWatchdog++;
      }
    }
  }
  check('Watchdog messages <= 2 per server per slot', excessiveWatchdog === 0, `${excessiveWatchdog} excessive`);

  // ── Summary ──
  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
