export const maxDuration = 10; // Vercel Pro Tier (경량 엔드포인트)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiLogger } from '@/lib/logger';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';

/**
 * AI 피드백 API 엔드포인트
 *
 * POST /api/ai/feedback
 *
 * 사용자 피드백 (👍/👎)을 수집하여 AI 품질 개선에 활용
 *
 * @version 1.1.0 - Rate Limiting 추가 (2026-01-03)
 * @version 1.2.0 - Zod 스키마 검증 추가
 */

const FeedbackRequestSchema = z.object({
  messageId: z.string().min(1),
  type: z.enum(['positive', 'negative']),
  timestamp: z.string().optional(),
  sessionId: z.string().optional(),
  traceId: z.string().optional(),
});

interface FeedbackLog {
  messageId: string;
  type: 'positive' | 'negative';
  timestamp: string;
  userAgent?: string;
}

/** Cloud Run 피드백 프록시 타임아웃 (ms) */
const FEEDBACK_PROXY_TIMEOUT_MS = 5000;

// 메모리 내 피드백 저장소 (MVP - 추후 DB 연동)
const feedbackStore: FeedbackLog[] = [];

async function handlePOST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = FeedbackRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = parsed.data;

    const feedbackLog: FeedbackLog = {
      messageId: body.messageId,
      type: body.type,
      timestamp: body.timestamp || new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
    };

    // 피드백 저장 (메모리)
    feedbackStore.push(feedbackLog);

    // 로그 출력 (개발/디버깅용)
    aiLogger.info('Feedback received', feedbackLog);

    // 최근 100개만 유지 (메모리 관리)
    if (feedbackStore.length > 100) {
      feedbackStore.shift();
    }

    // Forward to Cloud Run Langfuse if traceId is present
    let langfuseStatus: 'skipped' | 'success' | 'error' = 'skipped';
    if (
      body.traceId &&
      process.env.CLOUD_RUN_AI_URL &&
      process.env.CLOUD_RUN_API_SECRET
    ) {
      try {
        const res = await fetch(
          `${process.env.CLOUD_RUN_AI_URL}/api/ai/feedback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.CLOUD_RUN_API_SECRET,
            },
            body: JSON.stringify({
              traceId: body.traceId,
              score: body.type,
            }),
            signal: AbortSignal.timeout(FEEDBACK_PROXY_TIMEOUT_MS),
          }
        );
        langfuseStatus = res.ok ? 'success' : 'error';
        if (!res.ok) {
          aiLogger.error(
            `Cloud Run feedback proxy failed: ${res.status} ${res.statusText}`
          );
        }
      } catch (err) {
        langfuseStatus = 'error';
        aiLogger.error('Failed to forward feedback to Cloud Run', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded',
      feedbackId: `fb_${Date.now()}`,
      langfuseStatus,
    });
  } catch (error) {
    aiLogger.error('Feedback processing failed', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}

// Rate Limiting 적용 (분당 20회)
export const POST = withRateLimit(rateLimiters.default, handlePOST);

// GET: 피드백 통계 조회 (관리자용)
async function handleGET(_request: NextRequest) {
  const stats = {
    total: feedbackStore.length,
    positive: feedbackStore.filter((f) => f.type === 'positive').length,
    negative: feedbackStore.filter((f) => f.type === 'negative').length,
    recentFeedback: feedbackStore.slice(-10),
  };

  return NextResponse.json(stats);
}

// Rate Limiting 적용
export const GET = withRateLimit(rateLimiters.default, handleGET);
