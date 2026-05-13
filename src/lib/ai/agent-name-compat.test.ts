import { describe, expect, it } from 'vitest';
import {
  LEGACY_NLQ_AGENT_NAME,
  METRICS_QUERY_AGENT_NAME,
  normalizeAgentDisplayName,
} from './agent-name-compat';

describe('agent display name compatibility', () => {
  it('normalizes the legacy NLQ Agent display name', () => {
    expect(normalizeAgentDisplayName(LEGACY_NLQ_AGENT_NAME)).toBe(
      METRICS_QUERY_AGENT_NAME
    );
    expect(normalizeAgentDisplayName(METRICS_QUERY_AGENT_NAME)).toBe(
      METRICS_QUERY_AGENT_NAME
    );
  });
});
