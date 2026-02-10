/**
 * AI Job Stream API - SSE 기반 실시간 결과 수신
 *
 * GET /api/ai/jobs/:id/stream - SSE로 Job 결과 스트리밍
 *
 * Flow:
 * 1. 클라이언트가 SSE 연결
 * 2. 서버가 Redis를 폴링 (100ms 간격)
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
import { logger } from '@/lib/logging';
import { getRedisClient, redisGet } from '@/lib/redis';

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

interface JobProgress {
  stage: string;
  progress: number;
  message?: string;
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 100; // Redis 폴링 간격
const MAX_WAIT_TIME_MS = 55_000; // 최대 대기 시간 (Pro Tier maxDuration=60에서 5초 마진)
const PROGRESS_INTERVAL_MS = 2000; // 진행 상황 업데이트 간격

// ============================================================================
// GET /api/ai/jobs/:id/stream - SSE 스트리밍
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // SSE 스트림 생성
  const encoder = new TextEncoder();

  // 🎯 P1-2 Fix: Abort flag for clean loop termination
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      let lastProgressUpdate = 0;

      // SSE 형식으로 메시지 전송
      const sendEvent = (event: string, data: unknown) => {
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

          // Redis에서 결과 확인
          const result = await redisGet<JobResult>(`job:${jobId}`);

          if (result) {
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
            if (result.status === 'processing' || result.status === 'pending') {
              const now = Date.now();
              if (now - lastProgressUpdate >= PROGRESS_INTERVAL_MS) {
                // 진행 상황 확인
                const progress = await redisGet<JobProgress>(
                  `job:progress:${jobId}`
                );

                sendEvent('progress', {
                  jobId,
                  status: result.status,
                  progress: progress?.progress || 0,
                  stage: progress?.stage || 'initializing',
                  message: progress?.message || 'AI 에이전트 준비 중...',
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

          // 대기
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (error) {
        sendEvent('error', {
          jobId,
          status: 'error',
          error: String(error),
        });
      } finally {
        controller.close();
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
