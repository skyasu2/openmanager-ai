/**
 * 🎯 MetricsProvider - 단일 데이터 소스 (Single Source of Truth)
 *
 * 역할:
 * - 현재 한국 시간(KST) 기준으로 OTel Standard 데이터에서 메트릭 제공
 * - OTLP Standard Format → 내부 ServerMetrics 인터페이스 변환
 * - Cloud Run AI와 동일한 데이터 소스 사용 (데이터 일관성 보장)
 * - 모든 API와 컴포넌트가 이 서비스를 통해 일관된 데이터 접근
 *
 * @updated 2026-02-15 - Prometheus fallback 제거, OTel-only
 * @updated 2026-02-12 - OTLP Standard Format 적용
 * @updated 2026-02-10 - SRP 분리 (kst-time, types, time-comparison)
 */

import { getOTelHourlyData } from '@/data/otel-metrics';
import { logger } from '@/lib/logging';
import type { ExportMetricsServiceRequest } from '@/types/otel-standard';
import { getKSTMinuteOfDay, getKSTTimestamp } from './kst-time';
import { extractMetricsFromStandard } from './metric-transformers';
import type { ApiServerMetrics, SystemSummary } from './types';

export {
  calculateRelativeDateTime,
  getKSTDateTime,
  getKSTMinuteOfDay,
  getKSTTimestamp,
} from './kst-time';
export {
  compareServerMetrics,
  getMetricsAtRelativeTime,
} from './time-comparison';
// Re-export for backward compatibility
export type {
  ApiServerMetrics,
  ApiServerMetrics as ServerMetrics,
  SystemSummary,
  TimeComparisonResult,
} from './types';

// ============================================================================
// OTel Data Cache & Loader (번들 기반)
// ============================================================================

let cachedOTelData: { hour: number; data: ExportMetricsServiceRequest } | null =
  null;

// OTel→ServerMetrics 변환 캐시 (동일 hour+minute 내 재변환 방지)
let cachedOTelConversion: {
  hour: number;
  minute: number;
  metrics: ApiServerMetrics[];
} | null = null;

/**
 * OTel 사전 계산 데이터 로드
 * @description 빌드 타임에 OTel SDK로 처리된 데이터 사용
 */
function loadOTelData(hour: number): ExportMetricsServiceRequest | null {
  if (cachedOTelData?.hour === hour) {
    return cachedOTelData.data;
  }

  const data = getOTelHourlyData(hour);
  if (data) {
    cachedOTelData = { hour, data };
    logger.debug(
      `[MetricsProvider] OTel 데이터 로드: hour-${hour.toString().padStart(2, '0')} (${data.resourceMetrics.length}개 Resources)`
    );
    return data;
  }

  return null;
}

// ============================================================================
// MetricsProvider Class (Singleton)
// ============================================================================

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
    MetricsProvider.instance = undefined as unknown as MetricsProvider;
    cachedOTelData = null;
    cachedOTelConversion = null;
    MetricsProvider.cachedServerList = null;
  }

  /**
   * 현재 시간 기준 단일 서버 메트릭 조회
   * OTel Standard 데이터 사용
   */
  public getServerMetrics(serverId: string): ApiServerMetrics | null {
    const minuteOfDay = getKSTMinuteOfDay();
    const timestamp = getKSTTimestamp();
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;

    const otelData = loadOTelData(hour);
    if (otelData) {
      let allMetrics: ApiServerMetrics[];
      if (
        cachedOTelConversion?.hour === hour &&
        cachedOTelConversion.minute === minute
      ) {
        allMetrics = cachedOTelConversion.metrics;
      } else {
        allMetrics = extractMetricsFromStandard(
          otelData,
          timestamp,
          minuteOfDay
        );
        cachedOTelConversion = { hour, minute, metrics: allMetrics };
      }
      const found = allMetrics.find((m) => m.serverId === serverId);
      if (found) {
        return found;
      }
    }

    logger.warn(
      `[MetricsProvider] OTel 데이터에서 서버 ${serverId}을(를) 찾을 수 없음 (hour=${hour})`
    );
    return null;
  }

  /**
   * 현재 시간 기준 모든 서버 메트릭 조회
   * OTel Standard 데이터 사용
   */
  public getAllServerMetrics(): ApiServerMetrics[] {
    const minuteOfDay = getKSTMinuteOfDay();
    const timestamp = getKSTTimestamp();
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;

    const otelData = loadOTelData(hour);
    if (otelData) {
      if (
        cachedOTelConversion?.hour === hour &&
        cachedOTelConversion.minute === minute
      ) {
        return cachedOTelConversion.metrics;
      }
      const metrics = extractMetricsFromStandard(
        otelData,
        timestamp,
        minuteOfDay
      );
      cachedOTelConversion = { hour, minute, metrics };
      return metrics;
    }

    logger.error('[MetricsProvider] OTel 데이터 로드 실패, 빈 배열 반환');
    return [];
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
   * OTel Standard 데이터 사용
   */
  public getMetricsAtTime(
    serverId: string,
    minuteOfDay: number
  ): ApiServerMetrics | null {
    if (minuteOfDay < 0 || minuteOfDay >= 1440) {
      return null;
    }

    const hour = Math.floor(minuteOfDay / 60);
    const timestamp = getKSTTimestamp();

    const otelData = loadOTelData(hour);
    if (otelData) {
      const metrics = extractMetricsFromStandard(
        otelData,
        timestamp,
        minuteOfDay
      );
      const found = metrics.find((m) => m.serverId === serverId);
      if (found) return found;
    }

    return null;
  }

  // Server List 캐시
  private static cachedServerList: Array<{
    serverId: string;
    serverType: string;
    location: string;
  }> | null = null;
  /**
   * 서버 목록 조회 (OTel Standard Resource 기반)
   * 캐싱 적용으로 성능 최적화 (O(N) -> O(1))
   */
  public getServerList(): Array<{
    serverId: string;
    serverType: string;
    location: string;
  }> {
    if (MetricsProvider.cachedServerList) {
      return MetricsProvider.cachedServerList;
    }

    // 0시 데이터를 로드하여 리소스 목록 추출 (가장 확실한 방법)
    const data = loadOTelData(0);
    if (!data) return [];

    const servers: Array<{
      serverId: string;
      serverType: string;
      location: string;
    }> = [];

    for (const resMetric of data.resourceMetrics) {
      const getAttr = (k: string) =>
        resMetric.resource.attributes.find((a) => a.key === k)?.value
          .stringValue;

      const hostname = getAttr('host.name');
      if (!hostname) continue;

      const serverId = hostname.split('.')[0];
      if (!serverId) continue;

      servers.push({
        serverId,
        serverType: getAttr('host.type') ?? 'unknown',
        location: getAttr('cloud.availability_zone') ?? 'unknown',
      });
    }

    MetricsProvider.cachedServerList = servers;
    return servers;
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
      slotIndex: Math.floor(minutes / 10),
      humanReadable: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} KST`,
    };
  }
}

// 편의를 위한 싱글톤 인스턴스 export
export const metricsProvider = MetricsProvider.getInstance();
