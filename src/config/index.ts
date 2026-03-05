/**
 * 🔧 Application Configuration
 *
 * 애플리케이션 전체 설정 관리
 * - 환경변수 기반 설정
 * - 타입 안전한 설정 스키마
 * - 기본값 및 검증
 */

import * as z from 'zod';
import type { Environment } from '../types/common';
import { logger } from '@/lib/logging';

// 설정 스키마 정의
export const ConfigSchema = z.object({
  // 애플리케이션 기본 설정
  app: z.object({
    name: z.string().default('OpenManager AI'),
    version: z.string().default(process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0'),
    environment: z
      .enum(['production', 'staging', 'development', 'test'])
      .default('development'),
    debug: z.boolean().default(false),
    port: z.number().min(1000).max(65535).default(3000),
  }),

  // 가상 서버 설정
  virtualServer: z.object({
    generationInterval: z.number().min(1000).default(5000), // 5초
    totalDuration: z.number().min(60000).default(1200000), // 20분
    historyDuration: z.number().min(3600000).default(86400000), // 24시간
    serverCount: z.number().min(1).max(20).default(15),
    enableRealtimeGeneration: z.boolean().default(true),
    enableHistoryGeneration: z.boolean().default(true),
  }),

  // 알림 시스템 설정
  alerts: z.object({
    checkInterval: z.number().min(5000).default(10000), // 10초
    cooldownMinutes: z.number().min(1).default(5),
    maxRetries: z.number().min(1).default(3),
    // Vercel 환경에서 이메일/웹훅 알림 제거됨
  }),

  // AI 에이전트 설정
  ai: z.object({
    responseTimeout: z.number().min(5000).default(30000), // 30초
    maxTokens: z.number().min(100).default(4000),
    temperature: z.number().min(0).max(2).default(0.7),
    enableContinuousLearning: z.boolean().default(true),
    enablePatternAnalysis: z.boolean().default(true),
    enablePrediction: z.boolean().default(true),
    maxContextLength: z.number().min(1000).default(8000),
  }),

  // 데이터베이스 설정
  database: z.object({
    url: z.string().url().optional(),
    key: z.string().min(1).optional(),
    enableMockMode: z.boolean().default(true),
    connectionTimeout: z.number().min(1000).default(10000),
    queryTimeout: z.number().min(1000).default(30000),
  }),

  // WebSocket 설정
  websocket: z.object({
    enabled: z.boolean().default(true),
    url: z.string().default('ws://localhost:3001/ws'),
    reconnectAttempts: z.number().min(1).default(5),
    reconnectDelay: z.number().min(1000).default(1000),
    heartbeatInterval: z.number().min(10000).default(30000),
  }),

  // 로깅 설정
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enableConsole: z.boolean().default(true),
    enableFile: z.boolean().default(false),
    maxFileSize: z.number().min(1024).default(10485760), // 10MB
    maxFiles: z.number().min(1).default(5),
    logDirectory: z.string().default('./logs'),
  }),

  // 모니터링 설정
  monitoring: z.object({
    enableHealthCheck: z.boolean().default(true),
    healthCheckInterval: z.number().min(5000).default(300000), // 5분 (Vercel 최적화)
    enableMetricsCollection: z.boolean().default(true),
    metricsRetentionDays: z.number().min(1).default(30),
    enablePerformanceMonitoring: z.boolean().default(true),
  }),

  // 보안 설정
  security: z.object({
    enableCors: z.boolean().default(true),
    corsOrigins: z.array(z.string()).default(['http://localhost:3000']),
    enableRateLimit: z.boolean().default(true),
    rateLimitWindow: z.number().min(60000).default(900000), // 15분
    rateLimitMax: z.number().min(1).default(100),
    enableApiKeyAuth: z.boolean().default(false),
  }),

  // 캐시 설정
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().min(1000).default(300000), // 5분
    maxSize: z.number().min(10).default(1000),
    enableRedis: z.boolean().default(false),
    redisUrl: z.string().optional(),
  }),

  // 개발 도구 설정
  development: z.object({
    enableHotReload: z.boolean().default(true),
    enableSourceMaps: z.boolean().default(true),
    enableProfiling: z.boolean().default(false),
    enableMockData: z.boolean().default(true),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

// 환경변수에서 설정 로드
export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AppConfig | null = null;

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  load(): AppConfig {
    if (this.config) {
      return this.config;
    }

    const rawConfig = {
      app: {
        name: process.env.NEXT_PUBLIC_APP_NAME || 'OpenManager AI',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
        environment: (process.env.NODE_ENV as Environment) || 'development',
        debug: process.env.NEXT_PUBLIC_DEBUG === 'true',
        port: Number(process.env.PORT) || 3000,
      },
      virtualServer: {
        generationInterval: Number(process.env.GENERATION_INTERVAL) || 5000,
        totalDuration: Number(process.env.TOTAL_DURATION) || 1200000,
        historyDuration: Number(process.env.HISTORY_DURATION) || 86400000,
        serverCount: Number(process.env.SERVER_COUNT) || 15,
        enableRealtimeGeneration:
          process.env.ENABLE_REALTIME_GENERATION !== 'false',
        enableHistoryGeneration:
          process.env.ENABLE_HISTORY_GENERATION !== 'false',
      },
      alerts: {
        checkInterval: Number(process.env.ALERT_CHECK_INTERVAL) || 10000,
        cooldownMinutes: Number(process.env.ALERT_COOLDOWN) || 5,
        maxRetries: Number(process.env.ALERT_MAX_RETRIES) || 3,
      },
      ai: {
        responseTimeout: Number(process.env.AI_RESPONSE_TIMEOUT) || 30000,
        maxTokens: Number(process.env.AI_MAX_TOKENS) || 4000,
        temperature: Number(process.env.AI_TEMPERATURE) || 0.7,
        enableContinuousLearning:
          process.env.AI_ENABLE_CONTINUOUS_LEARNING !== 'false',
        enablePatternAnalysis:
          process.env.AI_ENABLE_PATTERN_ANALYSIS !== 'false',
        enablePrediction: process.env.AI_ENABLE_PREDICTION !== 'false',
        maxContextLength: Number(process.env.AI_MAX_CONTEXT_LENGTH) || 8000,
      },
      database: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        key:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        enableMockMode: process.env.DATABASE_ENABLE_MOCK_MODE !== 'false',
        connectionTimeout:
          Number(process.env.DATABASE_CONNECTION_TIMEOUT) || 10000,
        queryTimeout: Number(process.env.DATABASE_QUERY_TIMEOUT) || 30000,
      },
      websocket: {
        enabled: process.env.WEBSOCKET_ENABLED !== 'false',
        url: process.env.WEBSOCKET_URL || 'ws://localhost:3001/ws',
        reconnectAttempts:
          Number(process.env.WEBSOCKET_RECONNECT_ATTEMPTS) || 5,
        reconnectDelay: Number(process.env.WEBSOCKET_RECONNECT_DELAY) || 1000,
        heartbeatInterval:
          Number(process.env.WEBSOCKET_HEARTBEAT_INTERVAL) || 30000,
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
        enableFile: process.env.LOG_ENABLE_FILE === 'true',
        maxFileSize: Number(process.env.LOG_MAX_FILE_SIZE) || 10485760,
        maxFiles: Number(process.env.LOG_MAX_FILES) || 5,
        logDirectory: process.env.LOG_DIRECTORY || './logs',
      },
      monitoring: {
        enableHealthCheck:
          process.env.MONITORING_ENABLE_HEALTH_CHECK !== 'false',
        healthCheckInterval:
          Number(process.env.MONITORING_HEALTH_CHECK_INTERVAL) || 30000,
        enableMetricsCollection:
          process.env.MONITORING_ENABLE_METRICS_COLLECTION !== 'false',
        metricsRetentionDays:
          Number(process.env.MONITORING_METRICS_RETENTION_DAYS) || 30,
        enablePerformanceMonitoring:
          process.env.MONITORING_ENABLE_PERFORMANCE !== 'false',
      },
      security: {
        enableCors: process.env.SECURITY_ENABLE_CORS !== 'false',
        corsOrigins: process.env.SECURITY_CORS_ORIGINS?.split(',') || [
          'http://localhost:3000',
        ],
        enableRateLimit: process.env.SECURITY_ENABLE_RATE_LIMIT !== 'false',
        rateLimitWindow:
          Number(process.env.SECURITY_RATE_LIMIT_WINDOW) || 900000,
        rateLimitMax: Number(process.env.SECURITY_RATE_LIMIT_MAX) || 100,
        enableApiKeyAuth: process.env.SECURITY_ENABLE_API_KEY_AUTH === 'true',
      },
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        ttl: Number(process.env.CACHE_TTL) || 300000,
        maxSize: Number(process.env.CACHE_MAX_SIZE) || 1000,
        enableRedis: process.env.CACHE_ENABLE_REDIS === 'true',
        redisUrl: process.env.REDIS_URL,
      },
      development: {
        enableHotReload: process.env.DEV_ENABLE_HOT_RELOAD !== 'false',
        enableSourceMaps: process.env.DEV_ENABLE_SOURCE_MAPS !== 'false',
        enableProfiling: process.env.DEV_ENABLE_PROFILING === 'true',
        enableMockData: process.env.DEV_ENABLE_MOCK_DATA !== 'false',
      },
    };

    try {
      this.config = ConfigSchema.parse(rawConfig);
      return this.config;
    } catch (error) {
      logger.error('❌ Configuration validation failed:', error);
      throw new Error('Invalid configuration', { cause: error });
    }
  }

  reload(): AppConfig {
    this.config = null;
    return this.load();
  }

  get<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.load()[section];
  }

  isDevelopment(): boolean {
    return this.load().app.environment === 'development';
  }

  isProduction(): boolean {
    return this.load().app.environment === 'production';
  }

  isDebugEnabled(): boolean {
    return this.load().app.debug;
  }
}

// 싱글톤 인스턴스
export const configLoader = ConfigLoader.getInstance();

// 편의 함수들 (사용되는 것만 유지)
export const getLoggingConfig = () => configLoader.get('logging');

// 환경 확인 함수들
export const isDevelopment = () => configLoader.isDevelopment();
export const isProduction = () => configLoader.isProduction();
export const isDebugEnabled = () => configLoader.isDebugEnabled();
