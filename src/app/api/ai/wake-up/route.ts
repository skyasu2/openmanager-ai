import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging';
import { rateLimiters } from '@/lib/security/rate-limiter';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimiters.dataGenerator.checkLimit(request);
  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil(
      (rateLimitResult.resetTime - Date.now()) / 1000
    );
    return NextResponse.json(
      { status: 'rate_limited', retryAfter: Math.max(retryAfter, 1) },
      { status: 429 }
    );
  }

  const CLOUD_RUN_URL = process.env.CLOUD_RUN_AI_URL;

  if (!CLOUD_RUN_URL) {
    return NextResponse.json(
      { status: 'skipped', message: 'Cloud Run URL not configured' },
      { status: 200 }
    );
  }

  try {
    // 1. Fire-and-forget wake-up signal
    logger.info(`Sending wake-up signal to ${CLOUD_RUN_URL}/warmup`);
    void fetch(`${CLOUD_RUN_URL}/warmup`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});

    // 2. Poll /ready until routes are loaded (max 25s, 2s interval)
    for (let waited = 0; waited < 25_000; waited += 2_000) {
      await new Promise((r) => setTimeout(r, 2_000));
      try {
        const res = await fetch(`${CLOUD_RUN_URL}/ready`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const warmupMs = waited + 2_000;
          logger.info(`AI Engine ready after ${warmupMs}ms`);
          return NextResponse.json({ status: 'ready', warmupMs });
        }
      } catch {
        // /ready not yet available, continue polling
      }
    }

    // Timeout — engine still starting
    return NextResponse.json({ status: 'warming' });
  } catch (error) {
    logger.error('Wake-up failed:', error);
    return NextResponse.json(
      { status: 'error', error: String(error) },
      { status: 500 }
    );
  }
}
