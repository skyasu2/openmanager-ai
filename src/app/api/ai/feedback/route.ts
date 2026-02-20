// Vercel 빌드 타임 상수 (정적 분석용). 런타임 타임아웃은 config에서 관리.
export const maxDuration = 10;

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/api-auth';
import { aiLogger } from '@/lib/logger';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * AI 피드백 API 엔드포인트
 *
 * POST /api/ai/feedback - 피드백 저장 (Supabase + Langfuse)
 * GET /api/ai/feedback - 통계 조회
 *
 * @version 1.3.0 - Supabase 영속 저장 + withAuth (2026-02-14)
 */

const FEEDBACK_TABLE = 'ai_feedback';

const FeedbackRequestSchema = z.object({
  messageId: z.string().min(1),
  type: z.enum(['positive', 'negative']),
  timestamp: z.string().optional(),
  sessionId: z.string().optional(),
  traceId: z.string().optional(),
});

/** Cloud Run 피드백 프록시 타임아웃 (ms) */
const FEEDBACK_PROXY_TIMEOUT_MS = 5000;

/** Supabase에 피드백 저장 (Graceful - 실패해도 API 응답에 영향 없음) */
async function persistFeedback(feedback: {
  message_id: string;
  type: 'positive' | 'negative';
  timestamp: string;
  session_id?: string;
  trace_id?: string;
  user_agent?: string;
}): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from(FEEDBACK_TABLE).insert(feedback);
    if (error) {
      aiLogger.warn(`Supabase feedback insert failed: ${error.message}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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
    const timestamp = body.timestamp || new Date().toISOString();
    const userAgent = request.headers.get('user-agent') || undefined;

    // Supabase 영속 저장 (non-blocking)
    const dbSaved = await persistFeedback({
      message_id: body.messageId,
      type: body.type,
      timestamp,
      session_id: body.sessionId,
      trace_id: body.traceId,
      user_agent: userAgent,
    });

    aiLogger.info('Feedback received', {
      messageId: body.messageId,
      type: body.type,
      dbSaved,
    });

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
      stored: dbSaved ? 'database' : 'log_only',
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

// 인증 + Rate Limiting 적용 (분당 20회)
export const POST = withAuth((request: NextRequest) =>
  withRateLimit(rateLimiters.default, handlePOST)(request)
);

// GET: 피드백 통계 조회 (Supabase 기반)
async function handleGET(_request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from(FEEDBACK_TABLE)
      .select('type, timestamp, message_id')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error || !data) {
      return NextResponse.json({
        total: 0,
        positive: 0,
        negative: 0,
        recentFeedback: [],
        source: 'unavailable',
      });
    }

    return NextResponse.json({
      total: data.length,
      positive: data.filter((f) => f.type === 'positive').length,
      negative: data.filter((f) => f.type === 'negative').length,
      recentFeedback: data.slice(0, 10),
      source: 'database',
    });
  } catch {
    return NextResponse.json({
      total: 0,
      positive: 0,
      negative: 0,
      recentFeedback: [],
      source: 'error',
    });
  }
}

// 인증 + Rate Limiting 적용
export const GET = withAuth((request: NextRequest) =>
  withRateLimit(rateLimiters.default, handleGET)(request)
);
