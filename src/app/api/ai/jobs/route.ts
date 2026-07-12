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
import { buildAssistantPlanFromRouteDecision } from '@/lib/ai/assistant-contract';
import { buildJobQueryAsOf } from '@/lib/ai/query-as-of';
import {
  buildRouteDecision,
  type RouteDecision,
  type RouteDecisionComplexity,
} from '@/lib/ai/route-decision';
import { normalizeSemanticQueryTrace } from '@/lib/ai/semantic-intent-frame';
import {
  analyzeJobQueryComplexity,
  inferJobType,
} from '@/lib/ai/utils/query-complexity';
import { createCloudRunAuthHeaders } from '@/lib/ai-proxy/cloud-run-auth';
import { getRequiredCloudRunConfig } from '@/lib/ai-proxy/cloud-run-config';
import { getAPIAuthContext, withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import {
  getRedisClient,
  redisClaimKey,
  redisDel,
  redisGet,
  redisMGet,
  redisSet,
} from '@/lib/redis';
import {
  createRateLimitIdentityHeaders,
  getRateLimitIdentity,
} from '@/lib/security/rate-limit-identity';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import type {
  AIJob,
  CreateJobRequest,
  CreateJobResponse,
  JobConversationMessage,
  JobListResponse,
  JobQueryAsOf,
  JobStatus,
  JobStatusResponse,
  TriggerStatus,
} from '@/types/ai-jobs';
import { getErrorMessage } from '@/types/type-utils';
import { withCSRFProtection } from '@/utils/security/csrf';
import {
  createInternalDisclosureFields,
  resolveSupervisorInternalDisclosureMode,
  type SupervisorInternalDisclosureMode,
} from '../supervisor/internal-disclosure-mode';
import { createBackendSessionId } from '../supervisor/session-owner';
import {
  buildJobIdempotencyRedisKey,
  buildJobRequestFingerprint,
  createExistingIdempotencyResponse,
  createJobCreatedResponse,
  JOB_IDEMPOTENCY_PENDING_TTL_SECONDS,
  type JobIdempotencyRecord,
  normalizeIdempotencyKey,
} from './job-idempotency';
import { buildScopedJobListKey, resolveJobOwnerKey } from './job-ownership';
import {
  getSubstantiveJobResultContent,
  JOB_RESULT_QUALITY_FAILURE_MESSAGE,
  shouldFailCompletedJobResult,
} from './job-result-quality';

function createJobQueueUnavailableResponse(reason: string) {
  return NextResponse.json(
    {
      error: 'Job queue unavailable',
      reason,
      fallback: 'Use /api/ai/supervisor directly',
    },
    { status: 503 }
  );
}

// ============================================
// 상수 정의
// ============================================

/** Cloud Run worker 처리 완료 대기 타임아웃 (ms) */
const TRIGGER_TIMEOUT_MS = 280000;

/** Cloud Tasks dispatch endpoint 대기 타임아웃 (ms) */
const CLOUD_TASKS_DISPATCH_TIMEOUT_MS = 10000;

/** Job TTL (24시간) */
const JOB_TTL_SECONDS = 86400;

/** Job 목록 TTL (1시간) */
const JOB_LIST_TTL_SECONDS = 3600;

/** Progress TTL (10분) */
const PROGRESS_TTL_SECONDS = 600;
const MAX_JOB_CONTEXT_MESSAGES = 20;
const MAX_JOB_CONTEXT_MESSAGE_CHARS = 8_000;

type JobRequestMetadata = NonNullable<
  NonNullable<CreateJobRequest['options']>['metadata']
>;

interface JobToolOptions {
  enableRAG?: boolean;
  enableWebSearch?: boolean;
  internalDisclosureMode?: SupervisorInternalDisclosureMode;
  localRouteDecision?: RouteDecision;
  metadata?: Record<string, unknown>;
}

function mapJobComplexityToRouteDecision(
  complexity: string
): RouteDecisionComplexity | undefined {
  if (complexity === 'simple' || complexity === 'complex') {
    return complexity;
  }
  if (complexity === 'medium') {
    return 'moderate';
  }
  return undefined;
}

function isSupervisorInputType(value: unknown): value is string {
  return (
    value === 'natural_query' ||
    value === 'log_paste' ||
    value === 'mixed' ||
    value === 'oversized'
  );
}

function extractJobToolOptions(metadata?: JobRequestMetadata): JobToolOptions {
  const enableRAG = metadata?.enableRAG;
  const enableWebSearch = metadata?.enableWebSearch;
  const semanticQueryTrace = normalizeSemanticQueryTrace(
    metadata?.semanticQueryTrace
  );
  const semanticMetadata = {
    ...(metadata?.intentFrame !== undefined
      ? { intentFrame: metadata.intentFrame }
      : {}),
    ...(semanticQueryTrace && { semanticQueryTrace }),
    ...(isSupervisorInputType(metadata?.inputType) && {
      inputType: metadata.inputType,
    }),
    ...(typeof metadata?.logExtract === 'string' &&
    metadata.logExtract.trim().length > 0
      ? { logExtract: metadata.logExtract.trim().slice(0, 8_000) }
      : {}),
  };

  return {
    ...(typeof enableRAG === 'boolean' && {
      enableRAG,
    }),
    ...(typeof enableWebSearch === 'boolean' && {
      enableWebSearch,
    }),
    ...(Object.keys(semanticMetadata).length > 0 && {
      metadata: semanticMetadata,
    }),
  };
}

function normalizeJobConversationMessages(
  value: unknown
): JobConversationMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message): message is Record<string, unknown> => {
      return typeof message === 'object' && message !== null;
    })
    .map((message): JobConversationMessage | null => {
      const role = message.role;
      const content =
        typeof message.content === 'string' ? message.content.trim() : '';
      if ((role !== 'user' && role !== 'assistant') || content.length === 0) {
        return null;
      }
      return {
        role,
        content: content.slice(0, MAX_JOB_CONTEXT_MESSAGE_CHARS),
      };
    })
    .filter((message): message is JobConversationMessage => message !== null)
    .slice(-MAX_JOB_CONTEXT_MESSAGES);
}

function buildJobWorkerMessages(params: {
  query: string;
  messages?: CreateJobRequest['messages'];
}): JobConversationMessage[] {
  const normalized = normalizeJobConversationMessages(params.messages);
  const currentUserMessage: JobConversationMessage = {
    role: 'user',
    content: params.query,
  };

  const lastMessage = normalized.at(-1);
  if (
    lastMessage?.role === 'user' &&
    lastMessage.content.trim() === params.query
  ) {
    return normalized;
  }

  return [...normalized, currentUserMessage].slice(-MAX_JOB_CONTEXT_MESSAGES);
}

// ============================================
// POST /api/ai/jobs - Job 생성 (Rate Limited)
// ============================================

async function handlePOST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateJobRequest;
    const { query, options } = body;
    const ownerKey = resolveJobOwnerKey(request);
    const backendSessionId = options?.sessionId
      ? createBackendSessionId(ownerKey, options.sessionId)
      : undefined;

    // 입력 검증
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    const normalizedQuery = query.trim();
    const workerMessages = buildJobWorkerMessages({
      query: normalizedQuery,
      messages: body.messages,
    });

    // Redis 가용성 확인
    const redis = getRedisClient();
    if (!redis) {
      return createJobQueueUnavailableResponse('redis_unavailable');
    }

    // 복잡도 분석
    const complexity = analyzeJobQueryComplexity(query);

    // Job 타입 자동 추론
    const jobType = body.type || inferJobType(query);
    const now = new Date().toISOString();
    const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);
    const idempotencyRedisKey = idempotencyKey
      ? buildJobIdempotencyRedisKey(
          ownerKey,
          options?.sessionId,
          idempotencyKey
        )
      : null;
    const requestFingerprint = idempotencyRedisKey
      ? buildJobRequestFingerprint(
          normalizedQuery,
          jobType,
          options,
          workerMessages
        )
      : null;

    if (idempotencyRedisKey && requestFingerprint) {
      const claimed = await redisClaimKey<JobIdempotencyRecord>(
        idempotencyRedisKey,
        {
          status: 'pending',
          fingerprint: requestFingerprint,
          createdAt: now,
        },
        JOB_IDEMPOTENCY_PENDING_TTL_SECONDS
      );

      if (!claimed) {
        return createExistingIdempotencyResponse(
          idempotencyRedisKey,
          requestFingerprint
        );
      }
    }

    const toolOptions = extractJobToolOptions(options?.metadata);
    const internalDisclosureMode = resolveSupervisorInternalDisclosureMode(
      getAPIAuthContext(request)
    );

    // Job ID 생성
    const jobId = randomUUID();
    const queryAsOf = buildJobQueryAsOf(
      now,
      options?.metadata?.queryAsOfDataSlot
    );
    const routeDecision = buildRouteDecision({
      intent: 'job',
      executionPath: 'job',
      ...(mapJobComplexityToRouteDecision(complexity.level) && {
        complexity: mapJobComplexityToRouteDecision(complexity.level),
      }),
      reasonCodes: ['job_queue_api'],
      decidedBy: 'bff',
      dataSlot: queryAsOf.dataSlot.timeLabel,
    });
    const assistantPlan = buildAssistantPlanFromRouteDecision(routeDecision);
    const workerToolOptions: JobToolOptions = {
      ...toolOptions,
      ...(internalDisclosureMode && { internalDisclosureMode }),
      localRouteDecision: routeDecision,
    };

    // Redis에 Job 저장
    const job: AIJob = {
      id: jobId,
      type: jobType,
      query: normalizedQuery,
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
        ownerKey,
        queryAsOf,
        localRouteDecision: workerToolOptions.localRouteDecision,
        routeDecision,
        assistantPlan,
        ...workerToolOptions,
      },
    };

    const saved = await redisSet(`job:${jobId}`, job, JOB_TTL_SECONDS);

    if (!saved) {
      if (idempotencyRedisKey) {
        await redisDel(idempotencyRedisKey);
      }
      logger.error('[AI Jobs] Failed to save job to Redis');
      return createJobQueueUnavailableResponse('redis_write_failed');
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
      const listKey = buildScopedJobListKey(ownerKey, options.sessionId);
      const existingList = (await redisGet<string[]>(listKey)) || [];
      existingList.unshift(jobId);
      // 최근 50개만 유지
      await redisSet(listKey, existingList.slice(0, 50), JOB_LIST_TTL_SECONDS);
    }

    const initialTriggerStatus: TriggerStatus = getRequiredCloudRunConfig().ok
      ? 'scheduled'
      : 'skipped';

    const response: CreateJobResponse = {
      jobId,
      status: 'queued',
      pollUrl: `/api/ai/jobs/${jobId}`,
      estimatedTime: complexity.estimatedTime,
      triggerStatus: initialTriggerStatus,
      routingMode: 'job-queue',
      complexity: complexity.level,
      routeDecision,
      assistantPlan,
    };

    if (idempotencyRedisKey && requestFingerprint) {
      const finalized = await redisSet<JobIdempotencyRecord>(
        idempotencyRedisKey,
        {
          status: 'created',
          fingerprint: requestFingerprint,
          createdAt: now,
          jobId,
          response,
        },
        JOB_TTL_SECONDS
      );

      if (!finalized) {
        logger.warn(
          `[AI Jobs] Failed to finalize idempotency record for job ${jobId}`
        );
      }
    }

    after(async () => {
      const finalTriggerStatus =
        initialTriggerStatus === 'scheduled'
          ? (
              await triggerWorker(
                jobId,
                normalizedQuery,
                jobType,
                backendSessionId,
                workerMessages,
                workerToolOptions,
                getRateLimitIdentity(request, backendSessionId),
                queryAsOf
              )
            ).status
          : initialTriggerStatus;

      await logJobCreation(
        jobId,
        jobType,
        finalTriggerStatus,
        complexity.level
      );
    });

    return createJobCreatedResponse(response);
  } catch (error) {
    logger.error('[AI Jobs] Error creating job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Auth + Rate Limiting 적용
export const POST = withAuth(
  withRateLimit(rateLimiters.aiJobCreation, withCSRFProtection(handlePOST))
);

// ============================================
// GET /api/ai/jobs - Job 목록 조회 (Rate Limited)
// ============================================

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const ownerKey = resolveJobOwnerKey(request);
    // sessionId 필수 (Redis는 복잡한 쿼리 불가)
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required for job list query' },
        { status: 400 }
      );
    }

    const limitParam = searchParams.get('limit');
    const limit = limitParam === null ? 10 : Number(limitParam);

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'limit must be an integer between 1 and 50' },
        { status: 400 }
      );
    }

    const redis = getRedisClient();
    if (!redis) {
      return createJobQueueUnavailableResponse('redis_unavailable');
    }

    // Session의 Job 목록 조회
    const listKey = buildScopedJobListKey(ownerKey, sessionId);
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
export const GET = withAuth(withRateLimit(rateLimiters.default, handleGET));

// ============================================
// 헬퍼 함수
// ============================================

/**
 * Redis Job을 API 응답 형식으로 변환
 */
function mapJobToResponse(job: AIJob): JobStatusResponse {
  const substantiveResult = getSubstantiveJobResultContent(job.result);
  const qualityFailed = shouldFailCompletedJobResult(job.status, job.result);

  return {
    jobId: job.id,
    type: job.type,
    status: qualityFailed ? 'failed' : job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    result: substantiveResult ? { content: substantiveResult } : null,
    error: qualityFailed ? JOB_RESULT_QUALITY_FAILURE_MESSAGE : job.error,
    errorDetails: job.errorDetails ?? null,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    processingTimeMs: job.processingTimeMs ?? null,
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

/**
 * Cloud Run Worker에 Job 처리 요청 (타임아웃 적용)
 */
async function triggerWorker(
  jobId: string,
  query: string,
  type: string,
  sessionId?: string,
  messages: JobConversationMessage[] = [{ role: 'user', content: query }],
  toolOptions: JobToolOptions = {},
  rateLimitIdentity?: string,
  queryAsOf?: JobQueryAsOf
): Promise<TriggerResult> {
  const cloudRunConfig = getRequiredCloudRunConfig();

  if (!cloudRunConfig.ok) {
    logger.warn(`[AI Jobs] ${cloudRunConfig.message}`);
    return { status: 'skipped', error: cloudRunConfig.message };
  }

  const triggerMode = getJobWorkerTriggerMode();
  const triggerPath = getWorkerTriggerPath(triggerMode);
  const triggerTimeoutMs = getWorkerTriggerTimeoutMs(triggerMode);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), triggerTimeoutMs);
  const startTime = Date.now();

  try {
    const triggerUrl = `${cloudRunConfig.url}${triggerPath}`;
    const { internalDisclosureMode, ...unsignedToolOptions } = toolOptions;
    const internalDisclosureFields = createInternalDisclosureFields({
      mode: internalDisclosureMode,
      audience: 'job',
      subject: `${jobId}:${sessionId || 'default'}`,
    });
    const rateLimitIdentityHeaders =
      createRateLimitIdentityHeaders(rateLimitIdentity);
    const res = await fetch(triggerUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(await createCloudRunAuthHeaders({
          apiSecret: cloudRunConfig.apiSecret,
          serviceUrl: triggerUrl,
        })),
        ...rateLimitIdentityHeaders,
      },
      body: JSON.stringify({
        jobId,
        messages,
        sessionId,
        type,
        ...unsignedToolOptions,
        ...internalDisclosureFields,
        ...(queryAsOf && { queryAsOf }),
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

    logger.info(
      `[AI Jobs] Worker triggered: ${jobId} mode=${triggerMode} (${responseTime}ms)`
    );
    return { status: 'sent', responseTime };
  } catch (error) {
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(
        `[AI Jobs] Trigger timeout: ${jobId} mode=${triggerMode} (${triggerTimeoutMs}ms)`
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
          message: getTriggerStatusMessage(triggerStatus),
        },
        triggerStatus === 'scheduled' ? 300 : 60
      );

      // Worker dispatch가 완료되지 않으면 원본 Job을 failed로 마킹
      if (triggerStatus !== 'scheduled') {
        const existingJob = await redisGet<AIJob>(`job:${jobId}`);
        if (existingJob && existingJob.status === 'queued') {
          await redisSet(
            `job:${jobId}`,
            {
              ...existingJob,
              status: 'failed' as JobStatus,
              error: getTriggerFailureMessage(triggerStatus),
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

function getTriggerStatusMessage(triggerStatus: TriggerStatus): string {
  switch (triggerStatus) {
    case 'scheduled':
      return 'Worker dispatch scheduled';
    case 'timeout':
      return 'Worker processing timed out';
    case 'skipped':
      return 'Worker target not configured';
    case 'failed':
      return 'Worker request failed';
    default:
      return 'Worker request completed';
  }
}

function getTriggerFailureMessage(triggerStatus: TriggerStatus): string {
  switch (triggerStatus) {
    case 'timeout':
      return 'Worker processing timed out. Please retry.';
    case 'skipped':
      return 'Worker target not configured. Please retry later.';
    default:
      return 'Worker request failed. Please retry.';
  }
}
