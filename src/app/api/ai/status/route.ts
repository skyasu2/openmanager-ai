/**
 * AI Status API Endpoint
 * Circuit Breaker 상태, 이벤트 히스토리, 통계 조회
 *
 * v2.0.0 (2025-12-17): 초기 구현
 * - GET: AI 서비스 상태 조회
 * - POST: Circuit Breaker 수동 리셋 (관리자 전용)
 */

// Vercel 빌드 타임 상수 (정적 분석용). 런타임 타임아웃은 config에서 관리.
export const maxDuration = 10;

import { type NextRequest, NextResponse } from 'next/server';
import {
  aiCircuitBreaker,
  circuitBreakerEvents,
  getAIStatusSummary,
} from '@/lib/ai/circuit-breaker';
import { parseJsonBody } from '@/lib/api/parse-json-body';
import { withAdminAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { getErrorMessage } from '@/types/type-utils';

// Node.js 런타임 사용 (인메모리 상태 유지)
export const runtime = 'nodejs';

/**
 * GET /api/ai/status
 * AI 서비스 상태 조회
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');
    const eventLimit = parseInt(searchParams.get('eventLimit') ?? '20', 10);

    // 특정 서비스 상태만 조회
    if (service) {
      const breaker = aiCircuitBreaker.getBreaker(service);
      const status = breaker.getStatus();
      const events = circuitBreakerEvents.getHistory({
        service,
        limit: eventLimit,
      });

      return NextResponse.json({
        service,
        status,
        events,
        timestamp: Date.now(),
      });
    }

    // 전체 상태 조회
    const summary = getAIStatusSummary();

    return NextResponse.json({
      ...summary,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[AI Status API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get AI status',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/ai/status
 * Circuit Breaker 수동 리셋 (관리자 전용)
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const result = await parseJsonBody<{ action: string; service?: string }>(
      request
    );
    if (!result.success) return result.response;
    const { action, service } = result.data;

    switch (action) {
      case 'reset': {
        if (service) {
          // 특정 서비스 리셋
          const success = aiCircuitBreaker.resetBreaker(service);
          if (!success) {
            return NextResponse.json(
              { error: `Service '${service}' not found` },
              { status: 404 }
            );
          }
          return NextResponse.json({
            message: `Circuit breaker for '${service}' has been reset`,
            timestamp: Date.now(),
          });
        } else {
          // 전체 리셋
          aiCircuitBreaker.resetAll();
          return NextResponse.json({
            message: 'All circuit breakers have been reset',
            timestamp: Date.now(),
          });
        }
      }

      case 'clearHistory': {
        circuitBreakerEvents.clearHistory();
        return NextResponse.json({
          message: 'Event history has been cleared',
          timestamp: Date.now(),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[AI Status API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
});
