/**
 * Jobs Route Handler
 *
 * Handles async job processing for AI queries.
 * This route is called by Vercel API to offload long-running AI tasks.
 *
 * Flow:
 * 1. Vercel creates job in Supabase, returns jobId immediately
 * 2. Vercel calls this endpoint (fire-and-forget or webhook style)
 * 3. This route processes the query via AI SDK Supervisor
 * 4. Result is stored in Redis for SSE retrieval
 *
 * @updated 2025-12-28 - Migrated from LangGraph to AI SDK
 */

import type { Context } from 'hono';
import { Hono } from 'hono';

import { getPublicErrorResponse, handleApiError } from '../lib/error-handler';
import { logger } from '../lib/logger';
import { logAPIKeyStatus, validateAPIKeys } from '../lib/model-config';
import {
  markJobProcessing,
  storeJobResult,
  storeJobError,
  getJobResult,
  updateJobProgress,
  isJobNotifierAvailable,
} from '../lib/job-notifier';
import { executeSupervisorStream, logProviderStatus } from '../services/ai-sdk';

// ============================================================================
// Jobs Router
// ============================================================================

export const jobsRouter = new Hono();

type JobStreamHandoff = { from: string; to: string; reason?: string };

type JobProgressMetadata = {
  agent?: string;
  handoffFrom?: string;
  handoffTo?: string;
  executionPath?: string[];
  handoffCount?: number;
  stageLabel?: string;
  stageDetail?: string;
};

type JobErrorDetails = {
  kind: 'rate-limit' | 'general';
  message: string;
  source?: 'frontend-gateway' | 'cloud-run-ai' | 'upstream-provider' | 'unknown';
  scope?: 'minute' | 'daily' | 'unknown';
  retryAfterSeconds?: number;
  remaining?: number;
  resetAt?: number;
  dailyLimitExceeded?: boolean;
};

const AGENT_STAGE_MAP: Record<string, string> = {
  Orchestrator: 'routing',
  supervisor: 'routing',
  'NLQ Agent': 'nlq',
  nlq: 'nlq',
  'Analyst Agent': 'analyst',
  analyst: 'analyst',
  'Reporter Agent': 'reporter',
  reporter: 'reporter',
  'Advisor Agent': 'processing',
  advisor: 'processing',
  'Vision Agent': 'processing',
  vision: 'processing',
};

const AGENT_ROLE_LABELS: Record<string, string> = {
  Orchestrator: '분석 조율',
  supervisor: '분석 조율',
  'NLQ Agent': '자연어 분석',
  nlq: '자연어 분석',
  'Analyst Agent': '심층 분석',
  analyst: '심층 분석',
  'Reporter Agent': '보고서 생성',
  reporter: '보고서 생성',
  'Advisor Agent': '운영 어드바이저',
  advisor: '운영 어드바이저',
  'Vision Agent': '시각 분석',
  vision: '시각 분석',
};

const STAGE_PROGRESS_MAP: Record<string, number> = {
  initializing: 10,
  routing: 20,
  nlq: 40,
  analyst: 60,
  processing: 60,
  reporter: 80,
  finalizing: 90,
  completed: 100,
};

const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'too many requests',
  'too many',
  'quota',
  '요청 제한',
  '요청이 너무 많',
  '일일 요청 제한',
  '오늘 한도',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return undefined;
}

function isRateLimitSource(
  value: unknown
): value is NonNullable<JobErrorDetails['source']> {
  return (
    value === 'frontend-gateway' ||
    value === 'cloud-run-ai' ||
    value === 'upstream-provider' ||
    value === 'unknown'
  );
}

function isRateLimitScope(
  value: unknown
): value is NonNullable<JobErrorDetails['scope']> {
  return value === 'minute' || value === 'daily' || value === 'unknown';
}

function inferRateLimitSourceFromMessage(
  message: string
): NonNullable<JobErrorDetails['source']> {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('cloud run') ||
    normalized.includes('cloud-run') ||
    normalized.includes('ai 엔진')
  ) {
    return 'cloud-run-ai';
  }

  if (
    normalized.includes('provider') ||
    normalized.includes('openai') ||
    normalized.includes('anthropic') ||
    normalized.includes('gemini')
  ) {
    return 'upstream-provider';
  }

  if (
    normalized.includes('gateway') ||
    normalized.includes('frontend') ||
    normalized.includes('api route')
  ) {
    return 'frontend-gateway';
  }

  return 'unknown';
}

function normalizeJobErrorDetails(value: unknown): JobErrorDetails | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.kind === 'general' && typeof value.message === 'string') {
    return {
      kind: 'general',
      message: value.message,
    };
  }

  const message =
    getStringValue(value.message) ?? getStringValue(value.error) ?? undefined;
  const retryAfterSeconds =
    getNumberValue(value.retryAfterSeconds) ?? getNumberValue(value.retryAfter);
  const remaining = getNumberValue(value.remaining);
  const resetAt = getNumberValue(value.resetAt);
  const dailyLimitExceeded = value.dailyLimitExceeded === true;
  const scope = isRateLimitScope(value.scope)
    ? value.scope
    : isRateLimitScope(value.limitScope)
      ? value.limitScope
      : dailyLimitExceeded
        ? 'daily'
        : undefined;
  const source = isRateLimitSource(value.source) ? value.source : undefined;

  const looksRateLimited =
    value.kind === 'rate-limit' ||
    RATE_LIMIT_PATTERNS.some((pattern) =>
      (message ?? '').toLowerCase().includes(pattern)
    ) ||
    retryAfterSeconds !== undefined ||
    remaining !== undefined ||
    resetAt !== undefined ||
    source !== undefined ||
    scope !== undefined ||
    dailyLimitExceeded;

  if (looksRateLimited) {
    return {
      kind: 'rate-limit',
      message:
        message ??
        (dailyLimitExceeded
          ? '오늘 AI 요청 한도가 소진되었습니다. 내일 다시 시도해주세요.'
          : retryAfterSeconds
            ? `요청이 너무 많습니다. ${retryAfterSeconds}초 후 다시 시도해주세요.`
            : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'),
      ...(source && { source }),
      ...(scope && { scope }),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(remaining !== undefined && { remaining }),
      ...(resetAt !== undefined && { resetAt }),
      ...(dailyLimitExceeded && { dailyLimitExceeded }),
    };
  }

  if (message) {
    return {
      kind: 'general',
      message,
    };
  }

  return undefined;
}

function extractJobErrorDetails(
  error: unknown,
  publicMessage: string
): JobErrorDetails | undefined {
  if (isRecord(error) && 'details' in error) {
    const details = normalizeJobErrorDetails(error.details);
    if (details) {
      return details.kind === 'rate-limit'
        ? details
        : { kind: 'general', message: publicMessage };
    }
  }

  const payloadDetails = normalizeJobErrorDetails(error);
  if (payloadDetails?.kind === 'rate-limit') {
    return payloadDetails;
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : isRecord(error)
        ? getStringValue(error.message) ?? getStringValue(error.error)
        : undefined;

  const looksRateLimited =
    rawMessage != null &&
    RATE_LIMIT_PATTERNS.some((pattern) =>
      rawMessage.toLowerCase().includes(pattern)
    );

  if (looksRateLimited && rawMessage) {
    const errorRecord = isRecord(error) ? error : null;
    const retryAfterSeconds = getNumberValue(
      errorRecord ? errorRecord.retryAfterSeconds ?? errorRecord.retryAfter : undefined
    );
    const remaining = getNumberValue(errorRecord ? errorRecord.remaining : undefined);
    const resetAt = getNumberValue(errorRecord ? errorRecord.resetAt : undefined);
    const scope = isRateLimitScope(errorRecord ? errorRecord.scope : undefined)
      ? (errorRecord?.scope as NonNullable<JobErrorDetails['scope']>)
      : undefined;

    return {
      kind: 'rate-limit',
      message: rawMessage,
      source: inferRateLimitSourceFromMessage(rawMessage),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(remaining !== undefined && { remaining }),
      ...(resetAt !== undefined && { resetAt }),
      ...(scope && { scope }),
    };
  }

  return {
    kind: 'general',
    message: publicMessage,
  };
}

function getAgentLabel(agent: string): string {
  return AGENT_ROLE_LABELS[agent] ?? agent;
}

function resolveAgentStage(agent?: string): string {
  if (!agent) return 'processing';
  return AGENT_STAGE_MAP[agent] ?? 'processing';
}

function appendExecutionPath(path: string[], ...agents: Array<string | undefined>) {
  for (const agent of agents) {
    if (!agent) continue;
    if (path[path.length - 1] !== agent) {
      path.push(agent);
    }
  }
}

function buildStageDetail(path: string[], handoff?: JobStreamHandoff): string | undefined {
  if (handoff) {
    return `${getAgentLabel(handoff.from)} → ${getAgentLabel(handoff.to)}`;
  }

  if (path.length === 0) {
    return undefined;
  }

  return path.map(getAgentLabel).join(' → ');
}

function buildProgressMetadata({
  executionPath,
  handoffs,
  agent,
  handoff,
}: {
  executionPath: string[];
  handoffs: JobStreamHandoff[];
  agent?: string;
  handoff?: JobStreamHandoff;
}): JobProgressMetadata {
  return {
    ...(agent && { agent }),
    ...(handoff && {
      handoffFrom: handoff.from,
      handoffTo: handoff.to,
    }),
    ...(executionPath.length > 0 && { executionPath: [...executionPath] }),
    ...(handoffs.length > 0 && { handoffCount: handoffs.length }),
    ...(agent && { stageLabel: getAgentLabel(agent) }),
    ...(buildStageDetail(executionPath, handoff) && {
      stageDetail: buildStageDetail(executionPath, handoff),
    }),
  };
}

function parseHandoffEvent(value: unknown): JobStreamHandoff | null {
  if (!isRecord(value)) return null;
  const from = getStringValue(value.from);
  const to = getStringValue(value.to);
  if (!from || !to) return null;
  return {
    from,
    to,
    ...(getStringValue(value.reason) && { reason: getStringValue(value.reason) }),
  };
}

function parseAgentStatusEvent(
  value: unknown
): { agent: string; status?: string; message?: string } | null {
  if (!isRecord(value)) return null;
  const agent = getStringValue(value.agent);
  if (!agent) return null;
  return {
    agent,
    ...(getStringValue(value.status) && { status: getStringValue(value.status) }),
    ...(getStringValue(value.message) && { message: getStringValue(value.message) }),
  };
}

/**
 * POST /api/jobs/process
 *
 * Process an AI job within the request lifecycle.
 * Called by Vercel after creating a job record.
 *
 * Request:
 * {
 *   jobId: string,        // UUID from Supabase ai_jobs table
 *   messages: Message[],  // Chat messages
 *   sessionId?: string    // Optional session for conversation context
 * }
 *
 * Response:
 * { success: true, jobId, status: 'completed' | 'failed' }
 *
 * The final job result is stored in Redis for SSE retrieval before returning.
 */
jobsRouter.post('/process', async (c: Context) => {
  const startTime = Date.now();

  try {
    const { jobId, messages, sessionId } = await c.req.json();

    // Validate request
    if (!jobId) {
      return c.json({ success: false, error: 'jobId is required' }, 400);
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { success: false, error: 'messages array is required' },
        400
      );
    }

    // Check Redis availability
    if (!isJobNotifierAvailable()) {
      logger.warn('[Jobs] Redis not available, falling back to sync mode');
      // In sync mode, we still process but can't store result
      // This is a degraded mode, client should use direct API
      return c.json(
        {
          success: false,
          error: 'Redis not available for async job processing',
          fallback: 'Use /api/ai/supervisor directly',
        },
        503
      );
    }

    // Check API Keys
    const { all } = validateAPIKeys();
    if (!all) {
      logAPIKeyStatus();
    }

    // Mark job as processing
    await markJobProcessing(jobId);
    await updateJobProgress(jobId, 'initializing', 10, 'AI 에이전트 초기화 중...');

    logger.info(`[Jobs] Processing job ${jobId}`);

    // Extract query from last user message
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage?.content;

    if (!query) {
      await storeJobError(jobId, 'No query content in messages');
      return c.json({ success: false, error: 'No query in messages' }, 400);
    }

    const outcome = await processJobSynchronously({
      jobId,
      messages,
      sessionId,
      startTime,
    });

    return c.json(
      {
        success: outcome.status === 'completed',
        jobId,
        status: outcome.status,
        ...(outcome.error && { error: outcome.error }),
      },
      200
    );
  } catch (error) {
    return handleApiError(c, error, 'Jobs');
  }
});

async function processJobSynchronously({
  jobId,
  messages,
  sessionId,
  startTime,
}: {
  jobId: string;
  messages: Array<{ role: string; content: string }>;
  sessionId?: string;
  startTime: number;
}): Promise<{ status: 'completed' | 'failed'; error?: string }> {
  const startedAt = new Date().toISOString();

  try {
    await updateJobProgress(
      jobId,
      'routing',
      20,
      'Supervisor가 적절한 에이전트 선택 중...',
      buildProgressMetadata({
        executionPath: ['Orchestrator'],
        handoffs: [],
        agent: 'Orchestrator',
      })
    );

    logProviderStatus();

    await updateJobProgress(
      jobId,
      'processing',
      50,
      'AI 에이전트가 응답 생성 중...',
      buildProgressMetadata({
        executionPath: ['Orchestrator'],
        handoffs: [],
        agent: 'Orchestrator',
      })
    );

    const responseChunks: string[] = [];
    const executionPath: string[] = ['Orchestrator'];
    const handoffs: JobStreamHandoff[] = [];
    const toolsCalled: string[] = [];
    const toolResults: Array<{ toolName?: string; result?: unknown }> = [];
    let ragSources: Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
    }> = [];
    let finalAgent: string | undefined;
    let traceId: string | undefined;
    let toolResultSummaries:
      | Array<{
          toolName: string;
          label: string;
          summary: string;
          preview?: string;
          status: 'completed' | 'failed';
        }>
      | undefined;
    let completedSuccessfully = false;

    for await (const event of executeSupervisorStream({
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      sessionId: sessionId || 'default',
    })) {
      if (event.type === 'text_delta' && typeof event.data === 'string') {
        responseChunks.push(event.data);
        continue;
      }

      if (event.type === 'tool_call' && isRecord(event.data)) {
        const toolName =
          getStringValue(event.data.name) ?? getStringValue(event.data.toolName);
        if (toolName) {
          toolsCalled.push(toolName);
        }
        continue;
      }

      if (event.type === 'tool_result' && isRecord(event.data)) {
        toolResults.push({
          ...(getStringValue(event.data.toolName) && {
            toolName: getStringValue(event.data.toolName),
          }),
          result: event.data.result,
        });
        continue;
      }

      if (event.type === 'agent_status') {
        const agentStatus = parseAgentStatusEvent(event.data);
        if (!agentStatus) continue;

        appendExecutionPath(executionPath, agentStatus.agent);
        const stage = resolveAgentStage(agentStatus.agent);
        await updateJobProgress(
          jobId,
          stage,
          STAGE_PROGRESS_MAP[stage] ?? 60,
          agentStatus.message ?? `${getAgentLabel(agentStatus.agent)} 처리 중...`,
          buildProgressMetadata({
            executionPath,
            handoffs,
            agent: agentStatus.agent,
          })
        );
        continue;
      }

      if (event.type === 'handoff') {
        const handoff = parseHandoffEvent(event.data);
        if (!handoff) continue;

        handoffs.push(handoff);
        appendExecutionPath(executionPath, handoff.from, handoff.to);
        const stage = resolveAgentStage(handoff.to);
        await updateJobProgress(
          jobId,
          stage,
          STAGE_PROGRESS_MAP[stage] ?? 60,
          `${getAgentLabel(handoff.to)}로 전달 중...`,
          buildProgressMetadata({
            executionPath,
            handoffs,
            agent: handoff.to,
            handoff,
          })
        );
        continue;
      }

      if (event.type === 'error') {
        const errorData = isRecord(event.data) ? event.data : {};
        const streamError = new Error(
          getStringValue(errorData.message) ??
            getStringValue(errorData.error) ??
            'Unknown error'
      );
        const errorDetails = normalizeJobErrorDetails(errorData);
        if (errorDetails?.kind === 'rate-limit') {
          (
            streamError as Error & {
              details?: JobErrorDetails;
            }
          ).details = errorDetails;
        }
        throw streamError;
      }

      if (event.type === 'done') {
        const doneData = isRecord(event.data) ? event.data : {};
        const metadata = isRecord(doneData.metadata) ? doneData.metadata : {};
        if (doneData.success === false) {
          const warning = isRecord(doneData.warning) ? doneData.warning : {};
          throw new Error(
            getStringValue(warning.message) ??
              'AI processing did not complete successfully'
          );
        }

        finalAgent =
          getStringValue(doneData.finalAgent) ??
          getStringValue(metadata.finalAgent) ??
          finalAgent;
        if (finalAgent) {
          appendExecutionPath(executionPath, finalAgent);
        }

        if (Array.isArray(metadata.handoffs)) {
          for (const item of metadata.handoffs) {
            const handoff = parseHandoffEvent(item);
            if (!handoff) continue;
            const exists = handoffs.some(
              (current) =>
                current.from === handoff.from &&
                current.to === handoff.to &&
                current.reason === handoff.reason
            );
            if (!exists) {
              handoffs.push(handoff);
            }
            appendExecutionPath(executionPath, handoff.from, handoff.to);
          }
        }

        if (Array.isArray(doneData.toolsCalled)) {
          toolsCalled.push(
            ...doneData.toolsCalled.filter(
              (tool): tool is string =>
                typeof tool === 'string' && tool.trim().length > 0
            )
          );
        }

        if (Array.isArray(doneData.ragSources)) {
          ragSources = doneData.ragSources as typeof ragSources;
        }

        traceId = getStringValue(metadata.traceId) ?? traceId;
        toolResultSummaries = Array.isArray(metadata.toolResultSummaries)
          ? (metadata.toolResultSummaries as typeof toolResultSummaries)
          : toolResultSummaries;

        await updateJobProgress(
          jobId,
          'finalizing',
          90,
          '응답 완료 처리 중...',
          buildProgressMetadata({
            executionPath,
            handoffs,
            agent: finalAgent,
          })
        );

        completedSuccessfully = true;
      }
    }

    if (!completedSuccessfully) {
      throw new Error('Job stream ended without a completion event');
    }

    await updateJobProgress(
      jobId,
      'completed',
      100,
      '완료',
      buildProgressMetadata({
        executionPath,
        handoffs,
        agent: finalAgent,
      })
    );
    await storeJobResult(jobId, responseChunks.join(''), {
      targetAgent: finalAgent,
      toolResults,
      toolsCalled,
      ragSources,
      metadata: {
        ...(traceId && { traceId }),
        ...(handoffs.length > 0 && { handoffs }),
        ...(toolResultSummaries && toolResultSummaries.length > 0 && {
          toolResultSummaries,
        }),
      },
      startedAt,
    });

    const processingTime = Date.now() - startTime;
    logger.info(
      `[Jobs] Job ${jobId} completed in ${processingTime}ms (finalAgent: ${finalAgent ?? 'unknown'})`
    );

    return { status: 'completed' };
  } catch (error) {
    const publicError = getPublicErrorResponse(error);
    const errorDetails = extractJobErrorDetails(error, publicError.message);
    const failureMessage =
      errorDetails?.kind === 'rate-limit'
        ? errorDetails.message
        : publicError.message;
    logger.error(
      { err: error, code: publicError.code },
      `[Jobs] Job ${jobId} failed`
    );
    await storeJobError(jobId, failureMessage, startedAt, errorDetails);
    return { status: 'failed', error: failureMessage };
  }
}

/**
 * GET /api/jobs/:id
 *
 * Get job result from Redis.
 * Used by Vercel SSE endpoint to poll for completion.
 */
jobsRouter.get('/:id', async (c: Context) => {
  const jobId = c.req.param('id');

  if (!jobId) {
    return c.json({ success: false, error: 'jobId is required' }, 400);
  }

  const result = await getJobResult(jobId);

  if (!result) {
    return c.json({
      success: false,
      error: 'Job not found or expired',
      jobId,
    }, 404);
  }

  return c.json({
    success: true,
    jobId,
    ...result,
  });
});

/**
 * GET /api/jobs/:id/progress
 *
 * Get job progress for UI feedback.
 */
jobsRouter.get('/:id/progress', async (c: Context) => {
  const jobId = c.req.param('id');

  if (!jobId) {
    return c.json({ success: false, error: 'jobId is required' }, 400);
  }

  const result = await getJobResult(jobId);

  // If job is completed or failed, return that status
  if (result && (result.status === 'completed' || result.status === 'failed')) {
    return c.json({
      success: true,
      jobId,
      status: result.status,
      progress: 100,
      stage: result.status,
      completedAt: result.completedAt,
      processingTimeMs: result.processingTimeMs,
    });
  }

  // Otherwise return in-progress status
  const { getJobProgress } = await import('../lib/job-notifier.js');
  const progress = await getJobProgress(jobId);

  if (!progress && !result) {
    return c.json({
      success: false,
      error: 'Job not found',
      jobId,
    }, 404);
  }

  return c.json({
    success: true,
    jobId,
    status: result?.status || 'processing',
    progress: progress?.progress || 0,
    stage: progress?.stage || 'unknown',
    message: progress?.message,
    updatedAt: progress?.updatedAt,
  });
});

// Note: extractTextFromStream removed - AI SDK returns text directly
