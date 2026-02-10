import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging';

export const runtime = 'edge';

export function POST() {
  const CLOUD_RUN_URL = process.env.CLOUD_RUN_AI_URL;

  if (!CLOUD_RUN_URL) {
    return NextResponse.json(
      { status: 'skipped', message: 'Cloud Run URL not configured' },
      { status: 200 }
    );
  }

  try {
    // Fire and forget - don't wait for full response, just trigger cold start
    // Use a short timeout to avoid blocking Vercel function
    logger.info(`🚀 Sending wake-up signal to ${CLOUD_RUN_URL}/warmup`);

    void fetch(`${CLOUD_RUN_URL}/warmup`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(1000), // 1s timeout, just to open connection
    }).catch((err) => {
      // Ignore timeout errors, as we expect it might take time to start
      logger.info('Wake-up signal sent (params ignored):', err.message);
    });

    return NextResponse.json({
      status: 'sent',
      message: 'Wake-up signal initiated',
    });
  } catch (error) {
    logger.error('Wake-up failed:', error);
    return NextResponse.json(
      { status: 'error', error: String(error) },
      { status: 500 }
    );
  }
}
