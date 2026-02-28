import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging';
import { rateLimiters } from '@/lib/security/rate-limiter';

// MIGRATED: Removed export const runtime = "nodejs" (default)
export const maxDuration = 30; // cold start 포함 15초 + 여유
const AI_WARMUP_SOURCE_HEADER = 'x-ai-warmup-source';

export async function POST(request: NextRequest) {
  const warmupSource =
    request.headers.get(AI_WARMUP_SOURCE_HEADER) || 'unknown';
  const warmupStartedAt = Date.now();

  const rateLimitResult = await rateLimiters.dataGenerator.checkLimit(request);
  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil(
      (rateLimitResult.resetTime - Date.now()) / 1000
    );
    const retryAfterSec = Math.max(retryAfter, 1);
    return NextResponse.json(
      { status: 'rate_limited', retryAfter: retryAfterSec },
      { status: 429, headers: { 'Retry-After': retryAfterSec.toString() } }
    );
  }

  const CLOUD_RUN_URL = process.env.CLOUD_RUN_AI_URL;

  if (!CLOUD_RUN_URL) {
    logger.warn(
      {
        event: 'warmup_skipped',
        source: warmupSource,
        reason: 'cloud_run_url_missing',
      },
      '[AI Warmup] Skipped'
    );
    return new NextResponse(null, { status: 204 });
  }

  try {
    logger.info(
      {
        event: 'warmup_started',
        source: warmupSource,
      },
      '[AI Warmup] Started'
    );

    // Cloud Run cold start 대응: 실제로 응답을 기다려야 컨테이너 기동 보장
    // void fetch는 Vercel 함수 종료 후 kill될 수 있어 웜업 실패 원인이었음
    const res = await fetch(`${CLOUD_RUN_URL}/warmup`, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000), // cold start 포함 15초
    });
    const warmupLatencyMs = Date.now() - warmupStartedAt;

    if (res.ok) {
      logger.info(
        {
          event: 'warmup_ready',
          source: warmupSource,
          warmup_latency_ms: warmupLatencyMs,
          upstream_status: res.status,
        },
        '[AI Warmup] Ready'
      );
      return NextResponse.json({ status: 'warmed_up' });
    }
    logger.warn(
      {
        event: 'warmup_upstream_not_ready',
        source: warmupSource,
        warmup_latency_ms: warmupLatencyMs,
        upstream_status: res.status,
      },
      '[AI Warmup] Upstream not ready'
    );
    return NextResponse.json({ status: 'ping_sent', httpStatus: res.status });
  } catch (error) {
    // 타임아웃이어도 Cloud Run은 이미 기동 시작됨 — 부분 성공으로 처리
    const isTimeout =
      error instanceof DOMException && error.name === 'AbortError';
    logger.warn(
      {
        event: isTimeout ? 'warmup_timeout' : 'warmup_failed',
        source: warmupSource,
        warmup_latency_ms: Date.now() - warmupStartedAt,
        error_name: error instanceof Error ? error.name : 'UnknownError',
        error_message: error instanceof Error ? error.message : String(error),
      },
      `[AI Warmup] ${isTimeout ? 'Timeout' : 'Failed'}`
    );
    return NextResponse.json({
      status: isTimeout ? 'starting' : 'error',
    });
  }
}
