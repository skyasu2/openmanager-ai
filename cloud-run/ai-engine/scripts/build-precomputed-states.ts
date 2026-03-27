#!/usr/bin/env npx tsx
/**
 * Pre-computed States 빌드 스크립트
 *
 * 사용법:
 *   npx tsx scripts/build-precomputed-states.ts
 *
 * 출력:
 *   data/precomputed-states.json (144 슬롯)
 */

import { join } from 'path';
import { buildPrecomputedStates } from '../src/data/precomputed-state';
import { writeFileSync } from 'fs';

const OUTPUT_PATH = join(__dirname, '../data/precomputed-states.json');

console.log('=== Pre-computed States Builder ===\n');

// 빌드
const slots = buildPrecomputedStates();

// 통계
const totalAlerts = slots.reduce((sum, s) => sum + s.alerts.length, 0);
const criticalSlots = slots.filter((s) => s.summary.critical > 0).length;
const warningSlots = slots.filter((s) => s.summary.warning > 0).length;

console.log(`\n=== 빌드 결과 ===`);
console.log(`총 슬롯: ${slots.length}`);
console.log(`총 알림: ${totalAlerts}`);
console.log(`Critical 슬롯: ${criticalSlots}`);
console.log(`Warning 슬롯: ${warningSlots}`);

// 샘플 출력
console.log(`\n=== 샘플 (슬롯 0, 72, 143) ===`);
for (const idx of [0, 72, 143]) {
  const slot = slots[idx];
  if (slot) {
    console.log(`\n[${slot.timeLabel}] ${slot.summary.total}서버 - H:${slot.summary.healthy} W:${slot.summary.warning} C:${slot.summary.critical}`);
    if (slot.alerts.length > 0) {
      console.log(`  알림: ${slot.alerts.slice(0, 2).map((a) => `${a.serverId}(${a.metric}:${a.value}%)`).join(', ')}`);
    }
  }
}

// JSON 저장
writeFileSync(OUTPUT_PATH, JSON.stringify(slots, null, 2), 'utf-8');
console.log(`\n✓ 저장 완료: ${OUTPUT_PATH}`);

// 파일 크기
const fs = require('fs');
const stats = fs.statSync(OUTPUT_PATH);
console.log(`  파일 크기: ${(stats.size / 1024).toFixed(1)} KB`);
