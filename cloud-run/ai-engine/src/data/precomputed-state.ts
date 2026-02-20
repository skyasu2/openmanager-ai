/**
 * 🎯 Pre-computed Server State Service
 *
 * 24시간 사이클 데이터를 144개 슬롯(10분 간격)으로 미리 계산
 * - 런타임 계산 = 0 (O(1) 조회)
 * - LLM 토큰 최소화 (수천 → ~100 토큰)
 * - 어제 = 오늘 = 내일 (동일 패턴 반복)
 *
 * @updated 2025-12-28 - 최적화 구현
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../lib/logger';
import { generateLogs, type GeneratedLog } from './log-generator';
import {
  buildPrecomputedStates,
  initOTelDataAsync,
  LOG_PRIORITY_ORDER,
  THRESHOLDS,
} from './precomputed-state-core';
import {
  buildCompactContext as buildCompactContextFromState,
  buildJSONContext,
  buildLLMContext,
  buildServerLLMContext,
  clearTrendCache,
  formatTextSummary,
} from './precomputed-state-formatters';
import type {
  ActivePattern,
  CompactContext,
  PrecomputedSlot,
  ServerAlert,
  ServerSnapshot,
  ServerStatus,
  SystemRulesThresholds,
  ThresholdConfig,
  TrendDirection,
} from './precomputed-state.types';

export { buildPrecomputedStates, initOTelDataAsync };
export type {
  ActivePattern,
  CompactContext,
  PrecomputedSlot,
  ServerAlert,
  ServerSnapshot,
  ServerStatus,
  SystemRulesThresholds,
  ThresholdConfig,
  TrendDirection,
};

// ============================================================================
// Runtime Cache & Lookup
// ============================================================================

let _cachedSlots: PrecomputedSlot[] | null = null;

function createFallbackSlot(slotIndex: number): PrecomputedSlot {
  const safeIndex = ((slotIndex % 144) + 144) % 144;
  const hour = Math.floor(safeIndex / 6);
  const minute = (safeIndex % 6) * 10;

  return {
    slotIndex: safeIndex,
    timeLabel: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    minuteOfDay: safeIndex * 10,
    summary: {
      total: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
      offline: 0,
    },
    alerts: [],
    activePatterns: [],
    servers: [],
    serverLogs: {},
  };
}

function getSlotOrFallback(slots: PrecomputedSlot[], slotIndex: number): PrecomputedSlot {
  return slots[slotIndex] ?? slots[0] ?? createFallbackSlot(slotIndex);
}

/** Pre-built JSON 경로 후보 */
function getPrebuiltJsonPaths(): string[] {
  return [
    join(__dirname, '../../data/precomputed-states.json'),
    join(process.cwd(), 'data/precomputed-states.json'),
    join(process.cwd(), 'cloud-run/ai-engine/data/precomputed-states.json'),
  ];
}

/** Pre-built JSON 로드 시도 */
function loadPrebuiltStates(): PrecomputedSlot[] | null {
  for (const filePath of getPrebuiltJsonPaths()) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const slots = JSON.parse(content) as PrecomputedSlot[];
        logger.info(`[PrecomputedState] Pre-built JSON 로드: ${filePath} (${slots.length}개 슬롯)`);
        return slots;
      } catch (e) {
        logger.warn(`[PrecomputedState] JSON 파싱 실패: ${filePath}`, e);
      }
    }
  }
  return null;
}

/** 슬롯 캐시 로드 (Lazy) - Pre-built 우선, 없으면 빌드 */
export function getSlots(): PrecomputedSlot[] {
  if (!_cachedSlots) {
    // 기본 정책: 런타임 빌드 우선 (데이터 정합성 최우선)
    // 필요 시 PRECOMPUTED_STATES_MODE=prebuilt 로 pre-built 우선 모드 활성화 가능
    const mode = process.env.PRECOMPUTED_STATES_MODE ?? 'runtime';
    const preferPrebuilt = mode === 'prebuilt';

    if (preferPrebuilt) {
      // 1) pre-built 로드 시도
      const prebuilt = loadPrebuiltStates();

      // 2) pre-built 검증 (기본 활성화)
      // stale pre-built로 인한 Vercel/Cloud Run 데이터 불일치 방지
      const shouldValidate = process.env.PRECOMPUTED_STATES_VALIDATE !== 'false';
      if (prebuilt && shouldValidate) {
        const runtimeBuilt = buildPrecomputedStates();
        const currentIndex = getCurrentSlotIndex();
        const prebuiltSummary = prebuilt[currentIndex]?.summary;
        const runtimeSummary = runtimeBuilt[currentIndex]?.summary;
        const isMatch =
          JSON.stringify(prebuiltSummary) === JSON.stringify(runtimeSummary);

        if (!isMatch) {
          logger.warn(
            '[PrecomputedState] stale pre-built 감지, 런타임 빌드 결과 사용',
            { currentIndex, prebuiltSummary, runtimeSummary }
          );
          if (runtimeBuilt.length > 0) {
            _cachedSlots = runtimeBuilt;
          } else if (prebuilt.length > 0) {
            logger.warn('[PrecomputedState] 런타임 빌드 0개, pre-built 유지');
            _cachedSlots = prebuilt;
          } else {
            logger.error('[PrecomputedState] pre-built/런타임 모두 비어있음, fallback 슬롯 생성');
            _cachedSlots = [createFallbackSlot(currentIndex)];
          }
        } else {
          _cachedSlots = prebuilt;
        }
      } else if (prebuilt) {
        _cachedSlots = prebuilt;
      } else {
        logger.info('[PrecomputedState] Pre-built 없음, 런타임 빌드 시작...');
        const runtimeBuilt = buildPrecomputedStates();
        _cachedSlots =
          runtimeBuilt.length > 0
            ? runtimeBuilt
            : [createFallbackSlot(getCurrentSlotIndex())];
      }
    } else {
      // 런타임 빌드 우선 (권장)
      logger.info('[PrecomputedState] 런타임 빌드 모드 사용');
      const runtimeBuilt = buildPrecomputedStates();
      if (runtimeBuilt.length > 0) {
        _cachedSlots = runtimeBuilt;
      } else {
        logger.warn('[PrecomputedState] 런타임 빌드 0개, pre-built fallback 시도');
        const prebuilt = loadPrebuiltStates();
        _cachedSlots =
          prebuilt && prebuilt.length > 0
            ? prebuilt
            : [createFallbackSlot(getCurrentSlotIndex())];
      }
    }

    // 3. Pre-built JSON에 serverLogs 없으면 런타임 보충
    if (_cachedSlots.length > 0 && !_cachedSlots[0].serverLogs) {
      logger.info('[PrecomputedState] serverLogs 없음, 런타임 보충 생성...');
      for (const slot of _cachedSlots) {
        const serverLogs: Record<string, GeneratedLog[]> = {};
        for (const server of slot.servers) {
          const logs = generateLogs(
            { cpu: server.cpu, memory: server.memory, disk: server.disk, network: server.network },
            server.id,
            server.type,
          );
          logs.sort((a, b) => (LOG_PRIORITY_ORDER[a.level] ?? 2) - (LOG_PRIORITY_ORDER[b.level] ?? 2));
          serverLogs[server.id] = logs.slice(0, 5);
        }
        slot.serverLogs = serverLogs;
      }
    }
  }
  return _cachedSlots;
}

/**
 * 현재 시각의 슬롯 인덱스 계산
 * @see src/services/metrics/MetricsProvider.ts (Vercel과 동일한 로직)
 *
 * 중요: toLocaleString 방식은 환경에 따라 불안정하므로
 * UTC + 9시간 직접 계산 방식 사용 (Vercel과 동일)
 */
function getCurrentSlotIndex(): number {
  const now = new Date();
  // UTC + 9시간 = KST (Vercel MetricsProvider와 동일 로직)
  const kstOffset = 9 * 60; // 분 단위
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + kstOffset) % 1440; // 1440 = 24시간
  return Math.floor(kstMinutes / 10);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 현재 시각의 Pre-computed 상태 조회 (O(1))
 */
export function getCurrentState(): PrecomputedSlot {
  const slots = getSlots();
  const index = getCurrentSlotIndex();
  return getSlotOrFallback(slots, index);
}

/**
 * 특정 슬롯 조회
 */
export function getStateBySlot(slotIndex: number): PrecomputedSlot | undefined {
  const slots = getSlots();
  return slots[slotIndex];
}

/**
 * 특정 시각의 상태 조회
 */
export function getStateByTime(hour: number, minute: number): PrecomputedSlot | undefined {
  const minuteOfDay = hour * 60 + minute;
  const slotIndex = Math.floor(minuteOfDay / 10);
  return getStateBySlot(slotIndex);
}

/**
 * LLM용 압축 컨텍스트 생성 (~100 토큰, 날짜 포함)
 */
export function getCompactContext(): CompactContext {
  const state = getStateAtRelativeTime(0);
  return buildCompactContextFromState(state, THRESHOLDS);
}

/**
 * LLM용 텍스트 요약 (최소 토큰, 날짜 포함)
 */
export function getTextSummary(): string {
  return formatTextSummary(getCompactContext());
}

/**
 * 특정 서버의 현재 상태 조회
 */
export function getServerState(serverId: string): ServerSnapshot | undefined {
  const state = getCurrentState();
  return state.servers.find((s) => s.id === serverId);
}

/**
 * 현재 활성 알림 목록
 */
export function getActiveAlerts(): ServerAlert[] {
  return getCurrentState().alerts;
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearStateCache(): void {
  _cachedSlots = null;
  clearTrendCache();
  logger.info('[PrecomputedState] 캐시 초기화됨');
}

/**
 * JSON 파일로 내보내기 (빌드 타임용)
 */
export function exportToJson(outputPath: string): void {
  const slots = buildPrecomputedStates();
  writeFileSync(outputPath, JSON.stringify(slots, null, 2), 'utf-8');
  logger.info(`[PrecomputedState] ${outputPath}에 내보내기 완료`);
}

// ============================================================================
// Date/Time Calculation (24시간 순환 + 실제 날짜)
// ============================================================================

/**
 * 현재 KST 날짜/시간 정보 반환
 */
export function getKSTDateTime(): { date: string; time: string; slotIndex: number; minuteOfDay: number } {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간 (ms)
  const kstDate = new Date(now.getTime() + kstOffset);

  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(Math.floor(kstDate.getUTCMinutes() / 10) * 10).padStart(2, '0');

  const minuteOfDay = kstDate.getUTCHours() * 60 + Math.floor(kstDate.getUTCMinutes() / 10) * 10;
  const slotIndex = Math.floor(minuteOfDay / 10);

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    slotIndex,
    minuteOfDay,
  };
}

/**
 * 상대 시간(분) 기준으로 실제 날짜/시간 계산
 * @param minutesAgo 몇 분 전 (양수 = 과거, 음수 = 미래)
 * @returns { date, time, slotIndex, timestamp }
 */
export function calculateRelativeDateTime(minutesAgo: number): {
  date: string;
  time: string;
  slotIndex: number;
  timestamp: string;
} {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const targetTime = new Date(now.getTime() + kstOffset - minutesAgo * 60 * 1000);

  const year = targetTime.getUTCFullYear();
  const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetTime.getUTCDate()).padStart(2, '0');
  const hours = String(targetTime.getUTCHours()).padStart(2, '0');
  const mins = Math.floor(targetTime.getUTCMinutes() / 10) * 10;
  const minutes = String(mins).padStart(2, '0');

  const minuteOfDay = targetTime.getUTCHours() * 60 + mins;
  const slotIndex = Math.floor(minuteOfDay / 10);

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    slotIndex,
    timestamp: `${year}-${month}-${day}T${hours}:${minutes}:00+09:00`,
  };
}

/**
 * 🎯 상대 시간 기준 상태 조회 (날짜 포함)
 * @param minutesAgo 몇 분 전 (0 = 현재)
 */
export function getStateAtRelativeTime(minutesAgo: number = 0): PrecomputedSlot & {
  fullTimestamp: string;
  dateLabel: string;
  isYesterday: boolean;
} {
  const { date, time, slotIndex, timestamp } = calculateRelativeDateTime(minutesAgo);
  const currentDate = getKSTDateTime().date;
  const isYesterday = date !== currentDate;

  const slots = getSlots();
  const state = getSlotOrFallback(slots, slotIndex);

  return {
    ...state,
    timeLabel: time, // 원래 timeLabel 덮어쓰기
    fullTimestamp: timestamp,
    dateLabel: isYesterday ? `${date} (어제)` : date,
    isYesterday,
  };
}

/**
 * 🎯 최근 N개 슬롯 히스토리 (날짜 포함)
 * @param count 조회할 슬롯 수 (기본 6 = 1시간)
 */
export function getRecentHistory(count: number = 6): Array<PrecomputedSlot & {
  fullTimestamp: string;
  dateLabel: string;
  isYesterday: boolean;
}> {
  const history = [];
  for (let i = 0; i < count; i++) {
    const minutesAgo = i * 10;
    history.push(getStateAtRelativeTime(minutesAgo));
  }
  return history;
}

/**
 * 🎯 시간 범위 비교 (현재 vs N분 전)
 */
export function compareWithPast(minutesAgo: number): {
  current: { timestamp: string; summary: PrecomputedSlot['summary']; alerts: ServerAlert[] };
  past: { timestamp: string; summary: PrecomputedSlot['summary']; alerts: ServerAlert[] };
  changes: {
    healthyDelta: number;
    warningDelta: number;
    criticalDelta: number;
    newAlerts: ServerAlert[];
    resolvedAlerts: ServerAlert[];
  };
} {
  const current = getStateAtRelativeTime(0);
  const past = getStateAtRelativeTime(minutesAgo);

  const currentAlertIds = new Set(current.alerts.map(a => `${a.serverId}-${a.metric}`));
  const pastAlertIds = new Set(past.alerts.map(a => `${a.serverId}-${a.metric}`));

  const newAlerts = current.alerts.filter(a => !pastAlertIds.has(`${a.serverId}-${a.metric}`));
  const resolvedAlerts = past.alerts.filter(a => !currentAlertIds.has(`${a.serverId}-${a.metric}`));

  return {
    current: {
      timestamp: current.fullTimestamp,
      summary: current.summary,
      alerts: current.alerts,
    },
    past: {
      timestamp: past.fullTimestamp,
      summary: past.summary,
      alerts: past.alerts,
    },
    changes: {
      healthyDelta: current.summary.healthy - past.summary.healthy,
      warningDelta: current.summary.warning - past.summary.warning,
      criticalDelta: current.summary.critical - past.summary.critical,
      newAlerts,
      resolvedAlerts,
    },
  };
}

// ============================================================================
// LLM Context Helpers (토큰 최적화)
// ============================================================================

/**
 * 🎯 LLM 시스템 프롬프트용 서버 상태 컨텍스트
 * 기존 loadHourlyScenarioData() 대신 사용 권장
 *
 * @returns 최소 토큰으로 압축된 현재 상태 (날짜 포함)
 */
export function getLLMContext(): string {
  return buildLLMContext(getStateAtRelativeTime(0), getSlots(), THRESHOLDS);
}

/**
 * 🎯 특정 서버의 LLM 컨텍스트 (확장 메트릭 포함)
 */
export function getServerLLMContext(serverId: string): string {
  return buildServerLLMContext(getCurrentState(), serverId);
}

/**
 * 🎯 JSON 형식 컨텍스트 (API 응답용, 날짜 포함)
 */
export function getJSONContext(): {
  date: string;
  time: string;
  timestamp: string;
  summary: PrecomputedSlot['summary'];
  critical: ServerAlert[];
  warning: ServerAlert[];
} {
  return buildJSONContext(getStateAtRelativeTime(0));
}
