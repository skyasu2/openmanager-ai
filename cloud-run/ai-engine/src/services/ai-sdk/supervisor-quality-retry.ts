import type { SupervisorResponse } from './supervisor-types';
import type { IntentCategory } from './supervisor-routing';

const QUALITY_RETRY_FLAGS = new Set(['EMPTY_RESPONSE', 'NO_OUTPUT']);

/**
 * Decide whether single-agent execution should retry with a different provider
 * based on response quality metadata.
 */
export function shouldRetryForQuality(
  result: SupervisorResponse,
  queryIntent: IntentCategory
): boolean {
  if (queryIntent === 'general') {
    return false;
  }

  const flags = result.metadata.qualityFlags ?? [];
  if (flags.length === 0) {
    return false;
  }

  if (flags.some((flag) => QUALITY_RETRY_FLAGS.has(flag))) {
    return true;
  }

  const hasMeaningfulContent =
    result.response.trim().length >= 60 || result.toolsCalled.length > 0;
  if (!hasMeaningfulContent && flags.includes('TOO_SHORT')) {
    return true;
  }

  return false;
}

