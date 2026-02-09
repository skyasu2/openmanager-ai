/**
 * 🎯 MetricsProvider - 단일 데이터 소스 (Single Source of Truth)
 *
 * 역할:
 * - 현재 한국 시간(KST) 기준으로 hourly-data JSON 파일에서 메트릭 제공
 * - Prometheus 포맷 JSON → 내부 ServerMetrics 인터페이스 변환
 * - Cloud Run AI와 동일한 데이터 소스 사용 (데이터 일관성 보장)
 * - 모든 API와 컴포넌트가 이 서비스를 통해 일관된 데이터 접근
 *
 * @updated 2026-02-04 - Prometheus 포맷 전환
 * @updated 2026-01-19 - Vercel 호환성: 번들 기반 loader로 변경 (fs 제거)
 * @updated 2026-01-04 - hourly-data 통합 (AI와 데이터 동기화)
 */

import { getServerStatus as getRulesServerStatus } from '@/config/rules/loader';
import {
  FIXED_24H_DATASETS,
  type Fixed10MinMetric,
  getDataAtMinute,
} from '@/data/fixed-24h-metrics';
import {
  extractServerId,
  getHourlyData as getBundledHourlyData,
  type HourlyData,
  type PrometheusTarget,
} from '@/data/hourly-data';
import { logger } from '@/lib/logging';

// ============================================================================
// Hourly Data Cache & Loader (번들 기반 - Vercel 호환)
// ============================================================================

let cachedHourlyData: { hour: number; data: HourlyData } | null = null;

/**
 * hourly-data 로드 (번들 기반)
 * @description fs 대신 빌드 시 번들에 포함된 데이터 사용 - Vercel Serverless 호환
 */
function loadHourlyData(hour: number): HourlyData | null {
  // 캐시 히트
  if (cachedHourlyData?.hour === hour) {
    return cachedHourlyData.data;
  }

  // 번들에서 로드 (fs 불필요)
  const data = getBundledHourlyData(hour);
  if (data) {
    cachedHourlyData = { hour, data };
    const targetCount = Object.keys(data.dataPoints[0]?.targets || {}).length;
    logger.info(
      `[MetricsProvider] hourly-data 로드: hour-${hour.toString().padStart(2, '0')} (${targetCount}개 target)`
    );
    return data;
  }

  logger.warn(`[MetricsProvider] hourly-data 없음: hour-${hour}`);
  return null;
}

/**
 * 서버 메트릭 (API 응답용) - 내부 인터페이스 (변경 없음)
 */
export interface ServerMetrics {
  serverId: string;
  serverType: string;
  location: string;
  timestamp: string; // ISO 8601
  minuteOfDay: number;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  logs: string[];
  status: 'online' | 'warning' | 'critical' | 'offline';
  /** nodeInfo - Prometheus target에서 추출한 하드웨어 정보 */
  nodeInfo?: {
    cpuCores: number;
    memoryTotalBytes: number;
    diskTotalBytes: number;
  };

  // Prometheus 확장 필드 (optional - 하위호환)
  hostname?: string;
  environment?: string;
  os?: string;
  osVersion?: string;
  loadAvg1?: number;
  loadAvg5?: number;
  bootTimeSeconds?: number;
  procsRunning?: number;
  responseTimeMs?: number;
}

/**
 * 전체 시스템 요약
 */
export interface SystemSummary {
  timestamp: string;
  minuteOfDay: number;
  totalServers: number;
  onlineServers: number;
  warningServers: number;
  criticalServers: number;
  offlineServers: number;
  averageCpu: number;
  averageMemory: number;
  averageDisk: number;
  averageNetwork: number;
}

/**
 * 한국 시간(KST) 기준 현재 minuteOfDay 계산
 */
export function getKSTMinuteOfDay(): number {
  const now = new Date();
  // UTC + 9시간 = KST
  const kstOffset = 9 * 60; // 분 단위
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + kstOffset) % 1440; // 1440 = 24시간

  // 10분 단위로 반올림
  return Math.floor(kstMinutes / 10) * 10;
}

/**
 * 현재 KST 타임스탬프 생성 (ISO 8601 형식)
 *
 * @returns ISO 8601 문자열 (예: "2026-02-06T19:30:45.123+09:00")
 *
 * @note toISOString()은 항상 UTC 시간을 반환하므로 수동 포맷팅 필요
 * @see getKSTDateTime() 유사한 로직 사용
 */
export function getKSTTimestamp(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간 (ms)
  const kstDate = new Date(now.getTime() + kstOffset);

  // 수동 포맷팅 (toISOString()은 UTC 기준이므로 사용하지 않음)
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getUTCSeconds()).padStart(2, '0');
  const ms = String(kstDate.getUTCMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+09:00`;
}

// ============================================================================
// Date/Time Calculation (24시간 순환 + 실제 날짜)
// ============================================================================

/**
 * 현재 KST 날짜/시간 정보 반환
 */
export function getKSTDateTime(): {
  date: string;
  time: string;
  slotIndex: number;
  minuteOfDay: number;
} {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간 (ms)
  const kstDate = new Date(now.getTime() + kstOffset);

  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(
    Math.floor(kstDate.getUTCMinutes() / 10) * 10
  ).padStart(2, '0');

  const minuteOfDay =
    kstDate.getUTCHours() * 60 + Math.floor(kstDate.getUTCMinutes() / 10) * 10;
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
 */
export function calculateRelativeDateTime(minutesAgo: number): {
  date: string;
  time: string;
  slotIndex: number;
  timestamp: string;
  isYesterday: boolean;
} {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const targetTime = new Date(
    now.getTime() + kstOffset - minutesAgo * 60 * 1000
  );
  const currentKST = new Date(now.getTime() + kstOffset);

  const year = targetTime.getUTCFullYear();
  const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetTime.getUTCDate()).padStart(2, '0');
  const hours = String(targetTime.getUTCHours()).padStart(2, '0');
  const mins = Math.floor(targetTime.getUTCMinutes() / 10) * 10;
  const minutes = String(mins).padStart(2, '0');

  const minuteOfDay = targetTime.getUTCHours() * 60 + mins;
  const slotIndex = Math.floor(minuteOfDay / 10);

  // 오늘/어제 판별
  const currentDay = String(currentKST.getUTCDate()).padStart(2, '0');
  const isYesterday = day !== currentDay;

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    slotIndex,
    timestamp: `${year}-${month}-${day}T${hours}:${minutes}:00+09:00`,
    isYesterday,
  };
}

/**
 * PrometheusTarget → ServerMetrics 변환
 */
function targetToServerMetrics(
  target: PrometheusTarget,
  timestamp: string,
  minuteOfDay: number
): ServerMetrics {
  const serverId = extractServerId(target.instance);
  const cpu = target.metrics.node_cpu_usage_percent;
  const memory = target.metrics.node_memory_usage_percent;
  const disk = target.metrics.node_filesystem_usage_percent;
  const network = target.metrics.node_network_transmit_bytes_rate;

  // up=0일 때도 메트릭 기반 상태를 먼저 평가하여 critical 정보 보존
  const metricsStatus = determineStatus(cpu, memory, disk, network);
  let status: ServerMetrics['status'];
  if (target.metrics.up === 0) {
    // 서버 다운 직전 critical/warning 상태였으면 해당 상태 유지 (진단 정보 보존)
    status = metricsStatus === 'critical' ? 'critical' : 'offline';
    if (metricsStatus === 'critical' || metricsStatus === 'warning') {
      logger.warn(
        `[MetricsProvider] ${serverId}: up=0 but metrics indicate ${metricsStatus} (cpu=${cpu}%, mem=${memory}%)`
      );
    }
  } else {
    status = metricsStatus;
  }

  return {
    serverId,
    serverType: target.labels.server_type,
    location: target.labels.datacenter,
    timestamp,
    minuteOfDay,
    cpu,
    memory,
    disk,
    network,
    logs: target.logs || [],
    status,
    nodeInfo: target.nodeInfo
      ? {
          cpuCores: target.nodeInfo.cpu_cores,
          memoryTotalBytes: target.nodeInfo.memory_total_bytes,
          diskTotalBytes: target.nodeInfo.disk_total_bytes,
        }
      : undefined,
    // Prometheus 확장 매핑
    hostname: target.labels.hostname,
    environment: target.labels.environment,
    os: target.labels.os,
    osVersion: target.labels.os_version,
    loadAvg1: target.metrics.node_load1,
    loadAvg5: target.metrics.node_load5,
    bootTimeSeconds: target.metrics.node_boot_time_seconds,
    procsRunning: target.metrics.node_procs_running,
    responseTimeMs: target.metrics.node_http_request_duration_milliseconds,
  };
}

/**
 * 🎯 상대 시간 기준 메트릭 조회 (날짜 포함)
 * @param serverId 서버 ID
 * @param minutesAgo 몇 분 전 (0 = 현재)
 */
export function getMetricsAtRelativeTime(
  serverId: string,
  minutesAgo: number = 0
): (ServerMetrics & { dateLabel: string; isYesterday: boolean }) | null {
  const { date, slotIndex, timestamp, isYesterday } =
    calculateRelativeDateTime(minutesAgo);
  const minuteOfDay = slotIndex * 10;

  // fixed-24h-metrics에서 조회
  const dataset = FIXED_24H_DATASETS.find((d) => d.serverId === serverId);
  if (!dataset) return null;

  const dataPoint = getDataAtMinute(dataset, minuteOfDay);
  if (!dataPoint) return null;

  return {
    serverId: dataset.serverId,
    serverType: dataset.serverType,
    location: dataset.location,
    timestamp,
    minuteOfDay,
    cpu: dataPoint.cpu,
    memory: dataPoint.memory,
    disk: dataPoint.disk,
    network: dataPoint.network,
    logs: dataPoint.logs,
    status: determineStatus(
      dataPoint.cpu,
      dataPoint.memory,
      dataPoint.disk,
      dataPoint.network
    ),
    dateLabel: isYesterday ? `${date} (어제)` : date,
    isYesterday,
  };
}

/**
 * 🎯 시간 비교 결과 (현재 vs N분 전)
 */
export interface TimeComparisonResult {
  current: {
    timestamp: string;
    date: string;
    metrics: ServerMetrics;
  };
  past: {
    timestamp: string;
    date: string;
    metrics: ServerMetrics;
  };
  delta: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

/**
 * 🎯 서버 메트릭 시간 비교
 */
export function compareServerMetrics(
  serverId: string,
  minutesAgo: number
): TimeComparisonResult | null {
  const current = getMetricsAtRelativeTime(serverId, 0);
  const past = getMetricsAtRelativeTime(serverId, minutesAgo);

  if (!current || !past) return null;

  return {
    current: {
      timestamp: current.timestamp,
      date: current.dateLabel,
      metrics: current,
    },
    past: {
      timestamp: past.timestamp,
      date: past.dateLabel,
      metrics: past,
    },
    delta: {
      cpu: Math.round((current.cpu - past.cpu) * 10) / 10,
      memory: Math.round((current.memory - past.memory) * 10) / 10,
      disk: Math.round((current.disk - past.disk) * 10) / 10,
      network: Math.round((current.network - past.network) * 10) / 10,
    },
  };
}

/**
 * 메트릭 값 기반 서버 상태 판별
 * @see /src/config/rules/system-rules.json (Single Source of Truth)
 * @see /src/config/rules/loader.ts (rulesLoader.getServerStatus)
 */
function determineStatus(
  cpu: number,
  memory: number,
  disk: number,
  network: number
): 'online' | 'warning' | 'critical' | 'offline' {
  return getRulesServerStatus({ cpu, memory, disk, network });
}

/**
 * 🎯 MetricsProvider 클래스
 * Singleton 패턴으로 구현하여 일관된 데이터 제공
 */
export class MetricsProvider {
  private static instance: MetricsProvider;

  private constructor() {}

  public static getInstance(): MetricsProvider {
    if (!MetricsProvider.instance) {
      MetricsProvider.instance = new MetricsProvider();
    }
    return MetricsProvider.instance;
  }

  /** 테스트 격리용: 싱글톤 인스턴스 및 캐시 리셋 */
  static resetForTesting(): void {
    if (process.env.NODE_ENV !== 'test') return;
    // @ts-expect-error -- 테스트 격리를 위한 의도적 리셋
    MetricsProvider.instance = undefined;
    cachedHourlyData = null;
  }

  /**
   * 현재 시간 기준 단일 서버 메트릭 조회
   * Prometheus 포맷 JSON에서 변환
   */
  public getServerMetrics(serverId: string): ServerMetrics | null {
    const minuteOfDay = getKSTMinuteOfDay();
    const timestamp = getKSTTimestamp();
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;

    // hourly-data에서 찾기 시도
    const hourlyData = loadHourlyData(hour);
    if (hourlyData) {
      const slotIndex = Math.floor(minute / 10);
      const dataPoint = hourlyData.dataPoints[slotIndex];

      if (!dataPoint) {
        logger.warn(
          `[MetricsProvider] slot ${slotIndex} not found for hour-${hour}, using fallback`
        );
      }

      if (dataPoint?.targets) {
        // Prometheus instance 키: "serverId:9100"
        const instanceKey = `${serverId}:9100`;
        const target = dataPoint.targets[instanceKey];
        if (target) {
          return targetToServerMetrics(target, timestamp, minuteOfDay);
        }
      }
    }

    // fallback: fixed data에서 찾기
    const dataset = FIXED_24H_DATASETS.find((d) => d.serverId === serverId);
    if (!dataset) return null;

    const dataPoint = getDataAtMinute(dataset, minuteOfDay);
    if (!dataPoint) return null;

    return {
      serverId: dataset.serverId,
      serverType: dataset.serverType,
      location: dataset.location,
      timestamp,
      minuteOfDay,
      cpu: dataPoint.cpu,
      memory: dataPoint.memory,
      disk: dataPoint.disk,
      network: dataPoint.network,
      logs: dataPoint.logs,
      status: determineStatus(
        dataPoint.cpu,
        dataPoint.memory,
        dataPoint.disk,
        dataPoint.network
      ),
    };
  }

  /**
   * 현재 시간 기준 모든 서버 메트릭 조회
   * Prometheus 포맷 JSON에서 변환
   */
  public getAllServerMetrics(): ServerMetrics[] {
    const minuteOfDay = getKSTMinuteOfDay();
    const timestamp = getKSTTimestamp();
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;

    // hourly-data 로드 시도
    const hourlyData = loadHourlyData(hour);
    if (hourlyData) {
      const slotIndex = Math.floor(minute / 10);
      const dataPoint = hourlyData.dataPoints[slotIndex];

      if (!dataPoint) {
        logger.warn(
          `[MetricsProvider] slot ${slotIndex} not found for hour-${hour} in getAllServerMetrics, using fallback`
        );
      }

      if (dataPoint?.targets) {
        return Object.values(dataPoint.targets).map((target) =>
          targetToServerMetrics(target, timestamp, minuteOfDay)
        );
      }
    }

    // fallback: 기존 fixed-24h-metrics 사용
    logger.warn(
      '[MetricsProvider] hourly-data 로드 실패, fallback to fixed data'
    );
    return FIXED_24H_DATASETS.map((dataset) => {
      const dataPoint = getDataAtMinute(dataset, minuteOfDay);
      if (!dataPoint) {
        return {
          serverId: dataset.serverId,
          serverType: dataset.serverType,
          location: dataset.location,
          timestamp,
          minuteOfDay,
          cpu: dataset.baseline.cpu,
          memory: dataset.baseline.memory,
          disk: dataset.baseline.disk,
          network: dataset.baseline.network,
          logs: [],
          status: 'online' as const,
        };
      }

      return {
        serverId: dataset.serverId,
        serverType: dataset.serverType,
        location: dataset.location,
        timestamp,
        minuteOfDay,
        cpu: dataPoint.cpu,
        memory: dataPoint.memory,
        disk: dataPoint.disk,
        network: dataPoint.network,
        logs: dataPoint.logs,
        status: determineStatus(
          dataPoint.cpu,
          dataPoint.memory,
          dataPoint.disk,
          dataPoint.network
        ),
      };
    });
  }

  /**
   * 시스템 전체 요약 정보
   */
  public getSystemSummary(): SystemSummary {
    const minuteOfDay = getKSTMinuteOfDay();
    const allMetrics = this.getAllServerMetrics();

    const statusCounts = allMetrics.reduce(
      (acc, m) => {
        acc[m.status]++;
        return acc;
      },
      { online: 0, warning: 0, critical: 0, offline: 0 }
    );

    // offline 서버(metrics=0)를 평균 계산에서 제외하여 왜곡 방지
    const onlineMetrics = allMetrics.filter((m) => m.status !== 'offline');
    const count = onlineMetrics.length || 1;
    const avgCpu =
      Math.round(
        (onlineMetrics.reduce((sum, m) => sum + m.cpu, 0) / count) * 10
      ) / 10;
    const avgMemory =
      Math.round(
        (onlineMetrics.reduce((sum, m) => sum + m.memory, 0) / count) * 10
      ) / 10;
    const avgDisk =
      Math.round(
        (onlineMetrics.reduce((sum, m) => sum + m.disk, 0) / count) * 10
      ) / 10;
    const avgNetwork =
      Math.round(
        (onlineMetrics.reduce((sum, m) => sum + m.network, 0) / count) * 10
      ) / 10;

    return {
      timestamp: getKSTTimestamp(),
      minuteOfDay,
      totalServers: allMetrics.length,
      onlineServers: statusCounts.online,
      warningServers: statusCounts.warning,
      criticalServers: statusCounts.critical,
      offlineServers: statusCounts.offline,
      averageCpu: avgCpu,
      averageMemory: avgMemory,
      averageDisk: avgDisk,
      averageNetwork: avgNetwork,
    };
  }

  /**
   * 경고/위험 상태 서버만 반환 (AI 컨텍스트 주입용)
   */
  public getAlertServers(): Array<{
    serverId: string;
    cpu: number;
    memory: number;
    disk: number;
    status: string;
  }> {
    const allMetrics = this.getAllServerMetrics();
    return allMetrics
      .filter(
        (s) =>
          s.status === 'warning' ||
          s.status === 'critical' ||
          s.status === 'offline'
      )
      .map((s) => ({
        serverId: s.serverId,
        cpu: s.cpu,
        memory: s.memory,
        disk: s.disk,
        status: s.status,
      }));
  }

  /**
   * 특정 시간대 메트릭 조회 (히스토리용)
   */
  public getMetricsAtTime(
    serverId: string,
    minuteOfDay: number
  ): Fixed10MinMetric | null {
    const dataset = FIXED_24H_DATASETS.find((d) => d.serverId === serverId);
    if (!dataset) return null;

    return getDataAtMinute(dataset, minuteOfDay) || null;
  }

  /**
   * 서버 목록 조회
   */
  public getServerList(): Array<{
    serverId: string;
    serverType: string;
    location: string;
  }> {
    return FIXED_24H_DATASETS.map((d) => ({
      serverId: d.serverId,
      serverType: d.serverType,
      location: d.location,
    }));
  }

  /**
   * 디버그용: 현재 시간 정보
   */
  public getTimeInfo(): {
    kstTime: string;
    minuteOfDay: number;
    slotIndex: number;
    humanReadable: string;
  } {
    const minuteOfDay = getKSTMinuteOfDay();
    const hours = Math.floor(minuteOfDay / 60);
    const minutes = minuteOfDay % 60;

    return {
      kstTime: getKSTTimestamp(),
      minuteOfDay,
      slotIndex: minuteOfDay / 10,
      humanReadable: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} KST`,
    };
  }
}

// 편의를 위한 싱글톤 인스턴스 export
export const metricsProvider = MetricsProvider.getInstance();
