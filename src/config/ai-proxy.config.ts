/**
 * AI Proxy Configuration (Zod Schema)
 *
 * @description
 * Cloud Run 프록시 타임아웃 및 설정 중앙화
 * Zod 스키마로 타입 안전성 및 런타임 검증 보장
 *
 * @created 2026-01-26
 *
 * @note maxDuration vs Timeout 차이점
 * - maxDuration: Next.js 빌드 타임 상수 (라우트 파일에서 정적 export)
 * - timeout: 런타임에 사용되는 실제 타임아웃 (이 config에서 관리)
 *
 * Vercel 티어 변경 시:
 * 1. VERCEL_TIER 환경변수 변경 (free → pro)
 * 2. 각 라우트 파일의 maxDuration 주석 참고하여 값 변경
 */

import { z } from 'zod';
import { logger } from '@/lib/logging';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Vercel 티어 스키마
 */
const VercelTierSchema = z.enum(['free', 'pro']).default('pro');

/**
 * 타임아웃 설정 스키마
 */
const TimeoutConfigSchema = z.object({
  min: z.number().min(1000).max(60000),
  max: z.number().min(1000).max(60000),
  default: z.number().min(1000).max(60000),
});

/**
 * 쿼리 라우팅 설정 스키마
 * @description 복잡도 기반 스트리밍/Job Queue 라우팅 임계값
 */
const QueryRoutingConfigSchema = z.object({
  /** 복잡도 임계값: 이 점수 초과시 Job Queue 사용 (기본값: 19) */
  complexityThreshold: z.number().min(1).max(100).default(19),
  /** Job Queue 강제 사용 키워드 */
  forceJobQueueKeywords: z.array(z.string()).default([
    '보고서', '리포트', '근본 원인', '장애 분석', '전체 분석',
  ]),
});

/**
 * 스트리밍 재시도 설정 스키마
 * @description P1: Exponential backoff 재시도 설정
 */
const StreamRetryConfigSchema = z.object({
  /** 최대 재시도 횟수 */
  maxRetries: z.number().min(0).max(5).default(3),
  /** 초기 대기 시간 (ms) */
  initialDelayMs: z.number().min(100).max(5000).default(1000),
  /** 백오프 배수 */
  backoffMultiplier: z.number().min(1).max(5).default(2),
  /** 최대 대기 시간 (ms) */
  maxDelayMs: z.number().min(1000).max(30000).default(10000),
  /** 🎯 P0: Jitter 범위 (0.0 ~ 1.0, Thundering herd 방지) */
  jitterFactor: z.number().min(0).max(1).default(0.1),
  /** 재시도 가능한 에러 패턴 */
  retryableErrors: z.array(z.string()).default([
    'timeout', 'ETIMEDOUT', 'ECONNRESET', 'fetch failed',
    'socket hang up', '504', '503', 'Stream error',
  ]),
});

/**
 * RAG 검색 가중치 설정 스키마
 * @description P2: RAG 하이브리드 검색 가중치 외부화
 */
const RAGWeightsConfigSchema = z.object({
  /** 벡터 검색 가중치 (pgVector) */
  vector: z.number().min(0).max(1).default(0.5),
  /** 그래프 검색 가중치 (Knowledge Graph) */
  graph: z.number().min(0).max(1).default(0.3),
  /** 웹 검색 가중치 (Tavily) */
  web: z.number().min(0).max(1).default(0.2),
});

/**
 * Observability 설정 스키마
 * @description P1: Trace ID 전파 및 로깅 설정
 */
const ObservabilityConfigSchema = z.object({
  /** Trace ID 전파 활성화 */
  enableTraceId: z.boolean().default(true),
  /** Trace ID 헤더 이름 */
  traceIdHeader: z.string().default('X-Trace-Id'),
  /** 상세 로깅 활성화 (개발 환경) */
  verboseLogging: z.boolean().default(false),
});

/**
 * 쿼리 복잡도 카테고리 가중치 스키마
 * @description P1: 복잡도 분석 가중치 외부화
 * @see src/lib/ai/utils/query-complexity.ts
 */
const ComplexityCategoryWeightsSchema = z.object({
  /** 분석 관련 키워드 가중치 */
  analysis: z.number().min(0).max(50).default(20),
  /** 예측 관련 키워드 가중치 */
  prediction: z.number().min(0).max(50).default(25),
  /** 집계 관련 키워드 가중치 */
  aggregation: z.number().min(0).max(50).default(15),
  /** 시간 범위 관련 키워드 가중치 */
  timeRange: z.number().min(0).max(50).default(15),
  /** 다중 서버 관련 키워드 가중치 */
  multiServer: z.number().min(0).max(50).default(15),
  /** 보고서 관련 키워드 가중치 */
  report: z.number().min(0).max(50).default(20),
  /** 원인 분석 관련 키워드 가중치 */
  rootCause: z.number().min(0).max(50).default(30),
  /** RAG 검색 관련 키워드 가중치 */
  ragSearch: z.number().min(0).max(50).default(25),
});

/**
 * AI Proxy 설정 스키마
 */
const AIProxyConfigSchema = z.object({
  /** Vercel 티어 (free: 10초, pro: 60초) */
  tier: VercelTierSchema,

  /** 티어별 maxDuration (빌드 타임 참조용) */
  maxDuration: z.object({
    free: z.literal(10),
    pro: z.literal(60),
  }),

  /** 엔드포인트별 타임아웃 설정 */
  timeouts: z.object({
    supervisor: TimeoutConfigSchema,
    'incident-report': TimeoutConfigSchema,
    'intelligent-monitoring': TimeoutConfigSchema,
    'analyze-server': TimeoutConfigSchema,
  }),

  /** 캐시 TTL 설정 (초) */
  cacheTTL: z.object({
    'supervisor-status': z.number().default(300),
    supervisor: z.number().default(1800),
    'incident-report': z.number().default(3600),
    'intelligent-monitoring': z.number().default(600),
  }),

  /** 쿼리 라우팅 설정 */
  queryRouting: QueryRoutingConfigSchema,

  /** 스트리밍 재시도 설정 */
  streamRetry: StreamRetryConfigSchema,

  /** RAG 검색 가중치 */
  ragWeights: RAGWeightsConfigSchema,

  /** Observability 설정 */
  observability: ObservabilityConfigSchema,

  /** 복잡도 카테고리 가중치 */
  complexityWeights: ComplexityCategoryWeightsSchema,
});

// ============================================================================
// Types
// ============================================================================

export type VercelTier = z.infer<typeof VercelTierSchema>;
export type TimeoutConfig = z.infer<typeof TimeoutConfigSchema>;
export type AIProxyConfig = z.infer<typeof AIProxyConfigSchema>;
export type ProxyEndpoint = keyof AIProxyConfig['timeouts'];
export type CacheEndpoint = keyof AIProxyConfig['cacheTTL'];
export type QueryRoutingConfig = z.infer<typeof QueryRoutingConfigSchema>;
export type StreamRetryConfig = z.infer<typeof StreamRetryConfigSchema>;
export type RAGWeightsConfig = z.infer<typeof RAGWeightsConfigSchema>;
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
export type ComplexityCategoryWeights = z.infer<typeof ComplexityCategoryWeightsSchema>;

// ============================================================================
// Tier-specific Timeout Presets
// ============================================================================

/**
 * Free tier 타임아웃 (10초 제한, 1초 안전 마진)
 */
const FREE_TIER_TIMEOUTS = {
  supervisor: { min: 3000, max: 9000, default: 5000 },
  'incident-report': { min: 5000, max: 9000, default: 7000 },
  'intelligent-monitoring': { min: 3000, max: 9000, default: 5000 },
  'analyze-server': { min: 3000, max: 9000, default: 5000 },
} as const;

/**
 * Pro tier 타임아웃 (60초 제한, 5초 안전 마진)
 */
const PRO_TIER_TIMEOUTS = {
  supervisor: { min: 15000, max: 55000, default: 30000 },
  'incident-report': { min: 20000, max: 45000, default: 30000 },
  'intelligent-monitoring': { min: 10000, max: 30000, default: 15000 },
  'analyze-server': { min: 8000, max: 25000, default: 12000 },
} as const;

// ============================================================================
// Config Loader
// ============================================================================

/**
 * 환경변수에서 설정 로드 및 검증
 */
function loadAIProxyConfig(): AIProxyConfig {
  const rawTier = process.env.VERCEL_TIER?.trim().toLowerCase();
  const rawPlan = process.env.VERCEL_PLAN?.trim().toLowerCase();
  const isVercelRuntime = Boolean(process.env.VERCEL);

  const tier: VercelTier =
    rawTier === 'free' || rawTier === 'pro'
      ? rawTier
      : rawPlan === 'hobby' || rawPlan === 'free'
        ? 'free'
        : rawPlan === 'pro' || rawPlan === 'enterprise'
          ? 'pro'
          : isVercelRuntime
            ? 'pro'
            : 'free';
  const timeouts = tier === 'pro' ? PRO_TIER_TIMEOUTS : FREE_TIER_TIMEOUTS;

  const rawConfig = {
    tier,
    maxDuration: {
      free: 10 as const,
      pro: 60 as const,
    },
    timeouts,
    cacheTTL: {
      'supervisor-status': 300,
      supervisor: 1800,
      'incident-report': 3600,
      'intelligent-monitoring': 600,
    },
    queryRouting: {
      complexityThreshold: Number(process.env.AI_COMPLEXITY_THRESHOLD) || 19,
      forceJobQueueKeywords: process.env.AI_FORCE_JOB_QUEUE_KEYWORDS?.split(',') || [
        '보고서', '리포트', '근본 원인', '장애 분석', '전체 분석',
      ],
    },
    streamRetry: {
      maxRetries: Number(process.env.AI_STREAM_MAX_RETRIES) || 3,
      initialDelayMs: Number(process.env.AI_STREAM_INITIAL_DELAY) || 1000,
      backoffMultiplier: Number(process.env.AI_STREAM_BACKOFF_MULTIPLIER) || 2,
      maxDelayMs: Number(process.env.AI_STREAM_MAX_DELAY) || 10000,
      jitterFactor: Number(process.env.AI_STREAM_JITTER_FACTOR) || 0.1,
      retryableErrors: [
        'timeout', 'ETIMEDOUT', 'ECONNRESET', 'fetch failed',
        'socket hang up', '504', '503', 'Stream error',
      ],
    },
    ragWeights: {
      vector: Number(process.env.AI_RAG_WEIGHT_VECTOR) || 0.5,
      graph: Number(process.env.AI_RAG_WEIGHT_GRAPH) || 0.3,
      web: Number(process.env.AI_RAG_WEIGHT_WEB) || 0.2,
    },
    observability: {
      enableTraceId: process.env.AI_ENABLE_TRACE_ID !== 'false',
      traceIdHeader: process.env.AI_TRACE_ID_HEADER || 'X-Trace-Id',
      verboseLogging: process.env.AI_VERBOSE_LOGGING === 'true',
    },
    complexityWeights: {
      analysis: Number(process.env.AI_COMPLEXITY_WEIGHT_ANALYSIS) || 20,
      prediction: Number(process.env.AI_COMPLEXITY_WEIGHT_PREDICTION) || 25,
      aggregation: Number(process.env.AI_COMPLEXITY_WEIGHT_AGGREGATION) || 15,
      timeRange: Number(process.env.AI_COMPLEXITY_WEIGHT_TIME_RANGE) || 15,
      multiServer: Number(process.env.AI_COMPLEXITY_WEIGHT_MULTI_SERVER) || 15,
      report: Number(process.env.AI_COMPLEXITY_WEIGHT_REPORT) || 20,
      rootCause: Number(process.env.AI_COMPLEXITY_WEIGHT_ROOT_CAUSE) || 30,
      ragSearch: Number(process.env.AI_COMPLEXITY_WEIGHT_RAG_SEARCH) || 25,
    },
  };

  const result = AIProxyConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    logger.error('❌ AI Proxy config validation failed:', result.error.issues);
    throw new Error(
      `Invalid AI Proxy configuration: ${result.error.issues.map((i) => i.message).join(', ')}`
    );
  }

  return result.data;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _config: AIProxyConfig | null = null;

/**
 * AI Proxy 설정 가져오기 (싱글톤)
 */
export function getAIProxyConfig(): AIProxyConfig {
  if (!_config) {
    _config = loadAIProxyConfig();
    logger.info(`🔧 AI Proxy config loaded (tier: ${_config.tier})`);
  }
  return _config;
}

/**
 * 설정 재로드 (테스트용)
 */
export function reloadAIProxyConfig(): AIProxyConfig {
  _config = null;
  return getAIProxyConfig();
}

// ============================================================================
// Convenience Getters
// ============================================================================

/**
 * 현재 Vercel 티어
 */
export function getVercelTier(): VercelTier {
  return getAIProxyConfig().tier;
}

/**
 * 현재 티어의 maxDuration 값 (빌드 타임 참조용)
 * @note 실제 라우트 파일에서는 리터럴 값 사용 필요
 */
export function getCurrentMaxDuration(): 10 | 60 {
  const config = getAIProxyConfig();
  return config.maxDuration[config.tier];
}

/**
 * 엔드포인트별 기본 타임아웃
 */
export function getDefaultTimeout(endpoint: ProxyEndpoint): number {
  return getAIProxyConfig().timeouts[endpoint].default;
}

/**
 * 엔드포인트별 최대 타임아웃
 */
export function getMaxTimeout(endpoint: ProxyEndpoint): number {
  return getAIProxyConfig().timeouts[endpoint].max;
}

/**
 * 엔드포인트별 최소 타임아웃
 */
export function getMinTimeout(endpoint: ProxyEndpoint): number {
  return getAIProxyConfig().timeouts[endpoint].min;
}

/**
 * 타임아웃 값을 유효 범위로 클램프
 */
export function clampTimeout(endpoint: ProxyEndpoint, timeout: number): number {
  const config = getAIProxyConfig().timeouts[endpoint];
  return Math.max(config.min, Math.min(config.max, timeout));
}

/**
 * 캐시 TTL 가져오기 (초)
 */
export function getCacheTTL(endpoint: CacheEndpoint): number {
  return getAIProxyConfig().cacheTTL[endpoint];
}

// ============================================================================
// Query Routing Getters
// ============================================================================

/**
 * 복잡도 임계값 가져오기
 * @description 이 점수 초과시 Job Queue 사용
 */
export function getComplexityThreshold(): number {
  return getAIProxyConfig().queryRouting.complexityThreshold;
}

/**
 * Job Queue 강제 사용 키워드 목록
 */
export function getForceJobQueueKeywords(): string[] {
  return getAIProxyConfig().queryRouting.forceJobQueueKeywords;
}

// ============================================================================
// Stream Retry Getters
// ============================================================================

/**
 * 스트리밍 재시도 설정 전체 가져오기
 */
export function getStreamRetryConfig(): StreamRetryConfig {
  return getAIProxyConfig().streamRetry;
}

/**
 * 재시도 가능한 에러인지 확인
 */
export function isRetryableError(errorMessage: string): boolean {
  const config = getStreamRetryConfig();
  return config.retryableErrors.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * 재시도 대기 시간 계산 (지수 백오프 + Jitter)
 *
 * @description
 * Thundering herd 문제 방지를 위해 ±jitterFactor% 랜덤 지터 추가
 * 예: jitterFactor=0.1이면 ±10% 범위의 랜덤 변동
 *
 * @param attempt - 현재 시도 횟수 (0부터 시작)
 * @returns 지터가 적용된 대기 시간 (ms)
 */
export function calculateRetryDelay(attempt: number): number {
  const config = getStreamRetryConfig();
  const baseDelay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

  // 🎯 P0: Jitter 적용 (±jitterFactor% 범위)
  // Math.random()은 [0, 1) 범위이므로 (Math.random() * 2 - 1)은 [-1, 1) 범위
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

  // 최소 100ms 보장 (음수 방지)
  return Math.max(100, Math.round(cappedDelay + jitter));
}

// ============================================================================
// RAG Weights Getters
// ============================================================================

/**
 * RAG 검색 가중치 전체 가져오기
 */
export function getRAGWeights(): RAGWeightsConfig {
  return getAIProxyConfig().ragWeights;
}

// ============================================================================
// Observability Getters
// ============================================================================

/**
 * Observability 설정 전체 가져오기
 */
export function getObservabilityConfig(): ObservabilityConfig {
  return getAIProxyConfig().observability;
}

// ============================================================================
// Complexity Weights Getters
// ============================================================================

/**
 * 복잡도 카테고리 가중치 전체 가져오기
 * @description P1: query-complexity.ts에서 사용
 */
export function getComplexityCategoryWeights(): ComplexityCategoryWeights {
  return getAIProxyConfig().complexityWeights;
}

/**
 * 특정 카테고리 가중치 가져오기
 */
export function getComplexityCategoryWeight(
  category: keyof ComplexityCategoryWeights
): number {
  return getAIProxyConfig().complexityWeights[category];
}

// ============================================================================
// W3C Trace Context (re-exported from ai-proxy/tracing.ts)
// ============================================================================
export {
  generateTraceId,
  generateTraceparent,
  parseTraceparentTraceId,
  TRACEPARENT_HEADER,
  traceIdToUUID,
} from './ai-proxy/tracing';
