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
 * 이 방식은 클라이언트 폴링보다 효율적:
 * - 클라이언트 → 서버: 1개 연결
 * - 서버 → Redis: 빠른 내부 폴링 (< 1ms RTT)
 *
 * @version 1.0.0
 */

export const maxDuration = 60; // Vercel Pro Tier

import type { NextRequest } from 'next/server';
import { checkAPIAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { getRedisClient, getSystemRunningFlag, redisGet } from '@/lib/redis';
import type { RedisJobProgress } from '@/types/ai-jobs';

// ============================================================================
// Types
// ============================================================================

interface JobResult {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'queued';
  result?: string;
  error?: string;
  targetAgent?: string;
  toolResults?: unknown[];
  ragSources?: Array<{
    title: string;
    similarity: number;
    sourceType: string;
    category?: string;
  }>;
  startedAt: string;
  completedAt?: string;
  processingTimeMs?: number;
}

function isTerminalStatus(
  status: JobResult['status'] | null | undefined
): boolean {
  return status === 'completed' || status === 'failed';
}

// ============================================================================
// Constants
// ============================================================================

const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 5000;
const ACTIVE_POLL_INTERVAL_MS = getPollIntervalFromEnv(
  'AI_JOB_STREAM_POLL_INTERVAL_MS',
  200
);
const QUEUED_POLL_INTERVAL_MS = getPollIntervalFromEnv(
  'AI_JOB_STREAM_QUEUED_POLL_INTERVAL_MS',
  1000
);
const MAX_WAIT_TIME_MS = 55_000; // 최대 대기 시간 (Pro Tier maxDuration=60에서 5초 마진)
const PROGRESS_INTERVAL_MS = 2000; // 진행 상황 업데이트 간격

export function getPollIntervalFromEnv(
  envName: string,
  defaultValue: number
): number {
  const raw = process.env[envName];
  if (!raw) return defaultValue;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return defaultValue;

  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, parsed));
}

function getPollIntervalByStatus(
  status: JobResult['status'] | null | undefined
): number {
  if (status === 'queued' || status === 'pending') {
    return QUEUED_POLL_INTERVAL_MS;
  }
  return ACTIVE_POLL_INTERVAL_MS;
}

async function sleepWithAbort(
  ms: number,
  signal: AbortSignal
): Promise<boolean> {
  if (signal.aborted) return true;

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      resolve(true);
    };

    const cleanup = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

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

  // 시스템 정지 상태에서는 신규/진행 중 Job의 SSE 폴링을 시작하지 않음.
  // 단, 이미 완료/실패된 Job 결과 조회는 허용한다.
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

  // 🎯 P1-2 Fix: Abort flag for clean loop termination
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      let lastProgressUpdate = 0;
      let lastKnownStatus: JobResult['status'] | null = initialCheck.status;

      const handleRequestAbort = () => {
        aborted = true;
      };
      requestSignal.addEventListener('abort', handleRequestAbort, {
        once: true,
      });

      // SSE 형식으로 메시지 전송
      const sendEvent = (event: string, data: unknown) => {
        if (aborted) return;
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // 연결 확인 이벤트
      sendEvent('connected', { jobId, timestamp: new Date().toISOString() });

      try {
        while (!aborted) {
          const elapsed = Date.now() - startTime;

          // 타임아웃 체크
          if (elapsed > MAX_WAIT_TIME_MS) {
            sendEvent('timeout', {
              jobId,
              message: 'Job processing timeout',
              elapsedMs: elapsed,
            });
            break;
          }

          // Redis에서 결과/진행률을 1회 명령(MGET)으로 조회 (명령어 절감)
          const [jobState, progressState] = (await redis.mget(
            `job:${jobId}`,
            `job:progress:${jobId}`
          )) as [JobResult | null, RedisJobProgress | null];
          const result = jobState ?? null;
          const progress = progressState ?? null;

          if (result) {
            lastKnownStatus = result.status;

            if (result.status === 'completed') {
              // 성공 결과 전송
              sendEvent('result', {
                jobId,
                status: 'completed',
                response: result.result,
                targetAgent: result.targetAgent,
                toolResults: result.toolResults,
                ragSources: result.ragSources,
                processingTimeMs: result.processingTimeMs,
                timestamp: result.completedAt,
              });

              // Redis에서 결과 정리 (TTL에 의존해도 되지만 명시적 정리)
              // 주석: 재시도를 위해 유지할 수도 있음
              // await redisDel(`job:${jobId}`);
              break;
            }

            if (result.status === 'failed') {
              // 실패 결과 전송
              sendEvent('error', {
                jobId,
                status: 'failed',
                error: result.error,
                processingTimeMs: result.processingTimeMs,
                timestamp: result.completedAt,
              });
              break;
            }

            // 진행 중인 경우 - 주기적으로 진행 상황 전송
            if (
              result.status === 'processing' ||
              result.status === 'pending' ||
              result.status === 'queued'
            ) {
              const now = Date.now();
              if (now - lastProgressUpdate >= PROGRESS_INTERVAL_MS) {
                sendEvent('progress', {
                  jobId,
                  status: result.status,
                  progress: progress?.progress ?? 0,
                  stage: progress?.stage ?? 'initializing',
                  message: progress?.message ?? 'AI 에이전트 준비 중...',
                  elapsedMs: elapsed,
                });

                lastProgressUpdate = now;
              }
            }
          } else {
            // Redis에 아직 결과가 없는 경우 - 초기 대기 상태 전송
            const now = Date.now();
            if (now - lastProgressUpdate >= PROGRESS_INTERVAL_MS) {
              sendEvent('progress', {
                jobId,
                status: 'queued',
                progress: 0,
                stage: 'init',
                message: '요청 대기열에 추가됨...',
                elapsedMs: elapsed,
              });
              lastProgressUpdate = now;
            }
          }

          // 상태 기반 적응 대기 (큐 상태는 느리게, 처리 중은 빠르게)
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
      // 🎯 P1-2 Fix: Set abort flag to terminate polling loop
      aborted = true;
      logger.info(
        `[Jobs Stream] Client disconnected, aborting polling: ${jobId}`
      );
    },
  });

  // SSE 헤더 설정
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx 버퍼링 비활성화
    },
  });
}
