import { existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../lib/logger';
import type {
  OTelHourlyFile,
  OTelHourlySlot,
  OTelResourceCatalog,
} from '../types/otel-metrics';
import { buildSlot, type RawServerData } from './precomputed-state-slot';
import type {
  PrecomputedSlot,
  SystemRulesThresholds,
} from './precomputed-state.types';
export { LOG_PRIORITY_ORDER } from './precomputed-state-slot';

// ============================================================================
// Thresholds (from system-rules.json - Single Source of Truth)
// ============================================================================

/**
 * 🎯 system-rules.json 경로 후보
 * Cloud Run 배포 환경과 로컬 개발 환경 모두 지원
 */
function getSystemRulesPaths(): string[] {
  return [
    // Cloud Run 배포 시 복사된 경로
    join(__dirname, '../../config/system-rules.json'),
    join(process.cwd(), 'config/system-rules.json'),
    // 로컬 개발 시 원본 경로
    join(process.cwd(), 'src/config/rules/system-rules.json'),
    join(process.cwd(), '../src/config/rules/system-rules.json'),
  ];
}

/**
 * 🎯 system-rules.json에서 임계값 로드
 * @returns SystemRulesThresholds | null
 */
function loadThresholdsFromSystemRules(): SystemRulesThresholds | null {
  for (const filePath of getSystemRulesPaths()) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const rules = JSON.parse(content);
        if (rules?.thresholds) {
          logger.info(`[PrecomputedState] system-rules.json 로드: ${filePath}`);
          return {
            cpu: { warning: rules.thresholds.cpu.warning, critical: rules.thresholds.cpu.critical },
            memory: { warning: rules.thresholds.memory.warning, critical: rules.thresholds.memory.critical },
            disk: { warning: rules.thresholds.disk.warning, critical: rules.thresholds.disk.critical },
            network: { warning: rules.thresholds.network.warning, critical: rules.thresholds.network.critical },
          };
        }
      } catch (e) {
        logger.warn(`[PrecomputedState] system-rules.json 파싱 실패: ${filePath}`, e);
      }
    }
  }
  return null;
}

/**
 * 🎯 임계값 정의 - Single Source of Truth
 * @see /src/config/rules/system-rules.json
 *
 * 우선순위:
 * 1. system-rules.json에서 로드
 * 2. 폴백: 업계 표준 기본값
 */
export const THRESHOLDS: SystemRulesThresholds = loadThresholdsFromSystemRules() ?? {
  // 폴백 기본값 (업계 표준)
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 80, critical: 90 },
  disk: { warning: 80, critical: 90 },
  network: { warning: 70, critical: 85 },
};

// ============================================================================
// OTel Data Loader (PRIMARY — Tiered Data Access)
// ============================================================================

/** OTel resource-catalog.json 캐시 */
let _resourceCatalog: OTelResourceCatalog | null = null;

function getOTelResourceCatalog(): OTelResourceCatalog | null {
  if (_resourceCatalog) return _resourceCatalog;
  const paths = [
    join(__dirname, '../../data/otel-data/resource-catalog.json'),
    join(__dirname, '../../data/otel-processed/resource-catalog.json'),
    join(process.cwd(), 'data/otel-data/resource-catalog.json'),
    join(process.cwd(), 'data/otel-processed/resource-catalog.json'),
    join(process.cwd(), 'cloud-run/ai-engine/data/otel-processed/resource-catalog.json'),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        _resourceCatalog = JSON.parse(readFileSync(p, 'utf-8'));
        logger.info(`[PrecomputedState] OTel resource-catalog 로드: ${p}`);
        return _resourceCatalog;
      } catch {
        /* 다음 경로 시도 */
      }
    }
  }
  return null;
}

/** OTel hourly JSON 경로 후보 */
function getOTelPaths(hour: number): string[] {
  const paddedHour = hour.toString().padStart(2, '0');
  return [
    join(__dirname, '../../data/otel-data/hourly', `hour-${paddedHour}.json`),
    join(__dirname, '../../data/otel-processed/hourly', `hour-${paddedHour}.json`),
    join(process.cwd(), 'data/otel-data/hourly', `hour-${paddedHour}.json`),
    join(process.cwd(), 'data/otel-processed/hourly', `hour-${paddedHour}.json`),
    join(process.cwd(), 'cloud-run/ai-engine/data/otel-processed/hourly', `hour-${paddedHour}.json`),
  ];
}

/** OTel hourly JSON 로드 (PRIMARY - sync) */
function loadOTelHourly(hour: number): OTelHourlyFile | null {
  // Check async cache first (populated by initOTelDataAsync)
  if (_otelHourlyCache.has(hour)) {
    return _otelHourlyCache.get(hour)!;
  }
  for (const filePath of getOTelPaths(hour)) {
    if (existsSync(filePath)) {
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf-8')) as OTelHourlyFile;
        _otelHourlyCache.set(hour, data);
        return data;
      } catch {
        /* 다음 경로 시도 */
      }
    }
  }
  return null;
}

/** Async cache for parallel hourly file loading */
const _otelHourlyCache = new Map<number, OTelHourlyFile>();

/**
 * Pre-load all 24 hourly OTel files in parallel (async).
 * Call at startup to avoid cold-start sync reads.
 * After this, loadOTelHourly/buildPrecomputedStates use the cache.
 */
export async function initOTelDataAsync(): Promise<void> {
  const loadOne = async (hour: number): Promise<void> => {
    for (const filePath of getOTelPaths(hour)) {
      try {
        const content = await readFile(filePath, 'utf-8');
        _otelHourlyCache.set(hour, JSON.parse(content) as OTelHourlyFile);
        return;
      } catch {
        /* 다음 경로 시도 */
      }
    }
  };

  await Promise.all(Array.from({ length: 24 }, (_, i) => loadOne(i)));
  logger.info(`[PrecomputedState] Async pre-load 완료: ${_otelHourlyCache.size}/24 시간 파일`);
}

/**
 * Normalize OTel utilization value to percent (0-100).
 * Matches Vercel-side normalizeUtilizationPercent logic.
 * - ratio (0~1): multiply by 100
 * - percent (1~100): keep as-is
 * - out of range: clamp to 0~100
 */
function normalizeUtilizationPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1) return Math.round(value * 1000) / 10;
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

/**
 * OTel slot → RawServerData[] 변환
 * OTel ratio (0-1) → percent (0-100) 변환 포함
 *
 * @see docs/reference/architecture/data/otel-data-architecture.md §3 Metrics Mapping
 */
function otelSlotToRawServers(slot: OTelHourlySlot): Record<string, RawServerData> {
  const catalog = getOTelResourceCatalog();
  const serverMap: Record<string, RawServerData> = {};

  for (const metric of slot.metrics) {
    for (const dp of metric.dataPoints) {
      const hostname = dp.attributes['host.name'];
      const serverId = hostname?.replace('.openmanager.kr', '') ?? '';
      if (!serverId) continue;

      if (!serverMap[serverId]) {
        const resource = catalog?.resources[serverId];
        serverMap[serverId] = {
          id: serverId,
          name: serverId,
          type: resource?.['server.role'] ?? 'unknown',
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 0,
          cpuCores: resource?.['host.cpu.count'],
        };
      }

      const server = serverMap[serverId];
      switch (metric.name) {
        case 'system.cpu.utilization':
          server.cpu = normalizeUtilizationPercent(dp.asDouble);
          break;
        case 'system.memory.utilization':
          server.memory = normalizeUtilizationPercent(dp.asDouble);
          break;
        case 'system.filesystem.utilization':
          server.disk = normalizeUtilizationPercent(dp.asDouble);
          break;
        case 'system.network.io':
          // system.network.io 값은 bytes/sec → 1Gbps 기준 utilization %로 변환
          server.network = Math.min(100, Math.round((dp.asDouble / 125_000_000) * 1000) / 10);
          break;
        case 'system.linux.cpu.load_1m':
          server.load1 = dp.asDouble;
          break;
        case 'system.linux.cpu.load_5m':
          server.load5 = dp.asDouble;
          break;
        case 'http.server.request.duration':
          // Normalize to milliseconds based on metric unit field
          // OTel standard: "s" (seconds), some sources: "ms" (milliseconds)
          server.responseTimeMs = metric.unit === 'ms' ? dp.asDouble : dp.asDouble * 1000;
          break;
        case 'system.status':
          // 1 = online, 0 = offline (Cloud Run 전용 메트릭)
          if (dp.asDouble === 0) {
            server.status = 'offline';
          }
          break;
        case 'system.uptime':
          server.bootTimeSeconds = Math.floor(Date.now() / 1000 - dp.asDouble);
          break;
      }
    }
  }

  return serverMap;
}

/** 144개 슬롯 빌드 — OTel SSOT */
export function buildPrecomputedStates(): PrecomputedSlot[] {
  const slots: (PrecomputedSlot | undefined)[] = new Array(144);
  let previousServers: Record<string, RawServerData> = {};
  let otelCount = 0;

  // 24시간 순회 (0-23)
  for (let hour = 0; hour < 24; hour++) {
    const otelData = loadOTelHourly(hour);

    if (!otelData) {
      logger.warn(`[PrecomputedState] hour-${hour} OTel 데이터 없음, 스킵`);
      continue;
    }

    otelCount++;
    for (let slotInHour = 0; slotInHour < 6; slotInHour++) {
      const slotIndex = hour * 6 + slotInHour;
      const otelSlot = otelData.slots[Math.min(slotInHour, otelData.slots.length - 1)];
      if (!otelSlot) continue;

      const rawServers = otelSlotToRawServers(otelSlot);
      slots[slotIndex] = buildSlot(
        rawServers,
        previousServers,
        slotIndex,
        hour,
        slotInHour,
        THRESHOLDS,
        '',
        otelSlot.logs
      );
      previousServers = rawServers;
    }
  }

  // Filter out gaps from missing hours
  const filledSlots = slots.filter((s): s is PrecomputedSlot => s !== undefined);
  logger.info(
    `[PrecomputedState] ${filledSlots.length}개 슬롯 빌드 완료 (OTel=${otelCount}h)`
  );
  return filledSlots;
}
