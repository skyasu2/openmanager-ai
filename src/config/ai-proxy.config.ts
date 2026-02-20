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
 * 공식 Limits를 반영해 운영:
 * - Legacy runtime: Hobby 기본 10초, 최대 60초 / Pro 기본 15초, 최대 300초
 * - Fluid Compute: Hobby/Pro 기본 300초, Pro/Enterprise 최대 800초
 * - Edge streaming: 최초 응답은 25초 내 시작 필요, 스트리밍 지속 300초
 *
 * Vercel 티어 변경 시:
 * 1. VERCEL_TIER 또는 VERCEL_PLAN 환경변수로 티어 반영
 * 2. AI_MAX_FUNCTION_DURATION_SECONDS 로 런타임 예산 조정
 * 3. 라우트의 maxDuration은 빌드 타임 상수로 문서화
 */

import { z } from 'zod';
import { logger } from '@/lib/logging';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Vercel 티어 스키마
 */
const VercelTierSchema = z.enum(['free', 'pro']).default('free');

const TierMaxDurationSecondsSchema = z.number().int().min(1).max(800).default(60);

const FunctionTimeoutReserveSchema = z
  .number()
  .int()
  .min(200)
  .max(10_000)
  .default(1_500);

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
  /** Vercel 티어 (build-time 기준): free/pro 모두 런타임 제한 반영 */
  tier: VercelTierSchema,

  /** 티어별 maxDuration (빌드 타임 참조용) */
  maxDuration: z.object({
    free: TierMaxDurationSecondsSchema,
    pro: TierMaxDurationSecondsSchema,
  }),

  /** 런타임에서 실제로 적용할 최대 함수 실행 시간 (ms) */
  maxFunctionDurationMs: z.number().int().min(1_000).max(800_000),

  /** 런타임 안전 마진 (ms) */
  functionTimeoutReserveMs: FunctionTimeoutReserveSchema,

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
 * Free tier 타임아웃 기본값(현재 60초 상한 기준 보수값)
 */
const FREE_TIER_TIMEOUTS = {
  supervisor: { min: 3000, max: 9000, default: 5000 },
  'incident-report': { min: 5000, max: 9000, default: 7000 },
  'intelligent-monitoring': { min: 3000, max: 9000, default: 5000 },
  'analyze-server': { min: 3000, max: 9000, default: 5000 },
} as const;

/**
 * Pro tier 타임아웃 (비용 안정성을 고려해 하향 기본값에서 시작)
 */
const PRO_TIER_TIMEOUTS = {
  supervisor: { min: 15000, max: 55000, default: 30000 },
  'incident-report': { min: 20000, max: 45000, default: 30000 },
  'intelligent-monitoring': { min: 10000, max: 30000, default: 15000 },
  'analyze-server': { min: 8000, max: 25000, default: 12000 },
} as const;

const RAG_WEIGHTS_DEFAULT_KEYS = {
  vector: 'AI_RAG_WEIGHT_VECTOR',
  graph: 'AI_RAG_WEIGHT_GRAPH',
  web: 'AI_RAG_WEIGHT_WEB',
} as const;

const COMPLEXITY_WEIGHTS_DEFAULT_KEYS = {
  analysis: 'AI_COMPLEXITY_WEIGHT_ANALYSIS',
  prediction: 'AI_COMPLEXITY_WEIGHT_PREDICTION',
  aggregation: 'AI_COMPLEXITY_WEIGHT_AGGREGATION',
  timeRange: 'AI_COMPLEXITY_WEIGHT_TIME_RANGE',
  multiServer: 'AI_COMPLEXITY_WEIGHT_MULTI_SERVER',
  report: 'AI_COMPLEXITY_WEIGHT_REPORT',
  rootCause: 'AI_COMPLEXITY_WEIGHT_ROOT_CAUSE',
  ragSearch: 'AI_COMPLEXITY_WEIGHT_RAG_SEARCH',
} as const;

const DEFAULT_MAX_DURATION_SECONDS: Record<VercelTier, number> = {
  free: 60,
  pro: 300,
};

const parseOptionalIntEnv = (key: string): number | null => {
  const raw = process.env[key];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseOptionalDecimalEnv = (key: string): number | null => {
  const raw = process.env[key];
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseOptionalBooleanEnv = (key: string): boolean | null => {
  const raw = process.env[key]?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
};

const parseStringListEnv = (key: string): string[] | null => {
  const raw = process.env[key];
  if (!raw) return null;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const parseNumericWithDefault = <T extends number>(
  key: string,
  fallback: T,
  validate: (value: number) => boolean
): T => {
  const parsed = parseOptionalIntEnv(key);
  return parsed === null || !validate(parsed) ? fallback : (parsed as T);
};

const parseDecimalWithDefault = <T extends number>(
  key: string,
  fallback: T,
  validate: (value: number) => boolean
): T => {
  const parsed = parseOptionalDecimalEnv(key);
  return parsed === null || !validate(parsed) ? fallback : (parsed as T);
};

const parseTier = (rawTier?: string, rawPlan?: string): VercelTier => {
  const tier = rawTier?.toLowerCase();
  const plan = rawPlan?.toLowerCase();

  if (tier === 'free' || tier === 'hobby' || tier === 'pro') {
    return tier === 'pro' ? 'pro' : 'free';
  }

  if (plan === 'free' || plan === 'hobby') {
    return 'free';
  }

  if (plan === 'pro' || plan === 'enterprise' || plan === 'ent') {
    return 'pro';
  }

  return 'free';
};

const clampTimeoutEnv = (value: number, min = 1_000, max = 60_000): number => {
  return Math.max(min, Math.min(max, value));
};

// ============================================================================
// Config Loader
// ============================================================================

/**
 * 환경변수에서 설정 로드 및 검증
 */
function loadAIProxyConfig(): AIProxyConfig {
  const tier = parseTier(
    process.env.VERCEL_TIER?.trim(),
    process.env.VERCEL_PLAN?.trim()
  );
  const timeouts = tier === 'pro' ? PRO_TIER_TIMEOUTS : FREE_TIER_TIMEOUTS;
  const configuredMaxDurationSeconds = parseNumericWithDefault(
    'AI_MAX_FUNCTION_DURATION_SECONDS',
    DEFAULT_MAX_DURATION_SECONDS[tier],
    (value) => value >= 10 && value <= 800
  );
  const functionTimeoutReserveMs = parseNumericWithDefault(
    'AI_FUNCTION_TIMEOUT_RESERVE_MS',
    tier === 'pro' ? 2_000 : 1_500,
    (value) => value >= 200 && value <= 10_000
  );
  const forceJobQueueKeywords = parseStringListEnv('AI_FORCE_JOB_QUEUE_KEYWORDS');

  const rawConfig = {
    tier,
    maxDuration: {
      free: clampTimeoutEnv(configuredMaxDurationSeconds, 10, 300),
      pro: clampTimeoutEnv(configuredMaxDurationSeconds, 10, 800),
    },
    maxFunctionDurationMs: clampTimeoutEnv(
      configuredMaxDurationSeconds * 1_000,
      1_000,
      800_000
    ),
    functionTimeoutReserveMs,
    timeouts,
    cacheTTL: {
      'supervisor-status': 300,
      supervisor: 1800,
      'incident-report': 3600,
      'intelligent-monitoring': 600,
    },
    queryRouting: {
      complexityThreshold: parseNumericWithDefault(
        'AI_COMPLEXITY_THRESHOLD',
        19,
        (value) => value >= 1 && value <= 100
      ),
      forceJobQueueKeywords:
        forceJobQueueKeywords ?? [
          '보고서', '리포트', '근본 원인', '장애 분석', '전체 분석',
        ],
    },
    streamRetry: {
      maxRetries: parseNumericWithDefault(
        'AI_STREAM_MAX_RETRIES',
        3,
        (value) => value >= 0 && value <= 5
      ),
      initialDelayMs: parseNumericWithDefault(
        'AI_STREAM_INITIAL_DELAY',
        1_000,
        (value) => value >= 100 && value <= 5_000
      ),
      backoffMultiplier: parseNumericWithDefault(
        'AI_STREAM_BACKOFF_MULTIPLIER',
        2,
        (value) => value >= 1 && value <= 5
      ),
      maxDelayMs: parseNumericWithDefault(
        'AI_STREAM_MAX_DELAY',
        10_000,
        (value) => value >= 1_000 && value <= 30_000
      ),
      jitterFactor: parseDecimalWithDefault(
        'AI_STREAM_JITTER_FACTOR',
        0.1,
        (value) => value >= 0 && value <= 1
      ),
      retryableErrors: [
        'timeout', 'ETIMEDOUT', 'ECONNRESET', 'fetch failed',
        'socket hang up', '504', '503', 'Stream error',
      ],
    },
    ragWeights: {
      vector: parseDecimalWithDefault(
        RAG_WEIGHTS_DEFAULT_KEYS.vector,
        0.5,
        (value) => value >= 0 && value <= 1
      ),
      graph: parseDecimalWithDefault(
        RAG_WEIGHTS_DEFAULT_KEYS.graph,
        0.3,
        (value) => value >= 0 && value <= 1
      ),
      web: parseDecimalWithDefault(
        RAG_WEIGHTS_DEFAULT_KEYS.web,
        0.2,
        (value) => value >= 0 && value <= 1
      ),
    },
    observability: {
      enableTraceId: parseOptionalBooleanEnv('AI_ENABLE_TRACE_ID') !== false,
      traceIdHeader: process.env.AI_TRACE_ID_HEADER || 'X-Trace-Id',
      verboseLogging: process.env.AI_VERBOSE_LOGGING === 'true',
    },
    complexityWeights: {
      analysis: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.analysis,
        20,
        (value) => value >= 0 && value <= 50
      ),
      prediction: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.prediction,
        25,
        (value) => value >= 0 && value <= 50
      ),
      aggregation: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.aggregation,
        15,
        (value) => value >= 0 && value <= 50
      ),
      timeRange: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.timeRange,
        15,
        (value) => value >= 0 && value <= 50
      ),
      multiServer: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.multiServer,
        15,
        (value) => value >= 0 && value <= 50
      ),
      report: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.report,
        20,
        (value) => value >= 0 && value <= 50
      ),
      rootCause: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.rootCause,
        30,
        (value) => value >= 0 && value <= 50
      ),
      ragSearch: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.ragSearch,
        25,
        (value) => value >= 0 && value <= 50
      ),
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
export function getCurrentMaxDuration(): number {
  const config = getAIProxyConfig();
  return config.maxDuration[config.tier];
}

/**
 * 라우트 maxDuration(초)와 런타임 제한을 함께 고려한 실행 상한(ms)
 *
 * - routeMaxDurationSeconds: Next.js route.ts에서 export const maxDuration로 선언된 값
 * - 런타임 제한: AI_MAX_FUNCTION_DURATION_SECONDS 또는 기본값
 *
 * 양쪽 중 더 작은 값을 반환해 route-level 설정 변경 시 과한 타임아웃을 방지.
 */
export function getRouteMaxExecutionMs(routeMaxDurationSeconds: number): number {
  if (!Number.isFinite(routeMaxDurationSeconds) || routeMaxDurationSeconds <= 0) {
    return 0;
  }
  const routeMaxMs = routeMaxDurationSeconds * 1_000;
  return Math.max(0, Math.min(routeMaxMs, getMaxFunctionDurationMs()));
}

/**
 * 현재 Vercel 런타임 최대 실행 시간 (ms)
 */
export function getMaxFunctionDurationMs(): number {
  return getAIProxyConfig().maxFunctionDurationMs;
}

/**
 * 함수 종료 여유 버퍼 (응답 처리/로깅/직렬화 여유)
 */
export function getFunctionTimeoutReserveMs(): number {
  return getAIProxyConfig().functionTimeoutReserveMs;
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
