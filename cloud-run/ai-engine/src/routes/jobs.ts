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

import {
  CloudTasksPayloadTooLargeError,
  enqueueCloudTask,
  getCloudTasksConfig,
} from '../lib/cloud-tasks';
import { getPublicErrorResponse, handleApiError } from '../lib/error-handler';
import { logger } from '../lib/logger';
import { logAPIKeyStatus, validateAPIKeys } from '../lib/model-config';
import { createErrorResponse, ErrorCodes } from '../types/api-response';
import { RATE_LIMIT_IDENTITY_HEADER } from '../middleware/rate-limiter';
import type { RetrievalMetadata } from '../lib/retrieval-contract';
import {
  markJobProcessing,
  storeJobResult,
  storeJobError,
  getJobResult,
  updateJobProgress,
  isJobNotifierAvailable,
} from '../lib/job-notifier';
import {
  type JobErrorDetails,
  type JobStreamHandoff,
  STAGE_PROGRESS_MAP,
  appendExecutionPath,
  buildProgressMetadata,
  extractJobErrorDetails,
  getAgentLabel,
  getStringValue,
  isRecord,
  normalizeJobErrorDetails,
  parseAgentStatusEvent,
  parseHandoffEvent,
  resolveAgentStage,
} from './jobs-route-helpers';
import {
  buildJobProcessTargetUrl,
  extractJobProcessQueryAsOf,
  extractJobProcessToolOptions,
  isRecentProcessingJob,
} from './jobs-request-contract';
import {
  extractProviderMetadata,
  type JobProviderMetadata,
  parseRetrievalMetadata,
} from './jobs-result-metadata';
import { executeSupervisorStream, logProviderStatus } from '../services/ai-sdk';
import {
  normalizeSemanticQueryTrace,
  type SemanticQueryTrace,
} from '../services/ai-sdk/supervisor-semantic-metadata';
import { getDefaultMonitoringAssistantRuntimeHost } from '../services/ai-sdk/monitoring-runtime-host';
import type {
  AnalysisMode,
  SupervisorRequest,
} from '../services/ai-sdk/supervisor-types';
import {
  runWithQueryAsOf,
  type QueryAsOf,
} from '../data/query-as-of-context';

// ============================================================================
// Jobs Router
// ============================================================================

export const jobsRouter = new Hono();

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
    const payload = (await c.req.json()) as Record<string, unknown>;
    const { jobId, messages, sessionId } = payload;
    const toolOptions = extractJobProcessToolOptions(payload);
    const queryAsOf = extractJobProcessQueryAsOf(payload);
    const jobIdValue = typeof jobId === 'string' ? jobId.trim() : '';

    // Validate request
    if (!jobIdValue) {
      return c.json({ success: false, error: 'jobId is required' }, 400);
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { success: false, error: 'messages array is required' },
        400
      );
    }
    const jobMessages = messages as Array<{ role: string; content: string }>;
    const sessionIdValue =
      typeof sessionId === 'string' ? sessionId : undefined;

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

    const existingJob = await getJobResult(jobIdValue);
    const existingStatus =
      typeof existingJob?.status === 'string' ? existingJob.status : undefined;
    if (existingStatus === 'completed') {
      logger.info(
        `[Jobs] Duplicate process delivery ignored for completed job ${jobIdValue}`
      );
      return c.json(
        {
          success: true,
          jobId: jobIdValue,
          status: 'completed',
          duplicate: true,
        },
        200
      );
    }

    if (
      existingStatus === 'processing' &&
      isRecentProcessingJob(existingJob?.startedAt)
    ) {
      logger.info(
        `[Jobs] Duplicate process delivery ignored for active job ${jobIdValue}`
      );
      return c.json(
        {
          success: true,
          jobId: jobIdValue,
          status: 'processing',
          duplicate: true,
        },
        202
      );
    }

    // Check API Keys
    const { all } = validateAPIKeys();
    if (!all) {
      logAPIKeyStatus();
    }

    // Mark job as processing
    await markJobProcessing(jobIdValue);
    await updateJobProgress(
      jobIdValue,
      'initializing',
      10,
      'AI 에이전트 초기화 중...'
    );

    logger.info(`[Jobs] Processing job ${jobIdValue}`);

    // Extract query from last user message
    const lastMessage = jobMessages[jobMessages.length - 1];
    const query = lastMessage?.content;

    if (!query) {
      await storeJobError(jobIdValue, 'No query content in messages');
      return c.json({ success: false, error: 'No query in messages' }, 400);
    }

    const outcome = await runWithQueryAsOf(queryAsOf, () =>
      processJobSynchronously({
        jobId: jobIdValue,
        messages: jobMessages,
        sessionId: sessionIdValue,
        ...toolOptions,
        queryAsOf,
        startTime,
      })
    );

    return c.json(
      {
        success: outcome.status === 'completed',
        jobId: jobIdValue,
        status: outcome.status,
        ...(outcome.error && { error: outcome.error }),
      },
      200
    );
  } catch (error) {
    return handleApiError(c, error, 'Jobs');
  }
});

/**
 * POST /api/jobs/dispatch
 *
 * Enqueue a Cloud Tasks HTTP task that will call /api/jobs/process.
 * This keeps Vercel's job creation request short while the long AI work runs
 * in a Cloud Tasks-managed Cloud Run request.
 */
jobsRouter.post('/dispatch', async (c: Context) => {
  try {
    const payload = (await c.req.json()) as Record<string, unknown>;
    const { jobId, messages } = payload;

    if (typeof jobId !== 'string' || jobId.trim().length === 0) {
      return c.json({ success: false, error: 'jobId is required' }, 400);
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { success: false, error: 'messages array is required' },
        400
      );
    }

    if (!isJobNotifierAvailable()) {
      return c.json(
        {
          success: false,
          error: 'Redis not available for async job processing',
          fallback: 'Use /api/ai/supervisor directly',
        },
        503
      );
    }

    const cloudTasksConfig = getCloudTasksConfig();
    if (!cloudTasksConfig.ok) {
      logger.warn(`[Jobs] Cloud Tasks dispatch unavailable: ${cloudTasksConfig.message}`);
      return c.json(
        {
          success: false,
          error: cloudTasksConfig.message,
          code: cloudTasksConfig.code,
        },
        503
      );
    }

    await updateJobProgress(
      jobId,
      'queued',
      8,
      'Cloud Tasks에 작업 등록 중...'
    );

    const targetUrl = buildJobProcessTargetUrl(
      c.req.url,
      c.req.header('x-forwarded-proto')
    );
    const rateLimitIdentity = c.req.header(RATE_LIMIT_IDENTITY_HEADER)?.trim();
    const task = await enqueueCloudTask({
      config: cloudTasksConfig,
      targetUrl,
      payload,
      headers: {
        ...(rateLimitIdentity && {
          [RATE_LIMIT_IDENTITY_HEADER]: rateLimitIdentity,
        }),
      },
    });

    await updateJobProgress(
      jobId,
      'queued',
      10,
      'Cloud Tasks 작업 등록 완료'
    );

    logger.info(
      `[Jobs] Dispatched job ${jobId} via Cloud Tasks (${task.name ?? 'unnamed-task'})`
    );

    return c.json(
      {
        success: true,
        jobId,
        status: 'queued',
        dispatchMode: 'cloud-tasks',
        taskName: task.name,
      },
      202
    );
  } catch (error) {
    if (error instanceof CloudTasksPayloadTooLargeError) {
      logger.warn(
        `[Jobs] Cloud Tasks payload too large: ${error.payloadBytes}/${error.maxBytes} bytes`
      );
      return c.json(
        createErrorResponse(
          'Cloud Tasks payload too large',
          ErrorCodes.PAYLOAD_TOO_LARGE,
          {
            payloadBytes: error.payloadBytes,
            maxBytes: error.maxBytes,
          }
        ),
        413
      );
    }

    return handleApiError(c, error, 'Jobs dispatch');
  }
});

async function processJobSynchronously({
  jobId,
  messages,
  sessionId,
  analysisMode,
  enableRAG,
  enableWebSearch,
  internalDisclosureMode,
  localRouteDecision,
  metadata,
  queryAsOf,
  startTime,
}: {
  jobId: string;
  messages: Array<{ role: string; content: string }>;
  sessionId?: string;
  analysisMode?: AnalysisMode;
  enableRAG?: SupervisorRequest['enableRAG'];
  enableWebSearch?: SupervisorRequest['enableWebSearch'];
  internalDisclosureMode?: SupervisorRequest['internalDisclosureMode'];
  localRouteDecision?: SupervisorRequest['localRouteDecision'];
  metadata?: SupervisorRequest['metadata'];
  queryAsOf?: QueryAsOf;
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
    let retrieval: RetrievalMetadata | undefined;
    let routeDecision: unknown;
    let assistantPlan: unknown;
    let assistantResult: unknown;
    let semanticQueryTrace: SemanticQueryTrace | undefined;
    let providerMetadata: JobProviderMetadata = {};
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
      analysisMode,
      enableRAG,
      enableWebSearch,
      internalDisclosureMode,
      localRouteDecision,
      metadata,
      queryAsOf,
      runtimeHost: getDefaultMonitoringAssistantRuntimeHost(),
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
        retrieval = parseRetrievalMetadata(metadata.retrieval) ?? retrieval;
        routeDecision = metadata.routeDecision ?? routeDecision;
        assistantPlan = metadata.assistantPlan ?? assistantPlan;
        assistantResult = metadata.assistantResult ?? assistantResult;
        semanticQueryTrace =
          normalizeSemanticQueryTrace(metadata.semanticQueryTrace) ??
          semanticQueryTrace;
        providerMetadata = {
          ...providerMetadata,
          ...extractProviderMetadata(metadata),
        };
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
        ...(analysisMode && { analysisMode }),
        ...(typeof enableRAG === 'boolean' && { enableRAG }),
        ...(enableWebSearch !== undefined && { enableWebSearch }),
        ...(localRouteDecision && { localRouteDecision }),
        ...(queryAsOf && { queryAsOf }),
        ...(retrieval && { retrieval }),
        ...(traceId && { traceId }),
        ...(routeDecision !== undefined && { routeDecision }),
        ...(assistantPlan !== undefined && { assistantPlan }),
        ...(assistantResult !== undefined && { assistantResult }),
        ...(semanticQueryTrace && { semanticQueryTrace }),
        ...providerMetadata,
        handoffs,
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
