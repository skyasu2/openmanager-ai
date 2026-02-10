/**
 * 🎭 Mock 데이터 컨텍스트 로더
 *
 * AI가 Mock 데이터를 실제 서버처럼 분석할 수 있도록
 * 컨텍스트 정보를 제공
 */

import { isMockMode } from '@/config/mock-config';
import { logger } from '@/lib/logging';
import type { Server } from '@/types/server';
import { UnifiedServerDataSource } from '../data/UnifiedServerDataSource';

export interface MockContext {
  enabled: boolean;
  currentTime: string;
  metrics: {
    serverCount: number;
    criticalCount: number;
    warningCount: number;
    healthyCount: number;
    avgCpu: number;
    avgMemory: number;
    avgDisk: number;
  };
  servers: Server[];
  trends: {
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    alertTrend: 'increasing' | 'decreasing' | 'stable';
    scenario: { name: string };
  };
}

export class MockContextLoader {
  private static instance: MockContextLoader;
  private cachedContext: MockContext | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 300000; // 5분 캐시 (UnifiedServerDataSource와 동기화)

  static getInstance(): MockContextLoader {
    if (!MockContextLoader.instance) {
      MockContextLoader.instance = new MockContextLoader();
    }
    return MockContextLoader.instance;
  }

  /**
   * 캐시 유효성 확인
   */
  private isCacheValid(): boolean {
    return (
      this.cachedContext !== null &&
      Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS
    );
  }

  /**
   * 캐시 무효화
   */
  private invalidateCache(): void {
    this.cachedContext = null;
    this.cacheTimestamp = 0;
  }

  /**
   * 공개 메서드: 캐시 강제 새로고침
   * AI API에서 최신 데이터가 필요할 때 호출
   */
  public refreshCache(): MockContext | null {
    this.invalidateCache();
    return this.getMockContext();
  }

  /**
   * Mock 컨텍스트 가져오기 (통합 데이터 서비스 연동 + 캐싱)
   */
  getMockContext(): MockContext | null {
    // 프로덕션에서는 디버그 로그 제거
    if (process.env.NODE_ENV === 'development') {
      logger.info('🔍 MockContextLoader.getMockContext() 호출됨');
      logger.info('🔍 isMockMode() 결과:', isMockMode());
    }

    if (!isMockMode()) {
      if (process.env.NODE_ENV === 'development') {
        logger.info('❌ Mock 모드가 비활성화됨 - null 반환');
      }
      return null;
    }

    // 캐시된 데이터가 유효하면 반환
    if (this.isCacheValid()) {
      if (process.env.NODE_ENV === 'development') {
        logger.info('⚡ 캐시된 MockContext 사용');
      }
      return this.cachedContext;
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        logger.info('🔄 UnifiedServerDataSource 동기 컨텍스트 조회 시도...');
      }
      // 🚀 베르셀 최적화: UnifiedServerDataSource를 통해 정적 JSON 데이터 사용 (scenario-loader)
      const result = this.getStaticContextSync();

      // 캐시 업데이트
      if (result) {
        this.cachedContext = result;
        this.cacheTimestamp = Date.now();
      }

      if (process.env.NODE_ENV === 'development') {
        logger.info('✅ UnifiedServerDataSource 동기 컨텍스트 성공:', {
          enabled: result?.enabled,
          serverCount: result?.servers?.length,
          currentTime: result?.currentTime,
          cached: true,
        });
      }
      return result;
    } catch (error) {
      logger.error('❌ UnifiedServerDataSource 데이터 조회 실패:', error);

      // 폴백: null 반환 (UnifiedServerDataSource 캐시 초기화 대기 필요)
      // AI는 데이터 없음 상태를 gracefully 처리 가능
      logger.warn(
        '⚠️ MockContext 사용 불가 - UnifiedServerDataSource 초기화 대기 중'
      );

      // 캐시 무효화 (다음 요청 시 재시도)
      this.invalidateCache();

      return null;
    }
  }

  /**
   * AI용 컨텍스트 문자열 생성 (시나리오 정보 제외)
   */
  generateContextString(): string {
    const context = this.getMockContext();
    if (!context) {
      return '';
    }

    const lines = [
      `🎭 Mock 데이터 모드 활성화됨`,
      `⏰ 현재 시각: ${context.currentTime}`,
      ``,
      `서버 상태:`,
      `- 전체 서버: ${context.metrics.serverCount}대`,
      `- 위험: ${context.metrics.criticalCount}대`,
      `- 경고: ${context.metrics.warningCount}대`,
      `- 정상: ${context.metrics.healthyCount}대`,
      ``,
      `현재 메트릭:`,
      `- CPU 평균: ${context.metrics.avgCpu}%`,
      `- Memory 평균: ${context.metrics.avgMemory}%`,
      `- Disk 평균: ${context.metrics.avgDisk}%`,
    ];

    // 주요 문제 서버 정보 추가 (시나리오 언급 없이)
    if (context.servers && context.servers.length > 0) {
      const problemServers = context.servers.filter(
        (s) =>
          s.status === 'critical' ||
          s.status === 'warning' ||
          s.cpu > 80 ||
          s.memory > 85
      );

      if (problemServers.length > 0) {
        lines.push('', '주요 서버 상태:');
        problemServers.slice(0, 3).forEach((server) => {
          lines.push(
            `- ${server.name}: CPU ${server.cpu}%, Memory ${server.memory}%, 상태: ${server.status}`
          );
        });
      }
    }

    // 시나리오 정보는 제공하지 않음 - AI가 데이터만 보고 판단하도록
    return lines.join('\n');
  }

  /**
   * 특정 서버 분석용 컨텍스트
   */
  getServerContext(serverId: string): string {
    const context = this.getMockContext();
    if (!context) {
      return '';
    }

    const server = context.servers.find((s) => s.id === serverId);
    if (!server) {
      return '서버를 찾을 수 없습니다.';
    }

    return [
      `🖥️ ${server.name} (${server.id})`,
      `상태: ${server.status}`,
      `위치: ${server.location || '알 수 없음'}`,
      ``,
      `현재 메트릭:`,
      `- CPU: ${server.cpu}%`,
      `- Memory: ${server.memory}%`,
      `- Disk: ${server.disk}%`,
      `- Network: ${server.network}%`,
      ``,
      `알림: ${typeof server.alerts === 'number' ? server.alerts : Array.isArray(server.alerts) ? server.alerts.length : 0}개`,
      `마지막 업데이트: ${server.lastUpdate ? new Date(server.lastUpdate).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' }) : '알 수 없음'}`,
    ].join('\n');
  }

  /**
   * 🚀 베르셀 최적화: UnifiedServerDataSource 기반 컨텍스트 생성
   * Single Source of Truth: scenario-loader 통합
   *
   * ✅ UnifiedServerDataSource 마이그레이션 완료 (2025-11-23)
   * - 5분 간격 고정 데이터 (12 data points/hour)
   * - scenario-loader 기반 EnhancedServerMetrics
   * - KST 타임존 동기화
   */
  private getStaticContextSync(): MockContext | null {
    try {
      if (process.env.NODE_ENV === 'development') {
        logger.info(
          '🚀 UnifiedServerDataSource 기반 컨텍스트 생성 시도 (동기 래퍼)'
        );
      }

      // 🎯 Single Source of Truth: UnifiedServerDataSource → scenario-loader
      const dataSource = UnifiedServerDataSource.getInstance();
      const servers = dataSource.getCachedServersSync();

      // 캐시가 준비되지 않은 경우 null 반환
      if (servers.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          logger.warn(
            '⚠️ UnifiedServerDataSource 캐시 미준비 - 다음 요청에서 재시도'
          );
        }
        return null;
      }

      if (process.env.NODE_ENV === 'development') {
        logger.info('✅ UnifiedServerDataSource 동기 데이터 로드 성공:', {
          serversCount: servers.length,
        });
      }

      // 서버 상태별 분류
      const criticalServers = servers.filter((s) => s.status === 'critical');
      const warningServers = servers.filter((s) => s.status === 'warning');
      const onlineServers = servers.filter((s) => s.status === 'online');

      // 평균 메트릭 계산 (서버 데이터에서 직접 계산)
      const avgCpu =
        servers.length > 0
          ? Math.round(
              servers.reduce((sum, s) => sum + s.cpu, 0) / servers.length
            )
          : 0;

      const avgMemory =
        servers.length > 0
          ? Math.round(
              servers.reduce((sum, s) => sum + s.memory, 0) / servers.length
            )
          : 0;

      const avgDisk =
        servers.length > 0
          ? Math.round(
              servers.reduce((sum, s) => sum + s.disk, 0) / servers.length
            )
          : 0;

      const currentTime = new Date().toLocaleTimeString('ko-KR', {
        hour12: false,
        timeZone: 'Asia/Seoul', // KST 타임존 명시
      });

      return {
        enabled: true,
        currentTime,
        metrics: {
          serverCount: servers.length,
          criticalCount: criticalServers.length,
          warningCount: warningServers.length,
          healthyCount: onlineServers.length,
          avgCpu,
          avgMemory,
          avgDisk,
        },
        servers: servers.slice(0, 10), // 상위 10개 서버 (AI 분석에 충분)
        trends: {
          cpuTrend:
            avgCpu > 70 ? 'increasing' : avgCpu < 30 ? 'decreasing' : 'stable',
          memoryTrend:
            avgMemory > 75
              ? 'increasing'
              : avgMemory < 40
                ? 'decreasing'
                : 'stable',
          alertTrend:
            criticalServers.length > servers.length * 0.3
              ? 'increasing'
              : criticalServers.length === 0
                ? 'decreasing'
                : 'stable',
          scenario: { name: 'scenario-loader' }, // scenario-loader 사용 명시
        },
      };
    } catch (error) {
      logger.error('❌ UnifiedServerDataSource 컨텍스트 생성 실패:', error);
      return null;
    }
  }
}
