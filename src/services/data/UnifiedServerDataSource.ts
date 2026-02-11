/**
 * 🎯 Unified Server Data Source
 *
 * Single Source of Truth for all server-related data in the application.
 * Manages caching, validation, and data synchronization between client/server.
 *
 * @created 2025-12-01
 * @author AI Assistant
 * @version 2.0.0 (SSOT Architecture Implemented)
 */

import { SystemConfigurationManager } from '@/config/SystemConfiguration';
import { logger } from '@/lib/logging';
import type { Server } from '@/types/server';

export interface ServerDataSourceConfig {
  totalServers: number;
  dataSource: 'basic' | 'expanded' | 'custom';
  enableValidation: boolean;
  enableCaching: boolean;
  cacheTtl: number;
}

export interface ServerDataMetrics {
  totalServers: number;
  onlineServers: number;
  warningServers: number;
  criticalServers: number;
  lastUpdated: string;
  dataSource: string;
}

/**
 * 🔄 통합 서버 데이터 소스 클래스 (싱글톤)
 */
export class UnifiedServerDataSource {
  private static instance: UnifiedServerDataSource;
  private config: ServerDataSourceConfig;
  private cachedServers: Server[] | null = null;
  private cacheTimestamp: number = 0;
  private systemConfig: SystemConfigurationManager;

  private constructor() {
    this.systemConfig = SystemConfigurationManager.getInstance();
    this.config = this.loadDataSourceConfig();

    if (process.env.NODE_ENV !== 'production') {
      logger.info('🎯 UnifiedServerDataSource initialized:', {
        totalServers: this.config.totalServers,
        dataSource: this.config.dataSource,
        cacheTtl: `${this.config.cacheTtl / 1000}s`,
      });
    }
  }

  public static getInstance(): UnifiedServerDataSource {
    if (!UnifiedServerDataSource.instance) {
      UnifiedServerDataSource.instance = new UnifiedServerDataSource();
    }
    return UnifiedServerDataSource.instance;
  }

  /** 테스트 격리용: 싱글톤 인스턴스 리셋 */
  static resetForTesting(): void {
    if (process.env.NODE_ENV !== 'test') return;
    UnifiedServerDataSource.instance =
      undefined as unknown as UnifiedServerDataSource;
  }

  /**
   * 📋 데이터 소스 설정 로드
   */
  private loadDataSourceConfig(): ServerDataSourceConfig {
    const systemConfig = this.systemConfig.getAll();

    return {
      totalServers: systemConfig.totalServers,
      dataSource: systemConfig.mockSystem.dataSource,
      enableValidation: systemConfig.environment.mode !== 'production',
      enableCaching: systemConfig.performance.enableCache,
      cacheTtl: systemConfig.performance.cacheTtlMs,
    };
  }

  /**
   * 🎯 서버 데이터 조회 (메인 인터페이스)
   *
   * **Single Source of Truth**: MetricsProvider → hourly-data JSON
   *
   * @returns {Promise<Server[]>} 15개 서버 데이터 (24시간 회전 JSON)
   *
   * @description
   * - 서버 사이드: MetricsProvider → `hourly-data/hour-*.json`
   * - 클라이언트 사이드: `/api/servers-unified` API 사용 (브라우저 호환)
   * - 캐싱: 10분 TTL (JSON 데이터 10분 간격에 맞춤)
   * - 검증: 서버 수 및 필수 필드 확인
   *
   * @example
   * // ✅ 올바른 사용 (싱글톤 패턴)
   * const dataSource = UnifiedServerDataSource.getInstance();
   * const servers = await dataSource.getServers();
   *
   * @example
   * // ✅ 올바른 사용 (편의 함수)
   * import { getServersFromUnifiedSource } from '@/services/data/UnifiedServerDataSource';
   * const servers = await getServersFromUnifiedSource();
   *
   * @see {@link docs/core/architecture/data/data-architecture.md} 아키텍처 가이드
   */
  public async getServers(): Promise<Server[]> {
    // 캐시 확인
    if (this.isCacheValid() && this.cachedServers) {
      return this.cachedServers;
    }

    // 🚀 클라이언트 사이드 감지: 브라우저에서는 API 사용 (fs 모듈 없음)
    if (typeof window !== 'undefined') {
      return this.loadServersFromAPI();
    }

    // 서버 사이드: 파일 시스템 직접 접근
    const servers = await this.loadServersFromSource();

    // 검증
    if (this.config.enableValidation) {
      this.validateServers(servers);
    }

    // 캐싱
    if (this.config.enableCaching) {
      this.cachedServers = servers;
      this.cacheTimestamp = Date.now();
    }

    return servers;
  }

  /**
   * 🌐 클라이언트 사이드 API 호출 (브라우저 환경용)
   *
   * 브라우저에서는 fs 모듈을 사용할 수 없으므로 API를 통해 데이터 로드
   */
  private async loadServersFromAPI(): Promise<Server[]> {
    try {
      const response = await fetch('/api/servers-unified?limit=50');

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to fetch data from API');
      }

      const servers = result.data as Server[];

      // 캐싱
      if (this.config.enableCaching) {
        this.cachedServers = servers;
        this.cacheTimestamp = Date.now();
      }

      logger.info(
        `✅ [Client] Loaded ${servers.length} servers from /api/servers-unified`
      );
      return servers;
    } catch (error) {
      logger.error('❌ [Client] API fetch failed:', error);
      // 캐시된 데이터가 있으면 반환
      if (this.cachedServers && this.cachedServers.length > 0) {
        logger.warn('⚠️ [Client] Using stale cache due to API error');
        return this.cachedServers;
      }
      throw error;
    }
  }

  /**
   * 📊 서버 메트릭 조회
   */
  public async getServerMetrics(): Promise<ServerDataMetrics> {
    const servers = await this.getServers();

    const metrics: ServerDataMetrics = {
      totalServers: servers.length,
      onlineServers: servers.filter((s) => s.status === 'online').length,
      warningServers: servers.filter((s) => s.status === 'warning').length,
      criticalServers: servers.filter((s) => s.status === 'critical').length,
      lastUpdated: new Date().toISOString(),
      dataSource: `${this.config.dataSource}-${this.config.totalServers}`,
    };

    return metrics;
  }

  /**
   * 🔄 동기 래퍼: 캐시된 서버 데이터 반환 (MockContextLoader용)
   *
   * MetricsProvider 기반 캐시 데이터 동기 접근
   *
   * @returns 캐시된 서버 데이터 또는 빈 배열 (캐시 미준비 시)
   */
  public getCachedServersSync(): Server[] {
    if (
      !this.isCacheValid() ||
      !this.cachedServers ||
      this.cachedServers.length === 0
    ) {
      logger.warn('⚠️ getCachedServersSync(): Cache not ready or empty');
      return [];
    }
    return this.cachedServers;
  }

  /**
   * 🔄 서버 데이터 로드 (ServerMonitoringService 사용)
   *
   * @description
   * ServerMonitoringService를 통해 가공된 서버 데이터를 Server 타입으로 변환
   * - Dashboard와 AI 응답 데이터 일관성 보장
   * - Single Source of Truth: hourly-data/*.json → MetricsProvider → ServerMonitoringService
   *
   * @updated 2026-02-11 - ServerMonitoringService 통합
   */
  private async loadServersFromSource(): Promise<Server[]> {
    const { getServerMonitoringService } = await import(
      '@/services/monitoring'
    );
    const service = getServerMonitoringService();
    const servers = service.getAllAsServers();

    if (process.env.NODE_ENV !== 'production') {
      logger.info(
        `🔄 Loading servers from ServerMonitoringService: ${servers.length} servers`
      );
    }

    return servers;
  }

  /**
   * ✅ 서버 데이터 검증
   */
  private validateServers(servers: Server[]): void {
    if (servers.length !== this.config.totalServers) {
      logger.warn(
        `⚠️ Server count mismatch: expected ${this.config.totalServers}, got ${servers.length}`
      );
    }

    const invalidServers = servers.filter(
      (s) => !s.id || !s.name || !s.hostname
    );
    if (invalidServers.length > 0) {
      logger.error('❌ Invalid servers found:', invalidServers.length);
    }
  }

  /**
   * 💾 캐시 유효성 검증
   */
  private isCacheValid(): boolean {
    if (!this.config.enableCaching || !this.cachedServers) {
      return false;
    }

    const cacheAge = Date.now() - this.cacheTimestamp;
    return cacheAge < this.config.cacheTtl;
  }

  /**
   * 🗑️ 캐시 무효화
   */
  public invalidateCache(): void {
    this.cachedServers = null;
    this.cacheTimestamp = 0;
    logger.info('🗑️ Server data cache invalidated');
  }

  /**
   * 📊 상태 리포트
   */
  public getStatusReport() {
    return {
      config: this.config,
      cacheStatus: {
        enabled: this.config.enableCaching,
        isValid: this.isCacheValid(),
        lastUpdated: new Date(this.cacheTimestamp).toISOString(),
      },
      systemStatus: this.systemConfig.getStatusReport(),
    };
  }
}

// 🌟 편의 함수들
export const getUnifiedServerDataSource = () =>
  UnifiedServerDataSource.getInstance();
export const getServersFromUnifiedSource = () =>
  UnifiedServerDataSource.getInstance().getServers();
export const getServerMetricsFromUnifiedSource = () =>
  UnifiedServerDataSource.getInstance().getServerMetrics();

// 기본 인스턴스 생성
export const serverDataSource = UnifiedServerDataSource.getInstance();

export default serverDataSource;
