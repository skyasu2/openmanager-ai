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
import { executeSupervisorStream, logProviderStatus } from '../services/ai-sdk';

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
