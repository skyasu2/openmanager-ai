/**
 * AI Job Stream API - SSE 기반 실시간 결과 수신
 *
 * GET /api/ai/jobs/:id/stream - SSE로 Job 결과 스트리밍
 *
 * Flow:
 * 1. 클라이언트가 SSE 연결
 * 2. 서버가 Redis를 상태 기반 적응 폴링
 * 3. 결과 발견 시 즉시 스트리밍
 * 4. 연결 종료
 *
 * @version 1.0.0
 */

export const maxDuration = 60;

import type { NextRequest } from 'next/server';
import { checkAPIAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { getRedisClient, getSystemRunningFlag, redisGet } from '@/lib/redis';
import { runRedisWithTimeout } from '@/lib/redis/client';
import type { RedisJobProgress } from '@/types/ai-jobs';
import { sanitizeJobMetadataForClient } from '../../job-metadata';
import { isJobOwnedByRequester } from '../../job-ownership';
import {
  buildProgressEventData,
  getJobStreamMaxWaitTimeMs,
  getPollIntervalByStatus,
  isTerminalStatus,
  type JobResult,
  PROGRESS_INTERVAL_MS,
  REDIS_TIMEOUT_MS,
  sleepWithAbort,
} from './stream-helpers';

// ============================================================================
// GET /api/ai/jobs/:id/stream - SSE 스트리밍
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check (SSE는 withAuth 래퍼 대신 직접 체크 — Response 타입 호환)
  const authError = await checkAPIAuth(request);
  if (authError) return authError;

  const { id: jobId } = await params;

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'Job ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Redis 연결 확인
  const redis = getRedisClient();
  if (!redis) {
    return new Response(
      JSON.stringify({
        error: 'Redis not available',
        fallback: 'Use polling instead',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Job 존재 여부 확인 (SSE 연결 전)
  const initialCheck = await redisGet<JobResult>(`job:${jobId}`);
  if (!initialCheck) {
    return new Response(JSON.stringify({ error: 'Job not found', jobId }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isJobOwnedByRequester(initialCheck as unknown, request)) {
    return new Response(JSON.stringify({ error: 'Job not found', jobId }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 시스템 정지 상태에서는 신규/진행 중 Job의 SSE 폴링을 시작하지 않음.
  const running = await getSystemRunningFlag();
  if (running === false && !isTerminalStatus(initialCheck.status)) {
    return new Response(
      JSON.stringify({
        error: 'System is not running',
        message: '시스템 시작 후 다시 시도해주세요.',
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // SSE 스트림 생성
  const encoder = new TextEncoder();
  const requestSignal = request.signal;
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const maxWaitTimeMs = getJobStreamMaxWaitTimeMs();
      const startTime = Date.now();
      let lastProgressUpdate = 0;
      let lastKnownStatus: JobResult['status'] | null = initialCheck.status;

      const handleRequestAbort = () => {
        aborted = true;
      };
      requestSignal.addEventListener('abort', handleRequestAbort, {
        once: true,
      });

      const sendEvent = (event: string, data: unknown) => {
        if (aborted) return;
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      sendEvent('connected', { jobId, timestamp: new Date().toISOString() });

      try {
        while (!aborted) {
          const elapsed = Date.now() - startTime;

          if (elapsed > maxWaitTimeMs) {
            sendEvent('timeout', {
              jobId,
              message: 'Job processing timeout',
              elapsedMs: elapsed,
            });
            break;
          }

          const [jobState, progressState] = (await runRedisWithTimeout(
            `job-stream MGET ${jobId}`,
            () => redis.mget(`job:${jobId}`, `job:progress:${jobId}`),
            { timeoutMs: REDIS_TIMEOUT_MS }
          )) as [JobResult | null, RedisJobProgress | null];
          const result = jobState ?? null;
          const progress = progressState ?? null;

          if (result) {
            lastKnownStatus = result.status;

            if (result.status === 'completed') {
              sendEvent('result', {
                jobId,
                status: 'completed',
                response: result.result,
                targetAgent: result.targetAgent,
                toolsCalled: result.toolsCalled,
                toolResults: result.toolResults,
                ragSources: result.ragSources,
                metadata: sanitizeJobMetadataForClient(result.metadata),
                processingTimeMs: result.processingTimeMs,
                timestamp: result.completedAt,
              });
              break;
            }

            if (result.status === 'failed') {
              sendEvent('error', {
                jobId,
                status: 'failed',
                error: result.error,
                errorDetails: result.errorDetails,
                processingTimeMs: result.processingTimeMs,
                timestamp: result.completedAt,
              });
              break;
            }

            if (
              result.status === 'processing' ||
              result.status === 'pending' ||
              result.status === 'queued'
            ) {
              const now = Date.now();
              if (now - lastProgressUpdate >= PROGRESS_INTERVAL_MS) {
                sendEvent(
                  'progress',
                  buildProgressEventData({
                    jobId,
                    status: result.status,
                    progressState: progress,
                    elapsedMs: elapsed,
                  })
                );
                lastProgressUpdate = now;
              }
            }
          } else {
            const now = Date.now();
            if (now - lastProgressUpdate >= PROGRESS_INTERVAL_MS) {
              sendEvent(
                'progress',
                buildProgressEventData({
                  jobId,
                  status: 'queued',
                  progressState: null,
                  elapsedMs: elapsed,
                })
              );
              lastProgressUpdate = now;
            }
          }

          const waitMs = getPollIntervalByStatus(lastKnownStatus);
          const interrupted = await sleepWithAbort(waitMs, requestSignal);
          if (interrupted) {
            aborted = true;
            break;
          }
        }
      } catch (error) {
        if (!aborted) {
          sendEvent('error', {
            jobId,
            status: 'error',
            error: String(error),
          });
        }
      } finally {
        requestSignal.removeEventListener('abort', handleRequestAbort);
        if (!aborted) {
          controller.close();
        }
      }
    },

    cancel() {
      aborted = true;
      logger.info(
        `[Jobs Stream] Client disconnected, aborting polling: ${jobId}`
      );
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
