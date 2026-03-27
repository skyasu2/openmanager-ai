/**
 * LLM Observability — OTel GenAI Semantic Conventions
 *
 * AI 요청/응답의 구조적 로깅을 제공합니다.
 * OpenTelemetry GenAI 시맨틱 컨벤션(gen_ai.*)을 따릅니다.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/
 */

import { createModuleLogger } from '@/lib/logging';

const aiLogger = createModuleLogger('gen_ai');

type AIOperationType = 'chat' | 'completion' | 'embedding';

type AIRequestEvent = {
  /** OTel: gen_ai.operation.name */
  operation: AIOperationType;
  /** OTel: gen_ai.system — e.g. 'groq', 'cerebras', 'mistral', 'gemini' */
  system: string;
  /** OTel: gen_ai.request.model */
  model: string;
  /** OTel: gen_ai.request.max_tokens (optional) */
  maxTokens?: number;
  /** OTel: gen_ai.request.temperature (optional) */
  temperature?: number;
  /** 라우팅된 에이전트 이름 (e.g. 'nlq', 'analyst', 'reporter') */
  agent?: string;
  /** 세션 ID */
  sessionId?: string;
  /** 요청 traceId */
  traceId?: string;
  /** 사용자 쿼리 요약 (첫 80자) */
  querySummary?: string;
};

type AIResponseEvent = {
  /** OTel: gen_ai.operation.name */
  operation: AIOperationType;
  /** OTel: gen_ai.system */
  system: string;
  /** OTel: gen_ai.response.model */
  model: string;
  /** OTel: gen_ai.usage.input_tokens */
  inputTokens?: number;
  /** OTel: gen_ai.usage.output_tokens */
  outputTokens?: number;
  /** 응답 지연 시간 (ms) */
  latencyMs: number;
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 (실패 시) */
  errorMessage?: string;
  /** 에이전트 이름 */
  agent?: string;
  /** 캐시 히트 여부 */
  cacheHit?: boolean;
  /** traceId */
  traceId?: string;
};

/**
 * AI 요청 시작 로깅
 *
 * @example
 * ```typescript
 * logAIRequest({
 *   operation: 'chat',
 *   system: 'groq',
 *   model: 'llama-3.3-70b-versatile',
 *   agent: 'nlq',
 *   sessionId: 'user_guest_session_123',
 *   querySummary: '서버 CPU 사용률이 높은 이유는?',
 * });
 * ```
 */
export function logAIRequest(event: AIRequestEvent): void {
  aiLogger.info({
    'gen_ai.operation.name': event.operation,
    'gen_ai.system': event.system,
    'gen_ai.request.model': event.model,
    ...(event.maxTokens && {
      'gen_ai.request.max_tokens': event.maxTokens,
    }),
    ...(event.temperature !== undefined && {
      'gen_ai.request.temperature': event.temperature,
    }),
    ...(event.agent && { 'gen_ai.agent': event.agent }),
    ...(event.sessionId && { session_id: event.sessionId }),
    ...(event.traceId && { trace_id: event.traceId }),
    ...(event.querySummary && { query_summary: event.querySummary }),
  });
}

/**
 * AI 응답 완료 로깅
 *
 * @example
 * ```typescript
 * logAIResponse({
 *   operation: 'chat',
 *   system: 'groq',
 *   model: 'llama-3.3-70b-versatile',
 *   inputTokens: 1200,
 *   outputTokens: 450,
 *   latencyMs: 2340,
 *   success: true,
 *   agent: 'nlq',
 * });
 * ```
 */
export function logAIResponse(event: AIResponseEvent): void {
  const logFn = event.success ? aiLogger.info : aiLogger.error;

  logFn({
    'gen_ai.operation.name': event.operation,
    'gen_ai.system': event.system,
    'gen_ai.response.model': event.model,
    ...(event.inputTokens && {
      'gen_ai.usage.input_tokens': event.inputTokens,
    }),
    ...(event.outputTokens && {
      'gen_ai.usage.output_tokens': event.outputTokens,
    }),
    latency_ms: event.latencyMs,
    success: event.success,
    ...(event.errorMessage && { error_message: event.errorMessage }),
    ...(event.agent && { 'gen_ai.agent': event.agent }),
    ...(event.cacheHit !== undefined && { cache_hit: event.cacheHit }),
    ...(event.traceId && { trace_id: event.traceId }),
  });
}

type AITimingHeaderOptions = {
  latencyMs: number;
  processingTimeMs?: number | null;
  cacheStatus?: 'HIT' | 'MISS' | 'BYPASS';
  mode?: 'streaming' | 'job-queue' | 'proxy';
  source?: string;
};

/**
 * 브라우저/QA가 AI 응답 시간을 헤더만으로 읽을 수 있도록 표준/커스텀 헤더를 생성한다.
 *
 * 참고:
 * - `X-AI-Latency-Ms` / `X-AI-Processing-Ms`가 운영 SSOT이다.
 * - `Server-Timing`은 로컬/일부 호스팅 경로에서는 보이지만, Vercel production 응답에서는
 *   스트리밍/프록시 경로에서 제거될 수 있으므로 보조 진단 신호로만 사용한다.
 */
export function buildAITimingHeaders(
  options: AITimingHeaderOptions
): Record<string, string> {
  const latencyMs = Math.max(0, Math.round(options.latencyMs));
  const headers: Record<string, string> = {
    'X-AI-Latency-Ms': String(latencyMs),
    'Server-Timing': `ai;dur=${latencyMs}`,
  };

  if (options.processingTimeMs != null) {
    const processingTimeMs = Math.max(0, Math.round(options.processingTimeMs));
    headers['X-AI-Processing-Ms'] = String(processingTimeMs);
    headers['Server-Timing'] += `, ai_processing;dur=${processingTimeMs}`;
  }

  if (options.cacheStatus) {
    headers['X-AI-Cache-Status'] = options.cacheStatus;
  }

  if (options.mode) {
    headers['X-AI-Mode'] = options.mode;
  }

  if (options.source) {
    headers['X-AI-Source'] = options.source;
  }

  return headers;
}

/**
 * AI 요청-응답 사이클을 측정하는 헬퍼.
 * 시작 타임스탬프를 반환하며, 완료 시 logAIResponse에 latencyMs를 전달합니다.
 */
export function startAITimer(): { elapsed: () => number } {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
  };
}
