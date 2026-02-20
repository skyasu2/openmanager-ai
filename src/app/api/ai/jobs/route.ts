/**
 * AI Job Queue API - Redis Only
 *
 * POST /api/ai/jobs - 새 Job 생성
 * GET /api/ai/jobs - Job 목록 조회 (sessionId 필터만 지원)
 *
 * @version 2.0.0 - Redis Only 전환 (2026-01-26)
 * @description Supabase 제거, Redis를 단일 저장소로 사용
 */

// Vercel 빌드 타임 상수 (정적 분석용). 런타임 타임아웃은 config에서 관리.
export const maxDuration = 30;

import { randomUUID } from 'crypto';
import { after, type NextRequest, NextResponse } from 'next/server';
import {
  analyzeJobQueryComplexity,
  inferJobType,
} from '@/lib/ai/utils/query-complexity';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { getRedisClient, redisGet, redisMGet, redisSet } from '@/lib/redis';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import type {
  AIJob,
  CreateJobRequest,
  CreateJobResponse,
  JobListResponse,
  JobStatus,
  JobStatusResponse,
  TriggerStatus,
} from '@/types/ai-jobs';
import { getErrorMessage } from '@/types/type-utils';

// ============================================
// 상수 정의
// ============================================

/** Cloud Run 트리거 타임아웃 (ms) */
const TRIGGER_TIMEOUT_MS = 5000;

/** Job TTL (24시간) */
const JOB_TTL_SECONDS = 86400;

/** Job 목록 TTL (1시간) */
const JOB_LIST_TTL_SECONDS = 3600;

/** Progress TTL (10분) */
const PROGRESS_TTL_SECONDS = 600;

// ============================================
// POST /api/ai/jobs - Job 생성 (Rate Limited)
// ============================================

async function handlePOST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateJobRequest;
    const { query, options } = body;

    // 입력 검증
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Redis 가용성 확인
    const redis = getRedisClient();
    if (!redis) {
      return NextResponse.json(
        {
          error: 'Job queue unavailable',
          fallback: 'Use /api/ai/supervisor directly',
        },
        { status: 503 }
      );
    }

    // 복잡도 분석
    const complexity = analyzeJobQueryComplexity(query);

    // Job 타입 자동 추론
    const jobType = body.type || inferJobType(query);

    // Job ID 생성
    const jobId = randomUUID();
    const now = new Date().toISOString();

    // Redis에 Job 저장
    const job: AIJob = {
      id: jobId,
      type: jobType,
      query: query.trim(),
      status: 'queued',
      progress: 0,
      currentStep: null,
      result: null,
      error: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      sessionId: options?.sessionId || null,
      metadata: {
        complexity: complexity.level,
        estimatedTime: complexity.estimatedTime,
        factors: complexity.factors,
      },
    };

    const saved = await redisSet(`job:${jobId}`, job, JOB_TTL_SECONDS);

    if (!saved) {
      logger.error('[AI Jobs] Failed to save job to Redis');
      return NextResponse.json(
        { error: 'Failed to create job' },
        { status: 500 }
      );
    }

    // 초기 진행률 저장
    await redisSet(
      `job:progress:${jobId}`,
      {
        stage: 'initializing',
        progress: 5,
        message: 'AI 에이전트 초기화 중...',
        updatedAt: now,
      },
      PROGRESS_TTL_SECONDS
    );

    // Session별 Job 목록에 추가 (선택적)
    if (options?.sessionId) {
      const listKey = `job:list:${options.sessionId}`;
      const existingList = (await redisGet<string[]>(listKey)) || [];
      existingList.unshift(jobId);
      // 최근 50개만 유지
      await redisSet(listKey, existingList.slice(0, 50), JOB_LIST_TTL_SECONDS);
    }

    // Cloud Run Worker에 Job 처리 요청
    const triggerResult = await triggerWorker(
      jobId,
      query,
      jobType,
      options?.sessionId
    );

    // 비동기 로깅
    after(async () => {
      await logJobCreation(
        jobId,
        jobType,
        triggerResult.status,
        complexity.level
      );
    });

    const response: CreateJobResponse = {
      jobId,
      status: 'queued',
      pollUrl: `/api/ai/jobs/${jobId}`,
      estimatedTime: complexity.estimatedTime,
      triggerStatus: triggerResult.status,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('[AI Jobs] Error creating job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Auth + Rate Limiting 적용
export const POST = withRateLimit(
  rateLimiters.aiAnalysis,
  withAuth(handlePOST)
);

// ============================================
// GET /api/ai/jobs - Job 목록 조회 (Rate Limited)
// ============================================

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    // sessionId 필수 (Redis는 복잡한 쿼리 불가)
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required for job list query' },
        { status: 400 }
      );
    }

    // Session의 Job 목록 조회
    const listKey = `job:list:${sessionId}`;
    const jobIds = (await redisGet<string[]>(listKey)) || [];

    // 🔧 N+1 쿼리 방지: MGET으로 일괄 조회
    const limitedJobIds = jobIds.slice(0, limit);
    const jobKeys = limitedJobIds.map((id) => `job:${id}`);
    const rawJobs = await redisMGet<AIJob>(jobKeys);

    const jobs: JobStatusResponse[] = rawJobs
      .filter((job): job is AIJob => job !== null)
      .map(mapJobToResponse);

    const response: JobListResponse = {
      jobs,
      total: jobIds.length,
      hasMore: jobIds.length > limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[AI Jobs] Error listing jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Auth + Rate Limiting 적용
export const GET = withRateLimit(rateLimiters.default, withAuth(handleGET));

// ============================================
// 헬퍼 함수
// ============================================

/**
 * Redis Job을 API 응답 형식으로 변환
 */
function mapJobToResponse(job: AIJob): JobStatusResponse {
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    result: job.result ? { content: job.result } : null,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

// ============================================
// Worker 트리거 관련
// ============================================

interface TriggerResult {
  status: TriggerStatus;
  responseTime?: number;
  error?: string;
}

/**
 * Cloud Run Worker에 Job 처리 요청 (타임아웃 적용)
 */
async function triggerWorker(
  jobId: string,
  query: string,
  type: string,
  sessionId?: string
): Promise<TriggerResult> {
  const cloudRunUrl = process.env.CLOUD_RUN_AI_URL;
  const apiSecret = process.env.CLOUD_RUN_API_SECRET;

  if (!cloudRunUrl) {
    logger.warn('[AI Jobs] CLOUD_RUN_AI_URL not configured');
    return { status: 'skipped', error: 'URL not configured' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT_MS);
  const startTime = Date.now();

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
    const responseTime = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      logger.error(`[AI Jobs] Worker ${res.status}: ${errorText}`);

      if (res.status === 401) {
        logger.error('[AI Jobs] ⚠️ API key issue - check CLOUD_RUN_API_SECRET');
      }

      return { status: 'failed', responseTime, error: `HTTP ${res.status}` };
    }

    logger.info(`[AI Jobs] Worker triggered: ${jobId} (${responseTime}ms)`);
    return { status: 'sent', responseTime };
  } catch (error) {
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(
        `[AI Jobs] Trigger timeout: ${jobId} (${TRIGGER_TIMEOUT_MS}ms)`
      );
      return { status: 'timeout', responseTime, error: 'Request timeout' };
    }

    logger.error('[AI Jobs] Trigger error:', error);
    return {
      status: 'failed',
      responseTime,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Job 생성 로깅 (after()에서 호출)
 */
async function logJobCreation(
  jobId: string,
  jobType: string,
  triggerStatus: TriggerStatus,
  complexityLevel: string
): Promise<void> {
  try {
    logger.info(
      `[AI Jobs] Created: ${jobId} | type=${jobType} | trigger=${triggerStatus} | complexity=${complexityLevel}`
    );

    // 트리거 실패 시 상태 업데이트
    if (triggerStatus !== 'sent') {
      await redisSet(
        `job:trigger:${jobId}`,
        {
          status: triggerStatus,
          timestamp: new Date().toISOString(),
          message:
            triggerStatus === 'timeout'
              ? 'Worker 연결 지연 - 잠시 후 자동 처리됩니다'
              : 'Worker 연결 실패 - 재시도 중입니다',
        },
        triggerStatus === 'timeout' ? 300 : 60
      );

      // Worker 연결 완전 실패 — 원본 Job을 failed로 마킹
      if (triggerStatus === 'failed') {
        const existingJob = await redisGet<AIJob>(`job:${jobId}`);
        if (existingJob && existingJob.status === 'queued') {
          await redisSet(
            `job:${jobId}`,
            {
              ...existingJob,
              status: 'failed' as JobStatus,
              error: 'Worker connection failed. Please retry.',
              completedAt: new Date().toISOString(),
            },
            JOB_TTL_SECONDS
          );
        }
      }
    }
  } catch (error) {
    logger.warn('[AI Jobs] Log failed:', error);
  }
}
