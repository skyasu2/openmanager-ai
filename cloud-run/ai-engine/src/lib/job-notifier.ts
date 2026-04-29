/**
 * Job Notifier Service
 *
 * Stores job results in Redis for async retrieval.
 * Uses Upstash Redis HTTP (no persistent connection needed).
 *
 * Pattern: Store-and-Retrieve (optimized for serverless)
 * - Cloud Run: Stores result with TTL
 * - Vercel: Polls Redis for result (server-side, not client)
 */

import { getRedisClient, redisGet, redisSet, redisDel } from './redis-client';
import { logger } from './logger';
import type { RetrievalMetadata } from './retrieval-contract';

// ============================================================================
// Types
// ============================================================================

export interface JobResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  errorDetails?: {
    kind: 'rate-limit' | 'general';
    message: string;
    source?: 'frontend-gateway' | 'cloud-run-ai' | 'upstream-provider' | 'unknown';
    scope?: 'minute' | 'daily' | 'unknown';
    retryAfterSeconds?: number;
    remaining?: number;
    resetAt?: number;
    dailyLimitExceeded?: boolean;
  };
  targetAgent?: string;
  toolsCalled?: string[];
  toolResults?: unknown[];
  ragSources?: Array<{
    title: string;
    similarity: number;
    sourceType: string;
    category?: string;
  }>;
  metadata?: {
    analysisMode?: 'auto' | 'thinking';
    enableRAG?: boolean;
    enableWebSearch?: boolean | 'auto';
    retrieval?: RetrievalMetadata;
    traceId?: string;
    handoffs?: Array<{ from: string; to: string; reason?: string }>;
    queryAsOf?: unknown;
    provider?: string;
    modelId?: string;
    providerAttempts?: Array<{
      provider: string;
      modelId?: string;
      attempt?: number;
      durationMs?: number;
      error?: string;
    }>;
    usedFallback?: boolean;
    fallbackReason?: string;
    durationMs?: number;
    ttfbMs?: number;
    latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
    resolvedMode?: 'single' | 'multi';
    modeSelectionSource?: string;
    toolResultSummaries?: Array<{
      toolName: string;
      label: string;
      summary: string;
      preview?: string;
      status: 'completed' | 'failed';
    }>;
  };
  startedAt: string;
  completedAt?: string;
  processingTimeMs?: number;
}

interface JobProgress {
  stage: string;
  progress: number; // 0-100
  message?: string;
  agent?: string;
  handoffFrom?: string;
  handoffTo?: string;
  executionPath?: string[];
  handoffCount?: number;
  stageLabel?: string;
  stageDetail?: string;
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const JOB_KEY_PREFIX = 'job:';
const JOB_PROGRESS_PREFIX = 'job:progress:';
const JOB_TTL_SECONDS = 3600; // 1 hour
const PROGRESS_TTL_SECONDS = 600; // 10 minutes

// ============================================================================
// Job Result Operations
// ============================================================================

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function mergeJobMetadata(
  existingJob: Record<string, unknown> | null,
  metadata: JobResult['metadata'] | undefined
): JobResult['metadata'] | undefined {
  const merged = {
    ...readObject(existingJob?.metadata),
    ...readObject(metadata),
  };

  return Object.keys(merged).length > 0
    ? (merged as JobResult['metadata'])
    : undefined;
}

/**
 * Mark job as processing (started)
 * 🎯 Fix: Merge with existing job data to preserve metadata (Stale Closure 방지)
 */
export async function markJobProcessing(jobId: string): Promise<boolean> {
  // Read existing job data to preserve metadata
  const existingJob = await redisGet<Record<string, unknown>>(`${JOB_KEY_PREFIX}${jobId}`);

  const result: JobResult = {
    status: 'processing',
    startedAt: new Date().toISOString(),
  };

  // Merge with existing data (preserve query, sessionId, type, metadata)
  const mergedResult = existingJob
    ? { ...existingJob, ...result }
    : result;

  return redisSet(`${JOB_KEY_PREFIX}${jobId}`, mergedResult, JOB_TTL_SECONDS);
}

/**
 * Store completed job result
 * 🎯 Fix: Merge with existing job data to preserve metadata (query, sessionId, type)
 */
export async function storeJobResult(
  jobId: string,
  response: string,
  options?: {
    targetAgent?: string;
    toolResults?: unknown[];
    ragSources?: Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
    }>;
    startedAt?: string;
    // AI SDK metadata
    toolsCalled?: string[];
    provider?: string;
    modelId?: string;
    metadata?: JobResult['metadata'];
  }
): Promise<boolean> {
  // Read existing job data to preserve metadata
  const existingJob = await redisGet<Record<string, unknown>>(`${JOB_KEY_PREFIX}${jobId}`);

  const startedAt = options?.startedAt || (existingJob?.startedAt as string) || new Date().toISOString();
  const completedAt = new Date().toISOString();
  const processingTimeMs =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();

  const result: JobResult = {
    status: 'completed',
    result: response,
    targetAgent: options?.targetAgent,
    toolsCalled: options?.toolsCalled,
    toolResults: options?.toolResults,
    ragSources: options?.ragSources,
    metadata: mergeJobMetadata(existingJob, options?.metadata),
    startedAt,
    completedAt,
    processingTimeMs,
  };

  // Merge with existing data (preserve query, sessionId, type, metadata)
  const mergedResult = existingJob
    ? { ...existingJob, ...result }
    : result;

  logger.info(
    `[JobNotifier] Storing result for job ${jobId} (${processingTimeMs}ms)`
  );
  return redisSet(`${JOB_KEY_PREFIX}${jobId}`, mergedResult, JOB_TTL_SECONDS);
}

/**
 * Store failed job result
 * 🎯 Fix: Merge with existing job data to preserve metadata (query, sessionId, type)
 */
export async function storeJobError(
  jobId: string,
  error: string,
  startedAt?: string,
  errorDetails?: JobResult['errorDetails']
): Promise<boolean> {
  // Read existing job data to preserve metadata
  const existingJob = await redisGet<Record<string, unknown>>(`${JOB_KEY_PREFIX}${jobId}`);

  const effectiveStartedAt = startedAt || (existingJob?.startedAt as string) || new Date().toISOString();
  const completedAt = new Date().toISOString();
  const processingTimeMs = effectiveStartedAt
    ? new Date(completedAt).getTime() - new Date(effectiveStartedAt).getTime()
    : 0;

  const result: JobResult = {
    status: 'failed',
    error,
    errorDetails,
    startedAt: effectiveStartedAt,
    completedAt,
    processingTimeMs,
  };

  // Merge with existing data (preserve query, sessionId, type, metadata)
  const mergedResult = existingJob
    ? { ...existingJob, ...result }
    : result;

  logger.error(`[JobNotifier] Storing error for job ${jobId}: ${error}`);
  return redisSet(`${JOB_KEY_PREFIX}${jobId}`, mergedResult, JOB_TTL_SECONDS);
}

/**
 * Get job result (for polling)
 */
export async function getJobResult(jobId: string): Promise<JobResult | null> {
  return redisGet<JobResult>(`${JOB_KEY_PREFIX}${jobId}`);
}

/**
 * Delete job result (cleanup after retrieval)
 */
export async function deleteJobResult(jobId: string): Promise<boolean> {
  return redisDel(`${JOB_KEY_PREFIX}${jobId}`);
}

// ============================================================================
// Job Progress Operations (Optional - for UI progress bar)
// ============================================================================

/**
 * Update job progress (for UI feedback)
 */
export async function updateJobProgress(
  jobId: string,
  stage: string,
  progress: number,
  message?: string,
  metadata?: Omit<JobProgress, 'stage' | 'progress' | 'message' | 'updatedAt'>
): Promise<boolean> {
  const progressData: JobProgress = {
    stage,
    progress: Math.min(100, Math.max(0, progress)),
    message,
    ...(metadata ?? {}),
    updatedAt: new Date().toISOString(),
  };

  return redisSet(
    `${JOB_PROGRESS_PREFIX}${jobId}`,
    progressData,
    PROGRESS_TTL_SECONDS
  );
}

/**
 * Get job progress
 */
export async function getJobProgress(
  jobId: string
): Promise<JobProgress | null> {
  return redisGet<JobProgress>(`${JOB_PROGRESS_PREFIX}${jobId}`);
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if Redis is available for job notifications
 */
export function isJobNotifierAvailable(): boolean {
  return getRedisClient() !== null;
}
