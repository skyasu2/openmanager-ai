/**
 * Confidence normalization shared across routing and evidence resolution.
 *
 * Two thresholds exist by design:
 *   - SEMANTIC_AGENT_CONFIDENCE_THRESHOLD (0.65): agent routing — lower so NLQ
 *     intentFrame results are actually used as the routing primary signal.
 *   - SEMANTIC_EVIDENCE_CONFIDENCE_THRESHOLD (0.80): fail-closed guard — higher
 *     so we only block the LLM path when the semantic frame is highly confident
 *     about the capability, preventing hallucinated answers for ambiguous queries.
 */

/** 0–100 or 0–1 confidence → normalized 0–1. */
export function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value > 1 ? value / 100 : value;
}
