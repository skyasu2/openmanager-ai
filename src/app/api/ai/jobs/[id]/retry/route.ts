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

import { after, type NextRequest, NextResponse } from 'next/server';
import { getRequiredCloudRunConfig } from '@/lib/ai-proxy/cloud-run-config';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { redisGet, redisSet } from '@/lib/redis';
import {
  getRateLimitIdentity,
  RATE_LIMIT_IDENTITY_HEADER,
} from '@/lib/security/rate-limit-identity';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import type { AnalysisMode } from '@/types/ai/analysis-mode';
import type { AIJob, TriggerStatus } from '@/types/ai-jobs';
import { withCSRFProtection } from '@/utils/security/csrf';
import { isJobOwnedByRequester } from '../../job-ownership';

const MAX_RETRIES = 2;
const JOB_TTL_SECONDS = 86400;
const PROGRESS_TTL_SECONDS = 600;
const TRIGGER_TIMEOUT_MS = 280000;
const CLOUD_TASKS_DISPATCH_TIMEOUT_MS = 10000;

type JobWorkerTriggerMode = 'direct' | 'cloud-tasks';

function getJobWorkerTriggerMode(): JobWorkerTriggerMode {
  return process.env.AI_JOB_TRIGGER_MODE?.trim() === 'cloud-tasks'
    ? 'cloud-tasks'
    : 'direct';
}

function getWorkerTriggerPath(mode: JobWorkerTriggerMode): string {
  return mode === 'cloud-tasks' ? '/api/jobs/dispatch' : '/api/jobs/process';
}

function getWorkerTriggerTimeoutMs(mode: JobWorkerTriggerMode): number {
  return mode === 'cloud-tasks'
    ? CLOUD_TASKS_DISPATCH_TIMEOUT_MS
    : TRIGGER_TIMEOUT_MS;
}

interface RetryToolOptions {
  analysisMode?: AnalysisMode;
  enableRAG?: boolean;
  enableWebSearch?: boolean;
}

function extractRetryToolOptions(job: AIJob): RetryToolOptions {
  const metadata = job.metadata ?? {};

  return {
    ...(metadata.analysisMode && {
      analysisMode: metadata.analysisMode,
    }),
    ...(typeof metadata.enableRAG === 'boolean' && {
      enableRAG: metadata.enableRAG,
    }),
    ...(typeof metadata.enableWebSearch === 'boolean' && {
      enableWebSearch: metadata.enableWebSearch,
    }),
  };
}

export const POST = withRateLimit<[{ params: Promise<{ id: string }> }]>(
  rateLimiters.aiJobCreation,
  withAuth(
    withCSRFProtection(async function POST(
      request: NextRequest,
      { params }: { params: Promise<{ id: string }> }
    ) {
      try {
        const { id: jobId } = await params;

        const job = await redisGet<AIJob>(`job:${jobId}`);
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        if (!isJobOwnedByRequester(job as unknown, request)) {
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

        const initialTriggerStatus: TriggerStatus = getRequiredCloudRunConfig()
          .ok
          ? 'scheduled'
          : 'skipped';

        after(async () => {
          const finalTriggerStatus =
            initialTriggerStatus === 'scheduled'
              ? await triggerWorkerRetry(
                  jobId,
                  job.query,
                  job.type,
                  job.sessionId ?? undefined,
                  extractRetryToolOptions(job),
                  getRateLimitIdentity(request)
                )
              : initialTriggerStatus;

          logger.info(
            `[AI Jobs] Retry: ${jobId} | attempt=${retryCount} | trigger=${finalTriggerStatus}`
          );

          if (finalTriggerStatus !== 'sent') {
            await redisSet(
              `job:${jobId}`,
              {
                ...updatedJob,
                status: 'failed',
                error: getRetryFailureMessage(finalTriggerStatus),
                completedAt: new Date().toISOString(),
              },
              JOB_TTL_SECONDS
            );
          }
        });

        return NextResponse.json({
          jobId,
          status: 'queued',
          retryCount,
          triggerStatus: initialTriggerStatus,
        });
      } catch (error) {
        logger.error('[AI Jobs] Retry error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    })
  )
);

async function triggerWorkerRetry(
  jobId: string,
  query: string,
  type: string,
  sessionId?: string,
  toolOptions: RetryToolOptions = {},
  rateLimitIdentity?: string
): Promise<TriggerStatus> {
  const cloudRunConfig = getRequiredCloudRunConfig();

  if (!cloudRunConfig.ok) {
    logger.warn(`[AI Jobs] Retry skipped: ${cloudRunConfig.message}`);
    return 'skipped';
  }

  const triggerMode = getJobWorkerTriggerMode();
  const triggerPath = getWorkerTriggerPath(triggerMode);
  const triggerTimeoutMs = getWorkerTriggerTimeoutMs(triggerMode);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), triggerTimeoutMs);

  try {
    const res = await fetch(`${cloudRunConfig.url}${triggerPath}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cloudRunConfig.apiSecret,
        ...(rateLimitIdentity
          ? { [RATE_LIMIT_IDENTITY_HEADER]: rateLimitIdentity }
          : {}),
      },
      body: JSON.stringify({
        jobId,
        messages: [{ role: 'user', content: query }],
        sessionId,
        type,
        ...toolOptions,
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

function getRetryFailureMessage(triggerStatus: TriggerStatus): string {
  switch (triggerStatus) {
    case 'timeout':
      return 'Worker retry timed out. Please retry again.';
    case 'skipped':
      return 'Worker target not configured. Please retry later.';
    default:
      return 'Worker retry failed. Please retry again.';
  }
}
