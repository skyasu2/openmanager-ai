import {
  getFunctionTimeoutReserveMs,
  getMaxTimeout,
  getRouteMaxExecutionMs,
} from '@/config/ai-proxy.config';

const SUPERVISOR_STREAM_ROUTE_MAX_DURATION_SECONDS = 60;
const WARMUP_SIGNAL_MAX_AGE_MS = 10 * 60 * 1000; // 10분
const STREAM_SOFT_TARGET_TIMEOUT_MS = 50_000;
const STREAM_COLD_START_FIRST_ATTEMPT_TIMEOUT_MS = 45_000;
const STREAM_COLD_START_RETRY_TIMEOUT_MS = 18_000;

export function getSupervisorStreamRequestTimeoutMs(): number {
  const routeBudgetMs = getRouteMaxExecutionMs(
    SUPERVISOR_STREAM_ROUTE_MAX_DURATION_SECONDS
  );
  return Math.max(0, routeBudgetMs - getFunctionTimeoutReserveMs());
}

export function isWarmupAwareFirstQuery(
  warmupStartedAt: number | null,
  isFirstQuery: boolean
): boolean {
  if (!isFirstQuery || !warmupStartedAt) return false;
  const elapsed = Date.now() - warmupStartedAt;
  return elapsed >= 0 && elapsed <= WARMUP_SIGNAL_MAX_AGE_MS;
}

export function getSupervisorStreamAbortTimeoutMs(options?: {
  isFirstQuery?: boolean;
  warmupStartedAt?: number | null;
}): number {
  const isFirstWarmupQuery = isWarmupAwareFirstQuery(
    options?.warmupStartedAt ?? null,
    options?.isFirstQuery === true
  );
  const targetTimeout = isFirstWarmupQuery
    ? STREAM_COLD_START_FIRST_ATTEMPT_TIMEOUT_MS
    : STREAM_SOFT_TARGET_TIMEOUT_MS;

  return Math.max(
    0,
    Math.min(
      targetTimeout,
      getMaxTimeout('supervisor'),
      getSupervisorStreamRequestTimeoutMs()
    )
  );
}

export function getSupervisorStreamRetryTimeoutMs(
  primaryTimeoutMs: number
): number | null {
  const remainingBudgetMs = Math.max(
    0,
    getSupervisorStreamRequestTimeoutMs() - primaryTimeoutMs
  );
  const retryTimeoutMs = Math.min(
    STREAM_COLD_START_RETRY_TIMEOUT_MS,
    getMaxTimeout('supervisor'),
    remainingBudgetMs
  );

  return retryTimeoutMs > 0 ? retryTimeoutMs : null;
}

export function parseWarmupStartedAt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export function parseOptionalDurationHeader(
  value: string | null
): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed);
}
