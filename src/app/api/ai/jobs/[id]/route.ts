/**
 * AI Job Queue API - 개별 Job 상태 조회 (Redis Only)
 *
 * GET /api/ai/jobs/:id - Job 상태 조회 (폴링)
 * DELETE /api/ai/jobs/:id - Job 취소
 *
 * @version 2.0.0 - Redis Only 전환 (2026-01-26)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { redisDel, redisGet, redisSet } from '@/lib/redis';
import type {
  AIJob,
  JobStatusResponse,
  RedisJobProgress,
} from '@/types/ai-jobs';

// ============================================
// GET /api/ai/jobs/:id - Job 상태 조회
// ============================================

export const GET = withAuth(async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Redis에서 Job 조회
    const job = await redisGet<AIJob>(`job:${jobId}`);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found or expired' },
        { status: 404 }
      );
    }

    // 진행 중인 경우 progress 정보도 조회
    let progressInfo: RedisJobProgress | null = null;
    if (job.status === 'queued' || job.status === 'processing') {
      progressInfo = await redisGet<RedisJobProgress>(`job:progress:${jobId}`);
    }

    const response: JobStatusResponse = {
      jobId: job.id,
      type: job.type,
      status: job.status,
      progress: progressInfo?.progress ?? job.progress,
      currentStep: progressInfo?.stage ?? job.currentStep,
      result: job.result ? { content: job.result } : null,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };

    // Cache 헤더 설정 (폴링 최적화)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Job-Status': job.status,
      },
    });
  } catch (error) {
    logger.error('[AI Jobs] Error getting job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// ============================================
// DELETE /api/ai/jobs/:id - Job 취소
// ============================================

export const DELETE = withAuth(async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Redis에서 Job 조회
    const job = await redisGet<AIJob>(`job:${jobId}`);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found or expired' },
        { status: 404 }
      );
    }

    // 이미 완료된 Job은 취소 불가
    if (job.status === 'completed' || job.status === 'failed') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed or failed job' },
        { status: 400 }
      );
    }

    // 이미 취소된 Job
    if (job.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Job is already cancelled' },
        { status: 400 }
      );
    }

    // Job 취소 처리
    const updatedJob: AIJob = {
      ...job,
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    };

    await redisSet(`job:${jobId}`, updatedJob, 3600); // 1시간 유지 후 삭제

    // Progress 정보 삭제
    await redisDel(`job:progress:${jobId}`);

    return NextResponse.json(
      { message: 'Job cancelled successfully', jobId },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[AI Jobs] Error cancelling job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
