/**
 * Trend Projection Backtest
 *
 * 실행 위치: 로컬 / GitLab CI self-hosted runner
 * Cloud Run 배포 불필요 — 순수 수치 계산, 외부 API 없음
 *
 * 평가 지표:
 * - MAE  (Mean Absolute Error): 투영값과 실제값의 평균 절대 오차
 * - MAPE (Mean Absolute Percentage Error): 상대 오차
 * - Precision / Recall: 임계값 돌파 탐지 정확도
 * - Lead Time: 실제 경보 발생 몇 슬롯(10분) 전에 탐지했나
 *
 * 사용법:
 *   npx tsx scripts/backtest-trend-projection.ts
 *   npx tsx scripts/backtest-trend-projection.ts --json   # JSON 출력
 *   npx tsx scripts/backtest-trend-projection.ts --metric cpu
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ============================================================================
// Config
// ============================================================================

const OTEL_DATA_DIR = resolve(
  __dirname,
  '../../../public/data/otel-data/hourly'
);
const WARNING_THRESHOLDS: Record<string, number> = {
  cpu: 70,
  memory: 80,
  disk: 80,
};
const CRITICAL_THRESHOLDS: Record<string, number> = {
  cpu: 90,
  memory: 90,
  disk: 90,
};
const REGRESSION_WINDOW = 12; // 슬롯 (= 2시간, 10분 간격)
const PROJECTION_HORIZON = 6; // 슬롯 ahead (= 1시간)

const args = process.argv.slice(2);
const outputJson = args.includes('--json');
const metricFilter = (() => {
  const idx = args.indexOf('--metric');
  return idx !== -1 ? args[idx + 1] : null;
})();

// ============================================================================
// Data Loading
// ============================================================================

interface SlotEntry {
  timestamp: number; // Unix ms
  values: Record<string, Record<string, number>>; // serverId → metric → value
}

function loadAllSlots(): SlotEntry[] {
  const files = readdirSync(OTEL_DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const slots: SlotEntry[] = [];
  let baseTs = Date.now() - files.length * 6 * 10 * 60 * 1000; // 대략적 시작점

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(OTEL_DATA_DIR, file), 'utf8'));
    for (const slot of raw.slots ?? []) {
      const entry: SlotEntry = { timestamp: baseTs, values: {} };
      for (const metric of slot.metrics ?? []) {
        const metricKey = mapMetricName(metric.name);
        if (!metricKey) continue;
        for (const dp of metric.dataPoints ?? []) {
          const serverId: string =
            dp.attributes?.['host.name'] ?? dp.attributes?.['server.id'] ?? '';
          if (!serverId) continue;
          if (!entry.values[serverId]) entry.values[serverId] = {};
          const raw_val: number = dp.asDouble ?? dp.value ?? 0;
          // cpu/memory/disk는 0–1 비율 → 퍼센트 변환
          entry.values[serverId][metricKey] =
            raw_val <= 1 && metricKey !== 'disk'
              ? Math.round(raw_val * 1000) / 10
              : Math.round(raw_val * 10) / 10;
        }
      }
      slots.push(entry);
      baseTs += 10 * 60 * 1000; // 10분
    }
  }
  return slots;
}

function mapMetricName(name: string): string | null {
  if (name.includes('cpu.utilization')) return 'cpu';
  if (name.includes('memory.utilization')) return 'memory';
  if (name.includes('filesystem.utilization')) return 'disk';
  return null;
}

// ============================================================================
// Linear Regression (TrendPredictor와 동일 알고리즘)
// ============================================================================

function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 };

  const x = values.map((_, i) => i);
  const y = values;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((s, xi, i) => s + xi * (y[i] ?? 0), 0);
  const sumX2 = x.reduce((s, xi) => s + xi * xi, 0);
  const sumY2 = y.reduce((s, yi) => s + yi * yi, 0);

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  const ssTotal = sumY2 - n * yMean * yMean;
  const ssRes = y.reduce((s, yi, i) => s + (yi - (slope * i + intercept)) ** 2, 0);
  const r2 = ssTotal !== 0 ? 1 - ssRes / ssTotal : 0;

  return { slope, intercept, r2 };
}

function project(window: number[], stepsAhead: number): number {
  const { slope, intercept } = linearRegression(window);
  const projected = intercept + slope * (window.length - 1 + stepsAhead);
  return Math.max(0, Math.min(100, projected));
}

// ============================================================================
// Backtest Engine
// ============================================================================

interface MetricResult {
  metric: string;
  server: string;
  windows: number;
  mae: number;
  mape: number;
  r2: number;
  // Threshold breach detection
  tp: number; // True Positive: 실제 경보 + 탐지
  fp: number; // False Positive: 탐지했지만 실제 경보 없음
  fn: number; // False Negative: 탐지 못한 실제 경보
  tn: number; // True Negative: 정상 + 미탐지
  leadTimes: number[]; // 탐지 시점에서 실제 경보까지 슬롯 수
}

function backtestServer(
  slots: SlotEntry[],
  serverId: string,
  metric: string
): MetricResult | null {
  const series: number[] = slots.map((s) => s.values[serverId]?.[metric] ?? NaN);
  // NaN 제거
  const validCount = series.filter((v) => !isNaN(v)).length;
  if (validCount < REGRESSION_WINDOW + PROJECTION_HORIZON + 5) return null;

  const threshold = WARNING_THRESHOLDS[metric] ?? 70;

  let mae = 0;
  let mapeSum = 0;
  let r2Sum = 0;
  let windows = 0;
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const leadTimes: number[] = [];

  for (let i = REGRESSION_WINDOW; i < series.length - PROJECTION_HORIZON; i++) {
    const window = series.slice(i - REGRESSION_WINDOW, i);
    if (window.some(isNaN)) continue;

    const actual = series[i + PROJECTION_HORIZON];
    if (isNaN(actual ?? NaN)) continue;

    const projected = project(window, PROJECTION_HORIZON);
    const { r2 } = linearRegression(window);

    const err = Math.abs(projected - actual!);
    mae += err;
    mapeSum += actual !== 0 ? err / actual! : 0;
    r2Sum += r2;
    windows++;

    // Threshold breach detection
    const willBreach = projected >= threshold;
    const didBreach = actual! >= threshold;

    if (willBreach && didBreach) {
      tp++;
      // Lead time: 얼마나 일찍 탐지했나 (실제 경보 슬롯 기준)
      leadTimes.push(PROJECTION_HORIZON);
    } else if (willBreach && !didBreach) {
      fp++;
    } else if (!willBreach && didBreach) {
      fn++;
    } else {
      tn++;
    }
  }

  if (windows === 0) return null;

  return {
    metric,
    server: serverId,
    windows,
    mae: Math.round((mae / windows) * 100) / 100,
    mape: Math.round((mapeSum / windows) * 10000) / 100, // %
    r2: Math.round((r2Sum / windows) * 1000) / 1000,
    tp, fp, fn, tn,
    leadTimes,
  };
}

// ============================================================================
// Aggregate & Report
// ============================================================================

interface AggregateResult {
  metric: string;
  servers: number;
  totalWindows: number;
  mae: number;
  mape: number;
  avgR2: number;
  precision: number;
  recall: number;
  f1: number;
  avgLeadTimeSlots: number;
  avgLeadTimeMin: number;
}

function aggregate(results: MetricResult[]): AggregateResult {
  const metric = results[0]!.metric;
  const totalWindows = results.reduce((s, r) => s + r.windows, 0);
  const mae = results.reduce((s, r) => s + r.mae * r.windows, 0) / totalWindows;
  const mape = results.reduce((s, r) => s + r.mape * r.windows, 0) / totalWindows;
  const avgR2 = results.reduce((s, r) => s + r.r2 * r.windows, 0) / totalWindows;

  const tp = results.reduce((s, r) => s + r.tp, 0);
  const fp = results.reduce((s, r) => s + r.fp, 0);
  const fn = results.reduce((s, r) => s + r.fn, 0);
  const tn = results.reduce((s, r) => s + r.tn, 0);
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  const allLeadTimes = results.flatMap((r) => r.leadTimes);
  const avgLeadTimeSlots =
    allLeadTimes.length > 0
      ? allLeadTimes.reduce((s, v) => s + v, 0) / allLeadTimes.length
      : 0;

  return {
    metric,
    servers: results.length,
    totalWindows,
    mae: Math.round(mae * 100) / 100,
    mape: Math.round(mape * 100) / 100,
    avgR2: Math.round(avgR2 * 1000) / 1000,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
    avgLeadTimeSlots: Math.round(avgLeadTimeSlots * 10) / 10,
    avgLeadTimeMin: Math.round(avgLeadTimeSlots * 10 * 10) / 10, // 10분/슬롯
  };
}

// ============================================================================
// Main
// ============================================================================

const slots = loadAllSlots();
const serverIds = [...new Set(slots.flatMap((s) => Object.keys(s.values)))].sort();
const metrics = metricFilter ? [metricFilter] : ['cpu', 'memory', 'disk'];

const allResults: MetricResult[] = [];
for (const metric of metrics) {
  for (const serverId of serverIds) {
    const r = backtestServer(slots, serverId, metric);
    if (r) allResults.push(r);
  }
}

const aggregated: AggregateResult[] = metrics.map((m) =>
  aggregate(allResults.filter((r) => r.metric === m))
).filter(Boolean);

if (outputJson) {
  console.log(JSON.stringify({ aggregated, detail: allResults }, null, 2));
} else {
  console.log('\n=== Trend Projection Backtest ===');
  console.log(`Data: ${slots.length} slots × ${serverIds.length} servers`);
  console.log(`Window: ${REGRESSION_WINDOW} slots (${REGRESSION_WINDOW * 10}min)`);
  console.log(`Horizon: ${PROJECTION_HORIZON} slots (${PROJECTION_HORIZON * 10}min = 1h)\n`);

  for (const agg of aggregated) {
    console.log(`── ${agg.metric.toUpperCase()} (${agg.servers} servers, ${agg.totalWindows} windows) ──`);
    console.log(`   MAE:       ${agg.mae.toFixed(2)}%`);
    console.log(`   MAPE:      ${agg.mape.toFixed(2)}%`);
    console.log(`   Avg R²:    ${agg.avgR2.toFixed(3)}`);
    console.log(`   Precision: ${(agg.precision * 100).toFixed(1)}%  (탐지 중 실제 경보 비율)`);
    console.log(`   Recall:    ${(agg.recall * 100).toFixed(1)}%  (실제 경보 중 탐지 비율)`);
    console.log(`   F1:        ${(agg.f1 * 100).toFixed(1)}%`);
    console.log(`   Lead Time: avg ${agg.avgLeadTimeMin}min (탐지 → 실제 경보 여유 시간)\n`);
  }

  console.log('=== 해석 기준 ===');
  console.log('MAE < 5%   : 허용 범위 (운영 보조 도구 수준)');
  console.log('MAE 5~15%  : 참고용 (추세 방향만 신뢰)');
  console.log('MAE > 15%  : 노출 부적합 (숨기거나 제거 권장)');
  console.log('Precision > 70%: 탐지 결과를 경보로 노출 가능');
  console.log('Recall > 50%   : 실제 경보 절반 이상 조기 탐지\n');
}
