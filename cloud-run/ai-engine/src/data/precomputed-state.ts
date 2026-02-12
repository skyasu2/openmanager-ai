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

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../lib/logger';
import type {
  OTelHourlyFile,
  OTelHourlySlot,
  OTelResourceCatalog,
} from '../types/otel-metrics';
import { generateLogs, type GeneratedLog } from './log-generator';

// ============================================================================
// Types
// ============================================================================

/** 서버 상태 (JSON SSOT와 동일한 용어 사용) */
export type ServerStatus = 'online' | 'warning' | 'critical' | 'offline';

/** 트렌드 방향 */
export type TrendDirection = 'up' | 'down' | 'stable';

/** 개별 서버 알림 */
export interface ServerAlert {
  serverId: string;
  serverName: string;
  serverType: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  threshold: number;
  trend: TrendDirection;
  severity: 'warning' | 'critical';
}

/** 서버 스냅샷 (LLM용 정보, 확장 메트릭 포함) */
export interface ServerSnapshot {
  id: string;
  name: string;
  type: string;
  status: ServerStatus;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  // 확장 메트릭 (AI 컨텍스트 강화)
  load1?: number;           // 1분 평균 로드
  load5?: number;           // 5분 평균 로드
  bootTimeSeconds?: number; // 부팅 시간 (Unix timestamp)
  responseTimeMs?: number;  // 응답 시간 (ms)
  cpuCores?: number;        // CPU 코어 수 (load 해석용)
}

/** 활성 패턴 (시나리오명 숨김) */
export interface ActivePattern {
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  pattern: 'spike' | 'gradual' | 'oscillate' | 'sustained' | 'normal';
  severity: 'info' | 'warning' | 'critical';
}

/** Pre-computed 슬롯 (10분 단위) */
export interface PrecomputedSlot {
  slotIndex: number;           // 0-143
  timeLabel: string;           // "14:30"
  minuteOfDay: number;         // 0-1430

  // 요약 통계
  summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    offline: number;
  };

  // 알림 목록 (warning/critical만)
  alerts: ServerAlert[];

  // 활성 패턴 (시나리오명 없이)
  activePatterns: ActivePattern[];

  // 전체 서버 스냅샷 (상세 조회용)
  servers: ServerSnapshot[];

  /** 서버별 주요 로그 (AI 컨텍스트용, 서버당 최대 5개) */
  serverLogs: Record<string, GeneratedLog[]>;
}

/** LLM용 압축 컨텍스트 */
export interface CompactContext {
  date: string;
  time: string;
  timestamp: string;
  summary: string;
  critical: Array<{ server: string; issue: string }>;
  warning: Array<{ server: string; issue: string }>;
  patterns: string[];
  thresholds: {
    cpu: { warning: number; critical: number };
    memory: { warning: number; critical: number };
    disk: { warning: number; critical: number };
    network: { warning: number; critical: number };
  };
  serverRoles: Array<{ id: string; name: string; type: string }>;
}

// ============================================================================
// Thresholds (from system-rules.json - Single Source of Truth)
// ============================================================================

interface ThresholdConfig {
  warning: number;
  critical: number;
}

interface SystemRulesThresholds {
  cpu: ThresholdConfig;
  memory: ThresholdConfig;
  disk: ThresholdConfig;
  network: ThresholdConfig;
}

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
          console.log(`[PrecomputedState] system-rules.json 로드: ${filePath}`);
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
const THRESHOLDS: SystemRulesThresholds = loadThresholdsFromSystemRules() ?? {
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
    join(__dirname, '../../data/otel-processed/resource-catalog.json'),
    join(process.cwd(), 'data/otel-processed/resource-catalog.json'),
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
    join(__dirname, '../../data/otel-processed/hourly', `hour-${paddedHour}.json`),
    join(process.cwd(), 'data/otel-processed/hourly', `hour-${paddedHour}.json`),
  ];
}

/** OTel hourly JSON 로드 (PRIMARY) */
function loadOTelHourly(hour: number): OTelHourlyFile | null {
  for (const filePath of getOTelPaths(hour)) {
    if (existsSync(filePath)) {
      try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch {
        /* 다음 경로 시도 */
      }
    }
  }
  return null;
}

/**
 * OTel slot → RawServerData[] 변환
 * OTel ratio (0-1) → percent (0-100) 변환 포함
 *
 * @see docs/reference/architecture/data/otel-pipeline-audit.md §6 매핑 테이블
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
          type: resource?.['host.type'] ?? 'unknown',
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
          server.cpu = Math.round(dp.asDouble * 1000) / 10;
          break;
        case 'system.memory.utilization':
          server.memory = Math.round(dp.asDouble * 1000) / 10;
          break;
        case 'system.filesystem.utilization':
          server.disk = Math.round(dp.asDouble * 1000) / 10;
          break;
        case 'system.network.io':
          server.network = dp.asDouble;
          break;
        case 'system.status':
          if (dp.asDouble === 0) server.status = 'offline';
          break;
        case 'system.cpu.load_average.1m':
          server.load1 = dp.asDouble;
          break;
        case 'system.cpu.load_average.5m':
          server.load5 = dp.asDouble;
          break;
        case 'http.server.request.duration':
          server.responseTimeMs = dp.asDouble * 1000;
          break;
        case 'system.uptime':
          server.bootTimeSeconds = Math.floor(Date.now() / 1000 - dp.asDouble);
          break;
      }
    }
  }

  return serverMap;
}

// ============================================================================
// Prometheus Data Loader (FALLBACK)
// ============================================================================

/** JSON 파일 경로 후보 */
function getJsonPaths(hour: number): string[] {
  const paddedHour = hour.toString().padStart(2, '0');
  return [
    join(__dirname, '../../../data/hourly-data', `hour-${paddedHour}.json`),
    join(process.cwd(), 'data/hourly-data', `hour-${paddedHour}.json`),
    join(process.cwd(), 'cloud-run/ai-engine/data/hourly-data', `hour-${paddedHour}.json`),
  ];
}

/** JSON 파일 로드 */
function loadHourlyJson(hour: number): HourlyJsonData | null {
  for (const filePath of getJsonPaths(hour)) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      } catch {
        // 다음 경로 시도
      }
    }
  }
  return null;
}

interface HourlyJsonData {
  hour: number;
  _scenario?: string;
  scrapeConfig: {
    scrapeInterval: string;
    evaluationInterval: string;
    source: string;
  };
  dataPoints: Array<{
    timestampMs: number;
    targets: Record<string, PrometheusTargetData>;
  }>;
}

interface PrometheusTargetData {
  job: string;
  instance: string;
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
}

interface RawServerData {
  id: string;
  name: string;
  type: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  status?: string;
  // 확장 메트릭
  load1?: number;
  load5?: number;
  bootTimeSeconds?: number;
  responseTimeMs?: number;
  cpuCores?: number;
}

/**
 * PrometheusTargetData → RawServerData 변환
 */
function targetToRawServer(target: PrometheusTargetData): RawServerData {
  return {
    id: target.instance.replace(/:9100$/, ''),
    name: target.labels.hostname.replace('.openmanager.kr', ''),
    type: target.labels.server_type,
    cpu: target.metrics.node_cpu_usage_percent,
    memory: target.metrics.node_memory_usage_percent,
    disk: target.metrics.node_filesystem_usage_percent,
    network: target.metrics.node_network_transmit_bytes_rate,
    status: target.metrics.up === 0 ? 'offline' : undefined,
    // 확장 메트릭
    load1: target.metrics.node_load1,
    load5: target.metrics.node_load5,
    bootTimeSeconds: target.metrics.node_boot_time_seconds,
    responseTimeMs: target.metrics.node_http_request_duration_milliseconds,
    cpuCores: target.nodeInfo?.cpu_cores,
  };
}

/** 서버 상태 결정 (JSON SSOT와 동일한 용어 사용) */
function determineStatus(server: RawServerData): ServerStatus {
  // up=0 (Prometheus scrape 실패) → offline
  if (server.status === 'offline') {
    return 'offline';
  }

  const { cpu, memory, disk, network } = server;

  // Critical 체크
  if (
    cpu >= THRESHOLDS.cpu.critical ||
    memory >= THRESHOLDS.memory.critical ||
    disk >= THRESHOLDS.disk.critical ||
    network >= THRESHOLDS.network.critical
  ) {
    return 'critical';
  }

  // Warning 체크
  if (
    cpu >= THRESHOLDS.cpu.warning ||
    memory >= THRESHOLDS.memory.warning ||
    disk >= THRESHOLDS.disk.warning ||
    network >= THRESHOLDS.network.warning
  ) {
    return 'warning';
  }

  return 'online'; // 'healthy' → 'online' (JSON SSOT 통일)
}

/** 트렌드 계산 (이전 슬롯과 비교) */
function calculateTrend(current: number, previous: number | undefined): TrendDirection {
  if (previous === undefined) return 'stable';
  const diff = current - previous;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
}

/** 알림 생성 */
function generateAlerts(
  server: RawServerData,
  previousServer: RawServerData | undefined
): ServerAlert[] {
  const alerts: ServerAlert[] = [];
  const metrics = ['cpu', 'memory', 'disk', 'network'] as const;

  for (const metric of metrics) {
    const value = server[metric];
    const threshold = THRESHOLDS[metric];
    const prevValue = previousServer?.[metric];

    if (value >= threshold.critical) {
      alerts.push({
        serverId: server.id,
        serverName: server.name,
        serverType: server.type,
        metric,
        value,
        threshold: threshold.critical,
        trend: calculateTrend(value, prevValue),
        severity: 'critical',
      });
    } else if (value >= threshold.warning) {
      alerts.push({
        serverId: server.id,
        serverName: server.name,
        serverType: server.type,
        metric,
        value,
        threshold: threshold.warning,
        trend: calculateTrend(value, prevValue),
        severity: 'warning',
      });
    }
  }

  return alerts;
}

/** 패턴 감지 (시나리오명 없이) */
function detectPatterns(servers: ServerSnapshot[]): ActivePattern[] {
  const patterns: ActivePattern[] = [];
  const metrics = ['cpu', 'memory', 'disk', 'network'] as const;

  for (const metric of metrics) {
    const values = servers.map((s) => s[metric]);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);

    if (max >= THRESHOLDS[metric].critical) {
      patterns.push({
        metric,
        pattern: max - avg > 30 ? 'spike' : 'sustained',
        severity: 'critical',
      });
    } else if (max >= THRESHOLDS[metric].warning) {
      patterns.push({
        metric,
        pattern: 'gradual',
        severity: 'warning',
      });
    }
  }

  return patterns;
}

/**
 * RawServerData → PrecomputedSlot 빌드 헬퍼
 * OTel path와 Prometheus path 양쪽에서 재사용
 */
function buildSlot(
  rawServers: Record<string, RawServerData>,
  previousServers: Record<string, RawServerData>,
  slotIndex: number,
  hour: number,
  slotInHour: number,
  scenario: string = '',
): PrecomputedSlot {
  const minuteOfDay = slotIndex * 10;
  const timeLabel = `${hour.toString().padStart(2, '0')}:${(slotInHour * 10).toString().padStart(2, '0')}`;

  // 서버 스냅샷 생성 (확장 메트릭 포함)
  const servers: ServerSnapshot[] = Object.values(rawServers).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    status: determineStatus(s),
    cpu: s.cpu,
    memory: s.memory,
    disk: s.disk,
    network: s.network,
    load1: s.load1,
    load5: s.load5,
    bootTimeSeconds: s.bootTimeSeconds,
    responseTimeMs: s.responseTimeMs,
    cpuCores: s.cpuCores,
  }));

  // 요약 통계 (healthy 필드명 유지, 값은 online 서버 수)
  const summary = {
    total: servers.length,
    healthy: servers.filter((s) => s.status === 'online').length,
    warning: servers.filter((s) => s.status === 'warning').length,
    critical: servers.filter((s) => s.status === 'critical').length,
    offline: servers.filter((s) => s.status === 'offline').length,
  };

  // 알림 생성
  const alerts: ServerAlert[] = [];
  for (const rawServer of Object.values(rawServers)) {
    const prevServer = previousServers[rawServer.id];
    alerts.push(...generateAlerts(rawServer, prevServer));
  }

  // 패턴 감지
  const activePatterns = detectPatterns(servers);

  // 서버별 로그 생성 (error 우선, 서버당 최대 5개)
  const serverLogs: Record<string, GeneratedLog[]> = {};
  for (const raw of Object.values(rawServers)) {
    const logs = generateLogs(
      { cpu: raw.cpu, memory: raw.memory, disk: raw.disk, network: raw.network },
      raw.id,
      raw.type,
      scenario,
    );
    // error 우선 정렬 후 최대 5개
    const priorityOrder: Record<string, number> = { error: 0, warn: 1, info: 2 };
    logs.sort((a, b) => (priorityOrder[a.level] ?? 2) - (priorityOrder[b.level] ?? 2));
    serverLogs[raw.id] = logs.slice(0, 5);
  }

  return {
    slotIndex,
    timeLabel,
    minuteOfDay,
    summary,
    alerts,
    activePatterns,
    servers,
    serverLogs,
  };
}

/** 144개 슬롯 빌드 — OTel 우선, Prometheus 폴백 (Tiered Data Access) */
export function buildPrecomputedStates(): PrecomputedSlot[] {
  const slots: PrecomputedSlot[] = [];
  let previousServers: Record<string, RawServerData> = {};
  let otelCount = 0;
  let promCount = 0;

  // 24시간 순회 (0-23)
  for (let hour = 0; hour < 24; hour++) {
    // Tier 1: OTel processed data (PRIMARY)
    const otelData = loadOTelHourly(hour);

    if (otelData) {
      otelCount++;
      for (let slotInHour = 0; slotInHour < 6; slotInHour++) {
        const slotIndex = hour * 6 + slotInHour;
        const slot = otelData.slots[Math.min(slotInHour, otelData.slots.length - 1)];
        if (!slot) continue;

        const rawServers = otelSlotToRawServers(slot);
        slots.push(buildSlot(rawServers, previousServers, slotIndex, hour, slotInHour));
        previousServers = rawServers;
      }
      continue;
    }

    // Tier 2: Prometheus hourly-data (FALLBACK)
    const hourlyData = loadHourlyJson(hour);
    if (!hourlyData) {
      logger.warn(`[PrecomputedState] hour-${hour} 데이터 없음 (OTel/Prometheus 모두), 스킵`);
      continue;
    }

    promCount++;
    for (let slotInHour = 0; slotInHour < 6; slotInHour++) {
      const slotIndex = hour * 6 + slotInHour;
      const dataPoint = hourlyData.dataPoints[Math.min(slotInHour, hourlyData.dataPoints.length - 1)];

      if (!dataPoint?.targets) {
        logger.warn(`[PrecomputedState] slot ${slotIndex} 데이터 없음`);
        continue;
      }

      const rawServers: Record<string, RawServerData> = {};
      for (const target of Object.values(dataPoint.targets)) {
        const raw = targetToRawServer(target);
        rawServers[raw.id] = raw;
      }

      slots.push(buildSlot(rawServers, previousServers, slotIndex, hour, slotInHour, hourlyData._scenario ?? ''));
      previousServers = rawServers;
    }
  }

  logger.info(
    `[PrecomputedState] ${slots.length}개 슬롯 빌드 완료 (OTel=${otelCount}h, Prometheus=${promCount}h)`
  );
  return slots;
}

// ============================================================================
// Runtime Cache & Lookup
// ============================================================================

let _cachedSlots: PrecomputedSlot[] | null = null;

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
        console.log(`[PrecomputedState] Pre-built JSON 로드: ${filePath} (${slots.length}개 슬롯)`);
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
    // 1. Pre-built JSON 시도 (빠른 cold start)
    _cachedSlots = loadPrebuiltStates();

    // 2. 없으면 런타임 빌드 (fallback)
    if (!_cachedSlots) {
      console.log('[PrecomputedState] Pre-built 없음, 런타임 빌드 시작...');
      _cachedSlots = buildPrecomputedStates();
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
          const priorityOrder: Record<string, number> = { error: 0, warn: 1, info: 2 };
          logs.sort((a, b) => (priorityOrder[a.level] ?? 2) - (priorityOrder[b.level] ?? 2));
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
  return slots[index] || slots[0];
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

  const critical = state.alerts
    .filter((a) => a.severity === 'critical')
    .slice(0, 3)
    .map((a) => ({
      server: a.serverId,
      issue: `${a.metric.toUpperCase()} ${a.value}%${a.trend === 'up' ? '↑' : a.trend === 'down' ? '↓' : ''}`,
    }));

  const warning = state.alerts
    .filter((a) => a.severity === 'warning')
    .slice(0, 3)
    .map((a) => ({
      server: a.serverId,
      issue: `${a.metric.toUpperCase()} ${a.value}%`,
    }));

  const patterns = state.activePatterns.map(
    (p) => `${p.metric.toUpperCase()} ${p.pattern} (${p.severity})`
  );

  const serverRoles = state.servers.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
  }));

  return {
    date: state.dateLabel,
    time: state.timeLabel,
    timestamp: state.fullTimestamp,
    summary: `${state.summary.total}서버: ${state.summary.healthy} healthy, ${state.summary.warning} warning, ${state.summary.critical} critical${state.summary.offline ? `, ${state.summary.offline} offline` : ''}`,
    critical,
    warning,
    patterns,
    thresholds: {
      cpu: { warning: THRESHOLDS.cpu.warning, critical: THRESHOLDS.cpu.critical },
      memory: { warning: THRESHOLDS.memory.warning, critical: THRESHOLDS.memory.critical },
      disk: { warning: THRESHOLDS.disk.warning, critical: THRESHOLDS.disk.critical },
      network: { warning: THRESHOLDS.network.warning, critical: THRESHOLDS.network.critical },
    },
    serverRoles,
  };
}

/**
 * LLM용 텍스트 요약 (최소 토큰, 날짜 포함)
 */
export function getTextSummary(): string {
  const ctx = getCompactContext();
  let text = `[${ctx.date} ${ctx.time}] ${ctx.summary}`;

  if (ctx.critical.length > 0) {
    text += `\nCritical: ${ctx.critical.map((c) => `${c.server}(${c.issue})`).join(', ')}`;
  }
  if (ctx.warning.length > 0) {
    text += `\nWarning: ${ctx.warning.map((w) => `${w.server}(${w.issue})`).join(', ')}`;
  }

  return text;
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
  console.log('[PrecomputedState] 캐시 초기화됨');
}

/**
 * JSON 파일로 내보내기 (빌드 타임용)
 */
export function exportToJson(outputPath: string): void {
  const slots = buildPrecomputedStates();
  writeFileSync(outputPath, JSON.stringify(slots, null, 2), 'utf-8');
  console.log(`[PrecomputedState] ${outputPath}에 내보내기 완료`);
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
  const state = slots[slotIndex] || slots[0];

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
 * precomputed slots에서 24시간 트렌드 요약 생성 (자체 구현)
 */
function buildTrendLLMContext(slots: PrecomputedSlot[]): string {
  if (slots.length === 0) return '';

  const serverTrends = new Map<string, { type: string; cpu: number[]; memory: number[]; disk: number[] }>();
  for (const slot of slots) {
    for (const server of slot.servers) {
      if (!serverTrends.has(server.id)) {
        serverTrends.set(server.id, { type: server.type, cpu: [], memory: [], disk: [] });
      }
      const t = serverTrends.get(server.id)!;
      t.cpu.push(server.cpu);
      t.memory.push(server.memory);
      t.disk.push(server.disk);
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;
  const max = (arr: number[]) => arr.length ? Math.round(Math.max(...arr) * 10) / 10 : 0;

  let context = '## 24시간 서버 트렌드 요약\n';
  for (const [serverId, metrics] of serverTrends) {
    context += `- ${serverId} (${metrics.type}): CPU avg ${avg(metrics.cpu)}%/max ${max(metrics.cpu)}%, Mem avg ${avg(metrics.memory)}%/max ${max(metrics.memory)}%, Disk avg ${avg(metrics.disk)}%/max ${max(metrics.disk)}%\n`;
  }
  return context;
}

/**
 * 🎯 LLM 시스템 프롬프트용 서버 상태 컨텍스트
 * 기존 loadHourlyScenarioData() 대신 사용 권장
 *
 * @returns 최소 토큰으로 압축된 현재 상태 (날짜 포함)
 */
export function getLLMContext(): string {
  const state = getStateAtRelativeTime(0);
  const { summary, alerts, dateLabel, timeLabel } = state;

  // 헤더 (날짜 포함)
  let context = `## 현재 서버 상태 [${dateLabel} ${timeLabel} KST]\n`;
  context += `총 ${summary.total}대: ✓${summary.healthy}정상 ⚠${summary.warning}경고 ✗${summary.critical}위험${summary.offline ? ` ⛔${summary.offline}오프라인` : ''}\n`;
  context += `임계값: CPU ${THRESHOLDS.cpu.warning}%/${THRESHOLDS.cpu.critical}%, Memory ${THRESHOLDS.memory.warning}%/${THRESHOLDS.memory.critical}%, Disk ${THRESHOLDS.disk.warning}%/${THRESHOLDS.disk.critical}%\n\n`;

  // 서버 역할별 현황
  const typeGroups = new Map<string, { total: number; warning: number; critical: number; offline: number }>();
  for (const server of state.servers) {
    const group = typeGroups.get(server.type) ?? { total: 0, warning: 0, critical: 0, offline: 0 };
    group.total++;
    if (server.status === 'warning') group.warning++;
    if (server.status === 'critical') group.critical++;
    if (server.status === 'offline') group.offline++;
    typeGroups.set(server.type, group);
  }
  context += `### 서버 역할별 현황\n`;
  for (const [type, group] of typeGroups) {
    const statusNote = group.offline > 0 ? ` (⛔${group.offline})` : group.critical > 0 ? ` (✗${group.critical})` : group.warning > 0 ? ` (⚠${group.warning})` : '';
    context += `- ${type}: ${group.total}대${statusNote}\n`;
  }
  context += '\n';

  // Critical 알림
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  if (criticalAlerts.length > 0) {
    context += `### Critical 알림\n`;
    for (const alert of criticalAlerts.slice(0, 5)) {
      const trend = alert.trend === 'up' ? '↑' : alert.trend === 'down' ? '↓' : '';
      context += `- ${alert.serverId}: ${alert.metric.toUpperCase()} ${alert.value}%${trend}\n`;
    }
    context += '\n';
  }

  // Warning 알림 (상위 5개만)
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  if (warningAlerts.length > 0) {
    context += `### Warning 알림\n`;
    for (const alert of warningAlerts.slice(0, 5)) {
      context += `- ${alert.serverId}: ${alert.metric.toUpperCase()} ${alert.value}%\n`;
    }
    context += '\n';
  }

  // 🆕 에러 로그 요약 (전체 서버)
  if (state.serverLogs) {
    const errorLogs: Array<{ serverId: string; log: GeneratedLog }> = [];
    for (const [sid, logs] of Object.entries(state.serverLogs)) {
      for (const log of logs) {
        if (log.level === 'error') {
          errorLogs.push({ serverId: sid, log });
        }
      }
    }
    if (errorLogs.length > 0) {
      context += `### 에러 로그 (상위 ${Math.min(errorLogs.length, 5)}건)\n`;
      for (const entry of errorLogs.slice(0, 5)) {
        context += `- ${entry.serverId} [${entry.log.source}]: ${entry.log.message}\n`;
      }
      context += '\n';
    }
  }

  // 🆕 Load Average 현황 (높은 부하 서버만)
  const highLoadServers = state.servers.filter(
    (s) => s.load1 !== undefined && s.cpuCores !== undefined && s.load1 > s.cpuCores * 0.7
  );
  if (highLoadServers.length > 0) {
    context += `\n### Load Average (높은 부하)\n`;
    for (const server of highLoadServers.slice(0, 5)) {
      const loadRatio = server.cpuCores ? (server.load1! / server.cpuCores * 100).toFixed(0) : '-';
      context += `- ${server.id}: ${server.load1?.toFixed(2)}/${server.cpuCores}cores (${loadRatio}%)\n`;
    }
  }

  // 🆕 최근 재시작 서버 (7일 이내)
  const now = Date.now() / 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;
  const recentlyRestarted = state.servers.filter(
    (s) => s.bootTimeSeconds !== undefined && s.bootTimeSeconds > sevenDaysAgo
  );
  if (recentlyRestarted.length > 0) {
    context += `\n### 최근 재시작 (7일 이내)\n`;
    for (const server of recentlyRestarted.slice(0, 5)) {
      const uptimeDays = ((now - server.bootTimeSeconds!) / 86400).toFixed(1);
      context += `- ${server.id}: ${uptimeDays}일 전 재시작\n`;
    }
  }

  // 🆕 Response Time 이상 (2초 이상)
  const slowServers = state.servers.filter(
    (s) => s.responseTimeMs !== undefined && s.responseTimeMs >= 2000
  );
  if (slowServers.length > 0) {
    context += `\n### 응답 지연 (≥2초)\n`;
    for (const server of slowServers.slice(0, 5)) {
      const severity = server.responseTimeMs! >= 5000 ? '🔴' : '🟠';
      context += `- ${server.id}: ${(server.responseTimeMs! / 1000).toFixed(1)}초 ${severity}\n`;
    }
  }

  // 24시간 트렌드 요약 추가 (precomputed slots에서 직접 계산)
  context += '\n' + buildTrendLLMContext(getSlots());

  return context;
}

/**
 * 🎯 특정 서버의 LLM 컨텍스트 (확장 메트릭 포함)
 */
export function getServerLLMContext(serverId: string): string {
  const state = getCurrentState();
  const server = state.servers.find((s) => s.id === serverId);
  const alerts = state.alerts.filter((a) => a.serverId === serverId);

  if (!server) {
    return `서버 ${serverId}를 찾을 수 없습니다.`;
  }

  let context = `## ${server.name} (${server.id})\n`;
  context += `상태: ${server.status.toUpperCase()}\n`;
  context += `메트릭: CPU ${server.cpu}% | Memory ${server.memory}% | Disk ${server.disk}% | Network ${server.network}%\n`;

  // 확장 메트릭
  const extendedMetrics: string[] = [];
  if (server.load1 !== undefined && server.cpuCores) {
    extendedMetrics.push(`Load: ${server.load1.toFixed(2)}/${server.cpuCores}cores`);
  }
  if (server.bootTimeSeconds !== undefined) {
    const uptimeDays = ((Date.now() / 1000 - server.bootTimeSeconds) / 86400).toFixed(1);
    extendedMetrics.push(`Uptime: ${uptimeDays}일`);
  }
  if (server.responseTimeMs !== undefined) {
    extendedMetrics.push(`Response: ${server.responseTimeMs}ms`);
  }
  if (extendedMetrics.length > 0) {
    context += `확장: ${extendedMetrics.join(' | ')}\n`;
  }

  if (alerts.length > 0) {
    context += `\n알림:\n`;
    for (const alert of alerts) {
      const trend = alert.trend === 'up' ? '↑' : alert.trend === 'down' ? '↓' : '';
      context += `- ${alert.metric.toUpperCase()} ${alert.value}%${trend} (임계: ${alert.threshold}%)\n`;
    }
  }

  // 최근 로그 요약
  const logs = state.serverLogs?.[serverId];
  if (logs && logs.length > 0) {
    const errorCount = logs.filter((l) => l.level === 'error').length;
    const warnCount = logs.filter((l) => l.level === 'warn').length;
    context += `\n### 최근 로그\n`;
    context += `에러: ${errorCount}건, 경고: ${warnCount}건\n`;
    for (const log of logs.slice(0, 3)) {
      context += `- [${log.level.toUpperCase()}] ${log.source}: ${log.message}\n`;
    }
  }

  return context;
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
  const state = getStateAtRelativeTime(0);
  return {
    date: state.dateLabel,
    time: state.timeLabel,
    timestamp: state.fullTimestamp,
    summary: state.summary,
    critical: state.alerts.filter((a) => a.severity === 'critical'),
    warning: state.alerts.filter((a) => a.severity === 'warning').slice(0, 10),
  };
}
