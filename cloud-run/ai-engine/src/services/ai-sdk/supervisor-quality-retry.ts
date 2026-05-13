import type { SupervisorResponse } from './supervisor-types';
import type { IntentCategory } from '../../domains/monitoring/routing-policy';

const QUALITY_RETRY_FLAGS = new Set(['EMPTY_RESPONSE', 'NO_OUTPUT']);

// Advisor responses missing code blocks should retry once with explicit format enforcement.
// MISSING_COMMAND_BLOCK means the LLM returned prose-only — a retry with prompt reinforcement
// has a reasonable chance of producing the required backtick code block.
const ADVISOR_FORMAT_RETRY_FLAGS = new Set(['MISSING_COMMAND_BLOCK']);
const ADVISOR_FORMAT_RETRY_SUPPRESS_FLAGS = new Set(['LATENCY_SLOW', 'LATENCY_VERY_SLOW']);

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
  if (flags.includes('no_provider')) {
    return false;
  }

  if (result.toolsCalled.length === 0) {
    return true;
  }

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

  // Advisor-specific: retry when format compliance fails due to missing code block.
  // metadata.finalAgent carries the executing agent name; formatCompliance=false means
  // a required pattern (e.g. backtick code block) was absent in the response.
  // Only trigger when the agent actually produced content — empty responses are already
  // handled by EMPTY_RESPONSE above.
  if (
    result.metadata.finalAgent === 'Advisor Agent' &&
    result.metadata.formatCompliance === false &&
    flags.some((flag) => ADVISOR_FORMAT_RETRY_FLAGS.has(flag)) &&
    !flags.some((flag) => ADVISOR_FORMAT_RETRY_SUPPRESS_FLAGS.has(flag)) &&
    result.response.trim().length > 0
  ) {
    return true;
  }

  return false;
}

/**
 * Build a retry prefix message that reinforces the Advisor format requirement.
 * Prepended to the user query on the retry attempt so the LLM sees the enforcement
 * instruction at the start of the conversation.
 */
export function buildAdvisorFormatRetryPrefix(): string {
  return '[RETRY] 이전 응답에 코드 블록이 누락되었습니다. 반드시 진단/조치/검증 명령어를 `코드 블록` 형태로 포함하세요. ';
}
