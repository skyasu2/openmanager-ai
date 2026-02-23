import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging';
import { rateLimiters } from '@/lib/security/rate-limiter';

export const runtime = 'nodejs';
export const maxDuration = 30; // cold start 포함 15초 + 여유

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
    // Cloud Run cold start 대응: 실제로 응답을 기다려야 컨테이너 기동 보장
    // void fetch는 Vercel 함수 종료 후 kill될 수 있어 웜업 실패 원인이었음
    logger.info(`Sending wake-up signal to ${CLOUD_RUN_URL}/warmup`);
    const res = await fetch(`${CLOUD_RUN_URL}/warmup`, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000), // cold start 포함 15초
    });

    if (res.ok) {
      return NextResponse.json({ status: 'warmed_up' });
    }
    return NextResponse.json({ status: 'ping_sent', httpStatus: res.status });
  } catch (error) {
    // 타임아웃이어도 Cloud Run은 이미 기동 시작됨 — 부분 성공으로 처리
    const isTimeout =
      error instanceof DOMException && error.name === 'AbortError';
    logger.warn(
      `Wake-up ${isTimeout ? 'timeout (container starting)' : 'failed'}:`,
      error
    );
    return NextResponse.json({
      status: isTimeout ? 'starting' : 'error',
    });
  }
}
