import type { ProviderAttempt } from '../../resilience/retry-with-fallback';
import type { ProviderAttemptTelemetry } from './orchestrator-types';

export function toProviderAttemptTelemetry(
  attempts: ProviderAttempt[]
): ProviderAttemptTelemetry[] {
  return attempts.map((attempt) => ({
    provider: attempt.provider,
    modelId: attempt.modelId,
    attempt: attempt.attempt,
    durationMs: attempt.durationMs,
    ...(attempt.error ? { error: attempt.error } : {}),
  }));
}

export function resolveFallbackReason(
  attempts: ProviderAttempt[],
  usedFallback: boolean
): string | undefined {
  if (!usedFallback) {
    return undefined;
  }

  const failedAttempt = attempts.find((attempt) => attempt.error);
  if (!failedAttempt) {
    return 'provider_fallback';
  }

  const normalizedError = failedAttempt.error?.toLowerCase() ?? '';
  if (normalizedError.includes('rate limit') || normalizedError.includes('429')) {
    return 'rate_limit';
  }
  if (normalizedError.includes('timeout')) {
    return 'timeout';
  }
  if (
    normalizedError.includes('missing required capabilities') ||
    normalizedError.includes('tool-calling') ||
    normalizedError.includes('structured-output')
  ) {
    return 'capability_mismatch';
  }
  if (
    normalizedError.includes('does not exist') ||
    normalizedError.includes('no access') ||
    normalizedError.includes('model not found') ||
    normalizedError.includes('404')
  ) {
    return 'model_unavailable';
  }
  if (
    normalizedError.includes('unavailable') ||
    normalizedError.includes('503') ||
    normalizedError.includes('502') ||
    normalizedError.includes('504')
  ) {
    return 'provider_unavailable';
  }

  return 'provider_error';
}
