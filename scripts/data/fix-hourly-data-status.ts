#!/usr/bin/env tsx
/**
 * hourly-data JSON 파일의 status 필드 재계산
 *
 * 문제: hourly-data JSON의 status 필드가 메트릭 값과 불일치
 * 해결: system-rules.json 임계값 기반으로 status 재계산
 *
 * 실행: npx tsx scripts/data/fix-hourly-data-status.ts
 *
 * @created 2026-01-19
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// 임계값 정의 (system-rules.json과 동일)
// ============================================================================

const THRESHOLDS = {
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 80, critical: 90 },
  disk: { warning: 80, critical: 90 },
  network: { warning: 70, critical: 85 },
};

type Status = 'online' | 'warning' | 'critical';

interface ServerMetrics {
  id: string;
  name: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  status: Status;
  [key: string]: unknown;
}

interface DataPoint {
  minute: number;
  timestamp: string;
  servers: Record<string, ServerMetrics>;
}

interface HourlyData {
  hour: number;
  _pattern?: string;
  dataPoints: DataPoint[];
}

// ============================================================================
// 상태 계산 함수
// ============================================================================

function computeStatus(metrics: {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}): Status {
  // Critical 체크 (하나라도 critical 임계값 초과)
  if (
    metrics.cpu >= THRESHOLDS.cpu.critical ||
    metrics.memory >= THRESHOLDS.memory.critical ||
    metrics.disk >= THRESHOLDS.disk.critical ||
    metrics.network >= THRESHOLDS.network.critical
  ) {
    return 'critical';
  }

  // Warning 체크 (하나라도 warning 임계값 초과)
  if (
    metrics.cpu >= THRESHOLDS.cpu.warning ||
    metrics.memory >= THRESHOLDS.memory.warning ||
    metrics.disk >= THRESHOLDS.disk.warning ||
    metrics.network >= THRESHOLDS.network.warning
  ) {
    return 'warning';
  }

  return 'online';
}

// ============================================================================
// 메인 함수
// ============================================================================

async function main() {
  // 2곳 동기화 (sync-hourly-data.ts와 동일 구조)
  const dataDirs = [
    path.join(process.cwd(), 'src/data/hourly-data'),         // SSOT 번들
    path.join(process.cwd(), 'cloud-run/ai-engine/data/hourly-data'), // Cloud Run
  ].filter(dir => fs.existsSync(dir));

  if (dataDirs.length === 0) {
    console.error('❌ No hourly-data directories found');
    process.exit(1);
  }

  console.log(`📂 Target directories (${dataDirs.length}):`);
  dataDirs.forEach(dir => console.log(`   - ${dir}`));

  console.log('🔄 Scanning hourly-data JSON files...\n');
  console.log(`Thresholds used:`);
  console.log(`  CPU:     warning >= ${THRESHOLDS.cpu.warning}%, critical >= ${THRESHOLDS.cpu.critical}%`);
  console.log(`  Memory:  warning >= ${THRESHOLDS.memory.warning}%, critical >= ${THRESHOLDS.memory.critical}%`);
  console.log(`  Disk:    warning >= ${THRESHOLDS.disk.warning}%, critical >= ${THRESHOLDS.disk.critical}%`);
  console.log(`  Network: warning >= ${THRESHOLDS.network.warning}%, critical >= ${THRESHOLDS.network.critical}%`);
  console.log('');

  let totalFixed = 0;
  const fixedByHour: Record<number, number> = {};
  const changes: string[] = [];

  // SSOT 디렉토리 (첫 번째)에서 변경사항 계산
  const ssotDir = dataDirs[0];

  for (let hour = 0; hour < 24; hour++) {
    const fileName = `hour-${hour.toString().padStart(2, '0')}.json`;
    const ssotPath = path.join(ssotDir, fileName);

    if (!fs.existsSync(ssotPath)) {
      console.warn(`⚠️ File not found: ${fileName}`);
      continue;
    }

    try {
      const content = fs.readFileSync(ssotPath, 'utf-8');
      const data: HourlyData = JSON.parse(content);

      if (!data.dataPoints || !Array.isArray(data.dataPoints)) {
        console.warn(`⚠️ Invalid format: ${fileName} (missing dataPoints)`);
        continue;
      }

      let fixedInFile = 0;

      for (const dataPoint of data.dataPoints) {
        if (!dataPoint.servers || typeof dataPoint.servers !== 'object') {
          continue;
        }

        for (const [serverId, server] of Object.entries(dataPoint.servers)) {
          const computed = computeStatus({
            cpu: server.cpu,
            memory: server.memory,
            disk: server.disk,
            network: server.network,
          });

          if (server.status !== computed) {
            const change = `  ${fileName}[${dataPoint.minute}m]: ${serverId} [${server.status} → ${computed}] ` +
              `(cpu:${server.cpu}, mem:${server.memory}, disk:${server.disk}, net:${server.network})`;
            changes.push(change);

            server.status = computed;
            fixedInFile++;
          }
        }
      }

      if (fixedInFile > 0) {
        // 모든 디렉토리에 JSON 파일 업데이트 (2-space 인덴트)
        const jsonContent = JSON.stringify(data, null, 2) + '\n';
        for (const dir of dataDirs) {
          const filePath = path.join(dir, fileName);
          fs.writeFileSync(filePath, jsonContent);
        }
        fixedByHour[hour] = fixedInFile;
        totalFixed += fixedInFile;
      }
    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error);
    }
  }

  // 결과 출력
  console.log('─'.repeat(60));
  console.log('📊 Changes Summary:\n');

  if (changes.length > 0) {
    changes.forEach((change) => console.log(change));
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log(`\n✅ Total fixed: ${totalFixed} status values across ${Object.keys(fixedByHour).length} files`);
  console.log(`📂 Synced to ${dataDirs.length} directories\n`);

  if (totalFixed > 0) {
    console.log('Files modified:');
    Object.entries(fixedByHour)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([hour, count]) => {
        console.log(`  hour-${hour.toString().padStart(2, '0')}.json: ${count} changes`);
      });
  } else {
    console.log('🎉 All hourly-data files are already consistent!');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
