/**
 * Langfuse Observability Integration
 *
 * MIT 라이선스 LLM 관측성 플랫폼
 * - 무료 티어: 50,000 events/월 (공식 가격)
 * - 트레이싱, 토큰 사용량, 성능 분석
 * - ⚠️ 무료 티어 초과 시 자동 비활성화
 *
 * @see https://langfuse.com/docs
 */

import { redisGet, redisSet } from '../../lib/redis-client';
import { logger } from '../../lib/logger';

// ============================================================================
// 0. 무료 티어 보호 시스템
// ============================================================================

const FREE_TIER_LIMIT = 50_000; // 월간 무료 한도
const SAFETY_THRESHOLD = 0.9; // 90%에서 차단 (45,000)
const DEFAULT_SAMPLE_RATE = 1.0; // 100% 전체 추적 (사용량 낮아 안전)

// 테스트 모드: 환경변수 또는 런타임 설정으로 100% 추적
let testModeEnabled = process.env.LANGFUSE_TEST_MODE === 'true';

// 테스트 모드 함수들은 클라이언트 선언 후 정의됨 (아래 섹션 참조)

interface UsageState {
  eventCount: number;
  monthKey: string; // "2025-01" 형식
  isDisabled: boolean;
  lastWarning: string | null;
}

// Redis 영속화 키 (월별)
const REDIS_KEY_PREFIX = 'langfuse:usage:';
function getUsageRedisKey(): string {
  return `${REDIS_KEY_PREFIX}${getCurrentMonthKey()}`;
}
const REDIS_TTL_SECONDS = 35 * 24 * 3600; // 35일

// 메모리 내 사용량 추적 (Redis 영속화로 재시작 시 복원)
let usageState: UsageState = {
  eventCount: 0,
  monthKey: getCurrentMonthKey(),
  isDisabled: false,
  lastWarning: null,
};

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function checkAndResetMonth(): void {
  const currentMonth = getCurrentMonthKey();
  if (usageState.monthKey !== currentMonth) {
    console.log(`🔄 [Langfuse] 월간 카운터 리셋: ${usageState.monthKey} → ${currentMonth}`);
    usageState = {
      eventCount: 0,
      monthKey: currentMonth,
      isDisabled: false,
      lastWarning: null,
    };
  }
}

function incrementUsage(count: number = 1): boolean {
  checkAndResetMonth();

  // 이미 비활성화된 경우
  if (usageState.isDisabled) {
    return false;
  }

  usageState.eventCount += count;
  const usagePercent = (usageState.eventCount / FREE_TIER_LIMIT) * 100;

  // 90% 도달 시 차단
  if (usageState.eventCount >= FREE_TIER_LIMIT * SAFETY_THRESHOLD) {
    usageState.isDisabled = true;
    logger.error(
      `🚨 [Langfuse] 무료 티어 한도 90% 도달! 자동 비활성화됨 ` +
        `(${usageState.eventCount.toLocaleString()}/${FREE_TIER_LIMIT.toLocaleString()} events)`
    );
    redisSet(getUsageRedisKey(), usageState, REDIS_TTL_SECONDS).catch(() => {});
    return false;
  }

  // 70%, 80% 경고
  const warningThresholds = [0.7, 0.8];
  for (const threshold of warningThresholds) {
    const thresholdKey = `${threshold * 100}%`;
    if (
      usageState.eventCount >= FREE_TIER_LIMIT * threshold &&
      usageState.lastWarning !== thresholdKey
    ) {
      usageState.lastWarning = thresholdKey;
      logger.warn(
        `⚠️ [Langfuse] 무료 티어 ${thresholdKey} 사용 중 ` +
          `(${usageState.eventCount.toLocaleString()}/${FREE_TIER_LIMIT.toLocaleString()} events)`
      );
    }
  }

  // Redis에 비동기 저장 (fire-and-forget)
  redisSet(getUsageRedisKey(), usageState, REDIS_TTL_SECONDS).catch(() => {});

  return true;
}

function shouldSample(): boolean {
  // 테스트 모드: 100% 추적
  if (testModeEnabled) {
    return true;
  }
  // 프로덕션: 100% 샘플링 (사용량 낮아 안전)
  return Math.random() < DEFAULT_SAMPLE_RATE;
}

// ============================================================================
// 0.5. 통합 샘플링 컨텍스트 (Issue #5 개선)
// ============================================================================

/**
 * 세션별 샘플링 상태 맵
 * - 동일 세션의 모든 이벤트가 일관되게 샘플링됨
 * - 메모리 누수 방지를 위해 TTL 적용 (5분)
 */
interface SamplingContext {
  sampled: boolean;
  createdAt: number;
}

const samplingContextMap = new Map<string, SamplingContext>();
const SAMPLING_CONTEXT_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * 세션에 대한 샘플링 결정 초기화
 * 이미 결정된 세션은 기존 결정을 유지
 */
export function initSamplingContext(sessionId: string): boolean {
  // 오래된 컨텍스트 정리 (5분 이상)
  cleanupStaleSamplingContexts();

  const existing = samplingContextMap.get(sessionId);
  if (existing) {
    return existing.sampled;
  }

  // 새 세션: 샘플링 결정
  const sampled = shouldSample();
  samplingContextMap.set(sessionId, {
    sampled,
    createdAt: Date.now(),
  });

  return sampled;
}

/**
 * 세션의 샘플링 상태 조회
 * 컨텍스트가 없으면 자동 초기화
 */
export function getSamplingContext(sessionId: string): boolean {
  const existing = samplingContextMap.get(sessionId);
  if (existing) {
    return existing.sampled;
  }

  // 컨텍스트 없으면 초기화
  return initSamplingContext(sessionId);
}

/**
 * 오래된 샘플링 컨텍스트 정리 (메모리 누수 방지)
 */
function cleanupStaleSamplingContexts(): void {
  const now = Date.now();
  for (const [sessionId, context] of samplingContextMap.entries()) {
    if (now - context.createdAt > SAMPLING_CONTEXT_TTL_MS) {
      samplingContextMap.delete(sessionId);
    }
  }
}

/**
 * 세션별 샘플링 여부 확인 (컨텍스트 기반)
 * sessionId가 없으면 독립 샘플링 사용
 */
function shouldSampleWithContext(sessionId?: string): boolean {
  if (testModeEnabled) {
    return true;
  }

  if (sessionId) {
    return getSamplingContext(sessionId);
  }

  // sessionId 없으면 독립 샘플링
  return shouldSample();
}

/** 서버 시작 시 Redis에서 사용량 복원 */
export async function restoreUsageFromRedis(): Promise<void> {
  try {
    const saved = await redisGet<UsageState>(getUsageRedisKey());
    if (saved && saved.monthKey === getCurrentMonthKey()) {
      usageState = saved;
      console.log(
        `♻️ [Langfuse] Redis에서 사용량 복원: ${saved.eventCount.toLocaleString()} events (${saved.monthKey})`
      );
    }
  } catch {
    // Redis 실패 시 인메모리 기본값 유지
    logger.warn('⚠️ [Langfuse] Redis 복원 실패, 인메모리 카운터 사용');
  }
}

/** 현재 사용량 상태 조회 */
export function getLangfuseUsageStatus(): {
  eventCount: number;
  limit: number;
  usagePercent: number;
  isDisabled: boolean;
  monthKey: string;
  testMode: boolean;
  sampleRate: string;
} {
  checkAndResetMonth();
  return {
    eventCount: usageState.eventCount,
    limit: FREE_TIER_LIMIT,
    usagePercent: Math.round((usageState.eventCount / FREE_TIER_LIMIT) * 100),
    isDisabled: usageState.isDisabled,
    monthKey: usageState.monthKey,
    testMode: testModeEnabled,
    sampleRate: testModeEnabled ? '100%' : `${DEFAULT_SAMPLE_RATE * 100}%`,
  };
}

// Langfuse types (manually defined to avoid import errors when module not installed)
interface LangfuseConfig {
  secretKey: string;
  publicKey: string;
  baseUrl?: string;
  flushAt?: number;
  flushInterval?: number;
}

interface LangfuseTrace {
  id?: string;
  generation: (params: {
    name: string;
    model: string;
    input: unknown;
    output?: string;
    usage?: { input: number; output: number; total: number };
    metadata?: Record<string, unknown>;
  }) => unknown;
  span: (params: {
    name: string;
    input: object;
    output: object;
    metadata?: Record<string, unknown>;
  }) => unknown;
  event: (params: { name: string; metadata?: Record<string, unknown> }) => unknown;
  update: (params: { output: string; metadata?: Record<string, unknown> }) => void;
  score: (params: { name: string; value: number }) => void;
}

interface LangfuseClient {
  trace: (params: {
    name: string;
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    input?: string;
  }) => LangfuseTrace;
  score: (params: {
    traceId: string;
    name: string;
    value: number;
  }) => void;
  flushAsync: () => Promise<void>;
  shutdownAsync: () => Promise<void>;
}

// Dynamic import wrapper
type LangfuseConstructor = new (config: LangfuseConfig) => LangfuseClient;
let LangfuseClass: LangfuseConstructor | null = null;
let loadAttempted = false;

async function loadLangfuse(): Promise<LangfuseConstructor | null> {
  if (loadAttempted) {
    return LangfuseClass;
  }
  loadAttempted = true;

  try {
    // Dynamic import with typed module shape
    const module = (await import('langfuse' as string)) as { Langfuse: LangfuseConstructor };
    LangfuseClass = module.Langfuse;
    return LangfuseClass;
  } catch {
    logger.warn('⚠️ [Langfuse] Module not installed, observability disabled');
    return null;
  }
}

// ============================================================================
// 1. Langfuse Client Singleton
// ============================================================================

let langfuseClient: LangfuseClient | null = null;
let initPromise: Promise<LangfuseClient> | null = null;

async function initLangfuse(): Promise<LangfuseClient> {
  const Langfuse = await loadLangfuse();

  if (!Langfuse) {
    return createNoOpLangfuse();
  }

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

  if (!secretKey || !publicKey) {
    logger.warn('⚠️ [Langfuse] Missing API keys, observability disabled');
    return createNoOpLangfuse();
  }

  // 테스트 모드: 즉시 플러시 (flushAt: 1), 프로덕션: 배치 플러시 (flushAt: 10)
  const flushConfig = testModeEnabled
    ? { flushAt: 1, flushInterval: 1000 }
    : { flushAt: 10, flushInterval: 5000 };

  const client = new Langfuse({
    secretKey,
    publicKey,
    baseUrl,
    ...flushConfig,
  });

  console.log(`✅ [Langfuse] Initialized with ${baseUrl} (flushAt: ${flushConfig.flushAt})`);
  return client;
}

export function getLangfuse(): LangfuseClient {
  // Synchronous access - use no-op if not initialized yet
  if (!langfuseClient) {
    // Start async initialization
    if (!initPromise) {
      initPromise = initLangfuse().then((client) => {
        langfuseClient = client;
        return client;
      });
    }
    // Return no-op until initialized
    return createNoOpLangfuse();
  }

  return langfuseClient;
}

/**
 * Prewarm Langfuse client during server startup to reduce first-request trace miss.
 */
export async function initializeLangfuseClient(): Promise<void> {
  if (langfuseClient) return;

  if (!initPromise) {
    initPromise = initLangfuse().then((client) => {
      langfuseClient = client;
      return client;
    });
  }

  await initPromise;
}

// ============================================================================
// 1.5. 테스트 모드 관리
// ============================================================================

/** Langfuse 클라이언트 재초기화 (설정 변경 시) */
async function reinitializeLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.flushAsync();
    await langfuseClient.shutdownAsync();
    langfuseClient = null;
    initPromise = null;
  }
  // 새 클라이언트로 재초기화 트리거
  initPromise = initLangfuse().then((client) => {
    langfuseClient = client;
    return client;
  });
  await initPromise;
}

/** 테스트 모드 활성화 (AI 어시스턴트 테스트 시 사용) */
export async function enableLangfuseTestMode(): Promise<void> {
  testModeEnabled = true;
  console.log('🧪 [Langfuse] 테스트 모드 활성화 - 100% 추적, 즉시 플러시');

  // 클라이언트 재초기화 (즉시 플러시 설정 적용)
  await reinitializeLangfuse();
}

/** 테스트 모드 비활성화 */
export async function disableLangfuseTestMode(): Promise<void> {
  testModeEnabled = false;
  console.log('🔒 [Langfuse] 테스트 모드 비활성화 - 100% 샘플링, 배치 플러시 복귀');

  // 클라이언트 재초기화 (배치 플러시 설정 적용)
  await reinitializeLangfuse();
}

// ============================================================================
// 2. Trace Helpers
// ============================================================================

export interface TraceMetadata {
  sessionId: string;
  userId?: string;
  mode?: 'single' | 'multi' | 'auto';
  query: string;
  /** Upstream trace ID from Vercel API (W3C traceparent). Links Cloud Run trace to client trace. */
  upstreamTraceId?: string;
}

export interface GenerationParams {
  model: string;
  provider: string;
  input: string | object;
  output?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Create a trace for a supervisor execution
 *
 * ⚠️ 무료 티어 보호:
 * - 10% 샘플링 적용 (90%는 No-Op)
 * - 월간 45,000 events 도달 시 자동 비활성화
 * - 통합 샘플링 컨텍스트: 동일 세션 내 모든 이벤트 일관 추적
 */
export function createSupervisorTrace(metadata: TraceMetadata): LangfuseTrace {
  // 1. 통합 샘플링 컨텍스트 체크 (세션 단위)
  //    - 세션 첫 요청 시 샘플링 결정
  //    - 이후 동일 세션의 모든 이벤트가 동일하게 추적됨
  if (!shouldSampleWithContext(metadata.sessionId)) {
    return createNoOpTrace();
  }

  // 2. 한도 체크 (90% 초과 시 차단)
  if (!incrementUsage(1)) {
    return createNoOpTrace();
  }

  const langfuse = getLangfuse();

  const trace = langfuse.trace({
    name: 'supervisor-execution',
    sessionId: metadata.sessionId,
    userId: metadata.userId,
    metadata: {
      mode: metadata.mode,
      queryLength: metadata.query.length,
      sampled: true, // 샘플링된 트레이스임을 표시
      ...(metadata.upstreamTraceId && {
        upstreamTraceId: metadata.upstreamTraceId,
      }),
    },
    input: metadata.query,
  });

  // Expose trace id if the underlying Langfuse SDK provides it
  const traceWithId = trace as LangfuseTrace & { id?: string };
  if (traceWithId.id) {
    return traceWithId;
  }
  return trace;
}

/** No-Op 트레이스 (샘플링 제외 또는 한도 초과 시) */
function createNoOpTrace(): LangfuseTrace {
  return {
    id: undefined,
    generation: () => ({}),
    span: () => ({}),
    event: () => ({}),
    update: () => {},
    score: () => {},
  };
}

/**
 * Log a generation (LLM call)
 */
export function logGeneration(trace: LangfuseTrace, params: GenerationParams): void {
  trace.generation({
    name: `${params.provider}/${params.model}`,
    model: params.model,
    input: params.input,
    output: params.output,
    usage: params.usage
      ? {
          input: params.usage.inputTokens,
          output: params.usage.outputTokens,
          total: params.usage.totalTokens,
        }
      : undefined,
    metadata: {
      provider: params.provider,
      duration: params.duration,
      ...params.metadata,
    },
  });
}

/**
 * Log a tool call span
 */
export function logToolCall(
  trace: LangfuseTrace,
  toolName: string,
  input: unknown,
  output: unknown,
  durationMs: number
): void {
  trace.span({
    name: `tool:${toolName}`,
    input: input as object,
    output: output as object,
    metadata: {
      durationMs,
      toolName,
    },
  });
}

/**
 * Log agent handoff
 */
export function logHandoff(
  trace: LangfuseTrace,
  fromAgent: string,
  toAgent: string,
  reason?: string
): void {
  trace.event({
    name: 'agent-handoff',
    metadata: {
      from: fromAgent,
      to: toAgent,
      reason,
    },
  });
}

/**
 * Finalize trace with output and score
 */
export function finalizeTrace(
  trace: LangfuseTrace,
  output: string,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  trace.update({
    output,
    metadata: {
      success,
      ...metadata,
    },
  });

  // Optionally add a score
  if (success) {
    trace.score({
      name: 'execution-success',
      value: 1,
    });
  }
}

/**
 * Record a score for an existing trace by its ID
 * Used for delayed scoring (e.g., user feedback)
 */
export function scoreByTraceId(traceId: string, name: string, value: number): boolean {
  if (!incrementUsage(1)) return false;

  try {
    const langfuse = getLangfuse();
    langfuse.score({ traceId, name, value });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [Langfuse] scoreByTraceId failed for trace ${traceId}: ${errorMessage}`);
    return false;
  }
}

/**
 * Flush pending traces (call before shutdown)
 */
export async function flushLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.flushAsync();
  }
}

/**
 * Shutdown Langfuse client
 */
export async function shutdownLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.shutdownAsync();
    langfuseClient = null;
  }
}

// ============================================================================
// 3. No-Op Client (for when keys are missing or module not installed)
// ============================================================================

function createNoOpLangfuse(): LangfuseClient {
  // Create a mock that does nothing
  const noOpTrace: LangfuseTrace = {
    id: undefined,
    generation: () => ({}),
    span: () => ({}),
    event: () => ({}),
    update: () => {},
    score: () => {},
  };

  return {
    trace: () => noOpTrace,
    score: () => {},
    flushAsync: async () => {},
    shutdownAsync: async () => {},
  };
}

// ============================================================================
// 4. Timeout Tracking Functions
// ============================================================================

/**
 * 타임아웃 이벤트 컨텍스트
 */
export interface TimeoutEventContext {
  operation: string;
  elapsed: number;
  threshold: number;
  sessionId?: string;
}

/**
 * 타임아웃 이벤트 로깅
 *
 * 경고(warning) 또는 오류(error) 수준의 타임아웃 이벤트를 Langfuse에 기록합니다.
 * 통합 샘플링 컨텍스트: 동일 세션 내 모든 이벤트가 일관되게 추적됩니다.
 *
 * @param type - 이벤트 유형 ('warning' | 'error')
 * @param context - 타임아웃 컨텍스트
 *
 * @example
 * ```ts
 * logTimeoutEvent('warning', {
 *   operation: 'orchestrator',
 *   elapsed: 25000,
 *   threshold: 25000,
 *   sessionId: 'sess-123',
 * });
 * ```
 */
export function logTimeoutEvent(
  type: 'warning' | 'error',
  context: TimeoutEventContext
): void {
  // 1. 통합 샘플링 컨텍스트 체크 (세션 단위)
  if (!shouldSampleWithContext(context.sessionId)) {
    return;
  }

  // 2. 한도 체크 (90% 초과 시 차단)
  if (!incrementUsage(1)) {
    return;
  }

  const langfuse = getLangfuse();

  langfuse.trace({
    name: `timeout_${type}`,
    sessionId: context.sessionId,
    metadata: {
      operation: context.operation,
      elapsed: context.elapsed,
      threshold: context.threshold,
      ratio: Math.round((context.elapsed / context.threshold) * 100) / 100,
      level: type === 'error' ? 'ERROR' : 'WARNING',
    },
    input: JSON.stringify({
      operation: context.operation,
      elapsed: `${context.elapsed}ms`,
      threshold: `${context.threshold}ms`,
    }),
  });

  // 구조화 로그 (GCP Cloud Logging severity 매핑)
  const msg = `[Langfuse] Timeout ${type}: ${context.operation} (${context.elapsed}ms / ${context.threshold}ms threshold)`;
  if (type === 'error') {
    logger.error(msg);
  } else {
    logger.warn(msg);
  }
}

/**
 * 타임아웃 모니터링 Span 생성자 반환 타입
 */
export interface TimeoutSpanHandle {
  /**
   * Span 완료 처리
   * @param success - 작업 성공 여부
   * @param elapsed - 경과 시간 (ms)
   */
  complete: (success: boolean, elapsed: number) => void;
}

/**
 * 타임아웃 모니터링 Span 생성
 *
 * 작업의 타임아웃 상태를 추적하는 span을 생성합니다.
 * 작업 완료 시 complete() 호출로 성공/실패 및 시간 활용률을 기록합니다.
 * 통합 샘플링 컨텍스트: 동일 세션 내 모든 이벤트가 일관되게 추적됩니다.
 *
 * @param traceId - 연결할 trace ID (sessionId로 사용)
 * @param operation - 작업 이름
 * @param timeout - 타임아웃 임계값 (ms)
 * @returns Span 완료 핸들러
 *
 * @example
 * ```ts
 * const span = createTimeoutSpan('sess-123', 'orchestrator', 50000);
 * try {
 *   await doWork();
 *   span.complete(true, Date.now() - startTime);
 * } catch (error) {
 *   span.complete(false, Date.now() - startTime);
 * }
 * ```
 */
export function createTimeoutSpan(
  traceId: string,
  operation: string,
  timeout: number
): TimeoutSpanHandle {
  // 통합 샘플링 컨텍스트 체크 (traceId = sessionId)
  if (!shouldSampleWithContext(traceId) || !incrementUsage(1)) {
    return {
      complete: () => {},
    };
  }

  const langfuse = getLangfuse();
  const startTime = Date.now();

  // Trace 생성 (span 역할)
  const trace = langfuse.trace({
    name: `timeout_monitor_${operation}`,
    sessionId: traceId,
    metadata: {
      timeout,
      operation,
      startTime: new Date().toISOString(),
    },
  });

  return {
    complete: (success: boolean, elapsed: number) => {
      const didTimeout = elapsed >= timeout;
      const utilizationPercent = Math.round((elapsed / timeout) * 100);

      trace.update({
        output: JSON.stringify({
          success,
          elapsed: `${elapsed}ms`,
          didTimeout,
          utilizationPercent: `${utilizationPercent}%`,
        }),
        metadata: {
          success,
          elapsed,
          didTimeout,
          utilizationPercent,
          endTime: new Date().toISOString(),
          actualDuration: Date.now() - startTime,
        },
      });

      // 타임아웃 발생 시 스코어 기록
      if (didTimeout) {
        trace.score({
          name: 'timeout-occurred',
          value: 0,
        });
      } else if (success) {
        trace.score({
          name: 'within-timeout',
          value: 1,
        });
      }
    },
  };
}

// ============================================================================
// 5. Export Types
// ============================================================================

export type { LangfuseClient, LangfuseTrace };
