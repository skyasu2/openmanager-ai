import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging';
import { rateLimiters } from '@/lib/security/rate-limiter';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request: NextRequest) {
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
    return new NextResponse(null, { status: 204 });
  }

  try {
    // Fire-and-forget wake-up signal — 즉시 반환
    // Cloud Run cold start는 실제 쿼리의 50s 타임아웃이 처리하므로
    // 여기서 폴링할 필요 없음 (Vercel 함수 30초 점유 방지)
    logger.info(`Sending wake-up signal to ${CLOUD_RUN_URL}/warmup`);
    void fetch(`${CLOUD_RUN_URL}/warmup`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});

    return NextResponse.json({ status: 'ping_sent' });
  } catch (error) {
    logger.error('Wake-up failed:', error);
    return NextResponse.json(
      { status: 'error', error: String(error) },
      { status: 500 }
    );
  }
}
