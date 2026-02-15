/**
 * Supervisor Error Handler
 *
 * supervisor/route.ts에서 분리된 에러 분류 및 응답 로직
 *
 * @created 2026-02-01 (route.ts SRP 분리)
 * @updated 2026-02-10 (AsyncLocalStorage: traceId 자동 주입)
 */

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getObservabilityConfig } from '@/config/ai-proxy.config';
import { logger } from '@/lib/logging';
import { getTraceId } from '@/lib/tracing/async-context';

/**
 * Supervisor 에러를 분류하고 적절한 HTTP 응답 생성
 * traceId는 AsyncLocalStorage에서 자동 조회
 */
export function handleSupervisorError(error: unknown): NextResponse {
  const observabilityConfig = getObservabilityConfig();
  const traceId = getTraceId();

  logger.error('❌ AI 스트리밍 처리 실패:', error);

  // Sentry에 AI context와 함께 에러 전송
  Sentry.withScope((scope: Sentry.Scope) => {
    scope.setTag('component', 'ai-supervisor');
    if (traceId) scope.setTag('traceId', traceId);
    if (error instanceof Error) {
      const isCircuitOpen = error.message.includes('일시적으로 중단되었습니다');
      const isTimeout =
        error.message.includes('timeout') || error.message.includes('TIMEOUT');
      scope.setTag(
        'ai_error_type',
        isCircuitOpen ? 'circuit_open' : isTimeout ? 'timeout' : 'general'
      );
    }
    scope.setLevel(
      error instanceof Error && error.message.includes('timeout')
        ? 'warning'
        : 'error'
    );
    Sentry.captureException(error);
  });

  // 공통 헤더 생성
  const baseHeaders: Record<string, string> = {};
  if (traceId && observabilityConfig.enableTraceId) {
    baseHeaders[observabilityConfig.traceIdHeader] = traceId;
  }

  if (error instanceof Error) {
    logger.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.slice(0, 500),
    });

    // Circuit Breaker Open
    if (error.message.includes('일시적으로 중단되었습니다')) {
      const retryMatch = error.message.match(/(\d+)초 후/);
      const retryAfter = retryMatch?.[1] ?? '60';

      return NextResponse.json(
        {
          success: false,
          error: 'AI service circuit open',
          message:
            'AI 서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.',
          retryAfter: parseInt(retryAfter, 10),
          traceId,
        },
        {
          status: 503,
          headers: { 'Retry-After': retryAfter, ...baseHeaders },
        }
      );
    }

    // Timeout
    if (
      error.message.includes('timeout') ||
      error.message.includes('TIMEOUT')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Request timeout',
          message:
            'AI 분석이 시간 내에 완료되지 않았습니다. 더 간단한 질문으로 시도해주세요.',
          traceId,
        },
        { status: 504, headers: baseHeaders }
      );
    }
  }

  // 프로덕션에서는 내부 에러 메시지를 노출하지 않음
  const safeMessage =
    process.env.NODE_ENV === 'production'
      ? 'AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      : error instanceof Error
        ? error.message
        : 'Unknown error occurred';

  return NextResponse.json(
    {
      success: false,
      error: 'AI processing failed',
      message: safeMessage,
      traceId,
    },
    { status: 500, headers: baseHeaders }
  );
}
