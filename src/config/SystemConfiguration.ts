/**
 * 🏗️ 중앙집중식 시스템 설정 관리
 * 모든 하드코딩된 값들을 환경변수 기반으로 동적 관리
 */

import * as z from 'zod';
import { logger } from '@/lib/logging';

// 🔧 Zod v4 ESM 호환 정수 검증 헬퍼
// Zod v4의 .int() 메서드는 webpack 번들링 시 'int is not defined' 오류 발생
// .refine(Number.isInteger) 패턴으로 대체하여 런타임 안정성 확보
const safeInt = () =>
  z.number().refine(Number.isInteger, { message: 'Must be an integer' });

// 📊 서버 설정 스키마 (타입 안전성 보장)
export const ServerConfigSchema = z.object({
  // 기본 서버 설정
  totalServers: safeInt().min(1).max(50).default(15),
  serverTypes: z
    .array(z.string())
    .min(1)
    .default([
      'web',
      'api',
      'database',
      'cache',
      'storage',
      'monitoring',
      'security',
      'backup',
      'queue',
      'load-balancer',
    ]),

  // Mock 시스템 설정
  mockSystem: z.object({
    enabled: z.boolean().default(true),
    dataSource: z.enum(['basic', 'expanded', 'custom']).default('custom'), // 🎯 server-data-loader 사용
    autoRotation: z.boolean().default(false),
    updateInterval: z.number().min(1000).default(600000), // 10분 (JSON 데이터 10분 간격에 맞춤)
  }),

  // API 응답 설정
  api: z.object({
    defaultPageSize: safeInt().min(5).max(100).default(10),
    maxPageSize: safeInt().min(10).max(200).default(50),
    enablePagination: z.boolean().default(true),
    timeoutMs: z.number().min(1000).max(30000).default(10000),
  }),

  // 성능 최적화 설정
  performance: z.object({
    enableCache: z.boolean().default(true),
    cacheTtlMs: z.number().min(1000).default(600000), // 10분 (JSON 데이터 10분 간격에 맞춤)
    batchSize: safeInt().min(1).max(1000).default(100),
    maxConcurrentRequests: safeInt().min(1).max(50).default(10),
  }),

  // 환경별 설정
  environment: z.object({
    mode: z
      .enum(['development', 'staging', 'production'])
      .default('development'),
    enableDebugLogs: z.boolean().default(true),
    enableMetrics: z.boolean().default(true),
    enableHealthChecks: z.boolean().default(true),
  }),
});

export type SystemConfig = z.infer<typeof ServerConfigSchema>;

// 🌍 환경변수 매핑
const ENV_MAPPING = {
  // 서버 설정
  TOTAL_SERVERS: 'totalServers',

  // Mock 시스템
  MOCK_ENABLED: 'mockSystem.enabled',
  MOCK_DATA_SOURCE: 'mockSystem.dataSource',
  MOCK_AUTO_ROTATION: 'mockSystem.autoRotation',
  MOCK_UPDATE_INTERVAL: 'mockSystem.updateInterval',

  // API 설정
  API_DEFAULT_PAGE_SIZE: 'api.defaultPageSize',
  API_MAX_PAGE_SIZE: 'api.maxPageSize',
  API_ENABLE_PAGINATION: 'api.enablePagination',
  API_TIMEOUT_MS: 'api.timeoutMs',

  // 성능 설정
  ENABLE_CACHE: 'performance.enableCache',
  CACHE_TTL_MS: 'performance.cacheTtlMs',
  BATCH_SIZE: 'performance.batchSize',
  MAX_CONCURRENT_REQUESTS: 'performance.maxConcurrentRequests',

  // 환경 설정
  NODE_ENV: 'environment.mode',
  ENABLE_DEBUG_LOGS: 'environment.enableDebugLogs',
  ENABLE_METRICS: 'environment.enableMetrics',
  ENABLE_HEALTH_CHECKS: 'environment.enableHealthChecks',
} as const;

/**
 * 🔧 시스템 설정 관리자 클래스 (싱글톤)
 */
export class SystemConfigurationManager {
  private static instance: SystemConfigurationManager;
  private config: SystemConfig;
  private isValidated = false;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): SystemConfigurationManager {
    if (!this.instance) {
      this.instance = new SystemConfigurationManager();
    }
    return this.instance;
  }

  /**
   * 🔄 환경변수에서 설정 로드
   */
  private loadConfiguration(): SystemConfig {
    // 🧪 테스트 환경에서는 기본 설정 반환 (Zod 파싱 오류 방지)
    if (process.env.NODE_ENV === 'test') {
      return {
        totalServers: 15,
        serverTypes: ['web', 'api', 'database'],
        mockSystem: {
          enabled: true,
          dataSource: 'custom',
          autoRotation: false,
          updateInterval: 300000,
        },
        api: {
          defaultPageSize: 10,
          maxPageSize: 50,
          enablePagination: true,
          timeoutMs: 10000,
        },
        performance: {
          enableCache: true,
          cacheTtlMs: 300000,
          batchSize: 100,
          maxConcurrentRequests: 10,
        },
        environment: {
          mode: 'development',
          enableDebugLogs: false,
          enableMetrics: false,
          enableHealthChecks: false,
        },
      } as SystemConfig;
    }

    const rawConfig: Record<string, unknown> = {};

    // 환경변수를 설정 객체로 변환
    for (const [envKey, configPath] of Object.entries(ENV_MAPPING)) {
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        this.setNestedValue(
          rawConfig,
          configPath,
          this.parseEnvValue(envValue)
        );
      }
    }

    // 🛡️ 기본 객체 구조 보장 (베르셀 배포 안정성)
    if (!rawConfig.mockSystem) {
      rawConfig.mockSystem = {};
    }
    if (!rawConfig.api) {
      rawConfig.api = {};
    }
    if (!rawConfig.performance) {
      rawConfig.performance = {};
    }
    if (!rawConfig.environment) {
      rawConfig.environment = {};
    }

    // 기본값과 병합
    const result = ServerConfigSchema.parse(rawConfig);

    if (process.env.NODE_ENV !== 'production') {
      logger.info('🔧 SystemConfiguration loaded:', {
        totalServers: result.totalServers,
        dataSource: result.mockSystem.dataSource,
        environment: result.environment.mode,
      });
    }

    return result;
  }

  /**
   * 📝 중첩된 객체 속성 설정
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: boolean | number | string | string[]
  ): void {
    const keys = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key && !current[key]) {
        current[key] = {};
      }
      if (key) {
        const nextValue = current[key];
        current =
          typeof nextValue === 'object' && nextValue !== null
            ? (nextValue as Record<string, unknown>)
            : {};
      }
    }

    const finalKey = keys[keys.length - 1];
    if (finalKey) {
      current[finalKey] = value;
    }
  }

  /**
   * 🔄 환경변수 값 파싱
   */
  private parseEnvValue(value: string): boolean | number | string | string[] {
    // Boolean 변환
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Number 변환
    const numValue = Number(value);
    if (!Number.isNaN(numValue)) return numValue;

    // Array 변환 (콤마 구분)
    if (value.includes(',')) {
      return value.split(',').map((item) => item.trim());
    }

    return value;
  }

  /**
   * ⚡ 설정 값 조회 (타입 안전)
   */
  public get<T extends keyof SystemConfig>(key: T): SystemConfig[T] {
    return this.config[key];
  }

  /**
   * 📊 전체 설정 조회
   */
  public getAll(): Readonly<SystemConfig> {
    return { ...this.config };
  }

  /**
   * ✅ 설정 검증
   */
  public validate(): { isValid: boolean; errors?: string[] } {
    try {
      ServerConfigSchema.parse(this.config);
      this.isValidated = true;
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err) => `${err.path.join('.')}: ${err.message}`
        );
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * 🔄 런타임 설정 업데이트 (개발 환경만)
   */
  public updateConfig<T extends keyof SystemConfig>(
    key: T,
    value: SystemConfig[T]
  ): boolean {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️ Runtime config updates disabled in production');
      return false;
    }

    try {
      const newConfig = { ...this.config, [key]: value };
      const validated = ServerConfigSchema.parse(newConfig);
      this.config = validated;

      logger.info(`🔧 Config updated: ${key} = `, value);
      return true;
    } catch (error) {
      logger.error(`❌ Config update failed for ${key}:`, error);
      return false;
    }
  }

  /**
   * 📊 설정 상태 리포트
   */
  public getStatusReport(): {
    isValidated: boolean;
    environment: string;
    totalServers: number;
    dataSource: string;
    lastUpdated: string;
  } {
    return {
      isValidated: this.isValidated,
      environment: this.config.environment.mode,
      totalServers: this.config.totalServers,
      dataSource: this.config.mockSystem.dataSource,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// 🌟 편의 함수들
export const getSystemConfig = () =>
  SystemConfigurationManager.getInstance().getAll();
export const getServerConfig = () =>
  SystemConfigurationManager.getInstance().get('totalServers');
export const getMockConfig = () =>
  SystemConfigurationManager.getInstance().get('mockSystem');
export const getApiConfig = () =>
  SystemConfigurationManager.getInstance().get('api');
export const getPerformanceConfig = () =>
  SystemConfigurationManager.getInstance().get('performance');

// 기본 인스턴스 생성
export const systemConfig = SystemConfigurationManager.getInstance();

// 설정 검증 (시작 시)
const validation = systemConfig.validate();
if (!validation.isValid) {
  logger.error(
    '❌ System configuration validation failed:',
    validation.errors
  );
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid system configuration');
  }
}

export default systemConfig;
