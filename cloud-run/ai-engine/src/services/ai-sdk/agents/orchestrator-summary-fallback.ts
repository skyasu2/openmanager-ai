import {
  classifyQueryIntent,
  shouldPreferDeterministic,
} from './orchestrator-query-intent';
import {
  buildMetricRankingFromPayload,
  buildMetricThresholdFilterFromPayload,
} from './orchestrator-summary-metric';
import {
  buildExplicitServerOperationalAnswer,
  buildSummaryFromPayloadForQuery,
  isExplicitServerOperationalQuery,
  isStatusAlertOperationalQuery,
} from './orchestrator-summary-operational';
import {
  buildSummaryPayloadFromCurrentState,
  getMetricsPayload,
  getPayloadServerEvidenceCount,
  type CollectedToolResult,
  type MetricsToolPayload,
} from './orchestrator-summary-payload';
import { isServiceCommandGuidanceQuery } from '../../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';

export { classifyQueryIntent, shouldPreferDeterministic };

/**
 * Determines whether to prefer deterministic (LLM-free) response for this
 * query, based on structural intent classification and tool result completeness.
 *
 * Replaces the previous env-specific regex approach with parseable
 * intent + metric metadata.
 */
export function isDeterministicSummaryQuery(
  query: string,
  _agentName: string,
  toolResultServerCount = 0
): boolean {
  if (isServiceCommandGuidanceQuery(query)) {
    return false;
  }

  if (
    toolResultServerCount > 0 &&
    (isStatusAlertOperationalQuery(query) ||
      isExplicitServerOperationalQuery(query))
  ) {
    return true;
  }

  const classification = classifyQueryIntent(query);
  return shouldPreferDeterministic(classification, toolResultServerCount);
}

function buildDeterministicAnswerFromPayload(
  query: string,
  payload: MetricsToolPayload,
  lookupPayload?: MetricsToolPayload | null
): string {
  const explicitServerAnswer = buildExplicitServerOperationalAnswer(
    query,
    payload,
    lookupPayload
  );
  if (explicitServerAnswer) {
    return explicitServerAnswer;
  }

  const classification = classifyQueryIntent(query);

  if (classification.intent === 'data-filter') {
    const metricFilterAnswer = buildMetricThresholdFilterFromPayload(
      payload,
      classification
    );
    if (metricFilterAnswer) {
      return metricFilterAnswer;
    }
  }

  if (classification.intent === 'data-ranking') {
    const metricRankingAnswer = buildMetricRankingFromPayload(payload, classification);
    if (metricRankingAnswer) {
      return metricRankingAnswer;
    }
  }

  return buildSummaryFromPayloadForQuery(query, payload);
}

// Deterministic fallback avoids another LLM call when metrics data is already available.
export function buildDeterministicSummaryFallback(
  query: string,
  agentName: string,
  toolResults: CollectedToolResult[],
  stateData?: unknown
): string | null {
  const payload = getMetricsPayload(toolResults);
  if (!payload) {
    return null;
  }
  const lookupPayload = buildSummaryPayloadFromCurrentState(stateData);

  if (!isDeterministicSummaryQuery(query, agentName, getPayloadServerEvidenceCount(payload))) {
    return null;
  }

  return buildDeterministicAnswerFromPayload(query, payload, lookupPayload);
}

// Final fallback for summary prompts when model emits no text and skips all tool calls.
export function buildDeterministicSummaryFromCurrentState(
  query: string,
  agentName: string,
  stateData?: unknown
): string | null {
  const payload = buildSummaryPayloadFromCurrentState(stateData);
  if (!payload) {
    return null;
  }

  if (!isDeterministicSummaryQuery(query, agentName, getPayloadServerEvidenceCount(payload))) {
    return null;
  }

  return buildDeterministicAnswerFromPayload(query, payload, payload);
}
