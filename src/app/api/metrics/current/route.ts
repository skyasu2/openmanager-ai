/**
 * 🎯 통합 메트릭 API - 모니터링과 AI 어시스턴트 데이터 일관성 보장
 *
 * 기능:
 * - 1분 단위 시간 정규화로 데이터 일치성 보장
 * - 24시간 순환 시스템
 * - 10분 기준점 + FNV-1a 보간
 * - 모니터링과 AI 어시스턴트 공통 사용
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getSystemConfig } from '@/config/SystemConfiguration';
import { logger } from '@/lib/logging';
import { getErrorMessage } from '@/types/type-utils';
import { getUnifiedServerDataSource } from '@/services/data/UnifiedServerDataSource';
import {
  fnv1aHash,
  generateCycleBasedMetric,
  generateCycleScenarios,
  get24HourCycle,
  getBaseline10MinSlot,
  getIncidentCycleInfo,
  interpolate1MinVariation,
  normalizeTimestamp,
} from '@/services/metrics/cycle-engine';
import type { EnhancedServerMetrics, ServerRole } from '@/types/server';

// 🚀 통합 서버 메트릭 생성 (6개 사이클 기반)
async function generateUnifiedServerMetrics(
  normalizedTimestamp: number
): Promise<EnhancedServerMetrics[]> {
  const cycleTime = get24HourCycle(normalizedTimestamp);
  const slot = getBaseline10MinSlot(cycleTime);
  const hour = Math.floor((slot * 10) / 60);
  const minute = Math.floor((slot * 10) % 60);

  // 현재 시간의 사이클 정보 계산
  const cycleInfo = getIncidentCycleInfo(hour, minute);

  // 🎯 통합 데이터 소스에서 서버 정보 가져오기 (중앙집중식 관리)
  const dataSource = getUnifiedServerDataSource();
  const servers = await dataSource.getServers();

  return servers.map((serverInfo) => {
    const serverId = serverInfo.id;
    // 6개 사이클 기반 메트릭 생성
    const cpuBaseline = generateCycleBasedMetric(
      serverId,
      'cpu',
      slot,
      cycleInfo
    );
    const memoryBaseline = generateCycleBasedMetric(
      serverId,
      'memory',
      slot,
      cycleInfo
    );
    const diskBaseline = generateCycleBasedMetric(
      serverId,
      'disk',
      slot,
      cycleInfo
    );
    const networkBaseline = generateCycleBasedMetric(
      serverId,
      'network',
      slot,
      cycleInfo
    );

    // 1분 보간값들 (자연스러운 변동)
    const cpu = interpolate1MinVariation(
      cpuBaseline,
      normalizedTimestamp,
      serverId,
      'cpu'
    );
    const memory = interpolate1MinVariation(
      memoryBaseline,
      normalizedTimestamp,
      serverId,
      'memory'
    );
    const disk = interpolate1MinVariation(
      diskBaseline,
      normalizedTimestamp,
      serverId,
      'disk'
    );
    const network = interpolate1MinVariation(
      networkBaseline,
      normalizedTimestamp,
      serverId,
      'network'
    );

    // 응답 시간 계산 (CPU 부하와 사이클 영향)
    const baseResponseTime = 50 + (cpu / 100) * 200; // 50-250ms 범위
    const cycleResponseMultiplier = 1 + cycleInfo.intensity * 0.5; // 장애 시 응답시간 증가
    const responseTime =
      baseResponseTime *
      cycleResponseMultiplier *
      (0.8 + fnv1aHash(normalizedTimestamp + serverId.charCodeAt(0)) * 0.4);

    // 📊 메트릭 기반 상태 결정 (hourly-data 원본값 사용 - SSOT 원칙)
    // 인위적 조정 제거: hourly-data에 실제 시나리오 값이 반영되어 있음
    const status =
      cpu > 85 || memory > 90
        ? 'critical'
        : cpu > 70 || memory > 80
          ? 'warning'
          : 'online';

    // 서버 역할 결정
    const serverRole = (serverInfo.role ||
      serverInfo.type ||
      serverId.split('-')[0]) as ServerRole;

    // 현재 사이클 기반 시나리오 생성
    const scenarios = generateCycleScenarios(
      cycleInfo,
      serverId,
      serverRole,
      normalizedTimestamp
    );

    return {
      id: serverId,
      name:
        serverInfo.hostname ||
        serverId
          .replace('-', ' ')
          .replace(/\b\w/g, (l: string) => l.toUpperCase()),
      hostname: serverInfo.hostname || `${serverId}.local`,
      environment: 'production' as const,
      role: serverRole,
      status,

      // Enhanced metrics with required naming (hourly-data 원본값 사용)
      cpu_usage: Math.round(cpu * 10) / 10,
      memory_usage: Math.round(memory * 10) / 10,
      disk_usage: Math.round(disk * 10) / 10,
      network_in: Math.round(network * 10) / 10,
      network_out: Math.round(network * 10) / 10,
      responseTime: Math.round(responseTime),
      uptime: 99.95,
      last_updated: new Date(normalizedTimestamp).toISOString(),
      alerts: scenarios, // 생성된 시나리오를 alerts 배열에 연결

      // Compatibility fields (hourly-data 원본값 사용)
      cpu: Math.round(cpu * 10) / 10,
      memory: Math.round(memory * 10) / 10,
      disk: Math.round(disk * 10) / 10,
      network: Math.round(network * 10) / 10,

      // AI 어시스턴트를 위한 추가 메타데이터
      metadata: {
        serverType: (serverInfo.type || serverId.split('-')[0]) as ServerRole,
        timeSlot: slot,
        hour,
        minute,
        cycleInfo: {
          timeSlot: cycleInfo.timeSlot,
          scenario: cycleInfo.scenario
            ? {
                affectedServers: cycleInfo.scenario.affectedServers,
                name: cycleInfo.scenario.name,
              }
            : undefined,
          phase: cycleInfo.phase,
          intensity: cycleInfo.intensity,
          description: cycleInfo.description,
          expectedResolution: cycleInfo.expectedResolution,
        },
        scenarios: scenarios.map((alert) => ({
          type: serverRole, // Use server role instead of alert type
          severity: alert.severity,
          description: alert.message, // Map message to description
        })),
        baseline: {
          cpu: cpuBaseline,
          memory: memoryBaseline,
          disk: diskBaseline,
          network: networkBaseline,
        },
        // 조정 로직 제거됨 - hourly-data 원본값 사용 (SSOT)
        metrics: {
          cpu: cpu,
          memory: memory,
        },
        initialServerInfo: {
          type: serverInfo.type,
          description: serverInfo.description || 'Server description',
          location: serverInfo.location,
          initialStatus: serverInfo.status,
        },
        isAffectedByCurrentCycle:
          cycleInfo.scenario?.affectedServers.includes(serverId) || false,
      },
    };
  });
}

/**
 * 📊 GET /api/metrics/current
 *
 * 모니터링과 AI 어시스턴트가 공통으로 사용하는 통합 메트릭 API
 */
export async function GET(_request: NextRequest) {
  try {
    const startTime = Date.now();

    // 1분 단위 시간 정규화
    const currentTime = Date.now();
    const normalizedTime = normalizeTimestamp(currentTime);

    // 현재 시간의 사이클 정보
    const cycleTime = get24HourCycle(normalizedTime);
    const slot = getBaseline10MinSlot(cycleTime);
    const hour = Math.floor((slot * 10) / 60);
    const minute = Math.floor((slot * 10) % 60);
    const currentCycleInfo = getIncidentCycleInfo(hour, minute);

    // 통합 서버 메트릭 생성
    const servers = await generateUnifiedServerMetrics(normalizedTime);

    const processingTime = Date.now() - startTime;

    // 응답 데이터
    const response = {
      success: true,
      timestamp: normalizedTime,
      actualTimestamp: currentTime,
      servers,
      metadata: {
        timeInfo: {
          normalized: normalizedTime,
          actual: currentTime,
          cycle24h: cycleTime,
          slot10min: slot,
          hour,
          minute,
          validUntil: normalizedTime + 60000, // 1분 후 만료
        },
        currentCycle: {
          timeSlot: currentCycleInfo.timeSlot,
          scenario: currentCycleInfo.scenario?.name || 'normal',
          description: currentCycleInfo.description,
          phase: currentCycleInfo.phase,
          intensity: currentCycleInfo.intensity,
          progress: Math.round(currentCycleInfo.progress * 100),
          expectedResolution: currentCycleInfo.expectedResolution,
          affectedServers: currentCycleInfo.scenario?.affectedServers || [],
        },
        systemInfo: {
          totalServers: servers.length,
          processingTime,
          dataConsistency: true, // 통합 데이터 소스 보장
          version: 'unified-v3.0-centralized',
          cycleSystemEnabled: true,
          configSource: 'centralized-system',
          dataSourceType: getSystemConfig().mockSystem.dataSource,
        },
      },
    };

    // 📊 REALTIME: 30초 TTL, SWR 비활성화 (실시간 메트릭 최적화)
    // 메트릭은 자주 폴링되므로 SWR 백그라운드 갱신 불필요
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control':
        'public, max-age=0, s-maxage=30, stale-while-revalidate=0',
      'CDN-Cache-Control': 'public, s-maxage=30',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=30',
      'X-Timestamp-Normalized': normalizedTime.toString(),
      'X-Processing-Time': processingTime.toString(),
      'X-Data-Version': 'unified-v1.0',
    });

    return NextResponse.json(response, { headers });
  } catch (error) {
    logger.error('❌ 통합 메트릭 API 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Unified metrics API failed',
        message: getErrorMessage(error),
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

// 📋 API 정보 조회
export function OPTIONS(_request: NextRequest) {
  return NextResponse.json({
    name: 'Unified Metrics API',
    description:
      '6개 시간대 장애-해소 사이클 기반 모니터링과 AI 어시스턴트 데이터 일관성 보장',
    features: [
      '1분 단위 시간 정규화',
      '24시간 순환 시스템',
      '6개 시간대별 장애-해소 사이클',
      '10분 기준점 + FNV-1a 보간',
      '현실적 장애 발생 및 자연 해결 패턴',
      'AI 어시스턴트 시나리오 분석 지원',
      '시간대별 서버 영향도 추적',
    ],
    cycles: [
      {
        slot: 0,
        hours: '0-4시',
        scenario: '백업 사이클',
        focus: '디스크 I/O 과부하',
      },
      {
        slot: 1,
        hours: '4-8시',
        scenario: '유지보수 사이클',
        focus: '패치 및 재시작',
      },
      {
        slot: 2,
        hours: '8-12시',
        scenario: '트래픽 사이클',
        focus: '출근시간 과부하',
      },
      {
        slot: 3,
        hours: '12-16시',
        scenario: '데이터베이스 사이클',
        focus: '점심 주문 폭증',
      },
      {
        slot: 4,
        hours: '16-20시',
        scenario: '네트워크 사이클',
        focus: '파일 다운로드 피크',
      },
      {
        slot: 5,
        hours: '20-24시',
        scenario: '배치 사이클',
        focus: '데이터 처리 작업',
      },
    ],
    version: 'unified-v2.0-cycles',
    consistency: true,
  });
}
