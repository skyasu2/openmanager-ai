/**
 * AI Job Retry API
 *
 * POST /api/ai/jobs/:id/retry - 실패한 Job 재시도
 *
 * - failed 상태의 Job만 재시도 가능
 * - 최대 2회 재시도 (retryCount 추적)
 * - Cloud Run Worker 재트리거
 */

export const maxDuration = 30;

import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { redisGet, redisSet } from '@/lib/redis';
import type { AIJob, TriggerStatus } from '@/types/ai-jobs';

const MAX_RETRIES = 2;
const JOB_TTL_SECONDS = 86400;
const PROGRESS_TTL_SECONDS = 600;
const TRIGGER_TIMEOUT_MS = 5000;

export const POST = withAuth(async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    const job = await redisGet<AIJob>(`job:${jobId}`);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'failed') {
      return NextResponse.json(
        { error: `Job is not in failed state (current: ${job.status})` },
        { status: 409 }
      );
    }

    const retryCount = (job.metadata?.retryCount ?? 0) + 1;
    if (retryCount > MAX_RETRIES) {
      return NextResponse.json(
        { error: `Maximum retry attempts (${MAX_RETRIES}) exceeded` },
        { status: 429 }
      );
    }

    // Job 리셋
    const updatedJob: AIJob = {
      ...job,
      status: 'queued',
      error: null,
      result: null,
      completedAt: null,
      startedAt: null,
      progress: 0,
      currentStep: null,
      metadata: { ...job.metadata, retryCount },
    };

    await redisSet(`job:${jobId}`, updatedJob, JOB_TTL_SECONDS);
    await redisSet(
      `job:progress:${jobId}`,
      {
        stage: 'retrying',
        progress: 5,
        message: `재시도 중... (${retryCount}/${MAX_RETRIES})`,
        updatedAt: new Date().toISOString(),
      },
      PROGRESS_TTL_SECONDS
    );

    // Cloud Run Worker 트리거
    const triggerStatus = await triggerWorkerRetry(
      jobId,
      job.query,
      job.type,
      job.sessionId ?? undefined
    );

    logger.info(
      `[AI Jobs] Retry: ${jobId} | attempt=${retryCount} | trigger=${triggerStatus}`
    );

    return NextResponse.json({
      jobId,
      status: 'queued',
      retryCount,
      triggerStatus,
    });
  } catch (error) {
    logger.error('[AI Jobs] Retry error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

async function triggerWorkerRetry(
  jobId: string,
  query: string,
  type: string,
  sessionId?: string
): Promise<TriggerStatus> {
  const cloudRunUrl = process.env.CLOUD_RUN_AI_URL;
  const apiSecret = process.env.CLOUD_RUN_API_SECRET;

  if (!cloudRunUrl) return 'skipped';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT_MS);

  try {
    const res = await fetch(`${cloudRunUrl}/api/jobs/process`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiSecret && { 'X-API-Key': apiSecret }),
      },
      body: JSON.stringify({
        jobId,
        messages: [{ role: 'user', content: query }],
        sessionId,
        type,
      }),
    });

    clearTimeout(timeoutId);
    return res.ok ? 'sent' : 'failed';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') return 'timeout';
    return 'failed';
  }
}
