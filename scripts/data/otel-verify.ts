/**
 * OTel Data Quality Verification Script
 *
 * otel-fix.ts 실행 후 데이터 무결성 검증.
 *
 * Usage: npx tsx scripts/data/otel-verify.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const OTEL_DATA_DIR = path.resolve('src/data/otel-data');
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
        if (metric.name === 'system.network.utilization') {
          if (metric.unit !== '1') networkUnitWrong++;
          for (const dp of metric.dataPoints) {
            if (dp.asDouble < 0 || dp.asDouble > 1) networkOutOfRange++;
          }
        }
      }
    }
  }

  check('Network unit = "1"', networkUnitWrong === 0, `${networkUnitWrong} wrong units`);
  check('Network values in [0, 1]', networkOutOfRange === 0, `${networkOutOfRange} out of range`);

  // ── 2. Timeseries has 9 metrics ──
  console.log('\n[2] Timeseries metrics count:');
  const ts: TimeSeries = JSON.parse(fs.readFileSync(TIMESERIES_PATH, 'utf-8'));
  const expectedMetrics = [
    'system.cpu.utilization',
    'system.memory.utilization',
    'system.filesystem.utilization',
    'system.network.utilization',
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
  const networkTs = ts.metrics['system.network.utilization'] ?? [];
  let tsNetworkOutOfRange = 0;
  for (const series of networkTs) {
    for (const val of series) {
      if (val < 0 || val > 1) tsNetworkOutOfRange++;
    }
  }
  check('Timeseries network in [0, 1]', tsNetworkOutOfRange === 0, `${tsNetworkOutOfRange} out of range`);

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
        if (metric.name !== 'system.network.utilization') continue;
        for (const dp of metric.dataPoints) {
          const sid = (dp.attributes['host.name'] ?? '').split('.')[0];
          if (sid.startsWith('storage-') && (dp.asDouble < 0.14 || dp.asDouble > 0.36)) {
            storageOutOfRange++;
          }
          if (sid.startsWith('cache-') && (dp.asDouble < 0.29 || dp.asDouble > 0.51)) {
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
