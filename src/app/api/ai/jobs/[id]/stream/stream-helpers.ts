/**
 * AI Job Stream helpers — constants, types, and pure utility functions.
 * Extracted from route.ts to keep the route handler focused.
 */

import {
  getFunctionTimeoutReserveMs,
  getRouteMaxExecutionMs,
} from '@/config/ai-proxy.config';
import { getRedisTimeoutMs } from '@/config/redis-timeouts';
import type { RedisJobProgress } from '@/types/ai-jobs';

// ============================================================================
// Types
// ============================================================================

export interface JobResult {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'queued';
  result?: string;
  error?: string;
  errorDetails?: {
    kind: 'rate-limit' | 'general';
    message: string;
    source?:
      | 'frontend-gateway'
      | 'cloud-run-ai'
      | 'upstream-provider'
      | 'unknown';
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
    traceId?: string;
    handoffs?: Array<{ from: string; to: string; reason?: string }>;
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

export type ActiveJobStatus = Extract<
  JobResult['status'],
  'pending' | 'processing' | 'queued'
>;

// ============================================================================
// Constants
// ============================================================================

const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 5000;
const JOB_STREAM_ROUTE_MAX_DURATION_SECONDS = 60;

export const ACTIVE_POLL_INTERVAL_MS = getPollIntervalFromEnv(
  'AI_JOB_STREAM_POLL_INTERVAL_MS',
  1000
);
export const QUEUED_POLL_INTERVAL_MS = getPollIntervalFromEnv(
  'AI_JOB_STREAM_QUEUED_POLL_INTERVAL_MS',
  2000
);
export const getJobStreamMaxWaitTimeMs = (): number => {
  const routeBudgetMs = getRouteMaxExecutionMs(
    JOB_STREAM_ROUTE_MAX_DURATION_SECONDS
  );
  return Math.max(
    1000,
    Math.max(0, routeBudgetMs - getFunctionTimeoutReserveMs())
  );
};

export const REDIS_TIMEOUT_MS = getRedisTimeoutMs('standard');
export const PROGRESS_INTERVAL_MS = 2000;

export const DEFAULT_STAGE_BY_STATUS: Record<ActiveJobStatus, string> = {
  queued: 'init',
  pending: 'initializing',
  processing: 'processing',
};
export const DEFAULT_PROGRESS_BY_STATUS: Record<ActiveJobStatus, number> = {
  queued: 0,
  pending: 5,
  processing: 15,
};
export const DEFAULT_MESSAGE_BY_STATUS: Record<ActiveJobStatus, string> = {
  queued: '요청 대기열에 추가됨...',
  pending: 'AI 에이전트 초기화 중...',
  processing: 'AI 에이전트 처리 중...',
};
export const DEFAULT_PROGRESS_BY_STAGE: Record<string, number> = {
  init: 0,
  initializing: 5,
  routing: 20,
  analyzing: 35,
  processing: 60,
  supervisor: 55,
  nlq: 60,
  analyst: 70,
  reporter: 80,
  finalizing: 95,
  retrying: 0,
  reconnecting: 0,
};
export const DEFAULT_MESSAGE_BY_STAGE: Record<string, string> = {
  init: '요청 대기열에 추가됨...',
  initializing: 'AI 에이전트 초기화 중...',
  routing: 'Supervisor가 적절한 에이전트 선택 중...',
  analyzing: '쿼리 분석 중...',
  processing: 'AI 에이전트 처리 중...',
  supervisor: 'Supervisor 분석 중...',
  nlq: 'NLQ Agent가 자연어 쿼리 처리 중...',
  analyst: 'Analyst Agent가 패턴 분석 중...',
  reporter: 'Reporter Agent가 보고서 생성 중...',
  finalizing: '응답 완료 처리 중...',
  retrying: '재시도 중...',
  reconnecting: '재연결 중...',
};

// ============================================================================
// Utility functions
// ============================================================================

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

export function getPollIntervalByStatus(
  status: JobResult['status'] | null | undefined
): number {
  if (status === 'queued' || status === 'pending') {
    return QUEUED_POLL_INTERVAL_MS;
  }
  return ACTIVE_POLL_INTERVAL_MS;
}

export function isTerminalStatus(
  status: JobResult['status'] | null | undefined
): boolean {
  return status === 'completed' || status === 'failed';
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProgressValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => getNonEmptyString(item))
    .filter((item): item is string => item !== null);
  return items.length > 0 ? items : null;
}

export function buildProgressEventData({
  jobId,
  status,
  progressState,
  elapsedMs,
}: {
  jobId: string;
  status: ActiveJobStatus;
  progressState: RedisJobProgress | null;
  elapsedMs: number;
}) {
  const stage =
    getNonEmptyString(progressState?.stage) ?? DEFAULT_STAGE_BY_STATUS[status];
  const progress =
    normalizeProgressValue(progressState?.progress) ??
    DEFAULT_PROGRESS_BY_STAGE[stage] ??
    DEFAULT_PROGRESS_BY_STATUS[status];
  const message =
    getNonEmptyString(progressState?.message) ??
    DEFAULT_MESSAGE_BY_STAGE[stage] ??
    DEFAULT_MESSAGE_BY_STATUS[status];

  return {
    jobId,
    status,
    progress,
    stage,
    message,
    elapsedMs,
    ...(getNonEmptyString(progressState?.agent) && {
      agent: getNonEmptyString(progressState?.agent),
    }),
    ...(getNonEmptyString(progressState?.handoffFrom) && {
      handoffFrom: getNonEmptyString(progressState?.handoffFrom),
    }),
    ...(getNonEmptyString(progressState?.handoffTo) && {
      handoffTo: getNonEmptyString(progressState?.handoffTo),
    }),
    ...(normalizeStringArray(progressState?.executionPath) && {
      executionPath: normalizeStringArray(progressState?.executionPath),
    }),
    ...(typeof progressState?.handoffCount === 'number' &&
      Number.isFinite(progressState.handoffCount) && {
        handoffCount: Math.max(0, Math.round(progressState.handoffCount)),
      }),
    ...(getNonEmptyString(progressState?.stageLabel) && {
      stageLabel: getNonEmptyString(progressState?.stageLabel),
    }),
    ...(getNonEmptyString(progressState?.stageDetail) && {
      stageDetail: getNonEmptyString(progressState?.stageDetail),
    }),
  };
}

export async function sleepWithAbort(
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
